import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = await (typeof globalThis.__getFirebaseConfig === 'function'
    ? globalThis.__getFirebaseConfig()
    : (globalThis.__FIREBASE_CONFIG_READY__
            ? globalThis.__FIREBASE_CONFIG_READY__.then(() => globalThis.__FIREBASE_CONFIG__)
            : globalThis.__FIREBASE_CONFIG__));

if (!firebaseConfig || typeof firebaseConfig !== 'object') {
    throw new Error('Firebase config not loaded. Ensure runtime-config.js is included before auth.js and FIREBASE_* env vars are set on the backend.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

const SUPERADMIN_EMAIL = 'ravikiran@oneorigin.us';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function rawEmail(email) {
    return String(email || '').trim();
}

function userDocIdFromEmail(email) {
    return normalizeEmail(email);
}

function userDocIdFromAuthEmail(email) {
    // Matches rules like users/{request.auth.token.email}
    return rawEmail(email);
}

async function upsertUserInFirestore({ email, name }) {
    const emailRaw = rawEmail(email);
    const normalized = normalizeEmail(emailRaw);
    if (!emailRaw || !normalized) throw new Error('Missing email');

    const refNormalized = doc(db, 'users', userDocIdFromEmail(emailRaw));
    const refAuth = doc(db, 'users', userDocIdFromAuthEmail(emailRaw));
    const snap = await getDoc(refNormalized);
    const nowIso = new Date().toISOString();
    const base = {
        email: emailRaw,
        name: name || (snap.exists() ? (snap.data().name || '') : '') || emailRaw.split('@')[0],
        employeeId: snap.exists() ? (snap.data().employeeId || '') : `EMP-${Date.now()}`,
        role: snap.exists() ? (snap.data().role || 'User') : 'User',
        lastActive: new Date().toLocaleString(),
        updatedAt: nowIso,
        createdAt: snap.exists() ? (snap.data().createdAt || nowIso) : nowIso,
    };

    // Superadmin is always Admin
    if (normalized === normalizeEmail(SUPERADMIN_EMAIL)) {
        base.role = 'Admin';
        base.employeeId = snap.exists() ? (snap.data().employeeId || 'SUPERADMIN') : 'SUPERADMIN';
    }

    // Write both doc-id forms so rules can resolve role via request.auth.token.email
    await Promise.all([
        setDoc(refNormalized, base, { merge: true }),
        (userDocIdFromAuthEmail(emailRaw) !== userDocIdFromEmail(emailRaw)) ? setDoc(refAuth, base, { merge: true }) : Promise.resolve(),
    ]);
    const refreshed = await getDoc(refNormalized);
    return refreshed.exists() ? { id: refreshed.id, ...refreshed.data() } : null;
}

function clearLocalAssessmentState() {
    localStorage.removeItem('initialAssessmentScore');
    localStorage.removeItem('userLevel');
    localStorage.removeItem('initialAssessmentStarted');
    localStorage.setItem('assignedCourses', '[]');
    localStorage.removeItem('upcomingCourse');
}

document.getElementById('loginBtn').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Domain check for @oneorigin.us
        if (user.email && user.email.endsWith("@oneorigin.us")) {
            localStorage.setItem("userName", user.displayName || "");
            localStorage.setItem("userEmail", user.email || "");

            // Firestore-backed, permanent registration + role sync
            const userDoc = await upsertUserInFirestore({
              email: user.email,
              name: user.displayName || ''
            });

            const role = String(userDoc?.role || 'User');
            localStorage.setItem('userRole', role.toLowerCase() === 'admin' ? 'admin' : 'user');
            if (userDoc?.employeeId) localStorage.setItem('employeeId', userDoc.employeeId);

            // If admin reset flag was set, clear assessment state for this user and clear the flag
            if (userDoc?.resetAssessmentFlag === true) {
              clearLocalAssessmentState();
              const ref = doc(db, 'users', userDocIdFromEmail(user.email));
              await updateDoc(ref, { resetAssessmentFlag: false, updatedAt: new Date().toISOString() });
            }

            window.location.href = "dashboard.html";
        } else {
            if (window.appUI && typeof window.appUI.alert === 'function') {
                window.appUI.alert({
                    title: 'Access denied',
                    message: 'Please sign in using your @oneorigin.us email.',
                    type: 'error'
                });
            }
            await signOut(auth);
        }
    } catch (error) {
        console.error("Login Error:", error.message);
        if (window.appUI && typeof window.appUI.alert === 'function') {
            window.appUI.alert({
                title: 'Login error',
                message: String(error && error.message ? error.message : 'Unknown error'),
                type: 'error'
            });
        }
    }
});