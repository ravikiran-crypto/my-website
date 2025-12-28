// Shared Course Storage - Firebase Firestore for real multi-user sync
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnfIJQxO6mi2_NEGqXRGH5EAxeaNcb7qc",
  authDomain: "oneorigin-learning-hub.firebaseapp.com",
  projectId: "oneorigin-learning-hub",
  storageBucket: "oneorigin-learning-hub.firebasestorage.app",
  messagingSenderId: "4168147692",
  appId: "1:4168147692:web:43a1205a0af9770f633bc9"
};

const app = initializeApp(firebaseConfig, 'shared-storage-app');
const db = getFirestore(app);

console.log('✅ Firestore initialized successfully');

// Get shared courses from Firestore
async function getSharedCourses() {
    try {
        console.log('📚 Fetching courses from Firestore...');
        const coursesCol = collection(db, 'courses');
        const snapshot = await getDocs(coursesCol);
        const courses = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: data.id || doc.id,
                name: data.name,
                type: data.type,
                videoId: data.videoId,
                uploadDate: data.uploadDate
            };
        });
        console.log(`✅ Found ${courses.length} courses in Firestore:`, courses);
        return courses;
    } catch (error) {
        console.error('❌ Error getting courses from Firestore:', error);
        console.log('⚠️ Falling back to localStorage');
        // Fallback to localStorage
        const local = localStorage.getItem('courses');
        return local ? JSON.parse(local) : [];
    }
}

// Add course to Firestore
async function addSharedCourse(course) {
    // Always add to localStorage first for immediate availability
    const localCourses = JSON.parse(localStorage.getItem('courses') || '[]');
    localCourses.push(course);
    localStorage.setItem('courses', JSON.stringify(localCourses));
    
    try {
        console.log('➕ Adding course to Firestore:', course);
        const courseRef = doc(db, 'courses', course.id.toString());
        await setDoc(courseRef, course);
        console.log('✅ Course added successfully to Firestore');
        return localCourses;
    } catch (error) {
        console.error('❌ Error adding course to Firestore:', error);
        console.log('⚠️ Course saved to localStorage only');
        return localCourses;
    }
}

// Delete course from Firestore
async function deleteSharedCourse(courseId) {
    try {
        console.log('🗑️ Deleting course from Firestore, ID:', courseId);
        const courseRef = doc(db, 'courses', courseId.toString());
        await deleteDoc(courseRef);
        console.log('✅ Deleted from Firestore');
        // Also update localStorage
        const courses = await getSharedCourses();
        localStorage.setItem('courses', JSON.stringify(courses));
        return courses;
    } catch (error) {
        console.error('❌ Error deleting course from Firestore:', error);
        console.log('⚠️ Falling back to localStorage delete');
        // Fallback to localStorage
        let courses = JSON.parse(localStorage.getItem('courses') || '[]');
        console.log('📦 Before delete, localStorage has', courses.length, 'courses');
        courses = courses.filter(c => c.id != courseId); // Use != for type coercion
        console.log('📦 After delete, localStorage has', courses.length, 'courses');
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
    console.log('⚠️ Using localStorage courses as Firestore returned empty');
    return localCourses;
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
window.getSharedAnnouncements = getSharedAnnouncements;
window.addSharedAnnouncement = addSharedAnnouncement;
