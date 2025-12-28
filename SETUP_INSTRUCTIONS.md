# 🔐 API Key Security Setup Guide

## ✅ What's Been Done

I've created a complete security setup to protect your API keys from exposure:

### 📁 Files Created:

1. **`.env`** - Environment variables file (NEVER commit this!)
2. **`.gitignore`** - Prevents sensitive files from being committed
3. **`server.js`** - Express backend server to proxy API calls
4. **`package.json`** - Backend dependencies
5. **`api-config.js`** - Frontend API helper functions
6. **`functions/`** - Firebase Cloud Functions setup
7. **`firebase.json`** - Firebase configuration

### ✨ What Changed:

- **dashboard.html**: Updated to use backend API proxy instead of direct Gemini API calls
- **Gemini API Key**: Now hidden from client-side code
- All API calls now go through your backend server

---

## 🚀 Setup Instructions

### Option 1: Local Development with Express Server (Recommended for Testing)

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Configure Your API Keys
Open the **`.env`** file and add your actual Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
👉 Get your key from: https://makersuite.google.com/app/apikey

#### Step 3: Start the Backend Server
```bash
npm start
```
Or for development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:3000`

#### Step 4: Open Your Application
- Open [index.html](index.html) in your browser
- Or navigate to `http://localhost:3000` if using the server

---

### Option 2: Deploy with Firebase Functions (For Production)

#### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

#### Step 2: Login to Firebase
```bash
firebase login
```

#### Step 3: Initialize Firebase Project
```bash
firebase init
```
- Select: Functions, Hosting
- Choose your Firebase project: `oneorigin-learning-hub`
- Use existing `functions` folder
- Install dependencies: Yes

#### Step 4: Set Gemini API Key in Firebase
```bash
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY_HERE"
```

#### Step 5: Install Function Dependencies
```bash
cd functions
npm install
cd ..
```

#### Step 6: Deploy Functions
```bash
firebase deploy --only functions
```

#### Step 7: Update Frontend Configuration
After deployment, Firebase will give you function URLs like:
```
https://YOUR-PROJECT-ID.cloudfunctions.net/gemini
https://YOUR-PROJECT-ID.cloudfunctions.net/geminiCustom
```

Open [api-config.js](api-config.js) and update line 5:
```javascript
const API_BASE_URL = 'https://YOUR-PROJECT-ID.cloudfunctions.net';
```

OR uncomment the Firebase Functions section (lines 59-103) and use those functions instead.

---

## 🔒 Security Best Practices

### ✅ DO:
- Keep your `.env` file secret
- Add `.env` to `.gitignore` (already done)
- Use environment variables for all API keys
- Deploy with Firebase Functions or a backend server
- Enable Firebase Security Rules
- Set up domain restrictions in Google Cloud Console

### ❌ DON'T:
- Commit `.env` file to Git
- Share your API keys publicly
- Hardcode API keys in client-side code
- Deploy without setting environment variables

---

## 📝 Important Notes About Firebase API Key

**The Firebase API key in your code is actually SAFE to expose in client-side code.** Firebase uses:
- **Authentication** to verify users
- **Security Rules** to protect data
- **App Check** to prevent abuse

However, you should still:
1. **Enable Firebase Security Rules** for Firestore/Database
2. **Set up Firebase App Check** to prevent unauthorized use
3. **Add domain restrictions** in Google Cloud Console

### Setting Up Firebase Security:

#### 1. Enable Security Rules (Firestore/Database)
Go to Firebase Console > Firestore/Database > Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### 2. Set Up Firebase App Check
Go to Firebase Console > App Check > Register your app

#### 3. Add Domain Restrictions
Go to Google Cloud Console > APIs & Services > Credentials:
- Click on your API key
- Under "Application restrictions", select "HTTP referrers"
- Add your domains: `yourdomain.com`, `localhost:3000`

---

## 🧪 Testing Your Setup

### Local Server Test:
1. Start server: `npm start`
2. Open browser: `http://localhost:3000`
3. Try the "Measure & Master" assessment
4. Check if AI news loads
5. Test Hub Bot chat

### Check API Calls:
- Open Browser DevTools (F12) > Network tab
- API calls should go to: `http://localhost:3000/api/gemini` (not directly to Google API)

---

## 🆘 Troubleshooting

### Error: "Gemini API key not configured"
- Make sure you added `GEMINI_API_KEY` to `.env`
- Restart the server after editing `.env`

### Error: "Cannot find module 'express'"
- Run `npm install` in the project root

### Error: Module not found (Firebase Functions)
- Run `cd functions && npm install && cd ..`

### CORS Errors:
- Make sure your backend server is running
- Check that `API_BASE_URL` in [api-config.js](api-config.js) points to your server

---

## 📦 Project Structure

```
OneOrigin-Hub/
├── .env                    # ⚠️ SECRET - API keys (DO NOT COMMIT)
├── .gitignore              # Git ignore rules
├── server.js               # Express backend server
├── package.json            # Backend dependencies
├── api-config.js           # Frontend API configuration
├── firebase.json           # Firebase configuration
├── functions/              # Firebase Cloud Functions
│   ├── index.js            # Function definitions
│   ├── package.json        # Function dependencies
│   └── .gitignore
├── dashboard.html          # Main app (updated to use backend)
├── index.html
├── login.html
├── course-view.html
├── auth.js
└── style.css
```

---

## 🎯 Next Steps

1. ✅ Add your Gemini API key to `.env`
2. ✅ Run `npm install`
3. ✅ Start server with `npm start`
4. ✅ Test your application
5. ⚠️ **NEVER commit the `.env` file**
6. 🚀 Deploy to Firebase Functions when ready for production

---

## 🔗 Useful Links

- [Get Gemini API Key](https://makersuite.google.com/app/apikey)
- [Firebase Console](https://console.firebase.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Firebase Security Rules Docs](https://firebase.google.com/docs/rules)
- [Firebase App Check Docs](https://firebase.google.com/docs/app-check)

---

## ⚠️ CRITICAL REMINDERS

### Before you commit to Git:
```bash
# Check what files will be committed
git status

# Make sure .env is NOT listed!
# If it is, run:
git rm --cached .env
git add .gitignore
git commit -m "Add .gitignore"
```

### If you accidentally committed .env:
```bash
# Remove from Git history (dangerous - backup first!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (if remote)
git push origin --force --all
```

**Then immediately regenerate your API keys!**

---

Good luck! 🚀 Your API keys are now secure.
