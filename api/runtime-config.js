// Vercel Serverless Function: runtime config (no secrets committed)
// Returns Firebase config from environment variables.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const firebase = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    };

    const missing = Object.entries(firebase)
      .filter(([_, v]) => !String(v || '').trim())
      .map(([k]) => k);

    if (missing.length) {
      res.status(500).json({ error: `Firebase runtime config not configured (missing: ${missing.join(', ')})` });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ firebase });
  } catch (error) {
    console.error('runtime-config error:', error);
    res.status(500).json({ error: error.message });
  }
}
