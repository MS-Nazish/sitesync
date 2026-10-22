# Deploying SiteSync (free, no credit card)

**Live app:** https://sitesync-pi.vercel.app

| Part | Where | Notes |
|---|---|---|
| Frontend (React PWA) | Vercel project **`sitesync`**, root folder `client` | https://sitesync-pi.vercel.app |
| Backend (Express API) | Vercel project **`sitesync-api`**, root folder `server` | https://sitesync-api-murex.vercel.app — runs as one serverless function |
| Database + photos | MongoDB Atlas project **SiteSync**, free `Cluster0` (AWS Mumbai) | Photos are stored in MongoDB (`files` collection) |

The frontend sends every `/api/...` request on to the API project ([client/vercel.json](client/vercel.json)).
To the browser, everything is one address, so logins, offline caching, photos and wage-slip links all work through
`https://sitesync-pi.vercel.app`.

## How updates work

Commit and `git push` to `main`. Vercel rebuilds **both** projects automatically in about a minute.

## Settings

**`sitesync-api` → Settings → Environment Variables**

| Variable | Value | Why |
|---|---|---|
| `MONGO_URI` | `mongodb+srv://infotech8nz_db_user:<password>@cluster0.fk8odiy.mongodb.net/sitesync?retryWrites=true&w=majority` | Database. Secret: never commit it |
| `PUBLIC_URL` | `https://sitesync-pi.vercel.app` | Used in wage-slip links sent to workers |
| `APP_TIMEZONE` | `Asia/Karachi` | Decides what "today" is for attendance (Vercel doesn't allow `TZ`) |
| `DEFAULT_COUNTRY_CODE` | `92` | Turns `0300-…` into `+92300…` for WhatsApp/SMS |
| `MESSAGE_PROVIDER` | `none` | Set to `twilio` plus Twilio keys to send slips from the server |
| `NODE_ENV` | `production` | |
| `NODEJS_HELPERS` | `0` | Lets Express read request bodies itself (photo uploads) |

`JWT_SECRET` is optional. When it isn't set, the signing key is derived from `MONGO_URI`, so changing the database
password logs everyone out once.

After changing a variable, redeploy: **Deployments → ⋯ → Redeploy**.

**Atlas → Network Access** allows `0.0.0.0/0`, because Vercel functions have no fixed IP. The database is still
protected by its username and password.

## First use

1. Open https://sitesync-pi.vercel.app. The first visit shows **Create admin account**.
2. **Sites** → add a site. Stand at the site and tap *Use my location* to set the GPS pin.
3. **Users** → create a supervisor login for each site supervisor (or your tester) and assign their site.
4. **Workers** → add workers. Supervisors can then mark attendance from their phones.

To fill the database with **demo data** instead: put `MONGO_URI` in `server/.env` on your PC and run
`npm run seed` in `server/`. ⚠️ This **erases** the database first, and it creates the demo logins (`admin@sitesync.com` /
`admin123`), so change those passwords before sharing.

## Free-plan limits

- **Vercel Hobby:** generous for testing and small teams. The first request after a quiet period takes 1–3 seconds
  while the function starts.
- **Atlas M0:** 512 MB. Each attendance photo is ~100–400 KB, so that's roughly 1,500–3,000 photos plus all the
  records. Delete old photos or move to Cloudinary when it fills up.
- Request size limit is ~4.5 MB per upload. The app compresses phone photos before sending, so this isn't hit in
  practice.

## Troubleshooting

| Problem | Fix |
|---|---|
| Login page says it can't reach the server | Open https://sitesync-api-murex.vercel.app/api/health. If it isn't `{"ok":true}`, check the `sitesync-api` deployment logs |
| API logs: `MongoServerSelectionError` / `bad auth` | Wrong password in `MONGO_URI`, or Atlas Network Access lost `0.0.0.0/0` |
| Supervisors told "can only mark attendance for today" at night | `APP_TIMEZONE` is missing on `sitesync-api` |
| Wage-slip links open the wrong site | `PUBLIC_URL` on `sitesync-api` must be the frontend address |
| Changed something in `.env` but nothing happened | Environment changes need a **Redeploy** on Vercel |

## Alternative: Render

[render.yaml](render.yaml) still describes the API as a Render web service, if you ever prefer Render (it needs a card
on file, even for the free plan).
