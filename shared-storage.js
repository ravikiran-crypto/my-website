// Shared Course Storage - Firebase Firestore for real multi-user sync
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    writeBatch,
    runTransaction,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnfIJQxO6mi2_NEGqXRGH5EAxeaNcb7qc",
  authDomain: "oneorigin-learning-hub.firebaseapp.com",
  projectId: "oneorigin-learning-hub",
  storageBucket: "oneorigin-learning-hub.firebasestorage.app",
  messagingSenderId: "4168147692",
  appId: "1:4168147692:web:43a1205a0af9770f633bc9"
};

// Use the default app so we share Firebase Auth state from auth.js
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// Ensure auth is initialized (for security rules that require request.auth)
getAuth(app);
const db = getFirestore(app);

console.log('Firestore initialized successfully');

// =====================
// Quick learning Shorts feed (Firestore-backed)
// =====================

const QUICK_SHORTS_COLLECTION = 'quickShorts';
const QUICK_SHORTS_SOURCES_DOC = ['config', 'quickShortsSources'];
const QUICK_SHORTS_META_DOC = ['config', 'quickShortsMeta'];

function safeArray(v) {
    return Array.isArray(v) ? v : [];
}

function normalizeHandle(v) {
    const s = safeTrim(v).replace(/^@/, '');
    if (!s) return '';
    return s;
}

function isAdminFromLocal() {
    try {
        return safeLower(localStorage.getItem('userRole')) === 'admin';
    } catch (_) {
        return false;
    }
}

async function getQuickShortSources() {
    try {
        const ref = doc(db, QUICK_SHORTS_SOURCES_DOC[0], QUICK_SHORTS_SOURCES_DOC[1]);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() || {}) : {};
        const handles = safeArray(data.handles).map(normalizeHandle).filter(Boolean);
        return { ok: true, handles };
    } catch (error) {
        console.warn('getQuickShortSources failed:', error);
        return { ok: false, handles: [], reason: error?.message || String(error) };
    }
}

async function setQuickShortSources(handles) {
    try {
        if (!isAdminFromLocal()) return { ok: false, reason: 'Not authorized' };
        const next = safeArray(handles).map(normalizeHandle).filter(Boolean);
        const ref = doc(db, QUICK_SHORTS_SOURCES_DOC[0], QUICK_SHORTS_SOURCES_DOC[1]);
        await setDoc(ref, { handles: next, updatedAt: serverTimestamp(), updatedAtMs: Date.now() }, { merge: true });
        return { ok: true, handles: next };
    } catch (error) {
        console.warn('setQuickShortSources failed:', error);
        return { ok: false, reason: error?.message || String(error) };
    }
}

async function getQuickShorts(maxItems = 60) {
    try {
        const n = Math.max(1, Math.min(200, Number(maxItems) || 60));
        const ref = collection(db, QUICK_SHORTS_COLLECTION);
        const q = query(ref, orderBy('addedAtMs', 'desc'), limit(n));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Store only embeddable entries (defensive)
        return items.filter(x => x && x.videoId && x.embeddable !== false);
    } catch (error) {
        console.warn('getQuickShorts failed:', error);
        return [];
    }
}

