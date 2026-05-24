# 📷 Fotky zo svadby Katky a Šimona

Mobile-first wedding photo & video sharing app — simple enough for grandparents.

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · Supabase · Vercel

---

## ✨ What the app does

| Feature | Detail |
|---------|--------|
| **Guest upload** | No account needed. Optional name. Up to 30 files at once. |
| **Progress per file** | XHR progress bar, status labels in Slovak. |
| **Image compression** | Client-side JPEG resize before upload (max 2500 px, quality 0.82). |
| **Video thumbnails** | Thumbnail JPEG generated client-side and stored separately; shown in gallery grid on all browsers including iOS Safari. |
| **Retry** | Each file can be retried individually without affecting others. |
| **Double-submit guard** | Prevents duplicate uploads when user taps the button twice. |
| **Gallery** | Public gallery at `/gallery`. OFF by default; admin turns it ON after the wedding. |
| **Lightbox** | Full-screen image/video viewer with swipe navigation and download/share. |
| **Pagination** | Gallery and admin load 40 files at a time — "Načítať ďalšie" button for more. |
| **Admin** | `/admin` — stats, file list, gallery toggle, soft delete with 7-day trash, bulk operations. |
| **Trash + cron** | Deleted files move to trash; Vercel Cron purges them after 7 days. |
| **Test cleanup** | Safely bulk-deletes only test uploads (uploaded before `WEDDING_START_TIMESTAMP`). |
| **Security** | Files go browser → Supabase directly via server-signed URLs. Service key never in browser. Admin session is HMAC-SHA256 signed cookie. |

---

## 🗂 Project structure

```
wedding-photos/
├── app/
│   ├── page.tsx                         # Main page (hero + upload form + gallery link)
│   ├── gallery/page.tsx                 # Public gallery / locked state
│   ├── admin/page.tsx                   # Admin dashboard
│   └── api/
│       ├── upload/
│       │   ├── init/route.ts            # Validate + issue signed PUT URL
│       │   ├── confirm/route.ts         # Record upload in database
│       │   └── thumbnail/route.ts       # Issue signed PUT URL for thumbnail
│       ├── gallery/route.ts             # Paginated public gallery API
│       ├── admin/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   ├── files/route.ts           # Paginated, filtered file list + stats
│       │   ├── files/[id]/route.ts      # Soft-delete single file
│       │   ├── files/[id]/restore/      # Restore from trash
│       │   ├── files/bulk/route.ts      # Bulk soft-delete
│       │   ├── settings/route.ts        # Gallery toggle (GET/PUT)
│       │   ├── trash/route.ts           # List trash
│       │   └── cleanup/route.ts         # Test-upload cleanup (GET preview / DELETE)
│       └── cron/
│           └── purge-trash/route.ts     # Called by Vercel Cron daily at 03:00 UTC
├── components/
│   ├── UploadForm.tsx                   # Full upload UI
│   ├── GalleryView.tsx                  # Grid + lightbox + selection + bulk download
│   ├── AdminPanel.tsx                   # Admin dashboard
│   ├── AdminLogin.tsx
│   ├── MobileSaveModal.tsx              # Share sheet on mobile (admin)
│   ├── WeddingInfo.tsx
│   └── MobileNav.tsx
├── lib/
│   ├── auth.ts                          # HMAC-SHA256 signed admin cookie
│   ├── downloadUtils.ts                 # Blob-download, Web Share API helpers
│   ├── imageCompression.ts              # Client-side JPEG resize (Canvas API)
│   ├── videoThumbnail.ts                # Client-side video frame capture (Canvas API)
│   ├── supabase/
│   │   ├── browser-client.ts            # Anon/publishable key — browser only
│   │   └── server-client.ts             # Service/secret key — server only
│   └── utils.ts                         # createId() — UUID with HTTP fallback
├── types/index.ts
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260523000000_create_uploads_table.sql
│       ├── 20260523000001_create_settings_table.sql
│       ├── 20260523000002_add_is_test_to_uploads.sql
│       └── 20260524000000_add_thumbnail_path_to_uploads.sql
└── vercel.json                          # Vercel Cron schedule
```

---

## 🌐 Routes

| URL | Who | Description |
|-----|-----|-------------|
| `/` | Everyone | Upload page |
| `/gallery` | Everyone | Public gallery (locked when disabled) |
| `/admin` | Admin | Dashboard |

---

## 🚀 Setup — Step by Step

