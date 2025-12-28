// Shared Course Storage - Simple Cloud Storage Solution
// This file provides a workaround for shared course data across users

// Use this as a shared data store (replace with actual API/database in production)
const SHARED_COURSES_KEY = 'oneorigin_shared_courses';

// Initialize shared storage with sample data if empty
function initializeSharedCourses() {
    const sharedData = localStorage.getItem(SHARED_COURSES_KEY);
    if (!sharedData || sharedData === '[]') {
        const sampleCourses = [
            {
                id: 1735382400000,
                name: 'Excel Basic',
                type: 'beginner',
                videoId: 'RRY-wTT6-ds',
                uploadDate: '12/28/2025'
            }
        ];
        localStorage.setItem(SHARED_COURSES_KEY, JSON.stringify(sampleCourses));
        return sampleCourses;
    }
    return JSON.parse(sharedData);
}

// Get all shared courses
function getSharedCourses() {
    const courses = localStorage.getItem(SHARED_COURSES_KEY);
    return courses ? JSON.parse(courses) : initializeSharedCourses();
}

// Add a new course to shared storage
function addSharedCourse(course) {
    const courses = getSharedCourses();
    courses.push(course);
    localStorage.setItem(SHARED_COURSES_KEY, JSON.stringify(courses));
    // Also sync to regular courses key
    localStorage.setItem('courses', JSON.stringify(courses));
    return courses;
}

// Delete a course from shared storage
function deleteSharedCourse(courseId) {
    let courses = getSharedCourses();
    courses = courses.filter(c => c.id !== courseId);
    localStorage.setItem(SHARED_COURSES_KEY, JSON.stringify(courses));
    // Also sync to regular courses key
    localStorage.setItem('courses', JSON.stringify(courses));
    return courses;
}

// Sync shared courses to local storage
function syncSharedCourses() {
    const sharedCourses = getSharedCourses();
    localStorage.setItem('courses', JSON.stringify(sharedCourses));
    return sharedCourses;
}
