# PANDUAN DEPLOY — Supabase + Vercel (step by step)

Prasyarat yang SUDAH beres: repo `ph1xzx/riset-ai` terisi kode + deploy key aktif.
Estimasi total: ±20–30 menit. Yang perlu disiapkan: akun GitHub, email untuk Supabase & Vercel, password database yang kuat.

---

## TAHAP 1 — Supabase (database + storage)

1. Buka https://supabase.com → **Start your project** → login pakai GitHub.
2. **New Project**:
   - Name: `riset-ai`
   - Database Password: buat yang kuat → **SIMPAN di catatan** (dipakai 2× nanti)
   - Region: `Southeast Asia (Singapore)` — terdekat dari Indonesia
   - Plan: Free
3. Tunggu provisioning ±1–2 menit sampai dashboard siap.
4. **Setup database + storage SEKALIGUS**: menu **SQL Editor** → New query → paste SELURUH isi file `supabase/setup.sql` dari repo → **Run**.
   File ini lengkap: membuat 18 tabel + index, seed Settings, dan bucket storage.
   - Cek 1: di SQL Editor jalankan `select count(*) from information_schema.tables where table_schema='public';` → harus **18**
   - Cek 2: menu **Storage** → muncul bucket `uploads` berlabel *public*
5. **Ambil kredensial** (simpan dulu di notepad):
   - **Project Settings → Database → Connection string**:
     - tab **Transaction pooler** (port `6543`, host `…pooler.supabase.com`) → ini `DATABASE_URL`. Ganti bagian `[YOUR-PASSWORD]` dengan password database dari langkah 2.
     - tab **Direct connection** (port `5432`) → ini `DIRECT_URL` (ganti passwordnya juga).
   - **Project Settings → API**:
     - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
     - *Project API keys → anon public* → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## TAHAP 2 — (OPSIONAL) Verifikasi skema dari laptop

`setup.sql` sudah membuat SEMUA tabel — tahap ini tidak wajib. Hanya jalankan kalau mau memastikan Prisma sinkron (butuh Node.js 18+):

```bash
git clone https://github.com/ph1xzx/riset-ai.git
cd riset-ai
npm install

# Linux / macOS:
DATABASE_URL="<DIRECT_URL>" DIRECT_URL="<DIRECT_URL>" npx prisma db push

# Windows (PowerShell):
$env:DATABASE_URL="<DIRECT_URL>"; $env:DIRECT_URL="<DIRECT_URL>"; npx prisma db push
```

- PENTING: untuk `db push` pakai koneksi **DIRECT (5432)**, bukan pooler.
- Sukses bila muncul: `Your database is now in sync with your schema.`
- Verifikasi: Supabase → **Table Editor** → muncul tabel `Project`, `Section`, `User`, `WritingTemplate`, dll.

## TAHAP 3 — Vercel

1. Buka https://vercel.com → **Sign up** → lanjutkan dengan GitHub.
2. **Add New… → Project** → cari `ph1xzx/riset-ai` → **Import**.
3. Framework Preset: **Next.js** (otomatis). JANGAN klik Deploy dulu.
4. Buka **Environment Variables**, isi 5 kunci ini:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string **pooler 6543** + `?pgbouncer=true&connection_limit=1&schema=public` |
   | `DIRECT_URL` | connection string **direct 5432** |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | key `anon` (eyJ…) |
   | `AUTH_SECRET` | string acak ≥16 karakter (sudah disediakan terpisah; atau bikin sendiri: `openssl rand -base64 32`) |

5. **Deploy** → tunggu 1–3 menit → dapat domain `nama-acak.vercel.app` (bisa diganti di Settings → Domains).

## TAHAP 4 — Smoke test (5 menit, pastikan semua hidup)

1. Buka domain → landing page tampil.
2. **/register** → buat akun → masuk dashboard. *(auth + database + middleware ✓)*
3. **/settings** → isi Base URL `https://generativelanguage.googleapis.com/v1beta/openai` + API key Gemini → Save. *(BYOK ✓)*
4. **Impor Skripsi** → upload .docx → cek Supabase → Storage → `uploads`: file muncul. *(Supabase Storage ✓)*
5. **Proyek Baru** → brainstorm judul keluar. *(AI ✓)*
6. **Export DOCX** terunduh; **Export PDF** menjawab "LibreOffice tidak tersedia" — itu MEMANG perilaku di Vercel, gunakan DOCX.
7. **Pratinjau** (ikon mata) → halaman ala Word tampil.

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Build gagal: `Environment variable not found: DIRECT_URL` | Env belum di-set sebelum build → isi di Vercel → Deployments → ⋯ → **Redeploy** |
| Error Prisma `P1001/P1017` (can't reach db) | `DATABASE_URL` masih direct 5433/5432 → pakai **pooler 6543**; atau password salah di connection string |
| Upload docx gagal | `supabase/setup.sql` belum dijalankan / bucket `uploads` tidak ada |
| Selalu dilempar ke /login | `AUTH_SECRET` kosong/berubah → set yang tetap lalu Redeploy |
| Generate AI lama lalu timeout | Hobby plan membatasi function 60 detik → dokumen besar bisa lewat; upgrade Pro (300 dtk) atau generate per section |
| Gambar hasil generate tidak muncul | kuota image model Gemini habis → pakai tab upload gambar (sudah ada fallback-nya) |

## Catatan

- Kunci Gemini TIDAK ditaruh di env Vercel — diisi lewat halaman `/settings` (disimpan di database, hanya hidup di server). Ini desain BYOK.
- Data proyek tersimpan di Supabase Postgres; file di bucket `uploads`. Backup: Supabase → Database → Backups.
- Mode multi-user: registrasi terbuka. Untuk membatasi, matikan sementara link /register atau tambahkan kebijakan di `api/auth/register`.
