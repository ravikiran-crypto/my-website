// Firebase Firestore Database - Permanent Storage
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnfIJQxO6mi2_NEGqXRGH5EAxeaNcb7qc",
  authDomain: "oneorigin-learning-hub.firebaseapp.com",
  projectId: "oneorigin-learning-hub",
  storageBucket: "oneorigin-learning-hub.firebasestorage.app",
  messagingSenderId: "4168147692",
  appId: "1:4168147692:web:43a1205a0af9770f633bc9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig, 'firestore-app');
const db = getFirestore(app);

// ============ USER OPERATIONS ============

export async function saveUser(userData) {
    try {
        const userRef = doc(db, 'users', userData.employeeId);
        await setDoc(userRef, {
            ...userData,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error saving user:', error);
        return { success: false, error: error.message };
    }
}

export async function getAllUsers() {
    try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

export async function getUserByEmail(email) {
    try {
        const usersCol = collection(db, 'users');
        const q = query(usersCol, where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

export async function updateUserRole(employeeId, newRole) {
    try {
        const userRef = doc(db, 'users', employeeId);
        await updateDoc(userRef, {
            role: newRole,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteUser(employeeId) {
    try {
        await deleteDoc(doc(db, 'users', employeeId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
}

// ============ COURSE OPERATIONS ============

export async function saveCourse(courseData) {
    try {
        const courseId = courseData.id || Date.now().toString();
        const courseRef = doc(db, 'courses', courseId);
        await setDoc(courseRef, {
            ...courseData,
            id: courseId,
            createdAt: courseData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true, id: courseId };
    } catch (error) {
        console.error('Error saving course:', error);
        return { success: false, error: error.message };
    }
}

export async function getAllCourses() {
    try {
        const coursesCol = collection(db, 'courses');
        const snapshot = await getDocs(coursesCol);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting courses:', error);
        return [];
    }
}

export async function deleteCourse(courseId) {
    try {
        await deleteDoc(doc(db, 'courses', courseId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting course:', error);
        return { success: false, error: error.message };
    }
}

// ============ USER COURSES (Assigned Courses) ============

export async function saveUserCourse(email, courseData) {
    try {
        const courseId = courseData.videoId || Date.now().toString();
        const userCourseRef = doc(db, 'userCourses', `${email}_${courseId}`);
        await setDoc(userCourseRef, {
            email,
            ...courseData,
            assignedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error saving user course:', error);
        return { success: false, error: error.message };
    }
}

export async function getUserCourses(email) {
    try {
        const userCoursesCol = collection(db, 'userCourses');
        const q = query(userCoursesCol, where('email', '==', email));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error getting user courses:', error);
        return [];
    }
}

export async function deleteUserCourse(email, videoId) {
    try {
        await deleteDoc(doc(db, 'userCourses', `${email}_${videoId}`));
        return { success: true };
    } catch (error) {
        console.error('Error deleting user course:', error);
        return { success: false, error: error.message };
    }
}

// ============ ANNOUNCEMENTS ============

export async function saveAnnouncement(announcementData) {
    try {
        const id = announcementData.id || Date.now().toString();
        const announcementRef = doc(db, 'announcements', id);
        await setDoc(announcementRef, {
            ...announcementData,
            id,
            createdAt: announcementData.createdAt || new Date().toISOString()
        }, { merge: true });
        return { success: true, id };
    } catch (error) {
        console.error('Error saving announcement:', error);
        return { success: false, error: error.message };
    }
}

export async function getAllAnnouncements() {
    try {
        const announcementsCol = collection(db, 'announcements');
        const snapshot = await getDocs(announcementsCol);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting announcements:', error);
        return [];
    }
}

// ============ MIGRATION from localStorage ============

export async function migrateLocalStorageToFirestore(userEmail) {
    console.log('🔄 Migrating data from localStorage to Firestore...');
    
    try {
        // Migrate user's assigned courses
        const assignedCourses = JSON.parse(localStorage.getItem('assignedCourses') || '[]');
        for (const course of assignedCourses) {
            await saveUserCourse(userEmail, course);
        }
        
        // Migrate users (admin only)
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        for (const user of users) {
            if (user.employeeId) {
                await saveUser(user);
            }
        }
        
        // Migrate courses
        const courses = JSON.parse(localStorage.getItem('courses') || '[]');
        for (const course of courses) {
            await saveCourse(course);
        }
        
        // Migrate announcements
        const announcements = JSON.parse(localStorage.getItem('announcements') || '[]');
        for (const announcement of announcements) {
            await saveAnnouncement(announcement);
        }
        
        console.log('✅ Migration complete!');
        return { success: true };
    } catch (error) {
        console.error('❌ Migration error:', error);
        return { success: false, error: error.message };
    }
}
