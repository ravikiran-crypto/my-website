import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnfIJQxO6mi2_NEGqXRGH5EAxeaNcb7qc",
  authDomain: "oneorigin-learning-hub.firebaseapp.com",
  projectId: "oneorigin-learning-hub",
  storageBucket: "oneorigin-learning-hub.firebasestorage.app",
  messagingSenderId: "4168147692",
  appId: "1:4168147692:web:43a1205a0af9770f633bc9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.getElementById('loginBtn').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Domain check for @oneorigin.us
        if (user.email.endsWith("@oneorigin.us")) {
            localStorage.setItem("userName", user.displayName || "");
            localStorage.setItem("userEmail", user.email || "");
            
            // Auto-record user in users table if not exists
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const existingUser = users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
            
            if (!existingUser) {
                users.push({
                    employeeId: 'AUTO-' + Date.now(),
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    role: user.email.toLowerCase() === 'ravikiran@oneorigin.us' ? 'Admin' : 'User',
                    lastActive: new Date().toLocaleString()
                });
                localStorage.setItem('users', JSON.stringify(users));
            } else {
                // Update last active
                existingUser.lastActive = new Date().toLocaleString();
                localStorage.setItem('users', JSON.stringify(users));
            }
            
            window.location.href = "dashboard.html";
        } else {
            alert("Access Denied: Please use your @oneorigin.us email.");
            await auth.signOut();
        }
    } catch (error) {
        console.error("Login Error:", error.message);
        alert("Error: " + error.message);
    }
});