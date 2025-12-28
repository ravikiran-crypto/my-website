const functions = require('firebase-functions');
const fetch = require('node-fetch');

// Get Gemini API key from Firebase environment config
// Set it using: firebase functions:config:set gemini.api_key="YOUR_API_KEY"
const GEMINI_API_KEY = functions.config().gemini?.api_key;

/**
 * Gemini API Proxy - Simple endpoint
 * POST /gemini
 * Body: { "prompt": "your prompt here", "model": "gemini-2.0-flash-exp" }
 */
exports.gemini = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, model = 'gemini-2.0-flash-exp' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured. Run: firebase functions:config:set gemini.api_key="YOUR_KEY"' 
      });
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
    return res.json(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Gemini API Proxy - Custom body endpoint
 * POST /geminiCustom
 * Body: { "model": "gemini-2.0-flash-exp", "body": { your custom Gemini API body } }
 */
exports.geminiCustom = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model = 'gemini-2.0-flash-exp', body } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Gemini API key not configured. Run: firebase functions:config:set gemini.api_key="YOUR_KEY"' 
      });
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
    return res.json(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return res.status(500).json({ error: error.message });
  }
});