async function refreshQuickShortsFeed(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const maxNew = Math.max(1, Math.min(100, Number(opts.maxNew || 40) || 40));
    const maxPerSource = Math.max(10, Math.min(1500, Number(opts.maxPerSource || 400) || 400));

    if (!isAdminFromLocal()) return { ok: false, added: 0, reason: 'Not authorized' };

    const src = await getQuickShortSources();
    const handles = safeArray(src.handles);
    if (!handles.length) return { ok: false, added: 0, reason: 'No sources configured' };

    const nowMs = Date.now();
    const toWrite = [];

    const checkEmbeddable = async (videoId) => {
        try {
            const resp = await fetch(`/api/youtube/check?videoId=${encodeURIComponent(videoId)}`);
            if (!resp.ok) return { ok: false };
            return await resp.json();
        } catch (_) {
            return { ok: false };
        }
    };

    for (const handle of handles) {
        if (toWrite.length >= maxNew) break;
        let ids = [];
        try {
            const resp = await fetch(`/api/youtube/channel-shorts?handle=${encodeURIComponent(handle)}&max=${encodeURIComponent(maxPerSource)}`);
            const data = resp.ok ? await resp.json() : null;
            ids = safeArray(data?.videoIds).map(safeTrim).filter(Boolean);
        } catch (_) {
            ids = [];
        }

        for (const id of ids) {
            if (toWrite.length >= maxNew) break;
            if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) continue;

            // Skip if already stored
            try {
                const ref = doc(db, QUICK_SHORTS_COLLECTION, id);
                const snap = await getDoc(ref);
                if (snap.exists()) continue;
            } catch (_) {}

            const info = await checkEmbeddable(id);
            if (!info || info.ok !== true) continue;

            toWrite.push({
                videoId: id,
                embeddable: true,
                source: handle,
                addedAt: serverTimestamp(),
                addedAtMs: nowMs,
                // Title is stored for auditing/search later, but UI can ignore it.
                title: safeTrim(info.title),
            });
        }
    }

    if (!toWrite.length) {
        try {
            const metaRef = doc(db, QUICK_SHORTS_META_DOC[0], QUICK_SHORTS_META_DOC[1]);
            await setDoc(metaRef, { lastAttemptAt: serverTimestamp(), lastAttemptAtMs: nowMs }, { merge: true });
        } catch (_) {}
        return { ok: true, added: 0 };
    }

    try {
        const batch = writeBatch(db);
        for (const item of toWrite) {
            const ref = doc(db, QUICK_SHORTS_COLLECTION, item.videoId);
            batch.set(ref, item, { merge: false });
        }
        const metaRef = doc(db, QUICK_SHORTS_META_DOC[0], QUICK_SHORTS_META_DOC[1]);
        batch.set(metaRef, { lastRefreshAt: serverTimestamp(), lastRefreshAtMs: nowMs, lastAdded: toWrite.length }, { merge: true });
        await batch.commit();
        return { ok: true, added: toWrite.length };
    } catch (error) {
        console.warn('refreshQuickShortsFeed failed:', error);
        return { ok: false, added: 0, reason: error?.message || String(error) };
    }
}

// =====================
// Activity Logs
// =====================

const ACTIVITY_LOGS_COLLECTION = 'activityLogs';

function safeTrim(v) {
    return String(v || '').trim();
}

function safeLower(v) {
    return safeTrim(v).toLowerCase();
}

function getActorFromLocalStorage() {
    try {
        const actorEmail = safeTrim(localStorage.getItem('userEmail'));
        const actorName = safeTrim(localStorage.getItem('userName'));
        const actorRole = safeLower(localStorage.getItem('userRole'));
        return { actorEmail, actorName, actorRole };
    } catch (_) {
        return { actorEmail: '', actorName: '', actorRole: '' };
    }
}

async function logActivity(event) {
    try {
        const { actorEmail, actorName, actorRole } = getActorFromLocalStorage();
        const nowMs = Date.now();
        const payload = {
            ts: serverTimestamp(),
            tsMs: nowMs,
            tsIso: new Date(nowMs).toISOString(),
            actorEmail: safeTrim(event?.actorEmail) || actorEmail,
            actorName: safeTrim(event?.actorName) || actorName,
            actorRole: safeLower(event?.actorRole) || actorRole,
            action: safeTrim(event?.action),
            summary: safeTrim(event?.summary),
            entityType: safeTrim(event?.entityType),
            entityId: safeTrim(event?.entityId),
            details: event?.details && typeof event.details === 'object' ? event.details : {},
            source: safeTrim(event?.source),
        };

        // Don't write empty events.
        if (!payload.action && !payload.summary) return { ok: false, skipped: true };

        const ref = collection(db, ACTIVITY_LOGS_COLLECTION);
        const docRef = await addDoc(ref, payload);
        return { ok: true, id: docRef.id };
    } catch (error) {
        console.warn('Activity log write failed:', error);
        return { ok: false, error: error?.message || String(error) };
    }
}

