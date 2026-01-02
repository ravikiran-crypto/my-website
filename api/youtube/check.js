export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Content-Type');

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

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      res.status(200).json({ ok: false, reason: `HTTP ${response.status} from YouTube` });
      return;
    }

    const html = await response.text();
    const jsonText =
      extractJsonObjectAfterMarker(html, 'ytInitialPlayerResponse') ||
      extractJsonObjectAfterMarker(html, 'var ytInitialPlayerResponse');

    if (!jsonText) {
      res.status(200).json({ ok: false, reason: 'Unable to parse YouTube player response' });
      return;
    }

    let player;
    try {
      player = JSON.parse(jsonText);
    } catch (e) {
      res.status(200).json({ ok: false, reason: 'Invalid player JSON' });
      return;
    }

    const status = player?.playabilityStatus?.status;
    const playableInEmbed = player?.playabilityStatus?.playableInEmbed;
    const reason =
      player?.playabilityStatus?.reason ||
      player?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText;
    const title = player?.videoDetails?.title || '';

    const ok = status === 'OK' && playableInEmbed !== false;
    res.status(200).json({
      ok,
      status: status || 'UNKNOWN',
      embeddable: playableInEmbed !== false,
      title,
      reason: ok ? '' : (reason || 'Video not playable or not embeddable'),
    });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error?.message || 'Unknown error' });
  }
}
