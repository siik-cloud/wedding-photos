# 📷 Fotky zo svadby Katky a Šimona

Wedding photo & video sharing app — mobile-first, simple enough for grandparents.

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Supabase · Vercel

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Upload** | No account, optional name, multiple files, direct-to-Supabase (no Vercel payload limits) |
| **Image compression** | Client-side JPEG resize/re-encode before upload (max 2500 px, quality 0.82) |
| **Per-file progress** | XHR progress events, status labels: Čaká / Pripravujem / % / Nahraté / Nepodarilo sa nahrať |
| **Retry** | Individual file retry; other files are not affected |
| **Double-tap guard** | `uploadingRef` prevents duplicate submissions |
| **Gallery** | Toggleable public gallery at `/gallery`; locked state when disabled |
| **Admin** | Dashboard with stats, gallery toggle, file management, test cleanup |
| **Test cleanup** | Safely deletes only files marked `is_test = true` OR uploaded before `WEDDING_START_TIMESTAMP` |
| **Security** | Server-side validation, service role key never in browser, HMAC-signed admin session |

---

## 🗂 Project Structure

```
wedding-photos/
├── app/
│   ├── page.tsx                      # Upload page + gallery card
│   ├── gallery/page.tsx              # Public gallery / locked state
│   ├── admin/page.tsx                # Admin panel
│   └── api/
│       ├── upload/init/route.ts      # Validate + signed upload URL
│       ├── upload/confirm/route.ts   # Record in database
│       ├── gallery/route.ts          # Public gallery API
│       └── admin/
│           ├── login/route.ts
│           ├── logout/route.ts
│           ├── files/route.ts
│           ├── files/[id]/route.ts
│           ├── settings/route.ts
│           └── cleanup/route.ts      # Test cleanup (GET preview / DELETE execute)
├── components/
│   ├── UploadForm.tsx                # Upload UI with compression + progress
│   ├── GalleryView.tsx               # Photo/video grid + lightbox
│   ├── AdminPanel.tsx                # Dashboard + cleanup section
│   └── AdminLogin.tsx
├── lib/
│   ├── imageCompression.ts           # Client-side JPEG compression (canvas)
│   ├── supabase-client.ts            # Browser client (anon key)
│   ├── supabase-server.ts            # Server client (service role)
│   ├── auth.ts                       # HMAC-signed admin session cookie
│   └── utils.ts                      # createId() — safe UUID with fallback
├── types/index.ts
└── supabase/
    ├── config.toml                       # Supabase CLI config
    └── migrations/
        ├── 20260523000000_create_uploads_table.sql
        ├── 20260523000001_create_settings_table.sql
        └── 20260523000002_add_is_test_to_uploads.sql
```

---

## 🚀 Setup — Step by Step

### Step 1 — Create a Supabase Project