async function getActivityLogs(maxItems = 200) {
    try {
        const n = Math.max(1, Math.min(500, Number(maxItems) || 200));
        const ref = collection(db, ACTIVITY_LOGS_COLLECTION);
        const q = query(ref, orderBy('tsMs', 'desc'), limit(n));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error getting activity logs:', error);
        return [];
    }
}

// =====================
// Hub Bot topic counter
// =====================

const HUB_BOT_TOPICS_COLLECTION = 'hubBotTopics';

function normalizeTopicKey(topic) {
    const raw = safeLower(topic)
        .replace(/[\u2019']/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!raw) return '';
    return raw.replace(/\s+/g, '-').slice(0, 80);
}

function extractTopicFromQuestion(question) {
    const q = safeTrim(question);
    if (!q) return '';
    const lower = q.toLowerCase();

    const patterns = [
        /\bwhat\s+is\s+([^?!.]+)/i,
        /\bwhat\s+are\s+([^?!.]+)/i,
        /\bexplain\s+([^?!.]+)/i,
        /\bdefine\s+([^?!.]+)/i,
        /\btell\s+me\s+about\s+([^?!.]+)/i,
        /\bmeaning\s+of\s+([^?!.]+)/i,
    ];

    for (const re of patterns) {
        const m = q.match(re);
        if (m && m[1]) {
            return String(m[1]).trim().replace(/\s+in\s+ai\b.*$/i, '').trim();
        }
    }

    // Fallback: use a short normalized slice.
    const fallback = lower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = fallback.split(' ').filter(Boolean).slice(0, 6);
    return words.join(' ');
}

async function hubBotRecordTopicQuestion({ question, actorEmail }) {
    const actor = safeLower(actorEmail) || safeLower(getActorFromLocalStorage().actorEmail);
    const topicDisplay = extractTopicFromQuestion(question) || safeTrim(question);
    const topicKey = normalizeTopicKey(topicDisplay);
    if (!topicKey) return { ok: false, reason: 'No topic', topicKey: '', topicDisplay: '', uniqueCount: 0 };

    const ref = doc(db, HUB_BOT_TOPICS_COLLECTION, topicKey);
    const nowMs = Date.now();

    try {
        const result = await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists() ? (snap.data() || {}) : {};
            const askedBy = Array.isArray(data.askedByEmails) ? data.askedByEmails.map(safeLower).filter(Boolean) : [];
            const hasActor = actor ? askedBy.includes(actor) : false;
            const nextAskedBy = (actor && !hasActor) ? [...askedBy, actor] : askedBy;
            const uniqueCount = nextAskedBy.length;
            const totalCount = Number(data.totalCount || 0) + 1;

            const threshold = 5;
            const courseAddRequested = Boolean(data.courseAddRequested);
            const coursesAddedAtMs = Number(data.coursesAddedAtMs || 0);

            const shouldRequest = uniqueCount >= threshold && !courseAddRequested && !coursesAddedAtMs;

            tx.set(ref, {
                topicKey,
                topicDisplay,
                askedByEmails: nextAskedBy,
                uniqueCount,
                totalCount,
                threshold,
                lastQuestion: safeTrim(question),
                lastAskedBy: actor,
                lastAskedAt: serverTimestamp(),
                lastAskedAtMs: nowMs,
                courseAddRequested: courseAddRequested || shouldRequest,
                updatedAtMs: nowMs,
                createdAtMs: Number(data.createdAtMs || 0) || nowMs,
            }, { merge: true });

            return { uniqueCount, totalCount, shouldRequest, alreadyAdded: Boolean(coursesAddedAtMs) };
        });

        return { ok: true, topicKey, topicDisplay, uniqueCount: result.uniqueCount, totalCount: result.totalCount, shouldRequest: result.shouldRequest, alreadyAdded: result.alreadyAdded };
    } catch (error) {
        console.error('hubBotRecordTopicQuestion failed:', error);
        return { ok: false, topicKey, topicDisplay, uniqueCount: 0, reason: error?.message || String(error) };
    }
}

