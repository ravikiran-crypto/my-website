// Firestore Integration Helper - Add these updated functions to dashboard.html
// Replace the existing localStorage functions with these Firestore-enabled versions

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
        alert('Please fill in all fields');
        return;
    }

    const userData = { employeeId, name, email, role, lastActive: '' };
    
    if (window.firestoreDB) {
        const result = await window.firestoreDB.saveUser(userData);
        if (result.success) {
            alert('User added successfully to Firestore!');
            closeAddUserModal();
            loadUsers();
            syncCurrentUserRole();
        } else {
            alert('Error adding user: ' + result.error);
        }
    } else {
        // Fallback to localStorage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        users.push(userData);
        localStorage.setItem('users', JSON.stringify(users));
        alert('User added to localStorage (Firestore not available)');
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

    if (!confirm(`Change role of ${employeeName} from "${oldRole}" to "${value}"?`)) {
        loadUsers();
        return;
    }

    if (window.firestoreDB) {
        const result = await window.firestoreDB.updateUserRole(employeeId, value);
        if (result.success) {
            alert(`${employeeName}'s role changed to ${value} in Firestore!`);
            loadUsers();
            syncCurrentUserRole();
        } else {
            alert('Error updating role: ' + result.error);
        }
    } else {
        users[index].role = value;
        localStorage.setItem('users', JSON.stringify(users));
        alert(`${employeeName}'s role changed to ${value} in localStorage`);
        loadUsers();
        syncCurrentUserRole();
    }
}

async function deleteSelectedRoles() {
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('No users selected');
        return;
    }
    
    if (!confirm(`Delete ${checkboxes.length} selected user(s)?`)) return;

    let users = [];
    if (window.firestoreDB) {
        users = await window.firestoreDB.getAllUsers();
        
        for (let checkbox of checkboxes) {
            const index = parseInt(checkbox.getAttribute('data-index'));
            if (users[index] && users[index].employeeId) {
                await window.firestoreDB.deleteUser(users[index].employeeId);
            }
        }
        alert('Users deleted from Firestore!');
    } else {
        users = JSON.parse(localStorage.getItem('users') || '[]');
        const indices = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-index')));
        const remaining = users.filter((_, i) => !indices.includes(i));
        localStorage.setItem('users', JSON.stringify(remaining));
        alert('Users deleted from localStorage');
    }
    
    loadUsers();
}

// ============ COURSE MANAGEMENT FUNCTIONS ============

async function saveNewCourse() {
    const name = document.getElementById('newCourseName').value.trim();
    const type = document.getElementById('newCourseType').value;
    const videoId = document.getElementById('newVideoId').value.trim();

    if (!name || !videoId) {
        alert('Please fill in all required fields.');
        return;
    }

    const uploadDate = new Date().toLocaleDateString();
    const courseData = { name, type, videoId, uploadDate, id: Date.now().toString() };

    if (window.firestoreDB) {
        const result = await window.firestoreDB.saveCourse(courseData);
        if (result.success) {
            alert('Course added to Firestore!');
            closeAddCourseModal();
            loadCourses();
        } else {
            alert('Error adding course: ' + result.error);
        }
    } else {
        const courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses.push(courseData);
        localStorage.setItem('courses', JSON.stringify(courses));
        alert('Course added to localStorage');
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
    if (!confirm('Delete this course?')) return;

    if (window.firestoreDB) {
        const result = await window.firestoreDB.deleteCourse(courseId);
        if (result.success) {
            alert('Course deleted from Firestore!');
            loadCourses();
        } else {
            alert('Error deleting course: ' + result.error);
        }
    } else {
        let courses = JSON.parse(localStorage.getItem('courses') || '[]');
        courses = courses.filter(c => c.id !== courseId);
        localStorage.setItem('courses', JSON.stringify(courses));
        alert('Course deleted from localStorage');
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
            console.log('✅ Course saved to Firestore');
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