### Step 1 — Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) → **New project**
2. **Name:** `wedding-photos`
3. **Region:** `eu-central-1` (Frankfurt — closest to Slovakia)
4. Save the database password somewhere safe
5. Wait ~2 minutes for provisioning

---

### Step 2 — Apply database migrations

**Install the Supabase CLI** (once per machine):

```bash
# npm (any OS)
npm install -g supabase

# Homebrew (macOS/Linux)
brew install supabase/tap/supabase
```

**Link to your remote project:**

```bash
# Your project ref = the subdomain of your Supabase URL.
# Example: https://abcdefghijkl.supabase.co → ref = abcdefghijkl
supabase link --project-ref <your-project-ref>
```

**Push all migrations:**

```bash
supabase db push
```

Expected output:

```
Applying migration 20260523000000_create_uploads_table.sql...
Applying migration 20260523000001_create_settings_table.sql...
Applying migration 20260523000002_add_is_test_to_uploads.sql...
Applying migration 20260524000000_add_thumbnail_path_to_uploads.sql...
```

`supabase db push` is idempotent — safe to run multiple times. Already-applied migrations are skipped.

> **Do not run any SQL manually in the Supabase dashboard.**

---

### Step 3 — Create the storage bucket

1. Supabase dashboard → **Storage** → **New bucket**
2. **Name:** `wedding-uploads` ← must be exactly this, lowercase
3. **Public bucket:** OFF (keep it private)
4. Click **Save**

No bucket policies needed — the server uses the service/secret key which bypasses RLS.

---

### Step 4 — Get your API keys

Supabase dashboard → **Settings** → **API**:

| Dashboard label | Env variable |
|-----------------|-------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable** API key (or "anon" in older dashboards) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret** API key (or "service_role" in older dashboards) | `SUPABASE_SECRET_KEY` |

> Supabase renamed "anon" → "publishable" and "service_role" → "secret" in their dashboard.
> The keys themselves are identical — just copy whichever your dashboard shows.

> ⚠️ Never commit `SUPABASE_SECRET_KEY`. It has full database access.

---

### Step 5 — Configure environment variables

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
# .env.local

# ── Supabase ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Publishable/anon key — safe for the browser
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Secret/service_role key — SERVER ONLY, never sent to the browser
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Admin ─────────────────────────────────────────────────────────────────────
# Password for the /admin dashboard
ADMIN_PASSWORD=choose-something-strong

# ── Wedding config ────────────────────────────────────────────────────────────
# ISO 8601 timestamp when the wedding starts.
# Uploads BEFORE this = test uploads that can be bulk-deleted safely.
WEDDING_START_TIMESTAMP=2026-06-06T10:00:00+02:00

# ── Cron ─────────────────────────────────────────────────────────────────────
# Protects /api/cron/purge-trash — Vercel sends this as Authorization: Bearer <secret>
# Generate: openssl rand -hex 32
CRON_SECRET=replace-with-a-strong-random-secret
```

---

### Step 6 — Local development

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

**Test on a real phone over Wi-Fi** (same network as your computer):

```bash
# Find your local IP first:
# Windows: ipconfig → look for IPv4 Address (e.g. 192.168.1.42)
# macOS:   ifconfig | grep "inet "

# Start Next.js on all interfaces:
npm run dev -- --hostname 0.0.0.0

# Open on phone: http://192.168.1.42:3000
```

> Note: On `http://` (non-HTTPS) `crypto.randomUUID()` is unavailable.
> The app's `createId()` in `lib/utils.ts` has a base-36 fallback — this is handled.

---

### Step 7 — Deploy to Vercel

**Push to GitHub:**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/wedding-photos.git
git push -u origin main
```

**Import to Vercel:**

1. [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
2. Framework: **Next.js** (auto-detected)
3. Under **Environment Variables**, add all six:

   | Variable | Required |
   |----------|----------|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ |
   | `SUPABASE_SECRET_KEY` | ✅ |
   | `ADMIN_PASSWORD` | ✅ |
   | `WEDDING_START_TIMESTAMP` | recommended |
   | `CRON_SECRET` | required for trash auto-purge |

4. Click **Deploy** (~2 min). You get a URL like `https://wedding-photos-abc.vercel.app`.

---

### Step 8 — Generate a QR code

