# 🚀 OneOrigin Hub - How to Access

## ⚠️ IMPORTANT: Server Must Be Running!

This application **REQUIRES** a backend server to work properly. You **CANNOT** open the HTML files directly.

---

## ✅ Correct Way to Access:

### **Step 1: Start the Server**

Open PowerShell/Terminal in the project folder and run:

```powershell
npm start
```

You should see:
```
🚀 Server running on http://localhost:3000
📡 API endpoints available at http://localhost:3000/api/
✅ GEMINI_API_KEY loaded: AIzaSyCls...kfZg
```

### **Step 2: Open in Browser**

Go to: **http://localhost:3000**

NOT: ~~file:///C:/Users/.../index.html~~ ❌

---

## 👥 For Other Users:

### **Option A: Same Computer (Localhost)**

If users are on the same computer:
1. Make sure server is running
2. Tell them to go to: `http://localhost:3000`

### **Option B: Different Computers (Network Access)**

If users are on different computers in the same network:

1. **Find your computer's IP address:**
   ```powershell
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., `192.168.1.100`)

2. **Update api-config.js:**
   ```javascript
   const API_BASE_URL = 'http://192.168.1.100:3000';
   ```

3. **Share the URL with users:**
   ```
   http://192.168.1.100:3000
   ```

4. **Make sure Windows Firewall allows port 3000**

### **Option C: Deploy to Cloud (Production)**

For internet access from anywhere:

1. **Deploy to Heroku, Railway, or Render:**
   - Follow deployment guide in SETUP_INSTRUCTIONS.md
   - Get a public URL like: `https://oneorigin-hub.herokuapp.com`

2. **Update api-config.js with production URL:**
   ```javascript
   const API_BASE_URL = 'https://oneorigin-hub.herokuapp.com';
   ```

3. **Share the public URL with users**

---

## 🔧 Troubleshooting

### **"API_KEY isn't working"**
**Cause:** Users are opening files directly (file:// protocol)  
**Fix:** Access via `http://localhost:3000`

### **"Cannot connect to localhost:3000"**
**Cause:** Server isn't running  
**Fix:** Run `npm start` in the project folder

### **"Other users can't access"**
**Cause:** Using localhost URL on different computers  
**Fix:** Use network IP (Option B) or deploy to cloud (Option C)

### **"Port 3000 already in use"**
**Cause:** Another app is using port 3000  
**Fix:** Change PORT in `.env` file:
```env
PORT=3001
```
Then access: `http://localhost:3001`

---

## 📋 Quick Start Checklist

- [ ] Server is running (`npm start`)
- [ ] Accessing via `http://localhost:3000` (not file://)
- [ ] `.env` file has Gemini API key
- [ ] All users access through the server URL

---

## 🌐 Network Setup (For Multiple Users)

### **Step-by-Step:**

1. **On the server computer:**
   ```powershell
   # Find your IP
   ipconfig
   # Example output: IPv4 Address: 192.168.1.100
   
   # Start server
   npm start
   ```

2. **Update api-config.js:**
   ```javascript
   const API_BASE_URL = 'http://192.168.1.100:3000';
   ```

3. **On user computers:**
   - Open browser
   - Go to: `http://192.168.1.100:3000`
   - Login with @oneorigin.us email

4. **Windows Firewall (if needed):**
   ```powershell
   # Allow Node.js through firewall
   New-NetFirewallRule -DisplayName "OneOrigin Hub" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

---

## 📱 Access URLs Summary

| Scenario | URL to Use | Requirements |
|----------|------------|--------------|
| Same computer | `http://localhost:3000` | Server running |
| Same network | `http://192.168.x.x:3000` | Server running, Firewall open |
| Internet | `https://your-app.com` | Deployed to cloud |

---

## ⚡ Pro Tips

1. **Always keep server running** when users need access
2. **Don't share localhost URLs** with users on different computers
3. **Deploy to cloud** for permanent internet access
4. **Check console** in browser DevTools (F12) for errors
5. **Restart server** after changing `.env` file

---

## 🆘 Common Errors

### Error: "Failed to fetch"
- Server not running
- Wrong URL (using file:// instead of http://)
- Firewall blocking port 3000

### Error: "API key not configured"
- Missing Gemini API key in `.env`
- Server needs restart after adding key

### Error: "Cannot GET /"
- Server running but index.html missing
- Check if all files are in the same folder

---

**Remember:** The app **MUST** be accessed through the server at `http://localhost:3000` or your network/deployment URL!
