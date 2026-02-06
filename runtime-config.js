// Runtime config loader (no secrets committed)
// Loads Firebase config from backend: GET /api/runtime-config
//
// The Firebase API key is *not* a secret in client apps, but we avoid committing it
// to public repos. Configure via environment variables on the backend.

(function () {
  function normalizeBaseUrl(base) {
    return String(base || '').replace(/\/+$/, '');
  }

  function isLocalLikeHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
  }

  function getConfigUrlCandidates() {
    // Prefer same-origin (Vercel/prod).
    const sameOrigin = '/api/runtime-config';

    // Local dev fallback: if page is served by Live Server (e.g. http://127.0.0.1:5500)
    // the API is usually on http://localhost:3000.
    const localhostApi = 'http://localhost:3000/api/runtime-config';

    // Optional override for debugging: ?apiBase=http://localhost:3000
    let override = null;
    try {
      const u = new URL(globalThis.location?.href || '');
      const apiBase = u.searchParams.get('apiBase');
      if (apiBase) override = `${normalizeBaseUrl(apiBase)}/api/runtime-config`;
    } catch (_) {
      // ignore
    }

    const out = [];
    if (override) out.push(override);
    out.push(sameOrigin);

    // Only add localhost fallback when it makes sense.
    const host = globalThis.location?.hostname;
    if (!isLocalLikeHost(host)) {
      // When hosted on a real domain, don't try localhost.
      return out;
    }
    out.push(localhostApi);
    return out;
  }

  async function fetchRuntimeConfig() {
    const candidates = getConfigUrlCandidates();
    let lastError = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
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
          throw new Error(`Failed to load runtime config from ${url} (${res.status}). ${details}`.trim());
        }

        const data = await res.json();
        const firebase = data && (data.firebase || data.firebaseConfig || data);
        if (!firebase || typeof firebase !== 'object') {
          throw new Error(`Runtime config missing "firebase" object (from ${url})`);
        }
        return firebase;
      } catch (err) {
        lastError = err;
      }
    }

    const hint = (function () {
      const host = globalThis.location?.host || '';
      if (String(host).includes('vercel.app')) {
        return 'On Vercel: set FIREBASE_CONFIG_JSON (or FIREBASE_* vars) in Project Settings → Environment Variables, then redeploy.';
      }
      if (isLocalLikeHost(globalThis.location?.hostname)) {
        return 'Local dev: open the app via http://localhost:3000 (served by server.js), or start the backend on port 3000. If using Live Server, add ?apiBase=http://localhost:3000 to the URL.';
      }
      return 'Ensure /api/runtime-config is reachable and configured.';
    })();

    throw new Error(`${String(lastError?.message || lastError || 'Failed to load runtime config')}\n\n${hint}`);
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
