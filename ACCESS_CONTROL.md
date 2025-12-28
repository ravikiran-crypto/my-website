# 🔐 Superadmin & Access Control

## ✅ What's Configured

### **Superadmin Account:**
- **Email:** `ravikiran@oneorigin.us`
- **Role:** Permanent Admin (cannot be changed)
- **Powers:** Full admin access, can grant/revoke admin to others

---

## 🎯 How It Works

### **1. Logout Behavior:**
- ✅ Any user (including Admin) who logs out is redirected to **Login page**
- ✅ All session data cleared (userEmail, userName, userRole)
- ✅ Data preserved: users, courses, announcements, etc.

### **2. Superadmin (ravikiran@oneorigin.us):**
- ✅ **Automatically Admin** on every login
- ✅ **Cannot be demoted** to User role
- ✅ **Cannot be deleted** from system
- ✅ **Always appears** in Role Management
- ✅ Created automatically if doesn't exist

### **3. Regular Users:**
- ✅ Default role: **User**
- ✅ Can only be promoted to Admin by existing Admin
- ✅ Cannot access Admin sections until promoted

### **4. Admin Users (Promoted):**
- ✅ Get admin access when role changed to "Admin"
- ✅ Can manage other users (except superadmin)
- ✅ Can grant/revoke admin access to others
- ✅ Cannot modify superadmin's role

---

## 📋 User Access Flow

### **First Time Setup:**

1. **Superadmin (ravikiran@oneorigin.us) logs in:**
   - Automatically gets Admin access ✅
   - Sees: Role Management, Course Management

2. **Other users log in:**
   - Default role: User
   - Cannot see admin sections
   - See: Home, Courses, Measure & Master, Hub Bot

3. **Superadmin promotes users:**
   - Go to Role Management
   - Find user → Change role to "Admin"
   - User must refresh browser to see admin sections

---

## 🛡️ Protection Rules

### **Superadmin Protection:**

| Action | Allowed? | Result |
|--------|----------|--------|
| Change role to User | ❌ | Alert: "Cannot change superadmin role" |
| Delete account | ❌ | Alert: "Cannot delete superadmin" |
| Remove from bulk delete | ❌ | Alert: "Superadmin cannot be removed" |
| Login | ✅ | Auto-promoted to Admin |

### **Regular Admin Protection:**

| Action | Allowed? | Who Can Do It? |
|--------|----------|----------------|
| Promote to Admin | ✅ | Any Admin |
| Demote to User | ✅ | Any Admin (except superadmin) |
| Delete account | ✅ | Any Admin |

---

## 🔄 Access Control Matrix

| User Type | Home | Courses | News | Measure & Master | Hub Bot | Course Mgmt | Role Mgmt |
|-----------|------|---------|------|------------------|---------|-------------|-----------|
| **Not Logged In** | Redirect to Login | ➡️ | ➡️ | ➡️ | ➡️ | ➡️ | ➡️ |
| **User (Default)** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Admin (Promoted)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Superadmin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🧪 Testing Guide

### **Test 1: Superadmin Access**
1. Login as `ravikiran@oneorigin.us`
2. ✅ Should see Course Mgmt and Role Mgmt in sidebar
3. ✅ Role should be "Admin" in Role Management
4. Try to change own role to "User"
5. ✅ Should see alert: "Cannot change superadmin role"

### **Test 2: New User Access**
1. Login as any other @oneorigin.us email
2. ✅ Should NOT see Course Mgmt or Role Mgmt
3. ✅ Should see: Home, Courses, News, Measure & Master, Hub Bot
4. ✅ Default role should be "User"

### **Test 3: Promote User**
1. Login as superadmin
2. Go to Role Management
3. Find the new user
4. Change role from "User" to "Admin"
5. ✅ User gets promoted
6. User refreshes browser
7. ✅ User now sees admin sections

### **Test 4: Logout**
1. Click "Log out" button
2. ✅ Redirected to Login page (`index.html`)
3. ✅ Cannot access dashboard without login

### **Test 5: Direct Access Without Login**
1. Clear localStorage or open incognito
2. Try to go directly to `http://localhost:3000/dashboard.html`
3. ✅ Should redirect to `index.html` (login page)

---

## 🔑 Admin Capabilities

### **What Admins Can Do:**

1. **User Management:**
   - Add new users
   - Change user roles (User ↔ Admin)
   - Delete users (except superadmin)

2. **Course Management:**
   - Add courses
   - Delete courses
   - Manage course content

3. **System Functions:**
   - Refresh AI news for all users
   - Access all features

### **What Admins CANNOT Do:**

1. ❌ Change superadmin role
2. ❌ Delete superadmin
3. ❌ Remove superadmin from user list

---

## 📝 Important Notes

1. **Superadmin email is hardcoded:** `ravikiran@oneorigin.us`
2. **Case-insensitive:** Works with any capitalization
3. **Auto-created:** If doesn't exist in users list, created automatically
4. **Permanent:** Cannot be removed or demoted
5. **Multiple admins allowed:** Superadmin can promote others

---

## 🆘 Troubleshooting

### **Problem: User still sees admin sections after demotion**
**Solution:** User needs to refresh browser (Ctrl+F5)

### **Problem: Superadmin showing as "User"**
**Solution:** Refresh the page - superadmin is auto-promoted on page load

### **Problem: Can't access dashboard after logout**
**Solution:** This is correct behavior - must login again through index.html

### **Problem: User added but role not syncing**
**Solution:** Make sure user email matches login email exactly

---

## 🚀 Quick Commands

```javascript
// In browser console (for debugging):

// Check current user role
localStorage.getItem('userRole')

// Check current user email
localStorage.getItem('userEmail')

// Force superadmin check (refresh after)
syncCurrentUserRole()
checkAdminStatus()

// View all users
JSON.parse(localStorage.getItem('users'))
```

---

**Your access control is now fully configured!** 🎉

- Superadmin: `ravikiran@oneorigin.us` ✅
- Logout: Always redirects to login ✅
- Protection: Superadmin cannot be modified ✅