1. Copy your Vercel URL (e.g. `https://wedding-photos-abc.vercel.app`)
2. Generate a QR code at [goqr.me](https://goqr.me) or [qr-code-generator.com](https://www.qr-code-generator.com)
3. Download as PNG — use 300+ DPI / 1000+ px for print quality
4. Print on table cards, ceremony programs, or a large sign at the venue

---

### Step 9 — Pre-wedding checklist

- [ ] `supabase db push` ran without errors — all 4 migrations applied
- [ ] `wedding-uploads` bucket exists in Supabase Storage, set to **private**
- [ ] All 6 env vars set in Vercel
- [ ] App is live at the Vercel URL
- [ ] Admin login works at `/admin` with your `ADMIN_PASSWORD`
- [ ] Gallery shows locked state at `/gallery`
- [ ] Upload 1 test photo → appears in admin panel
- [ ] Toggle gallery ON → photo visible at `/gallery`
- [ ] Toggle gallery OFF → gallery shows locked state again
- [ ] Delete the test photo from admin → disappears
- [ ] Run "Vymazať test uploady" → no real photos deleted
- [ ] QR code scans correctly on iPhone and Android
- [ ] Upload test on slow mobile data (use browser DevTools throttle)

---

## 👤 Admin panel

URL: `https://your-app.vercel.app/admin`

Login: the value of `ADMIN_PASSWORD`.

### What you can do

| Action | Where |
|--------|-------|
| View all uploads (with uploader name, date, size) | File list |
| Search by name or filename | Filter bar |
| Filter by photos / videos | Type filter |
| Sort by newest / oldest / largest | Sort selector |
| Download a file | Download button per row |
| Soft-delete a file (moves to 7-day trash) | Trash button per row |
| Restore from trash | Kôš tab → Obnoviť |
| Bulk delete selected | BulkActionBar |
| Toggle public gallery ON/OFF | Gallery toggle card |
| See total files / photos / videos / storage used | Stats cards |
| Delete all test uploads | "Vymazať test uploady" section |

### Test cleanup logic

"Vymazať test uploady" only deletes:
1. Files where `is_test = true` in the database, **or**
2. Files uploaded **before** `WEDDING_START_TIMESTAMP` (if that env var is set)

Real wedding photos (uploaded after the wedding started) are never touched.

---

## ⬇️ Downloading all files

Vercel serverless functions time out on large ZIP archives. Use one of these instead:

**Option A — Supabase Storage dashboard** *(easiest, no CLI needed)*

Supabase project → Storage → `wedding-uploads` → browse folders → select all → Download

**Option B — Supabase CLI** *(fastest for hundreds of files)*

```bash
supabase storage cp --recursive ss:///wedding-uploads ./svadobne-fotky
```

**Option C — Admin panel**
Download files individually with the download button in the file list. The admin "Bulk download" feature downloads selected files one by one.

---

## 🗂 Database schema

### `uploads`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `file_name` | TEXT | Safe filename (UUID prefix) |
| `original_file_name` | TEXT | Original name from the device |
| `file_type` | TEXT | `image` / `video` / `other` |
| `mime_type` | TEXT | e.g. `image/jpeg` |
| `file_size` | BIGINT | Bytes |
| `storage_path` | TEXT UNIQUE | Path in the bucket |
| `guest_name` | TEXT NULL | Optional uploader name |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete timestamp |
| `is_test` | BOOLEAN | `true` = safe to bulk-delete |
| `thumbnail_path` | TEXT NULL | Path to pre-generated video thumbnail JPEG |

### `settings`

| Key | Value | Default |
|-----|-------|---------|
| `public_gallery_enabled` | boolean (JSONB) | `false` |

---

## 📋 Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Publishable/anon key — safe for browser |
| `SUPABASE_SECRET_KEY` | ✅ | Secret/service_role key — server only |
| `ADMIN_PASSWORD` | ✅ | Password for `/admin` |
| `WEDDING_START_TIMESTAMP` | ☑️ | ISO 8601; uploads before this = test uploads |
| `CRON_SECRET` | ☑️ | Bearer secret for `/api/cron/purge-trash` |

---

## 🔐 Security

- **Uploads go browser → Supabase directly** via short-lived signed PUT URLs generated server-side. The secret key is never in the browser bundle.
- **File type and size are validated server-side** in `/api/upload/init`. Client-side checks are UX only.
- **Admin session** = stateless HMAC-SHA256 signed cookie, 8-hour expiry. No database session table needed.
- **Storage bucket is private** — all URLs are signed and expire (2 h gallery, 4 h admin).
- **RLS is enabled** on both tables with no public policies — row-level safety net even if the publishable key is used directly.

---

## 🖼️ Image compression

Before uploading, the browser compresses photos client-side using the Canvas API:

| Setting | Value |
|---------|-------|
| Max dimension (longest side) | 2500 px |
| Output format | JPEG |
| Quality | 0.82 |
| Minimum file size to compress | 400 KB (smaller files skip compression) |
| HEIC / HEIF | Skipped (uploaded as-is — iOS original format) |
| GIF | Skipped (compression would destroy animation) |
| Videos | Never compressed |

If compression produces a file *larger* than the original, the original is used instead. Compression failures always fall back to the original — uploads never fail because of compression.

---

## 🎬 Video thumbnails

For each uploaded video, the browser:

1. Creates a local blob URL from the file (no CORS issues)
2. Seeks a `<video>` element to 1 second (or 10% of duration)
3. Draws the frame onto a Canvas
4. Exports as JPEG (max 800 px, quality 0.82)
5. Uploads the thumbnail to `thumbnails/YYYY/MM/<uuid>.jpg` in the same bucket
6. Records `thumbnail_path` in the database

Gallery and admin then use `<img src={thumbnailUrl}>` instead of a `<video>` element, which works reliably on iOS Safari.

Fallback chain: pre-generated JPEG → `<video preload="metadata" #t=0.001>` → dark background with play icon.

---

## 🗃 Migrations reference

Migrations live in `supabase/migrations/` and are applied with `supabase db push`.

| File | What it does |
|------|-------------|
| `20260523000000_create_uploads_table.sql` | `uploads` table, indexes, RLS |
| `20260523000001_create_settings_table.sql` | `settings` table, RLS, seeds `public_gallery_enabled = false` |
| `20260523000002_add_is_test_to_uploads.sql` | `is_test` column for test-upload cleanup |
| `20260524000000_add_thumbnail_path_to_uploads.sql` | `thumbnail_path` column for video thumbnail storage |

**To add a future schema change:**

```bash
# Create a timestamped migration file
supabase migration new describe_what_changed

# Edit the generated file, then push
supabase db push

# Commit it to git
git add supabase/migrations/ && git commit -m "chore: add migration"
```

Never edit a migration file that has already been pushed to any environment.

---

## ✅ Full testing checklist

### Upload
- [ ] Upload 1 photo from iPhone (HEIC)
- [ ] Upload 1 photo from Android (JPEG or WebP)
- [ ] Upload 5+ photos at once — progress shows per file
- [ ] Upload 1 short video (MP4 or MOV)
- [ ] Upload a video — thumbnail appears in gallery grid
- [ ] Try uploading a PDF → expect Slovak error, no crash
- [ ] Try uploading a 30 MB image → "príliš veľký" error
- [ ] Tap upload button twice quickly → only 1 upload starts
- [ ] Choose 35 files → error before upload starts (max 30)

### Gallery
- [ ] `/gallery` shows locked state before toggle
- [ ] Admin: turn gallery ON → photos appear at `/gallery`
- [ ] Admin: turn gallery OFF → locked state returns
- [ ] Lightbox: swipe left/right between photos
- [ ] Download a photo from the lightbox (desktop)
- [ ] Share/save a photo from the lightbox (mobile)
- [ ] Video plays in lightbox
- [ ] Video thumbnail shows in grid (iPhone)

### Admin
- [ ] Login with correct password → success
- [ ] Login with wrong password → error, no crash
- [ ] File list shows all uploads with uploader name
- [ ] Search works — filters to matching files
- [ ] Type filter: only photos / only videos
- [ ] Sort: oldest / largest
- [ ] "Načítať ďalšie" loads next page without losing existing items
- [ ] Delete 1 file → moves to trash, stats update
- [ ] Kôš tab → restore file → reappears in active list
- [ ] Bulk select + delete → modal → confirm → files gone
- [ ] Stats cards show correct counts
- [ ] "Vymazať test uploady" → preview shows correct count
- [ ] Execute cleanup → only test files removed

### Network / mobile
- [ ] Upload on good Wi-Fi
- [ ] Upload on slow mobile data (throttle in DevTools → Slow 3G)
- [ ] App opens from QR code on iPhone
- [ ] App opens from QR code on Android
- [ ] Offline banner appears when phone loses internet
