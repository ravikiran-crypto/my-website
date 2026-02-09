export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, reason: 'Method not allowed' });
    return;
  }

  const extractJsonObjectAfterMarker = (text, marker) => {
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    const start = text.indexOf('{', idx);
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  };

  try {
    const videoId = String(req.query.videoId || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      res.status(400).json({ ok: false, reason: 'Invalid videoId format' });
      return;
    }

    const ua = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const oembedResp = await fetch(oembedUrl, { method: 'GET', headers: ua });
    if (!oembedResp.ok) {
      res.status(200).json({ ok: false, reason: `oEmbed ${oembedResp.status}` });
      return;
    }
    const oembed = await oembedResp.json().catch(() => ({}));
    const title = oembed?.title || '';
    const authorName = oembed?.author_name || '';
    const authorUrl = oembed?.author_url || '';

    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const embedResp = await fetch(embedUrl, { method: 'GET', headers: ua });
    if (!embedResp.ok) {
      res.status(200).json({ ok: false, title, reason: `Embed HTTP ${embedResp.status}` });
      return;
    }
    const embedHtml = await embedResp.text();
    const lower = embedHtml.toLowerCase();
    const blockedPhrases = [
      'video unavailable',
      'playback on other websites has been disabled',
      'this video is private',
      'sign in to confirm your age',
      'this video is not available',
    ];
    if (blockedPhrases.some(p => lower.includes(p))) {
      res.status(200).json({ ok: false, title, reason: 'Video unavailable or embedding disabled' });
      return;
    }

    // Best-effort parse for extra certainty
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(watchUrl, { method: 'GET', headers: ua });
      if (response.ok) {
        const html = await response.text();
        const jsonText =
          extractJsonObjectAfterMarker(html, 'ytInitialPlayerResponse') ||
          extractJsonObjectAfterMarker(html, 'var ytInitialPlayerResponse');
        if (jsonText) {
          const player = JSON.parse(jsonText);
          const status = player?.playabilityStatus?.status;
          const playableInEmbed = player?.playabilityStatus?.playableInEmbed;
          const reason =
            player?.playabilityStatus?.reason ||
            player?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText;

          const ok = status === 'OK' && playableInEmbed !== false;
          res.status(200).json({
            ok,
            status: status || 'UNKNOWN',
            embeddable: playableInEmbed !== false,
            title: player?.videoDetails?.title || title,
            authorName: authorName || (player?.videoDetails?.author || ''),
            authorUrl,
            reason: ok ? '' : (reason || 'Video not playable or not embeddable'),
          });
          return;
        }
      }
    } catch (_) {
      // ignore
    }

    res.status(200).json({ ok: true, status: 'OK', embeddable: true, title, authorName, authorUrl, reason: '' });
  } catch (error) {
    console.error('YouTube check error:', error);
    res.status(500).json({ ok: false, reason: error?.message || 'Unknown error' });
  }
}
