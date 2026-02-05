// Firestore Integration Helper - Add these updated functions to dashboard.html
// Replace the existing localStorage functions with these Firestore-enabled versions

function uiToast(type, title, message, duration = 4200) {
    if (window.appUI && typeof window.appUI.toast === 'function') {
        window.appUI.toast({ type, title, message, duration });
    }
}

function uiAlert(message, title = 'Notice', type = 'info') {
    if (window.appUI && typeof window.appUI.alert === 'function') {
        return window.appUI.alert({ title, message, type });
    }
    return Promise.resolve();
}

async function uiConfirm(message, title = 'Confirm', okText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
    if (window.appUI && typeof window.appUI.confirm === 'function') {
        return await window.appUI.confirm({ title, message, okText, cancelText, type });
    }
    return confirm(message);
}

// ============ USER MANAGEMENT FUNCTIONS ============

async function loadUsers() {
    const tbody = document.getElementById('userMgmtTableBody');
    if (!tbody) return;
    
    let users = [];
    if (window.firestoreDB) {
        users = await window.firestoreDB.getAllUsers();
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
    }
    
    tbody.innerHTML = '';
    users.forEach((u, idx) => {
        tbody.innerHTML += `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="user-checkbox" data-index="${idx}"></td>
                <td>${u.employeeId || ''}</td>
                <td>${u.name || ''}</td>
                <td>${u.email || ''}</td>
                <td>
                    <select onchange="updateUserRole(${idx}, this.value)" style="padding:4px; background:var(--card-bg); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">
                        <option value="User" ${u.role === 'User' ? 'selected' : ''}>User</option>
                        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>${u.lastActive || 'N/A'}</td>
            </tr>
        `;
    });
}

