# SiteSync — Site Attendance & Labour Payroll

A MERN-stack web app for local builders and contractors. Supervisors record daily worker attendance on their phone
with **GPS and photo proof**, give **advances**, and the system generates a **weekly payroll** (PDF / Excel / wage
slips) with advances deducted automatically.

## Features

| Area | What it does |
|---|---|
| **Role-based login** | JWT auth. **Admin** (contractor) has full access. **Supervisor** only sees the sites assigned to them. First run asks you to create the admin account. |
| **Sites** | Name, client, address, GPS pin + allowed radius, payroll week start day (e.g. Saturday), status. |
| **Workers** | Profile with photo, CNIC, phone, skill, daily wage, overtime rate (defaults to wage ÷ 8). Deactivate instead of delete so history stays. |
| **Mark attendance** | One screen per site per day: tap **P / ½ / A**, enter overtime hours, "mark rest present". Captures phone **GPS** and an optional **group photo** (compressed on the phone before upload). |
| **Geofence check** | Server computes distance to the site pin (Haversine). Entries outside the radius are **flagged** and shown on the dashboard and log. |
| **Anti-tampering** | Supervisors can only mark *today*; their entries lock after 24 h (configurable). Once a week's payroll is approved, that week's attendance and advances are frozen. Each record stores who marked it and when. |
| **Rate snapshot** | Each attendance record stores the wage on that day, so a mid-week raise is paid correctly. |
| **Advances** | Record cash given to a worker. Deducted in that week's payroll. If the advance is more than the earnings, the balance **carries forward** to next week. |
| **Weekly payroll** | Draft → **Approved** → **Paid**. Regenerate drafts at any time; approval checks that the numbers are still current. Admin can reopen an unpaid payroll. |
| **Reports** | Site wage sheet as **PDF** (with signature column) and **Excel**; individual **wage slip** PDF per worker. |
| **Dashboard** | Present today, not yet marked, GPS flags, running wage bill this week, unsettled advances, 14-day attendance chart, per-site status, pending payrolls. |
| **Worker profile** | Monthly attendance calendar, advances, payroll history with slips. |
| **Urdu / English** | One-tap language toggle. Full Urdu translation with right-to-left layout and the Noto Nastaliq Urdu font. The choice is remembered on each device. |
| **Offline attendance (PWA)** | Installable app. Attendance saved with no internet is stored on the phone (IndexedDB, including the photo) and uploads automatically when the connection returns. |
| **Wage slips by WhatsApp / SMS** | Each worker gets a ready-made message (English or Urdu) with their week's pay and a link to their PDF slip. Tap to send from your phone, or send all from the server through Twilio. |

## Urdu language

- The **English / اردو** button is in the sidebar, the mobile top bar and the login page.
- Switching sets `<html lang="ur" dir="rtl">`, so the whole layout mirrors. Spacing uses Tailwind's logical
  classes (`ms-`, `ps-`, `start-`, `text-end`), so the same markup works in both directions.
- All text lives in [client/src/i18n/translations.js](client/src/i18n/translations.js). To change a word, edit it there.
  Dates and money follow the language too (e.g. `13,000 روپے`, `23 اکتوبر`).
- Server error messages and the PDF reports are still in English. Wage slip messages can be sent in either language.

## Offline attendance (PWA)

How it works:

1. The app is a **Progressive Web App**: a service worker caches the app itself, so it opens with no signal, and
   caches recent API reads (sites, the attendance sheet, worker photos) for offline viewing.
2. If **Save attendance** can't reach the server, the sheet (statuses, overtime, GPS and the photo) is saved in the
   phone's **IndexedDB** and the worker rows show **Waiting to upload**.
3. A banner shows how many sheets are waiting. They upload automatically when the phone comes back online, every
   minute while the app is open, or when you tap **Sync now**.
4. The server accepts a late upload for up to `OFFLINE_SYNC_DAYS` (default 3) days. Each record is marked
   **Offline** with the time it was captured, so the admin can see it in the attendance log.
