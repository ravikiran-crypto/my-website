// API Configuration
// Automatically selects a working API base URL.
// - On Vercel: same-origin /api/*
// - On local static hosting (Live Server): prefers http://localhost:3000 (server.js)
let __resolvedApiBaseUrl = null;

function normalizeGeminiModel(model) {
  const raw = String(model || '').trim();
  if (!raw) return 'gemini-2.5-flash';
  const m = raw.toLowerCase();
  if (m === 'gemini-falsh-2.5' || m === 'gemini-flash-2.5') return 'gemini-2.5-flash';
  return raw;
}

async function tryHealth(baseUrl, timeoutMs = 1200) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${base}/api/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(t);
    return !!res && res.ok;
  } catch (_) {
    return false;
  }
}

async function resolveApiBaseUrl() {
  if (__resolvedApiBaseUrl) return __resolvedApiBaseUrl;

  const candidates = [
    window.location.origin,
    'http://localhost:3000',
  ];

  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await tryHealth(c)) {
      __resolvedApiBaseUrl = c;
      return __resolvedApiBaseUrl;
    }
  }

  // Fallback: keep same-origin (may still work on Vercel even without /api/health)
  __resolvedApiBaseUrl = window.location.origin;
  return __resolvedApiBaseUrl;
}

/**
 * Call Gemini API through backend proxy
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} model - The Gemini model to use (default: 'gemini-2.5-flash')
 * @returns {Promise<Object>} - The API response
 */
async function callGeminiAPI(prompt, model = 'gemini-2.5-flash') {
  try {
    const API_BASE_URL = await resolveApiBaseUrl();
    const normalizedModel = normalizeGeminiModel(model);
    const response = await fetch(`${API_BASE_URL}/api/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, model: normalizedModel }),
    });

    if (!response.ok) {
      let msg = 'API request failed';
      try {
        const error = await response.json();
        msg = error?.error || msg;
      } catch (_) {
        try {
          msg = await response.text();
        } catch (_) {
          // ignore
        }
      }

      // Add a helpful local-dev hint for the most common issue.
      if (/404|not found/i.test(String(msg || '')) && window.location.origin.includes('127.0.0.1:')) {
        msg = `${msg}\n\nTip: If you are running via Live Server, start the backend: \"npm install\" then \"npm start\" (server runs on http://localhost:3000).`;
      }
      if (/api key not configured|key not configured/i.test(String(msg || ''))) {
        msg = `${msg}\n\nTip: Set GEMINI_API_KEY in your environment (.env) before starting the server.`;
      }
      throw new Error(msg);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * Call Gemini API with custom request body through backend proxy
 * @param {Object} body - The custom request body for Gemini API
 * @param {string} model - The Gemini model to use (default: 'gemini-2.5-flash')
 * @returns {Promise<Object>} - The API response
 */
async function callGeminiAPICustom(body, model = 'gemini-2.5-flash') {
  try {
    const API_BASE_URL = await resolveApiBaseUrl();
    const normalizedModel = normalizeGeminiModel(model);
    const response = await fetch(`${API_BASE_URL}/api/gemini/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body, model: normalizedModel }),
    });

    if (!response.ok) {
      let msg = 'API request failed';
      try {
        const error = await response.json();
        msg = error?.error || msg;
      } catch (_) {
        try {
          msg = await response.text();
        } catch (_) {
          // ignore
        }
      }
      if (/api key not configured|key not configured/i.test(String(msg || ''))) {
        msg = `${msg}\n\nTip: Set GEMINI_API_KEY in your environment (.env) before starting the server.`;
      }
      throw new Error(msg);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * For Firebase Functions deployment, use these alternative functions:
 * (Uncomment and update YOUR-PROJECT-ID when deploying to Firebase)
 */
/*
const FIREBASE_FUNCTIONS_URL = 'https://YOUR-PROJECT-ID.cloudfunctions.net';

async function callGeminiAPIFirebase(prompt, model = 'gemini-2.5-flash') {
  try {
    const response = await fetch(`${FIREBASE_FUNCTIONS_URL}/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, model }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

async function callGeminiAPICustomFirebase(body, model = 'gemini-2.5-flash') {
  try {
    const response = await fetch(`${FIREBASE_FUNCTIONS_URL}/geminiCustom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body, model }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}
*/
