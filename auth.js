import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

function showMessage({ title, message, type = 'error' }) {
    try {
        const inline = globalThis.document?.getElementById?.('loginStatus');
        if (inline) {
            const prefix = type ? String(type).toUpperCase() : 'INFO';
            inline.textContent = `${prefix}: ${title} — ${message}`;
        }
    } catch (_) {
        // ignore
    }

    if (globalThis.window?.appUI && typeof globalThis.window.appUI.alert === 'function') {
        globalThis.window.appUI.alert({ title, message, type });
        return;
    }
    // Fallback so index.html (or failures before appUI loads) still shows something.
    alert(`${title}: ${message}`);
}

function describeAuthError(error) {
    const code = String(error?.code || '');
    const base = String(error?.message || 'Unknown error');
    const host = globalThis.location?.host || '(unknown-host)';

    if (code === 'auth/unauthorized-domain') {
        return {
            title: 'Login blocked (unauthorized domain)',
            message: `Firebase Auth is rejecting this domain: ${host}. Add it in Firebase Console → Authentication → Settings → Authorized domains.`,
            type: 'error',
        };
    }

    if (code === 'auth/operation-not-allowed') {
        return {
            title: 'Google provider disabled',
            message: 'Enable Google sign-in in Firebase Console → Authentication → Sign-in method.',
            type: 'error',
        };
    }

    if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return {
            title: 'Popup blocked',
            message: 'Your browser blocked the sign-in popup. Allow popups for this site or the app will switch to redirect sign-in.',
            type: 'error',
        };
    }

    if (code === 'auth/network-request-failed') {
        return {
            title: 'Network error',
            message: 'Network request failed while contacting Firebase. Check connectivity, VPN/firewall, and try again.',
            type: 'error',
        };
    }

    return {
        title: 'Login error',
        message: base,
        type: 'error',
    };
}

async function getFirebaseConfigOrThrow() {
    try {
        const cfg = await (typeof globalThis.__getFirebaseConfig === 'function'
            ? globalThis.__getFirebaseConfig()
            : (globalThis.__FIREBASE_CONFIG_READY__
                ? globalThis.__FIREBASE_CONFIG_READY__.then(() => globalThis.__FIREBASE_CONFIG__)
                : globalThis.__FIREBASE_CONFIG__));

        if (!cfg || typeof cfg !== 'object') {
            throw new Error('Firebase config not loaded. Ensure runtime-config.js is included before auth.js and FIREBASE_* env vars are set on the backend.');
        }
        return cfg;
    } catch (error) {
        // Most common root cause on Vercel is /api/runtime-config returning 500 because env vars are missing.
        const details = describeAuthError(error);
        showMessage({
            title: details.title,
            message: `${details.message}\n\nIf you are on Vercel: open /api/runtime-config and confirm it returns your Firebase projectId (not an error).`,
            type: details.type,
        });
        throw error;
    }
}

let app;
let auth;
let provider;
let db;

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

async function handleSignedInUser(user) {
    // Domain check for @oneorigin.us
    if (!user?.email || !user.email.endsWith('@oneorigin.us')) {
        showMessage({
            title: 'Access denied',
            message: 'Please sign in using your @oneorigin.us email.',
            type: 'error',
        });
        await signOut(auth);
        return;
    }

    localStorage.setItem('userName', user.displayName || '');
    localStorage.setItem('userEmail', user.email || '');

    // Firestore-backed, permanent registration + role sync
    const userDoc = await upsertUserInFirestore({
        email: user.email,
        name: user.displayName || '',
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

    window.location.href = 'dashboard.html';
}

async function attemptPopupThenRedirect() {
    try {
        const result = await signInWithPopup(auth, provider);
        await handleSignedInUser(result.user);
    } catch (error) {
        console.error('Login Error:', error);
        const info = describeAuthError(error);

        // Popup issues: fall back to redirect which works better on mobile / strict browsers.
        if (String(error?.code || '') === 'auth/popup-blocked'
            || String(error?.code || '') === 'auth/popup-closed-by-user'
            || String(error?.code || '') === 'auth/cancelled-popup-request'
            || String(error?.code || '') === 'auth/operation-not-supported-in-this-environment') {
            showMessage({
                title: 'Switching login method',
                message: 'Opening Google sign-in in a redirect flow (popup was blocked/unsupported).',
                type: 'info',
            });
            await signInWithRedirect(auth, provider);
            return;
        }

        showMessage(info);
    }
}

async function initAuth() {
    const firebaseConfig = await getFirebaseConfigOrThrow();
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    db = getFirestore(app);

    // If we returned from a redirect-based sign-in, consume it here.
    try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
            await handleSignedInUser(redirectResult.user);
            return;
        }
    } catch (error) {
        console.error('Redirect login error:', error);
        showMessage(describeAuthError(error));
    }

    const btn = document.getElementById('loginBtn');
    if (!btn) {
        console.warn('[auth] login button not found (expected id="loginBtn")');
        return;
    }

    btn.addEventListener('click', async () => {
        await attemptPopupThenRedirect();
    });
}

initAuth().catch((e) => {
    console.error('[auth] init failed:', e);
});