require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

function isPrivateHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '127.0.0.1') return true;
  // Basic private IPv4 blocks
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function extractJsonObjectAfterMarker(text, marker) {
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
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Gemini API proxy endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.0-flash-exp' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${error}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Advanced Gemini API endpoint (with custom body)
app.post('/api/gemini/custom', async (req, res) => {
  try {
    const { model = 'gemini-2.0-flash-exp', body } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${error}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check whether a YouTube video is playable + embeddable
app.get('/api/youtube/check', async (req, res) => {
  try {
    const videoId = String(req.query.videoId || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ ok: false, reason: 'Invalid videoId format' });
    }

    const ua = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    // 1) oEmbed is a lightweight existence/publicness check
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const oembedResp = await fetch(oembedUrl, { method: 'GET', headers: ua });
    if (!oembedResp.ok) {
      return res.status(200).json({ ok: false, reason: `oEmbed ${oembedResp.status}` });
    }
    const oembed = await oembedResp.json().catch(() => ({}));
    const title = oembed?.title || '';

    // 2) Check embed page for common "unavailable" signals
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const embedResp = await fetch(embedUrl, { method: 'GET', headers: ua });
    if (!embedResp.ok) {
      return res.status(200).json({ ok: false, title, reason: `Embed HTTP ${embedResp.status}` });
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
    const blocked = blockedPhrases.some(p => lower.includes(p));
    if (blocked) {
      return res.status(200).json({ ok: false, title, reason: 'Video unavailable or embedding disabled' });
    }

    // 3) Fallback to playerResponse parse for extra certainty (best-effort)
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
          const reason = player?.playabilityStatus?.reason || player?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText;

          const ok = status === 'OK' && playableInEmbed !== false;
          return res.status(200).json({
            ok,
            status: status || 'UNKNOWN',
            embeddable: playableInEmbed !== false,
            title: player?.videoDetails?.title || title,
            reason: ok ? '' : (reason || 'Video not playable or not embeddable'),
          });
        }
      }
    } catch (_) {
      // ignore
    }

    // If we got here, embed page looked OK and oEmbed succeeded
    return res.status(200).json({ ok: true, status: 'OK', embeddable: true, title, reason: '' });
  } catch (error) {
    console.error('YouTube check error:', error);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// Lightweight YouTube search (no API key). Returns candidate video IDs from YouTube search results.
app.get('/api/youtube/search', async (req, res) => {
  try {
    const query = String(req.query.query || req.query.q || '').trim();
    const max = Math.max(1, Math.min(30, Number(req.query.max || 15) || 15));

    if (!query) {
      return res.status(400).json({ ok: false, reason: 'Missing query' });
    }
    if (query.length > 200) {
      return res.status(400).json({ ok: false, reason: 'Query too long' });
    }

    const ua = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const resp = await fetch(searchUrl, { method: 'GET', headers: ua });
    if (!resp.ok) {
      return res.status(200).json({ ok: false, query, reason: `HTTP ${resp.status}`, videoIds: [] });
    }

    const html = await resp.text();
    const ids = [];
    const seen = new Set();
    const re = /watch\?v=([a-zA-Z0-9_-]{11})/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
        if (ids.length >= max) break;
      }
    }

    return res.status(200).json({ ok: ids.length > 0, query, videoIds: ids });
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(500).json({ ok: false, reason: error.message, videoIds: [] });
  }
});

// Check whether an article URL is reachable and likely readable (not SSRF/private)
app.get('/api/url/check', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) return res.status(400).json({ ok: false, reason: 'Missing url' });

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return res.status(400).json({ ok: false, reason: 'Invalid url' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ ok: false, reason: 'Unsupported protocol' });
    }

    // Block obvious placeholder domains (prevents "Example Domain" issue)
    const blockedDomains = new Set(['example.com', 'example.org', 'example.net']);
    if (blockedDomains.has(String(parsed.hostname || '').toLowerCase())) {
      return res.status(200).json({ ok: false, status: 200, contentType: 'text/html', finalUrl: parsed.toString(), reason: 'Blocked placeholder domain' });
    }

    if (isPrivateHostname(parsed.hostname)) {
      return res.status(400).json({ ok: false, reason: 'Blocked hostname' });
    }

    const looksLikeSoft404 = (htmlSnippet) => {
      if (!htmlSnippet) return false;
      const s = String(htmlSnippet).toLowerCase();
      const patterns = [
        'page not found',
        'error 404',
        '404 not found',
        'the page you are looking for',
        'does not exist',
        'this blog post does not exist',
        "we can't find the page",
        "we can’t find the page",
        '>404<',
        'status code 404',
      ];
      return patterns.some((p) => s.includes(p));
    };

    // Use HEAD as a quick probe, but always fetch a small HTML snippet via GET
    // to detect soft-404 pages (200 HTML with "page not found" content).
    let headResp = await fetch(parsed.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneOriginHub/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    // If HEAD is not allowed or errors, we still proceed with GET-range.
    if (headResp.status === 405) {
      // keep headResp but ignore
    }

    const resp = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneOriginHub/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Range': 'bytes=0-4095',
      },
    });

    const contentType = resp.headers.get('content-type') || '';
    const statusOk = resp.status >= 200 && resp.status < 400;
    const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType);

    let snippet = '';
    if (statusOk && isHtml) {
      try {
        snippet = await resp.text();
      } catch (_) {
        snippet = '';
      }
    }

    const ok = statusOk && isHtml && !looksLikeSoft404(snippet);
    const reason = ok
      ? undefined
      : (!statusOk ? 'http_status' : (!isHtml ? 'non_html' : 'soft_404'));

    res.status(200).json({
      ok,
      status: resp.status,
      contentType,
      finalUrl: resp.url,
      reason,
      headStatus: headResp?.status,
    });
  } catch (error) {
    console.error('URL check error:', error);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api/`);
  console.log(`🌐 Network access enabled (listening on all interfaces)`);
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log(`✅ GEMINI_API_KEY loaded: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  } else {
    console.log(`❌ GEMINI_API_KEY not found! Check your .env file`);
  }
  console.log('');
});
