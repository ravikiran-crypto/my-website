// Showcase Forum Storage - Firestore (with localStorage fallback)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js";

const firebaseConfig = await (typeof globalThis.__getFirebaseConfig === 'function'
  ? globalThis.__getFirebaseConfig()
  : (globalThis.__FIREBASE_CONFIG_READY__
      ? globalThis.__FIREBASE_CONFIG_READY__.then(() => globalThis.__FIREBASE_CONFIG__)
      : globalThis.__FIREBASE_CONFIG__));

if (!firebaseConfig || typeof firebaseConfig !== 'object') {
  throw new Error('Firebase config not loaded. Ensure runtime-config.js is included before showcase-storage.js and FIREBASE_* env vars are set on the backend.');
}

const PROJECTS_LS_KEY = "showcaseProjects";
const COMMENTS_LS_KEY = "showcaseComments";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function safeParse(json, fallback) {
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function toIso(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  const t = d.getTime();
  return Number.isFinite(t) ? d.toISOString() : new Date().toISOString();
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((t) => String(t || "").trim())
      .filter(Boolean)
      .map((t) => t.replace(/\s+/g, " "));
  }
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, " "));
}

function normalizeProject(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const id = String(p.id || "").trim() || `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    name: String(p.name || "").trim() || "Untitled Project",
    tagline: String(p.tagline || "").trim() || "",
    description: String(p.description || "").trim() || "",
    demoUrl: String(p.demoUrl || "").trim() || "",
    demoVideoUrl: String(p.demoVideoUrl || "").trim() || "",
    demoVideoStoragePath: String(p.demoVideoStoragePath || "").trim() || "",
    codeUrl: String(p.codeUrl || "").trim() || "",
    codeSnippet: String(p.codeSnippet || "").trim() || "",
    imageUrl: String(p.imageUrl || "").trim() || "",
    tags: normalizeTags(p.tags),
    makerName: String(p.makerName || "").trim() || "Anonymous",
    makerEmail: String(p.makerEmail || "").trim() || "",
    makerId: String(p.makerId || "").trim() || "",
    createdAt: toIso(p.createdAt),
    upvotes: Number.isFinite(Number(p.upvotes)) ? Number(p.upvotes) : 0,
    commentsCount: Number.isFinite(Number(p.commentsCount)) ? Number(p.commentsCount) : 0,
    suggestionsCount: Number.isFinite(Number(p.suggestionsCount)) ? Number(p.suggestionsCount) : 0,
  };
}

function normalizeSuggestion(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const id = String(s.id || "").trim() || `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const toName = String(s.toName || "").trim();
  return {
    id,
    projectId: String(s.projectId || "").trim(),
    projectName: String(s.projectName || "").trim(),
    toName,
    toNameLower: String(s.toNameLower || toName.toLowerCase()).trim(),
    fromName: String(s.fromName || "").trim() || "Anonymous",
    fromEmail: String(s.fromEmail || "").trim() || "",
    fromId: String(s.fromId || "").trim() || "",
    createdAt: toIso(s.createdAt),
  };
}

