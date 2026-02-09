// Vercel Serverless Function: Fetch Shorts video IDs from a YouTube channel Shorts page (handle-based)
export default async function handler(req, res) {
  // CORS
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
    res.status(405).json({ ok: false, reason: 'Method not allowed', videoIds: [] });
    return;
  }

  try {
    const handleRaw = String(req.query.handle || req.query.h || '').trim();
    const handle = handleRaw.replace(/^@/, '');
    const max = Math.max(1, Math.min(2000, Number(req.query.max || 1000) || 1000));

    if (!handle) {
      res.status(400).json({ ok: false, reason: 'Missing handle', videoIds: [] });
      return;
    }

    if (!/^[a-zA-Z0-9._-]{2,100}$/.test(handle)) {
      res.status(400).json({ ok: false, reason: 'Invalid handle', videoIds: [] });
      return;
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const url = `https://www.youtube.com/@${encodeURIComponent(handle)}/shorts?hl=en&gl=US`;
    const resp = await fetch(url, { method: 'GET', headers });

    if (!resp.ok) {
      res.status(200).json({ ok: false, handle, reason: `HTTP ${resp.status}`, videoIds: [] });
      return;
    }

    const html = await resp.text();
    const ids = [];
    const seen = new Set();

    // Shorts URLs often appear in embedded JSON with escaped slashes (e.g. \/shorts\/VIDEOID)
    const reShorts = /\\?\/shorts\\?\/([a-zA-Z0-9_-]{11})/g;
    let m;
    while ((m = reShorts.exec(html)) !== null) {
      const id = m[1];
      if (!id) continue;
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
        if (ids.length >= max) break;
      }
    }

    res.status(200).json({ ok: ids.length > 0, handle, videoIds: ids });
  } catch (error) {
    console.error('YouTube channel-shorts error:', error);
    res.status(500).json({ ok: false, reason: error.message, videoIds: [] });
  }
}
