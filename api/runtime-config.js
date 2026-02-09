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
    function readFirstEnv(names) {
      for (const n of names) {
        const v = process.env[n];
        if (String(v || '').trim()) return String(v).trim();
      }
      return '';
    }

    function readJsonEnv(names) {
      const raw = readFirstEnv(names);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {
        return null;
      }
    }

    // Optional: allow a single JSON env var to carry the whole client config.
    // Example value:
    // {"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
    const jsonCfg = readJsonEnv(['FIREBASE_CONFIG_JSON', 'FIREBASE_WEB_CONFIG', 'FIREBASE_CONFIG']);

    const firebase = {
      apiKey: jsonCfg?.apiKey || readFirstEnv(['FIREBASE_API_KEY', 'FIREBASE_APIKEY', 'VITE_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY']),
      authDomain: jsonCfg?.authDomain || readFirstEnv(['FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTHDOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']),
      projectId: jsonCfg?.projectId || readFirstEnv(['FIREBASE_PROJECT_ID', 'FIREBASE_PROJECTID', 'VITE_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID']),
      storageBucket: jsonCfg?.storageBucket || readFirstEnv(['FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGEBUCKET', 'VITE_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET']),
      messagingSenderId: jsonCfg?.messagingSenderId || readFirstEnv(['FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDERID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']),
      appId: jsonCfg?.appId || readFirstEnv(['FIREBASE_APP_ID', 'FIREBASE_APPID', 'VITE_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID']),
    };

    const missing = Object.entries(firebase)
      .filter(([_, v]) => !String(v || '').trim())
      .map(([k]) => k);

    if (missing.length) {
      res.status(500).json({
        error: `Firebase runtime config not configured (missing: ${missing.join(', ')})`,
        hint: 'On Vercel, .env files are NOT used at runtime. Set these as Environment Variables in Vercel Project Settings, for the correct environment (Production/Preview/Development).',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ firebase });
  } catch (error) {
    console.error('runtime-config error:', error);
    res.status(500).json({ error: error.message });
  }
}
