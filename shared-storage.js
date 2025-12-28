// Shared Course Storage - API-based for real multi-user sync
const DATA_API = window.location.origin + '/api/data';

// Get data from API
async function getSharedData(type) {
    try {
        const response = await fetch(DATA_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', type })
        });
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error getting shared data:', error);
        return [];
    }
}

// Add data to API
async function addSharedData(type, data) {
    try {
        const response = await fetch(DATA_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', type, data })
        });
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error adding shared data:', error);
        return [];
    }
}

// Delete data from API
async function deleteSharedData(type, id) {
    try {
        const response = await fetch(DATA_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', type, id })
        });
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error deleting shared data:', error);
        return [];
    }
}

// Legacy functions for compatibility
async function getSharedCourses() {
    return await getSharedData('courses');
}

async function addSharedCourse(course) {
    return await addSharedData('courses', course);
}

async function deleteSharedCourse(courseId) {
    return await deleteSharedData('courses', courseId);
}

async function syncSharedCourses() {
    const courses = await getSharedCourses();
    localStorage.setItem('courses', JSON.stringify(courses));
    return courses;
}

async function getSharedAnnouncements() {
    return await getSharedData('announcements');
}

async function addSharedAnnouncement(announcement) {
    return await addSharedData('announcements', announcement);
}