async function hubBotClaimTopicCourseAddition({ topicKey, actorEmail, videoId, videoTitle }) {
    const actor = safeLower(actorEmail) || safeLower(getActorFromLocalStorage().actorEmail);
    const ref = doc(db, HUB_BOT_TOPICS_COLLECTION, safeTrim(topicKey));
    const nowMs = Date.now();

    if (!safeTrim(topicKey) || !safeTrim(videoId)) return { ok: false, claimed: false, reason: 'Missing topicKey/videoId' };

    try {
        const result = await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists() ? (snap.data() || {}) : {};
            const already = Number(data.coursesAddedAtMs || 0);
            if (already) return { claimed: false };
            tx.set(ref, {
                coursesAddedAt: serverTimestamp(),
                coursesAddedAtMs: nowMs,
                courseVideoId: safeTrim(videoId),
                courseVideoTitle: safeTrim(videoTitle),
                courseAddedBy: actor,
                courseAddRequested: true,
            }, { merge: true });
            return { claimed: true };
        });
        return { ok: true, claimed: Boolean(result.claimed) };
    } catch (error) {
        console.error('hubBotClaimTopicCourseAddition failed:', error);
        return { ok: false, claimed: false, reason: error?.message || String(error) };
    }
}

async function hubBotSuppressTopicCourseAddition({ topicKey, reason }) {
    const key = safeTrim(topicKey);
    if (!key) return { ok: false, reason: 'Missing topicKey' };
    try {
        const ref = doc(db, HUB_BOT_TOPICS_COLLECTION, key);
        await setDoc(ref, {
            courseAddSuppressed: true,
            courseAddSuppressedAt: serverTimestamp(),
            courseAddSuppressedAtMs: Date.now(),
            courseAddSuppressedReason: safeTrim(reason),
            courseAddRequested: true,
        }, { merge: true });
        return { ok: true };
    } catch (error) {
        console.error('hubBotSuppressTopicCourseAddition failed:', error);
        return { ok: false, reason: error?.message || String(error) };
    }
}

function normalizeCourse(rawCourse, fallbackIndex = 0) {
    const course = rawCourse && typeof rawCourse === 'object' ? rawCourse : {};
    const videoId = (course.videoId || course.videoID || course.youtubeId || '').toString().trim();
    const id = (course.id ?? '').toString().trim();

    const normalized = {
        ...course,
        videoId,
        id: id || (videoId ? `legacy-${videoId}` : `legacy-${Date.now()}-${fallbackIndex}`),
        name: (course.name || course.courseName || '').toString().trim() || 'Untitled Course',
        type: (course.type || course.courseType || '').toString().trim() || 'beginner',
        uploadDate: (course.uploadDate || course.date || '').toString().trim() || new Date().toLocaleDateString(),
    };

    return normalized;
}

// Get shared courses from Firestore
async function getSharedCourses() {
    try {
        console.log('Fetching courses from Firestore...');
        const coursesCol = collection(db, 'courses');
        const snapshot = await getDocs(coursesCol);
        const courses = snapshot.docs.map((docSnap, index) => {
            const data = docSnap.data() || {};
            // If legacy docs didn't store id in the payload, use Firestore doc id.
            return normalizeCourse({ id: data.id || docSnap.id, ...data }, index);
        });
        console.log(`Found ${courses.length} courses in Firestore:`, courses);
        return courses;
    } catch (error) {
        console.error('Error getting courses from Firestore:', error);
        console.log('Falling back to localStorage');
        // Fallback to localStorage
        const local = localStorage.getItem('courses');
        const parsed = local ? JSON.parse(local) : [];
        const normalized = Array.isArray(parsed) ? parsed.map((c, i) => normalizeCourse(c, i)) : [];
        // Persist normalization so legacy courses get an id (enables delete buttons).
        try {
            localStorage.setItem('courses', JSON.stringify(normalized));
        } catch (_) {}
        return normalized;
    }
}

