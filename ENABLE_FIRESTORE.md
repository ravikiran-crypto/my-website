# 🚀 QUICK SETUP - Enable Firestore (2 Minutes)

## ⚠️ IMPORTANT: Enable Firestore for Multi-User Course Sharing

Your courses now use **Firebase Firestore** so ALL users can see the same courses!

### Quick Steps:

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/oneorigin-learning-hub

2. **Click "Firestore Database" in left menu**

3. **Click "Create Database"**

4. **Select "Start in production mode"** (or test mode)

5. **Choose location:** `us-central` (or closest to you)

6. **Click "Enable"** (takes 30 seconds)

7. **Done!** ✅

---

## ✅ After Enabling:

- Admin adds course → Saved to Firestore
- All users see the same courses instantly!
- Courses persist forever (never deleted)
- Works across all browsers and devices

---

## 🔒 Security Rules (Optional - After Testing):

If you want only admins to add/delete courses:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /courses/{courseId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /announcements/{announcementId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

**That's it! Enable Firestore and deploy to Vercel!** 🎉
