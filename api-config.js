// API Configuration
// Automatically uses the correct API base URL for Vercel deployment
const API_BASE_URL = window.location.origin;

/**
 * Call Gemini API through backend proxy
 * @param {string} prompt - The prompt to send to Gemini
 * @param {string} model - The Gemini model to use (default: 'gemini-2.5-flash')
 * @returns {Promise<Object>} - The API response
 */
async function callGeminiAPI(prompt, model = 'gemini-2.5-flash') {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gemini`, {
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

/**
 * Call Gemini API with custom request body through backend proxy
 * @param {Object} body - The custom request body for Gemini API
 * @param {string} model - The Gemini model to use (default: 'gemini-2.5-flash')
 * @returns {Promise<Object>} - The API response
 */
async function callGeminiAPICustom(body, model = 'gemini-2.5-flash') {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gemini/custom`, {
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