// Add course to Firestore
async function addSharedCourse(course) {
    // Always add to localStorage first for immediate availability
    const localCourses = JSON.parse(localStorage.getItem('courses') || '[]');
    const normalized = normalizeCourse(course, localCourses.length);
    localCourses.push(normalized);
    localStorage.setItem('courses', JSON.stringify(localCourses));
    
    try {
        console.log('Adding course to Firestore:', normalized);
        const courseRef = doc(db, 'courses', normalized.id.toString());
        await setDoc(courseRef, normalized);
        console.log('Course added successfully to Firestore');

        // Activity log (best-effort)
        try {
            await logActivity({
                action: 'course.add',
                summary: `Course added: ${normalized.name} (${normalized.type})`,
                entityType: 'course',
                entityId: String(normalized.id),
                source: safeTrim(normalized.source) || 'ui',
                details: {
                    name: normalized.name,
                    type: normalized.type,
                    videoId: normalized.videoId,
                    uploadDate: normalized.uploadDate,
                    source: normalized.source || '',
                    addedBy: normalized.addedBy || '',
                    channelUrl: normalized.channelUrl || '',
                }
            });
        } catch (_) {}

        return localCourses;
    } catch (error) {
        console.error('Error adding course to Firestore:', error);
        console.log('Course saved to localStorage only');
        return localCourses;
    }
}

// Delete course from Firestore
async function deleteSharedCourse(courseId) {
    try {
        const key = (courseId ?? '').toString().trim();
        if (!key) throw new Error('Missing course identifier');

        console.log('Deleting course from Firestore, key:', key);

        // 1) Best-effort delete by doc id (works for normal courses)
        await deleteDoc(doc(db, 'courses', key));

        // 2) Legacy support: delete any doc whose payload matches by id OR videoId
        const coursesCol = collection(db, 'courses');
        const snapshot = await getDocs(coursesCol);
        const matches = snapshot.docs.filter(d => {
            const data = d.data() || {};
            const did = (data.id ?? '').toString();
            const vid = (data.videoId ?? '').toString();
            return d.id === key || did === key || vid === key;
        });
        if (matches.length > 0) {
            await Promise.all(matches.map(d => deleteDoc(doc(db, 'courses', d.id))));
        }

        console.log('Deleted from Firestore (direct and legacy match)');

        // Activity log (best-effort)
        try {
            await logActivity({
                action: 'course.delete',
                summary: `Course deleted: ${key}`,
                entityType: 'course',
                entityId: key,
                source: 'ui',
                details: { key }
            });
        } catch (_) {}

        // Also update localStorage
        const courses = await getSharedCourses();
        localStorage.setItem('courses', JSON.stringify(courses));
        return courses;
    } catch (error) {
        console.error('Error deleting course from Firestore:', error);
        console.log('Falling back to localStorage delete');
        // Fallback to localStorage
        const key = (courseId ?? '').toString().trim();
        let courses = JSON.parse(localStorage.getItem('courses') || '[]');
        console.log('Before delete, localStorage has', courses.length, 'courses');
        courses = courses
            .map((c, i) => normalizeCourse(c, i))
            .filter(c => {
                const cid = (c.id ?? '').toString();
                const vid = (c.videoId ?? '').toString();
                // Delete by id match OR by videoId match (legacy)
                return !(cid === key || vid === key);
            });
        console.log('After delete, localStorage has', courses.length, 'courses');
        localStorage.setItem('courses', JSON.stringify(courses));
        return courses;
    }
}

// Sync shared courses to local storage
async function syncSharedCourses() {
    const courses = await getSharedCourses();
    // Only update localStorage if we got data from Firestore OR localStorage is empty
    const localCourses = JSON.parse(localStorage.getItem('courses') || '[]');
    if (courses.length > 0 || localCourses.length === 0) {
        localStorage.setItem('courses', JSON.stringify(courses));
        return courses;
    }
    // If Firestore returned empty but localStorage has data, use localStorage
    console.log('Using localStorage courses as Firestore returned empty');
    return localCourses;
}