5. If the server refuses a sheet (for example, that week's payroll was already approved), it appears under
   **Upload problems** with the reason. The supervisor can retry or discard it.

To install it on a phone, open the site in Chrome, then choose **Install app** in the sidebar or **Add to Home screen**.

> Service workers only run on `https://` or `localhost`, and only in the production build. To try offline mode on your
> PC: `npm run build` then `npm run preview` in `client/`, open http://localhost:4173 in Chrome, then in DevTools →
> Network choose **Offline**.

## Wage slips by WhatsApp / SMS

Open an **approved** or **paid** payroll and click **Send slips**. For every worker you get:

- **WhatsApp:** opens `wa.me` with the message already typed. Just press send. Free, no setup.
- **SMS:** opens the phone's SMS app with the message already typed. Free, no setup.
- **Share PDF** (on phones): shares the actual PDF file through the share sheet, for example to WhatsApp.
- **Copy** and **Open slip**.

Phone numbers like `0300-1234567` are converted to `+923001234567` (`DEFAULT_COUNTRY_CODE`, default 92).

Each message contains a short **signed link** (`/api/public/slip/...`) that opens the worker's PDF slip without
logging in. The link can't be guessed or changed to another worker, and it stops working `SLIP_LINK_DAYS` (default 60)
days after the payroll week. Set `PUBLIC_URL` to your deployed address so the links work on workers' phones.

**Sending everything from the server** (admin only) uses `MESSAGE_PROVIDER` in `server/.env`:

| Value | What happens |
|---|---|
| `none` (default) | Only the tap-to-send buttons above |
| `console` | Messages are printed in the server terminal (demo mode; `npm run dev:memory` uses this) |
| `twilio` | Real SMS and/or WhatsApp through Twilio. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` and/or `TWILIO_WHATSAPP_FROM` |

Every server-sent message is logged on the payroll, and the window shows **Sent by SMS / WhatsApp** with the time.

### Payroll formula

```
wages       = present days × day rate + half days × day rate ÷ 2
overtime    = OT hours × OT rate
gross       = wages + overtime
deductions  = advances this week + balance carried from last week
net pay     = max(0, gross − deductions)
carry fwd   = max(0, deductions − gross)
```

## Tech stack

- **Frontend:** React 18 + Vite, React Router, Tailwind CSS, Recharts, lucide-react icons, axios
- **Backend:** Node.js + Express, MongoDB + Mongoose, JWT + bcrypt, Multer (photo uploads), PDFKit, ExcelJS
- **Dev:** `mongodb-memory-server` so you can run everything without installing MongoDB

## Getting started

Requires **Node.js 18+**.

### 1. Install

```bash
cd server
npm install
cd ../client
npm install
```

### 2a. Quick try (no MongoDB needed)

Runs the API with a temporary in-memory database pre-filled with demo data. The first run downloads a MongoDB
binary (about 600 MB, one time only). **Data is wiped every time you stop it.**

```bash
cd server
npm run dev:memory
```

### 2b. Real database (local MongoDB or MongoDB Atlas)

```bash
cd server
cp .env.example .env      # then edit MONGO_URI and JWT_SECRET
npm run seed              # optional: wipes the DB and loads demo data
npm run dev
```

### 3. Start the frontend

In a second terminal:

```bash
cd client
npm run dev
```

Open http://localhost:5173. To test on a phone on the same Wi-Fi, open `http://<your-PC-IP>:5173`.

> **Note:** browsers only allow GPS on `https://` or `localhost`. On a phone over plain `http://` the location
> button will fail. Deploy with HTTPS (Render, Railway, Vercel, etc.) for real use on site.

### Demo logins (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | admin@sitesync.com | admin123 |
| Supervisor (DHA site) | ali@sitesync.com | super123 |
| Supervisor (Bahria site) | bilal@sitesync.com | super123 |

## Production build

```bash
cd client && npm run build
cd ../server && NODE_ENV=production npm start
```

With `NODE_ENV=production` the Express server also serves the built React app from `client/dist`, so the app runs on
one port.

## Project structure

```
server/
  src/
    models/        User, Site, Worker, Attendance, Advance, Payroll
    routes/        auth, users, sites, workers, attendance, advances, payroll, dashboard
    services/      payroll.js (builds payroll lines), reports.js (PDF / Excel),
                   messaging.js (phone numbers, slip messages, signed links, Twilio)
    utils/         payrollCalc.js (pure payroll maths), geo.js (Haversine), dates.js (payroll weeks)
    middleware/    auth.js (JWT + roles + site scoping), upload.js (Multer), error.js
    seed/          demo data
  uploads/         worker and attendance photos (created automatically)
client/
  src/
    pages/         Dashboard, MarkAttendance, AttendanceLog, Workers, WorkerDetail,
                   Advances, Payroll, PayrollDetail, Sites, Users, Account, Login
    components/    Layout (sidebar, sync banner), ui.jsx (buttons, cards, modals…), WorkerForm, SendSlipsModal
    i18n/          translations.js (English + Urdu), LanguageContext.jsx
    offline/       queue.js (IndexedDB queue), OfflineContext.jsx (auto-sync)
    utils/         device.js (GPS, photo compression), format.js
  public/          PWA icons
```

## API overview

All routes except login/setup need `Authorization: Bearer <token>`.

| Method | Route | Who | Purpose |
|---|---|---|---|
| GET | `/api/auth/status` | public | Is first-run setup needed? |
| POST | `/api/auth/setup` | public (once) | Create the first admin |
| POST | `/api/auth/login` | public | Log in |
| GET / POST / PUT / DELETE | `/api/users` | admin | Manage admins and supervisors |
| GET / POST / PUT / DELETE | `/api/sites` | read: all · write: admin | Sites |
| GET / POST / PUT / DELETE | `/api/workers` | admin, supervisor | Workers (multipart for photo) |
| GET | `/api/workers/:id/attendance?month=YYYY-MM` | admin, supervisor | Calendar data |
| GET | `/api/attendance/sheet?site=&date=` | admin, supervisor | Day sheet for marking |
| POST | `/api/attendance` | admin, supervisor | Save many entries (multipart: entries JSON, lat, lng, photo) |
| GET | `/api/attendance?site=&from=&to=&flagged=` | admin, supervisor | Attendance log |
| GET / POST / DELETE | `/api/advances` | admin, supervisor | Advances |
| POST | `/api/payroll/generate` | admin, supervisor | Create or refresh the draft for a week |
| PATCH | `/api/payroll/:id/approve` · `/pay` · `/reopen` | admin | Payroll workflow |
| GET | `/api/payroll/:id/pdf` · `/excel` · `/slip/:workerId` | admin, supervisor | Downloads |
| GET | `/api/dashboard` | admin, supervisor | Dashboard numbers |
| GET | `/api/payroll/:id/messages?lang=en\|ur` | admin, supervisor | Slip messages with WhatsApp / SMS links |
| POST | `/api/payroll/:id/notify` | admin | Send slips from the server (`channel: sms \| whatsapp`) |
| GET | `/api/public/slip/:token` | public (signed link) | A worker's PDF wage slip |

## Ideas to extend

- Store photos on Cloudinary or S3 instead of the local `uploads/` folder
- Urdu wage slip PDFs (PDFKit needs an Arabic-shaping step for Nastaliq text)
- Face match between the attendance photo and the worker's profile photo
