# Riset AI — Workspace Penelitian (BYOK)

Aplikasi web penulisan skripsi/tesis **tanpa login, tanpa billing, tanpa mockup/demo** — semua fitur AI
dipanggil ke provider sungguhan memakai **API key milikmu (BYOK)**; bila key belum diset, fitur AI memberi
pesan error yang jelas (bukan konten palsu).

Mengintegrasikan 2 alur yang sudah diverifikasi:
- **Mantra-style** — wizard proyek → brainstorming 5 judul → ResearchMemory → generate per sub-bab dengan
  status (EMPTY → DRAFTING → AI_DRAFT → USER_EDITED → APPROVED) → format kampus → ekspor DOCX.
- **Jenni-style** — editor TipTap dengan ghost-text autocomplete (Tab/→ terima, Esc tolak), AI Edit pada
  teks terpilih dengan diff, AI Chat dengan konteks (section/dokumen/library), Find Papers (OpenAlex +
  Crossref, keyless), library per proyek, Reviews (cek penulisan) dan **cek sitasi** (verifikasi sitasi
  terhadap Crossref + daftar pustaka dokumen — klik → bukti/DOI).
- **Ekstra sesuai request** — impor skripsi `.docx` (struktur custom dari heading dokumen, format kampus
  diekstrak otomatis) dan upload skripsi lama sebagai **pedoman** (struktur + margin/font/spasi).
- **Gambar** — sisipkan gambar ke editor via modal 3 tab: **Generate AI** (Gemini native
  `generateContent` + `responseModalities: [TEXT, IMAGE]` jika Base URL Google, atau
  `/images/generations` untuk provider OpenAI-compatible — model configurable, default
  `gemini-2.5-flash-image` + auto-fallback), **Dari URL** (download & simpan ke storage), dan
  **Cari di Web** (keyless: Wikimedia Commons + Openverse). Tab **Review → Saran Gambar** menganalisa
  dokumen dan mengusulkan diagram/ilustrasi/logo per section — klik **Buat & Sisipkan** dan gambar
  masuk **langsung ke sub-bab yang dibahas** (pindah section otomatis). Semua gambar (URL storage /
  URL web) ikut ter-embed saat **Export DOCX** (ImageRun).

## Halaman publik (tema editorial)

- `/` — landing (hero, fitur, cara kerja, galeri, CTA, footer) dengan pola tema serotoninn.com
  (header mengambang `mix-blend-mode:difference`, logo di tengah, side-menu panel gelap + kolom art,
  tipografi hairline-first-letter). Tema saja — bukan salinan brand/aset mereka.
- `/login` & `/register` — split layout (gambar editorial + form). **Flow saja**: submit langsung
  redirect ke `/dashboard`, logic autentikasi belum dibuat (sengaja, mode single-user).
- `/dashboard` dst. — aplikasi (di bawah route group `(app)` yang dibungkus AppShell).
- Aset landing di-generate dan disimpan di `public/images/`.

Catatan fitur gambar: usulan jenis **logo** hasil scan penulisan otomatis membawa `webQuery`
(diambil dari tool yang disebut di section, mis. "XAMPP logo", "PHP logo") — tombol *Cari di web*
membuka tab Cari dengan query terisi, user tidak perlu mengetik apa pun (ada fallback derived dari
caption bila LLM tidak mengembalikan `webQuery`).

## Menjalankan lokal

```bash
npm install
createdb riset            # atau set DATABASE_URL ke Postgres mana pun
npx prisma db push
npx tsx prisma/seed.ts
npm run dev               # http://localhost:3000
```

Tanpa Supabase, unggahan DOCX memakai fallback lokal (`/api/uploads` + folder `./uploads`).

## Deploy ke Vercel + Supabase (target produksi)

1. **Supabase**
   - Buat project → enable **Postgres** (kamu dapat `DATABASE_URL`, tambahkan `?schema=public&sslmode=require`).
   - Buat bucket **Storage** bernama `uploads`, set **public**, beri policy `INSERT` + `SELECT` untuk
     role `anon` (mode single-user; untuk produksi multi-user ganti ke private + RLS).
2. **Vercel**
   - Import repo, framework Next.js, tambahkan env vars:
     ```
     DATABASE_URL=postgresql://postgres:***@db.<ref>.supabase.co:5432/postgres?schema=public&sslmode=require
     NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
     ```
   - Build command: `npm run build` (sudah `prisma generate` di dalamnya) — jangan jalankan
     `prisma db push` otomatis di Vercel; jalankan sekali dari lokal:
     `DATABASE_URL=... npx prisma db push` lalu `npx tsx prisma/seed.ts`.
   - Catatan limit:
     - Rute AI sudah diberi `export const maxDuration` (120–300 detik). Plan Vercel Hobby punya batas
       durasi eksekusi lebih pendek — jika generate terpotong, naikkan plan atau pakai provider cepat.
     - Body limit Vercel ~4.5 MB — oleh karena itu client mengunggah DOCX **langsung ke Supabase Storage**
       (bypass body limit); server hanya menerima URL-nya.
3. **BYOK** — setelah deploy, buka **Settings** di aplikasi, isi base URL + API key + model
   (contoh: OpenRouter `https://openrouter.ai/api/v1`, Ollama lokal, atau Gemini
   `https://generativelanguage.googleapis.com/v1beta/openai` — untuk **generate gambar** isi juga
   *Model Gambar* mis. `gemini-2.5-flash-image`, kosongkan untuk auto-fallback; endpoint gambar
   Gemini native terdeteksi otomatis dari base URL). Key tersimpan di database server, tidak pernah
   dikirim ke browser setelah disimpan, tidak masuk log.

## Struktur utama

| Path | Isi |
| --- | --- |
| `prisma/schema.prisma` | 16 model (Settings, Project, ResearchMemory, Section, Source, Collection, Citation, ChatThread, Review, AIRun, ExportJob…) |
| `src/lib/ai/provider.ts` | BYOK runtime OpenAI-compatible + log `AIRun`; `AIConfigError` saat key/model belum diset |
| `src/lib/citations.ts` | Validasi token `[[SOURCE_<id>]]` + render APA7/IEEE/Harvard/Vancouver |
| `src/lib/academic.ts` | Pencarian OpenAlex + Crossref (keyless), dedup DOI |
| `src/lib/retrieval.ts` | Konteks retrieval keyword (modul terisolasi, bisa diganti embedding) |
| `src/lib/docx-import.ts` | Parse DOCX (mammoth) → section custom dari heading |
| `src/lib/docx-style.ts` | Ekstrak format kampus (jszip: margin/font/ukuran/spasi) |
| `src/lib/citation-check.ts` | Ekstrak & verifikasi sitasi (APA/author-year/IEEE) |
| `src/lib/docx-export.ts` | Ekspor DOCX asli dengan style kampus + daftar pustaka + gambar (data-URI/URL) |
| `src/lib/image-gen.ts` | Generate gambar (Gemini native / OpenAI-compatible), cari gambar keyless (Wikimedia/Openverse), fetch URL |
| `src/lib/storage.ts` | Supabase Storage + fallback lokal |
| `src/components/workspace/` | Editor (TipTap + ghost text + AI Edit diff + Cite + modal Gambar 3-tab), StructureTree, RightPanel (Chat/Sources/Review + Saran Gambar) |

## Shortcut editor

- `Tab` / `→` terima saran AI (ghost text), `Esc` tolak
- `Ctrl/⌘ + J` AI Edit pada teks terpilih
- Klik-dua-kali judul di struktur → rename; hover → move/hapus
- Simpan sumber di Find Papers → itu satu-satunya sumber yang boleh disitasi AI