// One-time cleanup: delete ALL courses (Firestore + localStorage)
async function deleteAllSharedCourses() {
    try {
        console.log('Clearing ALL courses from Firestore...');
        const coursesCol = collection(db, 'courses');
        const snapshot = await getDocs(coursesCol);
        await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'courses', d.id))));
        console.log('All courses deleted from Firestore');

        localStorage.setItem('courses', '[]');

        // Activity log (best-effort)
        try {
            await logActivity({
                action: 'course.deleteAll',
                summary: 'All courses cleared',
                entityType: 'course',
                entityId: '*',
                source: 'ui',
                details: {}
            });
        } catch (_) {}

        return [];
    } catch (error) {
        console.error('Error clearing all courses from Firestore:', error);
        console.log('Falling back to localStorage clear only');
        localStorage.setItem('courses', '[]');
        return [];
    }
}

// Get announcements from Firestore
async function getSharedAnnouncements() {
    try {
        const announcementsCol = collection(db, 'announcements');
        const snapshot = await getDocs(announcementsCol);
        const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        return announcements;
    } catch (error) {
        console.error('Error getting announcements from Firestore:', error);
        const local = localStorage.getItem('announcements');
        return local ? JSON.parse(local) : [];
    }
}

// Add announcement to Firestore
async function addSharedAnnouncement(announcement) {
    try {
        const announcementId = Date.now().toString();
        const announcementRef = doc(db, 'announcements', announcementId);
        await setDoc(announcementRef, announcement);

        // Activity log (best-effort)
        try {
            await logActivity({
                action: 'announcement.add',
                summary: 'Announcement added',
                entityType: 'announcement',
                entityId: announcementId,
                source: 'ui',
                details: { announcement }
            });
        } catch (_) {}

        return await getSharedAnnouncements();
    } catch (error) {
        console.error('Error adding announcement to Firestore:', error);
        const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
        announcements.unshift(announcement);
        localStorage.setItem('announcements', JSON.stringify(announcements));
        return announcements;
    }
}

// Make functions available globally for dashboard.html
window.getSharedCourses = getSharedCourses;
window.addSharedCourse = addSharedCourse;
window.deleteSharedCourse = deleteSharedCourse;
window.syncSharedCourses = syncSharedCourses;
window.deleteAllSharedCourses = deleteAllSharedCourses;
window.getSharedAnnouncements = getSharedAnnouncements;
window.addSharedAnnouncement = addSharedAnnouncement;

// Activity logs
window.logActivity = logActivity;
window.getActivityLogs = getActivityLogs;

// Hub Bot topic counter + claim
window.hubBotRecordTopicQuestion = hubBotRecordTopicQuestion;
window.hubBotClaimTopicCourseAddition = hubBotClaimTopicCourseAddition;
window.hubBotSuppressTopicCourseAddition = hubBotSuppressTopicCourseAddition;

// Quick learning Shorts feed
window.getQuickShorts = getQuickShorts;
window.getQuickShortSources = getQuickShortSources;
window.setQuickShortSources = setQuickShortSources;
window.refreshQuickShortsFeed = refreshQuickShortsFeed;

// =====================
// Shared Users (Role Mgmt)
// =====================

const SUPERADMIN_EMAIL = 'ravikiran@oneorigin.us';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function rawEmail(email) {
    return String(email || '').trim();
}

function userDocIdFromEmail(email) {
    // Firestore doc IDs can include '@' and '.', but not '/'
    return normalizeEmail(email);
}

function userDocIdFromAuthEmail(email) {
    // Matches the common rules pattern: users/{request.auth.token.email}
    // (Firestore rules are case-sensitive; store a copy with this exact key)
    return rawEmail(email);
}

async function getSharedUserByEmail(email) {
    try {
        const docId = userDocIdFromEmail(email);
        if (!docId) return null;
        const ref = doc(db, 'users', docId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() };
    } catch (error) {
        console.error('Error getting user by email from Firestore:', error);
        return null;
    }
}

