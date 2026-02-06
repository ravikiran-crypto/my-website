// Runtime config loader (no secrets committed)
// Loads Firebase config from backend: GET /api/runtime-config
//
// The Firebase API key is *not* a secret in client apps, but we avoid committing it
// to public repos. Configure via environment variables on the backend.

(function () {
  const CONFIG_URL = '/api/runtime-config';

  async function fetchRuntimeConfig() {
    const res = await fetch(CONFIG_URL, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      let details = '';
      try { details = await res.text(); } catch (_) {}
      throw new Error(`Failed to load runtime config (${res.status}). ${details}`.trim());
    }

    const data = await res.json();
    const firebase = data && (data.firebase || data.firebaseConfig || data);
    if (!firebase || typeof firebase !== 'object') {
      throw new Error('Runtime config missing "firebase" object');
    }

    return firebase;
  }

  async function ensureFirebaseConfig() {
    if (globalThis.__FIREBASE_CONFIG__ && typeof globalThis.__FIREBASE_CONFIG__ === 'object') {
      return globalThis.__FIREBASE_CONFIG__;
    }

    const firebase = await fetchRuntimeConfig();
    globalThis.__FIREBASE_CONFIG__ = firebase;
    return firebase;
  }

  // Single shared promise to avoid duplicate fetches
  if (!globalThis.__FIREBASE_CONFIG_READY__) {
    globalThis.__FIREBASE_CONFIG_READY__ = ensureFirebaseConfig().catch((err) => {
      console.error('[runtime-config] Failed to load Firebase config:', err);
      throw err;
    });
  }

  globalThis.__getFirebaseConfig = async function () {
    await globalThis.__FIREBASE_CONFIG_READY__;
    return globalThis.__FIREBASE_CONFIG__;
  };
})();
