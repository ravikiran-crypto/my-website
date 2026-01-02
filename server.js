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

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return res.status(200).json({ ok: false, reason: `HTTP ${response.status} from YouTube` });
    }

    const html = await response.text();
    const jsonText =
      extractJsonObjectAfterMarker(html, 'ytInitialPlayerResponse') ||
      extractJsonObjectAfterMarker(html, 'var ytInitialPlayerResponse');

    if (!jsonText) {
      return res.status(200).json({ ok: false, reason: 'Unable to parse YouTube player response' });
    }

    let player;
    try {
      player = JSON.parse(jsonText);
    } catch (e) {
      return res.status(200).json({ ok: false, reason: 'Invalid player JSON' });
    }

    const status = player?.playabilityStatus?.status;
    const playableInEmbed = player?.playabilityStatus?.playableInEmbed;
    const reason = player?.playabilityStatus?.reason || player?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText;
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
    console.error('YouTube check error:', error);
    res.status(500).json({ ok: false, reason: error.message });
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

    if (isPrivateHostname(parsed.hostname)) {
      return res.status(400).json({ ok: false, reason: 'Blocked hostname' });
    }

    // Prefer HEAD but fall back to GET if not allowed
    let resp = await fetch(parsed.toString(), {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneOriginHub/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!resp.ok || resp.status === 405) {
      resp = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OneOriginHub/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Range': 'bytes=0-2048',
        },
      });
    }

    const contentType = resp.headers.get('content-type') || '';
    const ok = resp.status >= 200 && resp.status < 400 && /text\/html|application\/xhtml\+xml/i.test(contentType);

    res.status(200).json({ ok, status: resp.status, contentType, finalUrl: resp.url });
  } catch (error) {
    console.error('URL check error:', error);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on http://192.168.0.200:${PORT}`);
  console.log(`📡 API endpoints available at http://192.168.0.200:${PORT}/api/`);
  console.log(`🌐 Network access enabled - users can connect from other computers`);
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    console.log(`✅ GEMINI_API_KEY loaded: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  } else {
    console.log(`❌ GEMINI_API_KEY not found! Check your .env file`);
  }
  console.log('');
});