async function saveNewUser() {
    const employeeId = document.getElementById('newEmployeeId').value.trim();
    const name = document.getElementById('newName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const role = document.getElementById('newRole').value;

    if (!employeeId || !name || !email) {
        uiToast('warning', 'Missing details', 'Please fill in all fields.');
        return;
    }

    const userData = { employeeId, name, email, role, lastActive: '' };
    
    if (window.firestoreDB) {
        const result = await window.firestoreDB.saveUser(userData);
        if (result.success) {
            uiToast('success', 'User added', 'User added successfully.');
            closeAddUserModal();
            loadUsers();
            syncCurrentUserRole();
        } else {
            uiToast('error', 'Add failed', 'Error adding user: ' + result.error);
        }
    } else {
        // Fallback to localStorage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        users.push(userData);
        localStorage.setItem('users', JSON.stringify(users));
        uiToast('success', 'User added', 'User added (local fallback).');
        closeAddUserModal();
        loadUsers();
        syncCurrentUserRole();
    }
}

async function updateUserRole(index, value) {
    let users = [];
    if (window.firestoreDB) {
        users = await window.firestoreDB.getAllUsers();
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
    }
    
    if (!users[index]) return;
    
    const oldRole = users[index].role;
    const employeeName = users[index].name;
    const employeeId = users[index].employeeId;

    if (!await uiConfirm(`Change role of ${employeeName} from "${oldRole}" to "${value}"?`, 'Change role', 'Change', 'Cancel', 'warning')) {
        loadUsers();
        return;
    }

    if (window.firestoreDB) {
        const result = await window.firestoreDB.updateUserRole(employeeId, value);
        if (result.success) {
            uiToast('success', 'Role updated', `${employeeName}'s role changed to ${value}.`);
            loadUsers();
            syncCurrentUserRole();
        } else {
            uiToast('error', 'Update failed', 'Error updating role: ' + result.error);
        }
    } else {
        users[index].role = value;
        localStorage.setItem('users', JSON.stringify(users));
        uiToast('success', 'Role updated', `${employeeName}'s role changed to ${value}. (Local)`);
        loadUsers();
        syncCurrentUserRole();
    }
}

async function deleteSelectedRoles() {
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');
    if (checkboxes.length === 0) {
        uiToast('warning', 'Nothing selected', 'No users selected.');
        return;
    }
    
    if (!await uiConfirm(`Delete ${checkboxes.length} selected user(s)?`, 'Delete users', 'Delete', 'Cancel', 'warning')) return;

    let users = [];
    if (window.firestoreDB) {
        users = await window.firestoreDB.getAllUsers();
        
        for (let checkbox of checkboxes) {
            const index = parseInt(checkbox.getAttribute('data-index'));
            if (users[index] && users[index].employeeId) {
                await window.firestoreDB.deleteUser(users[index].employeeId);
            }
        }
        uiToast('success', 'Deleted', 'Users deleted successfully.');
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
        const indices = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-index')));
        const remaining = users.filter((_, i) => !indices.includes(i));
        localStorage.setItem('users', JSON.stringify(remaining));
        uiToast('success', 'Deleted', 'Users deleted (local fallback).');
    }
    
    loadUsers();
}

// ============ COURSE MANAGEMENT FUNCTIONS ============

async function saveNewCourse() {
    const name = document.getElementById('newCourseName').value.trim();
    const type = document.getElementById('newCourseType').value;
    const videoId = document.getElementById('newVideoId').value.trim();

    if (!name || !videoId) {
        uiToast('warning', 'Missing details', 'Please fill in all required fields.');
        return;
    }

    const uploadDate = new Date().toLocaleDateString();
    const courseData = { name, type, videoId, uploadDate, id: Date.now().toString() };

    if (window.firestoreDB) {
        const result = await window.firestoreDB.saveCourse(courseData);
        if (result.success) {
            uiToast('success', 'Course added', 'Course added successfully.');
            closeAddCourseModal();
            loadCourses();
        } else {
            uiToast('error', 'Add failed', 'Error adding course: ' + result.error);
        }
    } else {
        const courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses.push(courseData);
        localStorage.setItem('courses', JSON.stringify(courses));
        uiToast('success', 'Course added', 'Course added (local fallback).');
        closeAddCourseModal();
        loadCourses();
    }
}

async function loadCourses() {
    const container = document.getElementById('coursesGrid');
    if (!container) return;

    let courses = [];
    if (window.firestoreDB) {
        courses = await window.firestoreDB.getAllCourses();
    } else {
        courses = JSON.parse(localStorage.getItem('courses') || '[]');
    }

    container.innerHTML = courses.map(course => `
        <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:15px;">
            <div style="font-weight:bold; color:var(--text-main); margin-bottom:8px;">${course.name}</div>
            <div style="color:var(--text-secondary); font-size:12px; margin-bottom:5px;">Type: ${course.type || 'N/A'}</div>
            <div style="color:var(--text-secondary); font-size:12px; margin-bottom:10px;">Upload: ${course.uploadDate || 'N/A'}</div>
            <button onclick="deleteCourse('${course.id}')" style="background:#f85149; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px;">Delete</button>
        </div>
    `).join('');
}

async function deleteCourse(courseId) {
    if (!await uiConfirm('Delete this course?', 'Delete course', 'Delete', 'Cancel', 'warning')) return;

    if (window.firestoreDB) {
        const result = await window.firestoreDB.deleteCourse(courseId);
        if (result.success) {
            uiToast('success', 'Deleted', 'Course deleted successfully.');
            loadCourses();
        } else {
            uiToast('error', 'Delete failed', 'Error deleting course: ' + result.error);
        }
    } else {
        let courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses = courses.filter(c => c.id !== courseId);
        localStorage.setItem('courses', JSON.stringify(courses));
        uiToast('success', 'Deleted', 'Course deleted (local fallback).');
        loadCourses();
    }
}

// ============ ASSIGNED COURSES FUNCTIONS ============

async function assignCourseToUser(videoData, level) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    const courseData = {
        videoId: videoData.videoId,
        topic: videoData.topic,
        definition: videoData.definition,
        uses: videoData.uses,
        level: level,
        progress: 0,
        completed: false,
        assignedAt: new Date().toISOString()
    };

    if (window.firestoreDB) {
        const result = await window.firestoreDB.saveUserCourse(userEmail, courseData);
        if (result.success) {
            console.log('Course saved to Firestore');
            loadAssignedCourses();
        }
    } else {
        let courses = JSON.parse(localStorage.getItem('assignedCourses') || '[]');
        courses.push(courseData);
        localStorage.setItem('assignedCourses', JSON.stringify(courses));
        loadAssignedCourses();
    }
}

async function loadAssignedCourses() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;

    const grid = document.getElementById('assignedCoursesGrid');
    if (!grid) return;

    let courses = [];
    if (window.firestoreDB) {
        courses = await window.firestoreDB.getUserCourses(userEmail);
    } else {
        courses = JSON.parse(localStorage.getItem('assignedCourses') || '[]');
    }

    if (courses.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">No courses assigned yet.</p>';
        return;
    }

    grid.innerHTML = courses.map(course => `
        <div class="course-card">
            <h3>${course.topic}</h3>
            <div class="definition-scroll-container">
                <p><strong>Definition:</strong> ${course.definition}</p>
                <p><strong>Uses:</strong> ${course.uses}</p>
            </div>
            <p><strong>Level:</strong> ${course.level}</p>
            <a href="course-view.html?videoId=${course.videoId}&topic=${encodeURIComponent(course.topic)}" target="_blank">
                <button>Start Learning</button>
            </a>
        </div>
    `).join('');
}

// Call on page load
window.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadCourses();
    loadAssignedCourses();
});
