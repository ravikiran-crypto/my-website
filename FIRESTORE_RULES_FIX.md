# URGENT: Fix Firestore Security Rules

## The Problem
Users cannot see courses because Firestore is blocking unauthenticated read/write requests.

## The Solution (2 minutes)

1. **Go to Firebase Console**: https://console.firebase.google.com/project/oneorigin-learning-hub/firestore/rules

2. **Replace the rules with this:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads and writes (for development/demo)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. **Click "Publish"**

4. **Refresh both dashboards** (admin and user)

## That's it!

Now all users can read and write to Firestore.

---

**Note**: For production, you'd want proper authentication. But for submission/demo, this works perfectly.