async function upsertSharedUser(userData) {
    try {
        const emailRaw = rawEmail(userData?.email);
        const email = normalizeEmail(emailRaw);
        if (!emailRaw || !email) throw new Error('Email is required');

        const docIdNormalized = userDocIdFromEmail(emailRaw);
        const docIdAuth = userDocIdFromAuthEmail(emailRaw);
        const refNormalized = doc(db, 'users', docIdNormalized);
        const refAuth = doc(db, 'users', docIdAuth);

        const existing = await getSharedUserByEmail(emailRaw);

        const now = new Date().toISOString();
        const base = {
            email: emailRaw,
            name: userData?.name || existing?.name || emailRaw.split('@')[0],
            employeeId: existing?.employeeId || userData?.employeeId || `EMP-${Date.now()}`,
            role: existing?.role || userData?.role || 'User',
            lastActive: new Date().toLocaleString(),
            updatedAt: now,
            createdAt: existing?.createdAt || now,
        };

        // Superadmin is always Admin
        if (email === normalizeEmail(SUPERADMIN_EMAIL)) {
            base.role = 'Admin';
            base.employeeId = existing?.employeeId || userData?.employeeId || 'SUPERADMIN';
        }

        // Preserve reset flag if present
        if (existing && typeof existing.resetAssessmentFlag !== 'undefined') {
            base.resetAssessmentFlag = existing.resetAssessmentFlag;
        }

        // Write both doc-id forms so security rules that use request.auth.token.email can resolve role
        await Promise.all([
            setDoc(refNormalized, base, { merge: true }),
            (docIdAuth && docIdAuth !== docIdNormalized) ? setDoc(refAuth, base, { merge: true }) : Promise.resolve(),
        ]);

        return await getSharedUserByEmail(emailRaw);
    } catch (error) {
        console.error('Error upserting user in Firestore:', error);
        return null;
    }
}

async function getSharedUsers() {
    try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        users.sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
        return users;
    } catch (error) {
        console.error('Error getting users from Firestore:', error);
        // Fallback to localStorage for single-device mode
        const local = localStorage.getItem('users');
        return local ? JSON.parse(local) : [];
    }
}

async function updateSharedUserRoleByEmail(email, newRole) {
    try {
        const normalized = normalizeEmail(email);
        if (!normalized) throw new Error('Email is required');
        if (normalized === normalizeEmail(SUPERADMIN_EMAIL)) {
            throw new Error('Cannot change the Superadmin role');
        }

        const ref = doc(db, 'users', userDocIdFromEmail(normalized));
        await updateDoc(ref, {
            role: newRole,
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating user role in Firestore:', error);
        return { success: false, error: error.message };
    }
}

async function deleteSharedUserByEmail(email) {
    try {
        const normalized = normalizeEmail(email);
        if (!normalized) throw new Error('Email is required');
        if (normalized === normalizeEmail(SUPERADMIN_EMAIL)) {
            throw new Error('Cannot delete the Superadmin');
        }
        await deleteDoc(doc(db, 'users', userDocIdFromEmail(normalized)));
        return { success: true };
    } catch (error) {
        console.error('Error deleting user in Firestore:', error);
        return { success: false, error: error.message };
    }
}

async function setUserResetAssessmentFlag(email, flag) {
    try {
        const normalized = normalizeEmail(email);
        if (!normalized) throw new Error('Email is required');
        const ref = doc(db, 'users', userDocIdFromEmail(normalized));
        await updateDoc(ref, {
            resetAssessmentFlag: !!flag,
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error setting resetAssessmentFlag:', error);
        return { success: false, error: error.message };
    }
}

window.getSharedUsers = getSharedUsers;
window.getSharedUserByEmail = getSharedUserByEmail;
window.upsertSharedUser = upsertSharedUser;
window.updateSharedUserRoleByEmail = updateSharedUserRoleByEmail;
window.deleteSharedUserByEmail = deleteSharedUserByEmail;
window.setUserResetAssessmentFlag = setUserResetAssessmentFlag;
