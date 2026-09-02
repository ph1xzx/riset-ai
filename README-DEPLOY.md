# Deploy Riset-AI → Vercel + Supabase

Versi ini adalah clone `riset-ai` yang disesuaikan untuk **Vercel (frontend + API serverless)** dan **Supabase (Postgres + Storage)**. Perilaku aplikasi identik; perbedaan hanya di infrastruktur.

## Yang sudah diadaptasi

| Bagian | Lokal (sandbox) | Vercel + Supabase |
|---|---|---|
| Database | PostgreSQL lokal | Supabase Postgres via **pooler** (`DATABASE_URL`) + direct (`DIRECT_URL`) untuk migrasi |
| Upload file (docx/gambar) | Disk `./uploads` | **Supabase Storage** bucket `uploads` — upload langsung dari browser (melewati limit body Vercel) |
| Export DOCX / MD | ✅ | ✅ identik |
| Export PDF (LibreOffice) | ✅ | ❌ tidak ada LibreOffice di serverless — tombol memberi pesan jelas, pakai Export DOCX |
| Prisma | engine native | + engine `debian-openssl-3.0.x` (runtime Vercel) |
| Kunci AI (Gemini dll.) | halaman /settings | sama — disimpan di DB, tidak pernah di env |

## Langkah deploy

### 1. GitHub — pasang deploy key
Repo → **Settings → Deploy keys → Add deploy key**:
- Title: `riset-ai-deploy@vercel`
- Key: isi public key ed25519 yang diberikan (berawal `ssh-ed25519 AAAA...`)
- Centang **Allow write access** (agar bisa push dari sandbox)
- Verifikasi fingerprint: `SHA256:92oxpyq+RpFgSENWsxrtx6Vblig7LyZuxQlEbNpIaEQ`

### 2. Supabase — siapkan database & storage
1. Buat project di https://supabase.com (region terdekat, mis. `ap-southeast-1`).
2. **SQL Editor** → jalankan seluruh isi `supabase/setup.sql` (bucket + policy).
3. Catat dari **Project Settings**:
   - **Database → Connection string**: *Transaction pooler* (port 6543) → `DATABASE_URL`, dan *Direct connection* (port 5432) → `DIRECT_URL`.
   - **API**: Project URL → `NEXT_PUBLIC_SUPABASE_URL`, `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3. Buat skema tabel (sekali)
Dari laptop/CI (butuh Node ≥ 18):
```bash
npm install
DATABASE_URL="..." DIRECT_URL="..." npm run db:push   # pakai koneksi DIRECT
```

### 4. Vercel
1. **Add New → Project → Import** repo GitHub ini.
2. Framework: **Next.js** (default). Build command otomatis `prisma generate && next build`.
3. **Environment Variables** (lihat `.env.example`) — WAJIB di-set sebelum build pertama:
   - `DATABASE_URL` (pooler 6543)
   - `DIRECT_URL` (direct 5432) — **dibutuhkan juga saat build** (Prisma membacanya ketika generate); boleh disamakan dengan DATABASE_URL kalau tidak menjalankan `db push` dari CI
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Setelah live: buka `/settings` → isi Base URL + API key Gemini → simpan.

### 5. Smoke test pasca-deploy
- `/` landing 200
- Import skripsi .docx → upload harus masuk bucket `uploads` (cek di Supabase → Storage)
- Buat proyek baru → brainstorm jalan
- Export DOCX terunduh; Export PDF menjawab pesan "LibreOffice tidak tersedia" (memang begitu di Vercel)

## Catatan penting
- **Hobby plan**: durasi function default 60 dtk. Rute AI sudah di-set `maxDuration` hingga 300 dtk — di Hobby Vercel membatasi 60 dtk; kalau generate sering timeout, upgrade ke Pro atau kecilkan dokumen per-request.
- **Single-user**: app ini BYOK (kunci AI milik pengguna, disimpan di DB). Kalau mau multi-user, tambahkan Supabase Auth + RLS — struktur DB sudah siap (model Settings global id=1).
- **PDF di produksi**: jalankan sidecar LibreOffice terpisah (mis. container Gotenberg) dan ubah `POST /api/projects/[id]/export-pdf` agar memanggilnya via HTTP.