1. Sign in at [supabase.com](https://supabase.com) → **New project**
2. Name: `wedding-photos` | Region: `eu-central-1` (Frankfurt, closest to Slovakia)
3. Save the database password somewhere safe
4. Wait ~2 minutes for provisioning

---

### Step 2 — Apply Database Migrations

The schema is managed through Supabase migrations — no manual SQL in the dashboard.

**Install the Supabase CLI** (once per machine):

```bash
npm install -g supabase
# or with Homebrew on macOS:
brew install supabase/tap/supabase
```

**Link to your remote project:**

```bash
# Your project ref is the subdomain of your Supabase URL.
# e.g. https://mngtodrqgogdulnbabgt.supabase.co → ref = mngtodrqgogdulnbabgt
supabase link --project-ref <your-project-ref>
```

This saves the remote connection into `.supabase/`. You only need to do this once per machine.

**Push migrations to the remote database:**

```bash
supabase db push
```

This applies any unapplied migrations in `supabase/migrations/` in order. Supabase tracks which migrations have already run, so it is safe to run again — it is idempotent.

You should see output like:

```
Applying migration 20260523000000_create_uploads_table.sql...
Applying migration 20260523000001_create_settings_table.sql...
Applying migration 20260523000002_add_is_test_to_uploads.sql...
```

> **No manual SQL required.** Do not run anything in the Supabase SQL editor.

---

### Step 3 — Create Storage Bucket

1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `wedding-uploads` ← exact, lowercase
3. Public bucket: **OFF** (private)
4. Click **Save**

No storage policies needed — the server uses the service role key which bypasses RLS.

---

### Step 4 — Get API Keys

Supabase dashboard → **Settings** → **API**:

| Key | Env variable |
|-----|-------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key | `SUPABASE_SECRET_KEY` |

> ⚠️ Never commit the secret key. It goes only in server-side env vars and is never sent to the browser.

---

### Step 5 — Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Publishable key — safe for the browser (replaces legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Secret key — server-side only, never exposed to the browser (replaces legacy SUPABASE_SERVICE_ROLE_KEY)
SUPABASE_SECRET_KEY=eyJ...

# Admin panel password — choose something strong
ADMIN_PASSWORD=your-strong-password

# Optional: timestamp of when the actual wedding starts.
# Files uploaded BEFORE this date are treated as test uploads
# and can be safely deleted via the admin "Vymazať test uploady" button.
# Format: ISO 8601 (any timezone)
# Example: 2026-06-06T10:00:00+02:00
WEDDING_START_TIMESTAMP=2026-06-06T10:00:00+02:00

# Cron secret — protects the /api/cron/purge-trash endpoint.
# Generate: openssl rand -hex 32
CRON_SECRET=replace-with-a-strong-random-secret
```

---

### Step 6 — Local Development

```bash
cd wedding-photos
npm install
npm run dev
# Opens at http://localhost:3000
```

---

### Step 7 — Test on a Phone Over Local Network (HTTP)

Since phones on the same Wi-Fi can reach your computer, you can test on real hardware without deploying:

```bash
# Find your machine's local IP
# Windows:
ipconfig
# Look for "IPv4 Address", e.g. 192.168.1.42

# macOS/Linux:
ifconfig | grep "inet "
```

Then start Next.js bound to all interfaces:

```bash
npm run dev -- --hostname 0.0.0.0
# or add to package.json scripts: "dev": "next dev --hostname 0.0.0.0"
```

Open **`http://192.168.1.42:3000`** on your phone (same Wi-Fi).

> **Note:** `http://` (not HTTPS) means `crypto.randomUUID()` may not be available.
> The app uses `createId()` in `lib/utils.ts` which has a safe fallback — this is handled.

---

### Step 8 — Deploy to Vercel

1. Push to GitHub:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USER/wedding-photos.git
   git push -u origin main
   ```

2. [vercel.com](https://vercel.com) → **Add New Project** → Import your repo

3. Under **Environment Variables**, add all variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SECRET_KEY
   ADMIN_PASSWORD
   WEDDING_START_TIMESTAMP   ← optional but recommended
   CRON_SECRET               ← required for trash auto-purge
   ```

4. Click **Deploy** (~2 min). You'll get a URL like `https://wedding-photos-abc.vercel.app`

---

### Step 9 — Generate a QR Code

1. Take your Vercel URL (or custom domain)
2. Generate a QR at [goqr.me](https://goqr.me) or [qr-code-generator.com](https://www.qr-code-generator.com)
3. Download as PNG (300+ DPI for print)
4. Print on table cards, programs, a large sign at the venue

---

### Step 10 — Production Checklist

- [ ] Schema SQL was run successfully in Supabase
- [ ] `wedding-uploads` bucket exists and is **private**
- [ ] All 5 env vars set in Vercel
- [ ] App deployed and accessible at the Vercel URL
- [ ] Admin login works at `/admin`
- [ ] Gallery shows locked state at `/gallery`
- [ ] Upload 1 test photo → appears in admin panel
- [ ] Gallery toggle: turn ON → photo appears at `/gallery`
- [ ] Gallery toggle: turn OFF → gallery shows locked state
- [ ] Delete test photo from admin
- [ ] Run cleanup: "Vymazať test uploady" removes test files
- [ ] QR code prints correctly and links to the right URL

---

## 👤 Admin Panel

URL: `https://your-app.vercel.app/admin`

**Login:** enter `ADMIN_PASSWORD` from your env vars.

### Features:
- **Stats** — total files, photo count, video count, total storage size
- **Gallery toggle** — enable/disable public gallery instantly
- **File list** — view all uploads with guest name, date, size; download or delete each file
- **Test cleanup** — preview + delete files uploaded before `WEDDING_START_TIMESTAMP`

### Test Cleanup Logic

The "Vymazať test uploady" button is safe — it only deletes:

1. Files where `is_test = true` in the database, **OR**
2. Files uploaded before `WEDDING_START_TIMESTAMP` (if the env var is set)

It **never** deletes files uploaded after the wedding start time. Real wedding photos are always safe.

---

## 🖼️ Image Compression

Before uploading, the app compresses photos client-side using the browser's Canvas API:

| Setting | Value |
|---------|-------|
| Max dimension | 2500 px (longest side) |
| Output format | JPEG |
| Quality | 0.82 |
| Min size to compress | 400 KB (smaller files skipped) |
| HEIC/HEIF | Skipped (uploaded as-is) |
| GIF | Skipped (would destroy animation) |
| Videos | Never compressed |

If compression produces a larger file than the original, the original is used instead. Compression errors always fall back to the original — uploads always continue.

---

## ⬇️ Downloading All Files

Vercel serverless functions time out for large ZIPs. Recommended alternatives:

### Option A — Supabase Storage Dashboard *(easiest)*
Supabase project → **Storage** → `wedding-uploads` → browse by date → download

### Option B — Supabase CLI
```bash
npm install -g supabase
supabase login
supabase storage cp --recursive ss:///wedding-uploads ./svadobne-fotky
```

### Option C — Admin Panel
Download files one by one using the download button in the admin file list.

---

## 🔐 Security

- Files upload **browser → Supabase directly** via server-issued signed URLs (service role key never in client bundle)
- File type and size validated **server-side** in `/api/upload/init` (client validation is UX only)
- Admin session = **stateless HMAC-SHA256 signed cookie**, 8-hour expiry, works on Vercel serverless
- Storage bucket is **private** — signed URLs required, auto-expire after 2–4 hours

---

## 🌐 Routes

| URL | Description |
|-----|-------------|
| `/` | Guest upload page |
| `/gallery` | Public gallery (when enabled) |
| `/admin` | Admin dashboard |

---

## 📋 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Publishable key — safe for browser use |
| `SUPABASE_SECRET_KEY` | ✅ | Secret key — server-side only, never in browser! |
| `ADMIN_PASSWORD` | ✅ | Admin panel password |
| `WEDDING_START_TIMESTAMP` | ☑️ | ISO date; files before this = test uploads |
| `CRON_SECRET` | ☑️ | Protects `/api/cron/purge-trash` — required for trash auto-purge |

---

## 🗃 Database Migrations Reference

All schema changes go through versioned migration files in `supabase/migrations/`.
They are never applied manually in the Supabase dashboard.

### Migration files

| File | What it does |
|------|-------------|
| `20260523000000_create_uploads_table.sql` | `uploads` table, indexes, RLS |
| `20260523000001_create_settings_table.sql` | `settings` table, RLS, seeds `public_gallery_enabled = false` |
| `20260523000002_add_is_test_to_uploads.sql` | `is_test` column + index on `uploads` |

### Commands

```bash
# Apply all pending migrations to the remote project
supabase db push

# Create a new migration (auto-generates a timestamped file)
supabase migration new <description>
# Example:
supabase migration new add_tags_to_uploads
# → creates supabase/migrations/20260601120000_add_tags_to_uploads.sql
# Edit that file, then run:
supabase db push

# Check which migrations have been applied on the remote
supabase migration list

# Pull current remote schema into a new migration (useful if you made changes in the dashboard)
supabase db pull
```

### Adding a future schema change

1. Run `supabase migration new <what_changed>`
2. Write the SQL in the generated file (pure `ALTER TABLE`, `CREATE INDEX`, etc.)
3. Run `supabase db push`
4. Commit the new migration file to git

Do **not** edit existing migration files after they have been applied to any environment.

### Checking migration status

```bash
supabase migration list
```

Output shows which migrations are applied locally and remotely:

```
        LOCAL      │     REMOTE     │     TIME (UTC)
  ─────────────────┼────────────────┼──────────────────────
  20260523000000   │ 20260523000000 │ 2026-05-23 12:00:00
  20260523000001   │ 20260523000001 │ 2026-05-23 12:00:01
  20260523000002   │ 20260523000002 │ 2026-05-23 12:00:02
```

---

## ✅ Testing Checklist

```
UPLOAD
[ ] Upload 1 photo from iPhone (HEIC or JPEG)
[ ] Upload 1 photo from Android (JPEG or WebP)
[ ] Upload multiple photos at once (5+)
[ ] Upload 1 short video (MP4 / MOV)
[ ] Try uploading a PDF → expect Slovak error message
[ ] Try uploading a 30 MB image → expect "príliš veľký" error
[ ] Tap upload button twice quickly → only one upload starts
[ ] Close browser tab mid-upload → reopen and retry

NETWORK
[ ] Upload on good Wi-Fi
[ ] Upload on slow mobile data (throttle in DevTools)
[ ] Open app via local IP http://192.168.x.x:3000 on phone
[ ] Upload via local IP on phone (tests createId() fallback)

GALLERY
[ ] Gallery page shows locked state before toggle
[ ] Admin: turn gallery ON → /gallery shows photos
[ ] Admin: turn gallery OFF → /gallery shows locked state
[ ] Download a photo from gallery
[ ] Open gallery from QR code on phone

ADMIN
[ ] Login with correct password → success
[ ] Login with wrong password → error
[ ] View uploaded files in admin
[ ] Delete a file → disappears from list
[ ] Stats update after delete
[ ] "Vymazať test uploady" → preview shows correct count
[ ] Execute cleanup → files gone from list
[ ] Download individual file from admin

COMPRESSION
[ ] Upload a large JPEG (>2 MB) → check compressed size in admin
[ ] Upload a HEIC from iPhone → uploaded as-is (no crash)
[ ] Upload a video → no compression, uploads normally
```
