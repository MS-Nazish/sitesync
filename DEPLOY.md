# Deploying SiteSync (free)

| Part | Where | Free plan |
|---|---|---|
| Frontend (React) | **Vercel** | Free forever, HTTPS included |
| Backend (Express API) | **Render** | Free web service (sleeps after 15 min idle) |
| Database | **MongoDB Atlas** | Free M0 cluster (512 MB) |

The frontend calls `/api/...` on its own Vercel address, and Vercel forwards those calls to Render
([client/vercel.json](client/vercel.json)). Because of that, the browser never deals with cross-site requests, and offline
caching, photos and wage-slip links all work through the one Vercel address.

Total time: about 30 minutes. Do the steps in this order.

---

## Step 1 — Database: MongoDB Atlas

1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. **Create a cluster**: choose **M0 Free**. For the region, pick the one closest to you (e.g. AWS Mumbai or Bahrain).
3. **Database Access** → *Add New Database User*. Choose a username and password, then **save the password**.
4. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`).
   Render's free plan has no fixed IP, so this is needed.
5. **Connect** → *Drivers* → copy the connection string. Replace `<password>` with your password and add the
   database name `sitesync` before the `?`:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/sitesync?retryWrites=true&w=majority
   ```

   Keep this string private.

## Step 2 — Code: GitHub

1. Go to https://github.com/new and name the repository `sitesync`. Choose **Private** and do **not** add a README.
   Then click **Create repository**.
2. In this project folder, run the commands below (replace `YOUR-USERNAME`). A browser window will ask you to sign in to GitHub.

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/sitesync.git
   ```

   ```bash
   git push -u origin main
   ```

## Step 3 — Backend: Render

1. Sign up at https://render.com with your GitHub account.
2. **New** → **Blueprint** → choose the `sitesync` repository. Render reads [render.yaml](render.yaml).
3. Render asks for two values:
   - `MONGO_URI`: the Atlas string from Step 1.
   - `PUBLIC_URL`: enter `https://sitesync.vercel.app` for now. You'll fix it in Step 4.
4. Click **Apply** and wait until the service shows **Live** (3–5 minutes).
5. Open `https://sitesync-api.onrender.com/api/health`. It should show `{"ok":true}`.
   If Render gave your service a different address, note it down.

The JWT secret is generated automatically. The timezone is set to Pakistan (`TZ=Asia/Karachi`), so "today" for
attendance matches local time.

## Step 4 — Frontend: Vercel

1. **Only if your Render address is not `sitesync-api.onrender.com`**: edit the two `destination` lines in
   [client/vercel.json](client/vercel.json), then commit and push.
2. Sign up at https://vercel.com with your GitHub account.
3. **Add New → Project** → import `sitesync`.
4. Set **Root Directory** to `client`. Vercel detects Vite by itself. Click **Deploy**.
5. Copy your address, e.g. `https://sitesync-abc123.vercel.app`.
6. Back in **Render → sitesync-api → Environment**, set `PUBLIC_URL` to that address and save. Render redeploys automatically.

## Step 5 — First login

1. Open your Vercel address. The first visit shows **Create admin account**. Make yours.
2. Add a **Site**. Stand at the site and tap *Use my location* for the GPS pin.
3. **Users** → create a supervisor account for your friend and assign the site.
4. Add some **Workers**, then share the link and login with your friend.

**Want the demo data instead?** Run the seed once from your PC against Atlas. ⚠️ It **wipes** that database first.

```bash
cd server
```

Create `server/.env` with `MONGO_URI=<your Atlas string>` and `JWT_SECRET=anything`, then:

```bash
npm run seed
```

The demo logins (`admin@sitesync.com` / `admin123`) then work. Change those passwords before sharing.
To show the "Fill demo login" buttons on the deployed login page, add `VITE_SHOW_DEMO=true` in
**Vercel → Settings → Environment Variables** and redeploy.

## Step 6 — Keep the backend awake (recommended)

Render's free plan sleeps after 15 minutes without visitors. The next visit then takes ~1 minute to start, and
during that time the app may say it can't reach the server. To avoid this:

1. Sign up at https://uptimerobot.com (free).
2. Add an **HTTP(s) monitor** for `https://sitesync-api.onrender.com/api/health` every **5 minutes**.

---

## Updating the app

Commit and `git push`. Vercel and Render both redeploy automatically.

## Free-plan limits to know

- **Photos are temporary on Render's free plan.** Worker and attendance photos are saved on the server's disk, and that
  disk is wiped whenever Render restarts or redeploys. That's fine for testing. For real use, move photo storage to
  Cloudinary (free tier).
- Atlas M0: 512 MB storage, which is plenty for thousands of attendance records.
- Wage-slip **WhatsApp / SMS buttons** work as-is (they open the phone's own apps). Sending from the server needs
  `MESSAGE_PROVIDER=twilio` plus Twilio keys in Render's environment.

## Troubleshooting

| Problem | Fix |
|---|---|
| Login page says it can't reach the server | Backend is waking up. Wait a minute and refresh, or set up Step 6 |
| Render log: `MongoServerSelectionError` | Atlas Network Access must allow `0.0.0.0/0`; check the password in `MONGO_URI` |
| Render log: `bad auth` | Wrong database user or password in `MONGO_URI` (special characters in the password must be URL-encoded) |
| Vercel page loads but every request fails with 404 | The Render address in `client/vercel.json` is wrong |
| Wage-slip links open `localhost` | `PUBLIC_URL` in Render is not set to your Vercel address |
| GPS button does nothing | Allow location for the site in the phone's browser settings |