function normalizeComment(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const id = String(c.id || "").trim() || `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    projectId: String(c.projectId || "").trim(),
    parentId: c.parentId === null || c.parentId === undefined ? null : String(c.parentId || "").trim() || null,
    authorName: String(c.authorName || "").trim() || "Anonymous",
    authorEmail: String(c.authorEmail || "").trim() || "",
    authorId: String(c.authorId || "").trim() || "",
    body: String(c.body || "").trim() || "",
    createdAt: toIso(c.createdAt),
  };
}

function getLocalProjects() {
  const raw = localStorage.getItem(PROJECTS_LS_KEY);
  const arr = safeParse(raw || "[]", []);
  return Array.isArray(arr) ? arr.map(normalizeProject) : [];
}

function setLocalProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_LS_KEY, JSON.stringify(projects.map(normalizeProject)));
  } catch {
    // ignore
  }
}

function getLocalComments() {
  const raw = localStorage.getItem(COMMENTS_LS_KEY);
  const arr = safeParse(raw || "[]", []);
  return Array.isArray(arr) ? arr.map(normalizeComment) : [];
}

function setLocalComments(comments) {
  try {
    localStorage.setItem(COMMENTS_LS_KEY, JSON.stringify(comments.map(normalizeComment)));
  } catch {
    // ignore
  }
}

export async function getShowcaseProjects() {
  try {
    const col = collection(db, "showcaseProjects");
    const snap = await getDocs(col);
    const projects = snap.docs.map((d) => normalizeProject({ id: d.id, ...(d.data() || {}) }));

    // Keep local in sync (and normalize legacy)
    setLocalProjects(projects);
    return projects;
  } catch (error) {
    console.error("getShowcaseProjects failed; using localStorage", error);
    return getLocalProjects();
  }
}

export async function addShowcaseProject(project) {
  const normalized = normalizeProject(project);

  // Local-first for instant UI
  const local = getLocalProjects();
  const next = [normalized, ...local.filter((p) => p.id !== normalized.id)];
  setLocalProjects(next);

  try {
    await setDoc(doc(db, "showcaseProjects", normalized.id), normalized, { merge: true });
  } catch (error) {
    console.error("addShowcaseProject Firestore failed; kept local", error);
  }

  return normalized;
}

export async function updateShowcaseProject(projectId, patch) {
  const id = String(projectId || "").trim();
  if (!id) throw new Error("Missing projectId");

  const local = getLocalProjects();
  const idx = local.findIndex((p) => p.id === id);
  const updated = normalizeProject({ ...(idx >= 0 ? local[idx] : { id }), ...(patch || {}) });
  const next = idx >= 0 ? [...local.slice(0, idx), updated, ...local.slice(idx + 1)] : [updated, ...local];
  setLocalProjects(next);

  try {
    await updateDoc(doc(db, "showcaseProjects", id), patch || {});
  } catch (error) {
    // updateDoc fails if doc missing; setDoc merge is safer fallback
    console.warn("updateShowcaseProject updateDoc failed; trying setDoc merge", error);
    try {
      await setDoc(doc(db, "showcaseProjects", id), patch || {}, { merge: true });
    } catch (e2) {
      console.error("updateShowcaseProject Firestore failed; kept local", e2);
    }
  }

  return updated;
}

async function deleteAllByProjectId(collectionName, projectId) {
  const pid = String(projectId || "").trim();
  if (!pid) return 0;

  const q = query(collection(db, collectionName), where("projectId", "==", pid));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  let deleted = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const d of snap.docs) {
    batch.delete(d.ref);
    deleted += 1;
    ops += 1;
    // Firestore batch hard limit is 500 ops; keep a buffer
    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  return deleted;
}

export async function deleteShowcaseProject(projectId) {
  const pid = String(projectId || "").trim();
  if (!pid) throw new Error("Missing projectId");

  // Local-first (instant UI)
  const localProjects = getLocalProjects();
  const existing = localProjects.find((p) => p.id === pid) || null;
  setLocalProjects(localProjects.filter((p) => p.id !== pid));
  setLocalComments(getLocalComments().filter((c) => c.projectId !== pid));

  // Firestore (best-effort; keep local changes even if remote fails)
  try {
    await deleteAllByProjectId("showcaseComments", pid);
  } catch (e) {
    console.warn("deleteShowcaseProject: failed deleting comments", e);
  }

  try {
    await deleteAllByProjectId("showcaseSuggestions", pid);
  } catch (e) {
    console.warn("deleteShowcaseProject: failed deleting suggestions", e);
  }

  try {
    await deleteDoc(doc(db, "showcaseProjects", pid));
  } catch (e) {
    console.warn("deleteShowcaseProject: failed deleting project doc", e);
  }

  // Storage (optional)
  const storagePath = String(existing?.demoVideoStoragePath || "").trim();
  if (storagePath) {
    try {
      await deleteObject(storageRef(storage, storagePath));
    } catch (e) {
      console.warn("deleteShowcaseProject: failed deleting demo video object", e);
    }
  }
}

export async function getShowcaseCommentsByProject(projectId) {
  const pid = String(projectId || "").trim();
  if (!pid) return [];

  try {
    const q = query(collection(db, "showcaseComments"), where("projectId", "==", pid));
    const snap = await getDocs(q);
    const comments = snap.docs.map((d) => normalizeComment({ id: d.id, ...(d.data() || {}) }));

    // Merge into local cache
    const local = getLocalComments().filter((c) => c.projectId !== pid);
    setLocalComments([...local, ...comments]);

    return comments;
  } catch (error) {
    console.error("getShowcaseCommentsByProject failed; using localStorage", error);
    return getLocalComments().filter((c) => c.projectId === pid);
  }
}

export async function addShowcaseComment(comment) {
  const normalized = normalizeComment(comment);
  if (!normalized.projectId) throw new Error("Missing projectId on comment");

  // Local-first
  const local = getLocalComments();
  const next = [...local.filter((c) => c.id !== normalized.id), normalized];
  setLocalComments(next);

  try {
    await setDoc(doc(db, "showcaseComments", normalized.id), normalized, { merge: true });
  } catch (error) {
    console.error("addShowcaseComment Firestore failed; kept local", error);
  }

  return normalized;
}

export function listenToShowcaseProjects(callback) {
  try {
    const col = collection(db, "showcaseProjects");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const projects = snap.docs.map((d) => normalizeProject({ id: d.id, ...(d.data() || {}) }));
        setLocalProjects(projects);
        if (typeof callback === "function") callback(projects);
      },
      (error) => {
        console.warn("listenToShowcaseProjects snapshot error", error);
      },
    );
    return unsub;
  } catch (error) {
    console.warn("listenToShowcaseProjects unavailable", error);
    return null;
  }
}

export function listenToShowcaseComments(projectId, callback) {
  const pid = String(projectId || "").trim();
  if (!pid) return null;
  try {
    const q = query(collection(db, "showcaseComments"), where("projectId", "==", pid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const comments = snap.docs.map((d) => normalizeComment({ id: d.id, ...(d.data() || {}) }));
        const local = getLocalComments().filter((c) => c.projectId !== pid);
        setLocalComments([...local, ...comments]);
        if (typeof callback === "function") callback(comments);
      },
      (error) => {
        console.warn("listenToShowcaseComments snapshot error", error);
      },
    );
    return unsub;
  } catch (error) {
    console.warn("listenToShowcaseComments unavailable", error);
    return null;
  }
}

export async function addShowcaseSuggestion(suggestion) {
  const normalized = normalizeSuggestion(suggestion);
  if (!normalized.projectId) throw new Error("Missing projectId on suggestion");
  if (!normalized.toNameLower) throw new Error("Missing recipient name");

  try {
    await setDoc(doc(db, "showcaseSuggestions", normalized.id), normalized, { merge: true });
  } catch (error) {
    console.error("addShowcaseSuggestion Firestore failed", error);
  }

  return normalized;
}

export function listenToShowcaseSuggestionsForUser(toNameLower, callback) {
  const key = String(toNameLower || "").trim().toLowerCase();
  if (!key) return null;
  try {
    const q = query(collection(db, "showcaseSuggestions"), where("toNameLower", "==", key));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const suggestions = snap.docs.map((d) => normalizeSuggestion({ id: d.id, ...(d.data() || {}) }));
        if (typeof callback === "function") callback(suggestions);
      },
      (error) => {
        console.warn("listenToShowcaseSuggestionsForUser snapshot error", error);
      },
    );
    return unsub;
  } catch (error) {
    console.warn("listenToShowcaseSuggestionsForUser unavailable", error);
    return null;
  }
}

export async function uploadShowcaseDemoVideo({ file, projectId, makerId }) {
  if (!file) throw new Error("Missing file");
  const pid = String(projectId || "").trim();
  if (!pid) throw new Error("Missing projectId");

  const safeMaker = String(makerId || "anonymous").replace(/[^a-zA-Z0-9._-]/g, "_");
  const originalName = String(file.name || "demo-video");
  const ext = (originalName.includes(".") ? originalName.split(".").pop() : "mp4") || "mp4";
  const path = `showcaseProjects/${pid}/${safeMaker}/demo-${Date.now()}.${ext}`;
  const ref = storageRef(storage, path);

  const task = uploadBytesResumable(ref, file, {
    contentType: file.type || undefined,
    customMetadata: {
      projectId: pid,
      makerId: String(makerId || ""),
      originalName,
    },
  });

  const downloadUrl = await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      () => {},
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      },
    );
  });

  return { downloadUrl, storagePath: path };
}

// Expose convenience globals (matches existing workspace style)
window.getShowcaseProjects = getShowcaseProjects;
window.addShowcaseProject = addShowcaseProject;
window.updateShowcaseProject = updateShowcaseProject;
window.getShowcaseCommentsByProject = getShowcaseCommentsByProject;
window.addShowcaseComment = addShowcaseComment;
window.listenToShowcaseProjects = listenToShowcaseProjects;
window.listenToShowcaseComments = listenToShowcaseComments;
window.uploadShowcaseDemoVideo = uploadShowcaseDemoVideo;
window.addShowcaseSuggestion = addShowcaseSuggestion;
window.listenToShowcaseSuggestionsForUser = listenToShowcaseSuggestionsForUser;
window.deleteShowcaseProject = deleteShowcaseProject;
