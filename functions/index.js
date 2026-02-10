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
  // Automation / workflows
  'n8n',
];

// Default topic queries to keep the feed aligned to the hub focus.
// Used by the daily scheduler in addition to channel handles.
const DEFAULT_QUICK_SHORT_QUERIES = [
  'llm',
  'agentic ai',
  'prompt engineering',
  'genai',
  'transformers neural network',
  'claude code',
  'n8n automation',
  'react',
  'html',
  'python machine learning',
];

function safeLower(v) {
  return String(v || '').trim().toLowerCase();
}

function ooIsDesiredQuickLearningTitle(title) {
  const t = safeLower(title);
  if (!t) return true; // if missing, don't block

  // Hard blocks: keep the feed technical.
  const blocked = [
    'interview',
    'mock interview',
    'resume',
    'cv',
    'salary',
    'negotiat',
    'hiring',
    'recruit',
    'business idea',
    'startup',
    'side hustle',
    'entrepreneur',
    'marketing',
    'sales',
    'dropshipping',
    'passive income',
    'make money',
    'crypto',
    'real estate',
  ];
  if (blocked.some((k) => t.includes(k))) return false;

  // Allowed topics (user requirement).
  const allowed = [
    'llm',
    'large language model',
    'agentic',
    'agent',
    'agents',
    'prompt engineering',
    'prompt',
    'genai',
    'generative ai',
    'transformer',
    'transformers',
    'neural network',
    'neural networks',
    'deep learning',
    'machine learning',
    'ml',
    'python',
    'react',
    'html',
    'n8n',
    'claude code',
    'claude',
  ];

  // Prevent "AI"-only noise from getting through.
  const weakOnly = ['ai', 'a.i.'];
  if (allowed.some((k) => t.includes(k))) return true;
  if (weakOnly.some((k) => t.includes(k))) return false;
  return false;
}

function deriveUpskillTopic(title) {
  const t = String(title || '').trim().toLowerCase();
  if (!t) return '';

  const rules = [
    { topic: 'Excel', keys: ['excel', 'vlookup', 'pivot', 'pivot table', 'power query'] },
    { topic: 'Power BI', keys: ['power bi', 'powerbi', 'dax'] },
    { topic: 'SQL', keys: ['sql', 'postgres', 'mysql', 'sql server', 'query', 'joins'] },
    { topic: 'Python', keys: ['python', 'pandas', 'numpy'] },
    { topic: 'Web', keys: ['html', 'css', 'web development'] },
    { topic: 'JavaScript', keys: ['javascript', ' js', 'node', 'npm'] },
    { topic: 'TypeScript', keys: ['typescript', ' ts'] },
    { topic: 'React', keys: ['react', 'next.js', 'nextjs'] },
    { topic: 'Automation', keys: ['n8n', 'workflow automation', 'automation workflow'] },
    { topic: 'Cloud', keys: ['aws', 'azure', 'gcp', 'google cloud', 'cloud'] },
    { topic: 'DevOps', keys: ['docker', 'kubernetes', 'k8s', 'ci/cd', 'cicd', 'devops'] },
    { topic: 'Git', keys: ['git', 'github', 'pull request', 'merge'] },
    { topic: 'Security', keys: ['security', 'cyber', 'owasp', 'vulnerability'] },
    {
      topic: 'AI',
      keys: [
        'ai',
        'machine learning',
        'ml',
        'llm',
        'prompt',
        'prompt engineering',
        'transformer',
        'transformers',
        'neural network',
        'deep learning',
        'genai',
        'generative ai',
        'agentic',
        'claude',
      ],
    },
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

async function fetchSearchShortIds(queryText, max = 60) {
  const queryTextTrim = String(queryText || '').trim();
  if (!queryTextTrim) return [];

  // Official Shorts filter parameter (best-effort scraping)
  const shortsSp = 'EgIYAQ%3D%3D';
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    queryTextTrim
  )}&sp=${shortsSp}&hl=en&gl=US`;

  const resp = await fetch(searchUrl, { method: 'GET', headers: UA_HEADERS });
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
  const queries = Array.isArray(srcSnap.data()?.queries) ? srcSnap.data().queries : [];
  // Union configured + defaults so older single-source configs don't block diversification.
  const sources = uniqueHandles([...(handles || []), ...DEFAULT_QUICK_SHORT_HANDLES]);
  const searchQueries = Array.from(
    new Set(
      [...(Array.isArray(queries) ? queries : []), ...DEFAULT_QUICK_SHORT_QUERIES]
        .map((q) => String(q || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 12);

  const startedAtMs = Date.now();
  const added = [];
  const seen = new Set();

  // Pre-fetch IDs per handle and then round-robin for diversity.
  const idsByHandle = new Map();
  for (const handle of sources) {
    const ids = await fetchChannelShortIds(handle, maxPerSource);
    idsByHandle.set(handle, ids);
  }

  const idsByQuery = new Map();
  for (const q of searchQueries) {
    const ids = await fetchSearchShortIds(q, Math.min(120, maxPerSource));
    idsByQuery.set(q, ids);
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

      if (!ooIsDesiredQuickLearningTitle(check.title || '')) continue;

      added.push({ id, handle, title: check.title || '' });
    }

    for (const q of searchQueries) {
      if (added.length >= maxNew) break;
      const ids = idsByQuery.get(q) || [];
      if (!ids.length) continue;
      progressed = true;
      const id = ids.shift();
      idsByQuery.set(q, ids);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      const docRef = db.collection(QUICK_SHORTS_COLLECTION).doc(id);
      const exists = await docRef.get();
      if (exists.exists) continue;

      const check = await checkEmbeddable(id);
      if (!check.ok) continue;
      if (!ooIsDesiredQuickLearningTitle(check.title || '')) continue;

      added.push({ id, handle: `q:${q}`, title: check.title || '' });
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
        embeddable: true,
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
      queriesCount: searchQueries.length,
    },
    { merge: true }
  );

  return { ok: true, committed, sources: sources.length };
}

// Runs daily; requires Cloud Scheduler.
exports.refreshQuickLearningDaily = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    try {
      await refreshQuickShortsFirestore({ maxNew: 40, maxPerSource: 200 });
    } catch (error) {
      console.error('refreshQuickLearningDaily failed:', error);
    }
    return null;
  });
