// Shared Course Storage - Firebase Firestore for real multi-user sync
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = await (typeof globalThis.__getFirebaseConfig === 'function'
        ? globalThis.__getFirebaseConfig()
        : (globalThis.__FIREBASE_CONFIG_READY__
                        ? globalThis.__FIREBASE_CONFIG_READY__.then(() => globalThis.__FIREBASE_CONFIG__)
                        : globalThis.__FIREBASE_CONFIG__));

if (!firebaseConfig || typeof firebaseConfig !== 'object') {
        throw new Error('Firebase config not loaded. Ensure runtime-config.js is included before shared-storage.js and FIREBASE_* env vars are set on the backend.');
}

// Use the default app so we share Firebase Auth state from auth.js
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// Ensure auth is initialized (for security rules that require request.auth)
getAuth(app);
const db = getFirestore(app);

console.log('Firestore initialized successfully');

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
