const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Node 18+ provides global fetch in Cloud Functions runtime.
const fetch = global.fetch;

admin.initializeApp();
const db = admin.firestore();

// Get Gemini API key from Firebase environment config
// Set it using: firebase functions:config:set gemini.api_key="YOUR_API_KEY"
const GEMINI_API_KEY = functions.config().gemini?.api_key;

/**
 * Gemini API Proxy - Simple endpoint
 * POST /gemini
 * Body: { "prompt": "your prompt here", "model": "gemini-2.5-flash" }
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
    const { prompt, model = 'gemini-2.5-flash' } = req.body;

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
 * Body: { "model": "gemini-2.5-flash", "body": { your custom Gemini API body } }
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
    const { model = 'gemini-2.5-flash', body } = req.body;

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

// =====================
// Quick learning: scheduled feed refresh (Firestore-backed)
// =====================

const QUICK_SHORTS_COLLECTION = 'quickShorts';
const QUICK_SHORTS_SOURCES_DOC_PATH = 'config/quickShortsSources';
const QUICK_SHORTS_META_DOC_PATH = 'config/quickShortsMeta';

// Internal defaults (no in-app "Sources" configuration UI).
// Update these handles if you want different channels.
const DEFAULT_QUICK_SHORT_HANDLES = [
  'freecodecamp',
  'GoogleDevelopers',
  'MicrosoftLearn',
  'GoogleCloudTech',
  'awsdevelopers',
  'fireship',
];

function deriveUpskillTopic(title) {
  const t = String(title || '').trim().toLowerCase();
  if (!t) return '';

  const rules = [
    { topic: 'Excel', keys: ['excel', 'vlookup', 'pivot', 'pivot table', 'power query'] },
    { topic: 'Power BI', keys: ['power bi', 'powerbi', 'dax'] },
    { topic: 'SQL', keys: ['sql', 'postgres', 'mysql', 'sql server', 'query', 'joins'] },
    { topic: 'Python', keys: ['python', 'pandas', 'numpy'] },
    { topic: 'JavaScript', keys: ['javascript', ' js', 'node', 'npm'] },
    { topic: 'TypeScript', keys: ['typescript', ' ts'] },
    { topic: 'React', keys: ['react', 'next.js', 'nextjs'] },
    { topic: 'Cloud', keys: ['aws', 'azure', 'gcp', 'google cloud', 'cloud'] },
    { topic: 'DevOps', keys: ['docker', 'kubernetes', 'k8s', 'ci/cd', 'cicd', 'devops'] },
    { topic: 'Git', keys: ['git', 'github', 'pull request', 'merge'] },
    { topic: 'Security', keys: ['security', 'cyber', 'owasp', 'vulnerability'] },
    { topic: 'AI', keys: ['ai', 'machine learning', 'ml', 'llm', 'prompt', 'transformer'] },
    { topic: 'Communication', keys: ['communication', 'presentation', 'writing', 'email'] },
    { topic: 'Leadership', keys: ['leadership', 'management', 'team', 'stakeholder'] },
  ];

  for (const r of rules) {
    if (r.keys.some((k) => t.includes(k))) return r.topic;
  }
  return '';
}

function uniqueHandles(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const h = normalizeHandle(raw);
    if (!h) continue;
    const key = h.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

const UA_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function normalizeHandle(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.replace(/^@/, '').replace(/^https?:\/\//i, '').replace(/\s+/g, '');
}

async function fetchChannelShortIds(handle, max = 200) {
  const h = normalizeHandle(handle);
  if (!h) return [];

  const url = `https://www.youtube.com/@${encodeURIComponent(h)}/shorts`;
  const resp = await fetch(url, { method: 'GET', headers: UA_HEADERS });
  if (!resp.ok) return [];
  const html = await resp.text();

  const out = new Set();
  const patterns = [
    /\/shorts\/([a-zA-Z0-9_-]{11})/g,
    /\\\/shorts\\\/([a-zA-Z0-9_-]{11})/g,
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(html))) {
      out.add(match[1]);
      if (out.size >= max) break;
    }
    if (out.size >= max) break;
  }

  return [...out];
}

async function checkEmbeddable(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return { ok: false };

  // oEmbed is lightweight and yields title.
  let title = '';
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${id}`
    )}&format=json`;
    const oembedResp = await fetch(oembedUrl, { method: 'GET', headers: UA_HEADERS });
    if (oembedResp.ok) {
      const oembed = await oembedResp.json().catch(() => ({}));
      title = oembed?.title || '';
    }
  } catch (_) {}

  try {
    const embedUrl = `https://www.youtube.com/embed/${id}`;
    const embedResp = await fetch(embedUrl, { method: 'GET', headers: UA_HEADERS });
    if (!embedResp.ok) return { ok: false, title };
    const embedHtml = await embedResp.text();
    const lower = embedHtml.toLowerCase();
    const blockedPhrases = [
      'video unavailable',
      'playback on other websites has been disabled',
      'this video is private',
      'sign in to confirm your age',
      'this video is not available',
    ];
    if (blockedPhrases.some((p) => lower.includes(p))) {
      return { ok: false, title };
    }
    return { ok: true, title };
  } catch (_) {
    return { ok: false, title };
  }
}

async function refreshQuickShortsFirestore({ maxNew = 40, maxPerSource = 200 } = {}) {
  const srcSnap = await db.doc(QUICK_SHORTS_SOURCES_DOC_PATH).get();
  const handles = Array.isArray(srcSnap.data()?.handles) ? srcSnap.data().handles : [];
  // Union configured + defaults so older single-source configs don't block diversification.
  const sources = uniqueHandles([...(handles || []), ...DEFAULT_QUICK_SHORT_HANDLES]);

  const startedAtMs = Date.now();
  const added = [];
  const seen = new Set();

  // Pre-fetch IDs per handle and then round-robin for diversity.
  const idsByHandle = new Map();
  for (const handle of sources) {
    const ids = await fetchChannelShortIds(handle, maxPerSource);
    idsByHandle.set(handle, ids);
  }

  let progressed = true;
  while (added.length < maxNew && progressed) {
    progressed = false;
    for (const handle of sources) {
      if (added.length >= maxNew) break;
      const ids = idsByHandle.get(handle) || [];
      if (!ids.length) continue;
      progressed = true;
      const id = ids.shift();
      idsByHandle.set(handle, ids);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const docRef = db.collection(QUICK_SHORTS_COLLECTION).doc(id);
      const exists = await docRef.get();
      if (exists.exists) continue;

      const check = await checkEmbeddable(id);
      if (!check.ok) continue;

      added.push({ id, handle, title: check.title || '' });
    }
  }

  let committed = 0;
  if (added.length) {
    let batch = db.batch();
    let batchCount = 0;
    for (const item of added) {
      const ref = db.collection(QUICK_SHORTS_COLLECTION).doc(item.id);
      batch.set(ref, {
        videoId: item.id,
        title: item.title,
        topic: deriveUpskillTopic(item.title) || '',
        sourceHandle: item.handle,
        addedAtMs: Date.now(),
        addedBy: 'scheduler',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount++;
      if (batchCount >= 450) {
        await batch.commit();
        committed += batchCount;
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount) {
      await batch.commit();
      committed += batchCount;
    }
  }

  await db.doc(QUICK_SHORTS_META_DOC_PATH).set(
    {
      updatedAtMs: Date.now(),
      lastRunAtMs: Date.now(),
      lastRunStartedAtMs: startedAtMs,
      lastRunAddedCount: committed,
      sourcesCount: sources.length,
    },
    { merge: true }
  );

  return { ok: true, committed, sources: sources.length };
}

// Runs daily; requires Cloud Scheduler.
exports.refreshQuickLearningDaily = functions.pubsub
  .schedule('every day 03:00')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      await refreshQuickShortsFirestore({ maxNew: 40, maxPerSource: 200 });
    } catch (error) {
      console.error('refreshQuickLearningDaily failed:', error);
    }
    return null;
  });
