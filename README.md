# Pathshala Mitra — backend

This is the real backend the frontend (login.html) talks to. Netlify only
hosts static files, so this piece has to run somewhere else — this README
walks through Render (free tier, no credit card needed) for the server,
and Firestore (Google Cloud) for the data, so nothing is lost when Render
restarts or redeploys.

## 1. Set up Firestore

1. Go to https://console.firebase.google.com → **Add project** (you can
   use an existing Google account, no billing needed for this scale).
2. In your new project, go to **Build → Firestore Database → Create
   database**. Choose **Production mode** and any region close to your
   users. Nothing else needs configuring — this backend talks to
   Firestore only through the Admin SDK (server-side, using the key
   below), so the default security rules (which block all client
   access) are exactly right and don't need editing.
3. Go to **Project settings** (gear icon) → **Service accounts** →
   **Generate new private key**. This downloads a `.json` file — this is
   a real credential, treat it like a password. Never commit it to git
   (it's already covered by `.gitignore` if you do save a copy locally
   as `serviceAccountKey.json`).
4. You'll paste this file's contents into an environment variable in
   step 2 below — as a single line. If you're doing this from a
   terminal, this prints it minified and ready to paste:
   ```
   node -e "console.log(JSON.stringify(require('./serviceAccountKey.json')))"
   ```

## 2. Deploy this folder to Render

1. Put this `backend/` folder in its own GitHub repo (or a `backend/`
   subfolder of your existing repo).
2. Go to https://render.com → New → Web Service → connect that repo.
3. Settings:
   - **Root directory:** `backend` (only if it's a subfolder)
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Under **Environment**, add:
   - `JWT_SECRET` = any long random string (e.g. generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `FIREBASE_SERVICE_ACCOUNT` = the whole service account JSON from
     step 1, pasted as one line
5. Deploy. Render gives you a URL like `https://pathshala-mitra-backend.onrender.com`.

Note: Render's free tier sleeps after inactivity (first request after a
while takes ~30s to wake up) — that's just a cold start, not data loss.
Every account and school lives in Firestore now, not on Render's disk, so
it survives redeploys, restarts, and sleep/wake cycles.

## 3. Create your first Admin account

Render gives you a Shell tab for the deployed service (Dashboard → your
service → Shell). Run:

```
node createAdmin.js ADMIN-01 "MySecurePass123" "Your Name"
```

Pick your own Login ID and password — `ADMIN-01` is just an example. You
can run this again any time to reset a forgotten admin password.

(To create a Teacher or Student account the same way, copy
`createAdmin.js` and change `role: 'ADMIN'` to `role: 'TEACHER'` or
`'STUDENT'` — the login system treats all three the same way, only the
role differs.)

## 4. Create your Super Admin account (to manage schools)

`super-admin-dashboard.html` is a separate, higher-level panel — it creates
new schools (each with its own Admin login), and assigns/extends/overrides
each school's subscription. It needs its own account, role `SUPERADMIN`,
which is deliberately separate from any school's Admin account:

```
node createSuperAdmin.js SUPER-01 "MySecurePass123" "Your Name"
```

Log in at `/login` with that Login ID and you'll land on
`/super-admin`. Everything it does — creating a school, resetting a
password, changing a subscription — goes through `/api/schools*`, which
is locked to `SUPERADMIN` tokens only (see `middleware/auth.js` and how
it's wired into `server.js`); a school's own Admin/Teacher/Student token
gets a 403 if it tries to call those routes directly.

When the Super Admin creates a school, this backend does two things at
once: it saves the school + subscription record (in the `schools`
Firestore collection, via `schoolsDb.js`), and it creates that school's
Admin login account (in the `users` collection, the same one
`createAdmin.js` writes to) — so the school can log in immediately with
the username/password you set for them. Deactivating a school from the
dashboard flips that same login account's `active` flag off, which blocks
their login without deleting anything.

## 5. Connect the Netlify frontend to this backend

Your frontend calls `/api/auth/login` on its own domain (see login.html) —
it does NOT hardcode the Render URL, to avoid CORS and keep one clean
domain for users. Instead, `netlify.toml` proxies `/api/*` straight to
your Render service. Open `netlify.toml` and replace the placeholder in
the `/api/*` redirect with your actual Render URL from step 2, e.g.:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://pathshala-mitra-backend.onrender.com/api/:splat"
  status = 200
  force = true
```

Redeploy the Netlify site after editing this. Once both are live, logging
in at `/login` on your Netlify site will really authenticate against this
backend and redirect to the right dashboard by role.

## Running it locally first (optional, to test before deploying)

```
cd backend
npm install
FIREBASE_SERVICE_ACCOUNT="$(node -e "console.log(JSON.stringify(require('./serviceAccountKey.json')))")" \
JWT_SECRET=dev-secret npm start
node createAdmin.js ADMIN-01 "MySecurePass123" "Your Name"
node createSuperAdmin.js SUPER-01 "MySecurePass123" "Your Name"
```

(This assumes you've saved the downloaded service account key locally as
`backend/serviceAccountKey.json` — it's git-ignored, so it's safe to keep
it there for local testing. Every command that talks to Firestore — the
server itself, and the create-admin/create-superadmin scripts — needs
`FIREBASE_SERVICE_ACCOUNT` set in its environment.)

Then open `login.html` directly through a local static server (not
`file://`, `fetch` needs a real origin) on the same machine, on port 4000
for the API — or just test with curl:

```
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"ADMIN-01","password":"MySecurePass123"}'
```

A successful response returns a token and `"role":"ADMIN"`.
