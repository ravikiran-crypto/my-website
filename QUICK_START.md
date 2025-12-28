# 🔐 Quick Start - API Security Setup

## ⚡ Fast Setup (5 minutes)

### 1️⃣ Add Your Gemini API Key
Open **`.env`** file and replace `your_gemini_api_key_here` with your actual key:
```env
GEMINI_API_KEY=AIzaSy...your_actual_key
```
Get key: https://makersuite.google.com/app/apikey

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Start Server
```bash
npm start
```

### 4️⃣ Open App
Navigate to: `http://localhost:3000`

---

## 📍 Where to Add What

### `.env` file (Line 7)
```env
GEMINI_API_KEY=YOUR_ACTUAL_GEMINI_API_KEY_HERE
```
👆 **Replace with your real Gemini API key**

### For Production Deployment:

#### Option A: Keep Using Express Server
- Deploy to Heroku, Railway, or any Node.js host
- Set environment variable `GEMINI_API_KEY` on the host
- Update `api-config.js` line 5 with your production server URL

#### Option B: Use Firebase Functions
```bash
# Set Gemini API key in Firebase
firebase functions:config:set gemini.api_key="YOUR_KEY"

# Deploy functions
firebase deploy --only functions

# Update api-config.js with your Firebase Functions URL
# Line 5: const API_BASE_URL = 'https://YOUR-PROJECT.cloudfunctions.net';
```

---

## ✅ What's Protected Now

- ✅ Gemini API key is now in `.env` (not in code)
- ✅ `.env` is in `.gitignore` (won't be committed)
- ✅ All Gemini API calls go through your backend
- ✅ API key is never exposed to browser

## 🔴 Critical Notes

### Firebase API Key (Already in your code)
The Firebase key `AIzaSyDnfIJQxO6mi2_NEGqXRGH5EAxeaNcb7qc` in [auth.js](auth.js), [login.html](login.html), and [course-view.html](course-view.html) is **OKAY to be public** because:
- Firebase uses authentication + security rules
- It's designed for client-side use
- Protected by domain restrictions

**BUT you should:**
1. Enable Firebase Security Rules
2. Set up Firebase App Check  
3. Add domain restrictions in Google Cloud Console

See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md#important-notes-about-firebase-api-key) for details.

---

## 🚨 NEVER Commit These Files
- ❌ `.env`
- ❌ `node_modules/`
- ❌ Any file with actual API keys

Already configured in `.gitignore` ✅

---

## 📁 Files Modified

### Created:
- `.env` - Your secret API keys
- `.gitignore` - Protects secrets
- `server.js` - Backend server
- `package.json` - Dependencies
- `api-config.js` - Frontend API helpers
- `functions/` - Firebase Functions
- `SETUP_INSTRUCTIONS.md` - Full guide

### Updated:
- `dashboard.html` - Now uses backend API

---

## 🆘 Quick Help

**Problem:** API key not configured error  
**Solution:** Add key to `.env` and restart server

**Problem:** Module not found  
**Solution:** Run `npm install`

**Problem:** Port already in use  
**Solution:** Change PORT in `.env` or kill existing process

**Problem:** CORS errors  
**Solution:** Make sure server is running on correct port

---

See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for complete documentation.
