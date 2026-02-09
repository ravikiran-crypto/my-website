// Vercel Serverless Function: Lightweight YouTube search (no API key)
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
    const query = String(req.query.query || req.query.q || '').trim();
    const max = Math.max(1, Math.min(30, Number(req.query.max || 15) || 15));
    const onlyShorts = String(req.query.onlyShorts || req.query.shortsOnly || '').trim() === '1';

    if (!query) {
      res.status(400).json({ ok: false, reason: 'Missing query', videoIds: [] });
      return;
    }
    if (query.length > 200) {
      res.status(400).json({ ok: false, reason: 'Query too long', videoIds: [] });
      return;
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // When onlyShorts=1 we apply the official YouTube search filter for Shorts.
    // (This still isn't a public API; it's best-effort scraping.)
    const shortsSp = 'EgIYAQ%3D%3D';
    const searchUrl = onlyShorts
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${shortsSp}&hl=en&gl=US`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
    const resp = await fetch(searchUrl, { method: 'GET', headers });

    if (!resp.ok) {
      res.status(200).json({ ok: false, query, reason: `HTTP ${resp.status}`, videoIds: [] });
      return;
    }

    const html = await resp.text();
    const ids = [];
    const seen = new Set();

    // Prefer Shorts links when requested.
    // Shorts URLs often appear in embedded JSON with escaped slashes (e.g. \/shorts\/VIDEOID)
    const reShorts = /\\?\/shorts\\?\/([a-zA-Z0-9_-]{11})/g;
    const reWatch = /watch\?v=([a-zA-Z0-9_-]{11})/g;

    const push = (id) => {
      if (!id) return;
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    };

    let m;
    if (onlyShorts) {
      while ((m = reShorts.exec(html)) !== null) {
        push(m[1]);
        if (ids.length >= max) break;
      }
    } else {
      // Normal search: watch links.
      while ((m = reWatch.exec(html)) !== null) {
        push(m[1]);
        if (ids.length >= max) break;
      }
    }

    res.status(200).json({ ok: ids.length > 0, query, onlyShorts, videoIds: ids });
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ ok: false, reason: error.message, videoIds: [] });
  }
}
