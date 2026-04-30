# 🥦 FridgeTracker

Track your food inventory, see what's expiring, get recipe ideas, and manage your shopping list.

---

## What You Need (Both Free)

| Service | What it does |
|---------|-------------|
| **Firebase** (by Google) | Saves your fridge data safely — works on phone + computer |
| **Vercel** | Hosts the live app so you can open it anywhere |

You already have the code on GitHub from the previous step. Now just two more things to set up.

---

## Step 1 — Set Up Firebase

Firebase is Google's database service. Since you have a Google account, this takes about 5 minutes.

### 1a — Create a project

1. Go to **firebase.google.com** and click **Get started**
2. Sign in with your Google account
3. Click **Create a project**
4. Name it `fridgetracker` and click **Continue**
5. Turn **off** Google Analytics (you don't need it) and click **Create project**
6. Wait about 30 seconds for it to set up, then click **Continue**

### 1b — Get your keys

1. On the Firebase project page, click the **web icon** `</>` (it says "Add an app to get started")
2. Give the app a nickname like `fridgetracker-web` and click **Register app**
3. You will see a block of code that looks like this:

```
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "fridgetracker-abc.firebaseapp.com",
  projectId: "fridgetracker-abc",
  storageBucket: "fridgetracker-abc.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

4. **Keep this page open** — you will need these values in Step 2

### 1c — Create the database

1. In the left sidebar, click **Build** → **Firestore Database**
2. Click **Create database**
3. Select **Start in test mode** and click **Next**
4. Choose any region close to you (e.g. `us-east1`) and click **Enable**
5. Done — your database is ready

---

## Step 2 — Deploy to Vercel

1. Go to **vercel.com** and sign in with your GitHub account
2. Click **Add New Project**
3. Find `fridgetracker` in the list and click **Import**
4. Before clicking Deploy, look for the **Environment Variables** section and add these 6 variables one by one:

| Variable name | Where to find the value |
|--------------|------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` from Step 1b |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` from Step 1b |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` from Step 1b |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` from Step 1b |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` from Step 1b |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` from Step 1b |

For each one:
- Type the variable name in the **Name** box
- Paste the value (from your Firebase config) in the **Value** box
- Click **Add**

5. Once all 6 are added, click **Deploy**
6. After about 2 minutes you will get a live link like `https://fridgetracker-abc.vercel.app`

**That's it — your app is live!** Open the link on your phone and computer to use it.

---

## Step 3 — Add to your phone home screen (optional but recommended)

This makes it feel like a real app on your phone.

**On iPhone:**
1. Open your Vercel link in **Safari**
2. Tap the **Share** button (the box with an arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

**On Android:**
1. Open your Vercel link in **Chrome**
2. Tap the three dots menu → **Add to Home screen**
3. Tap **Add**

---

## How the App Works

**Fridge tab** — your inventory sorted by what's expiring soonest
- 🔴 Red = expired or expiring within 2 days
- 🟡 Yellow = expiring in 3–5 days
- 🟢 Green = 6+ days left
- Tap ✓ when you use something (adds to shopping list automatically)
- Tap ✕ to discard (adds to shopping list automatically)

**Add Item tab** — two ways to add:
- **Manual** — type the name and date. Common items like milk, spinach, chicken auto-fill the expiry date
- **Leftover / Takeout** — type the restaurant or food name and the date is filled in automatically (e.g. Chick-fil-A = 2 days, leftover pasta = 3 days)

**Alerts tab** — shows everything expiring soon in one place. You can also enable browser notifications here so the app alerts you when you open it.

**Recipes tab** — suggests simple recipes based on what you currently have

**Shopping tab** — items appear here automatically when you mark something as used or expired. You can also add items manually.

---

## If You Update the Code Later

Any time you change code and push to GitHub, Vercel automatically redeploys. You don't need to do anything in Vercel again.

To push updates from Terminal:
```bash
git add .
git commit -m "describe what you changed"
git push
```

---

## Troubleshooting

**App loads but data doesn't save** — check that all 6 Firebase environment variables are set correctly in Vercel (Settings → Environment Variables). Make sure there are no extra spaces.

**"Firebase: Error (permission-denied)"** — your Firestore is in test mode which expires after 30 days. Go to Firebase → Firestore → Rules and change the expiry date or set rules to allow read/write.

**Notifications not working** — browser notifications only work when you have the app open. On iPhone, they only work if you've added the app to your home screen first.
