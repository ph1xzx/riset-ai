# ALUR FITUR TERINTEGRASI — Mantra Riset × Jenni AI

> Verifikasi lapangan (1 Sep 2026) untuk produk mandiri BYOK (Bring Your Own API Key).
> Sumber: akses langsung ke app.jenni.ai (login, eksplorasi in-app + screenshot),
> akses publik mantrariset.com (landing, /fitur, /faq, mockup dashboard),
> serta 2 file riset mentah: `PRODUCT REQUIREMENTS DOCUMENT.txt` +
> `AGENT PROMPT — Integrated Academic Research Workspace.txt`.

---

## 1. RINGKASAN EKSEKUTIF

Dua fitur inti yang digabungkan:

| Dari | Fitur inti yang diambil |
|---|---|
| **Mantra Riset** | **Alur proyek penelitian terstruktur** — topik → brainstorming 5 judul → proyek otomatis dengan kerangka Bab I–V → generate per sub-bab berurutan (status Draf AI / Diterima) → format kampus → ekspor DOCX siap submit. |
| **Jenni AI** | **Workspace penulisan interaktif** — rich-text editor dengan AI autocomplete (ghost text + sitasi inline), document prompt, Library sumber, pencarian 250M+ paper, AI Chat dengan context pill, AI Edit pada teks terpilih, Review, version history, ekspor. |

Prinsip penggabungan: **Mantra memberi TULANGAN (struktur & alur proyek), Jenni memberi OTOT (editor & interaksi AI per-ketik).** Semua AI memakai API key milikmu (BYOK), dan sitasi TIDAK BOLEH digagas model (rules citation safety dari PRD-mu tetap berlaku — ini juga sesuai cara kerja keduanya secara publik).

---

## 2. MANTRA RISET — Alur Fitur (terverifikasi)

### 2.1 Catatan verifikasi

- Login akun kamu **tidak bisa dilewati otomatis**: Mantra memakai **Cloudflare Turnstile** di form login (terkonfirmasi: iframe `challenges.cloudflare.com`, checkbox "Verify you are human", tombol "Masuk" disabled sampai captcha lolos). Browser headless dari server ter-blok (401). Jadi verifikasi alur internal memakai: mockup dashboard di landing page (sidebar + project card asli yang di-render), halaman `/fitur`, FAQ (JSON-LD), pricing, dan PRD mentah kamu (yang memang sudah berdasarkan riset hands-on).
- Sidebar app (dari mockup login dashboard): **Brainstorming Judul • Proyek Penelitian • Impor Skripsi • Cari Artikel • Cek Plagiasi • Billing • Lab Revisi • Video Tutorial • Parafrase • Generate PPT** + area "Mulai Buat Karya" (Skripsi S1 / Tesis S2 / Disertasi S3 / Artikel SINTA / Artikel Scopus) + daftar "Proyek Terakhir".

### 2.2 Alur utama (end-to-end)

```
LOGIN (email/Google + Turnstile)
  → DASHBOARD: proyek terakhir, kredit tersisa, mulai buat karya
  → PILIH TIPE: Skripsi / Tesis / Disertasi / Artikel SINTA / Artikel Scopus
  → ISI DATA SEDERHANA: topik, jenis penelitian, metode
     (tanpa prompt engineering — sistem yang menyusun instruksi AI di balik layar)
  → BRAINSTORMING JUDUL: 5 judul + alasan + metode cocok
  → PILIH JUDUL → PROYEK OTOMATIS DIBUAT LEPAT DENGAN KERANGKA BAB I–V
  → STUDIO SKRIPSI (ruang kerja utama):
       editor kaya, generate PER SUB-BAGIAN secara berurutan,
       status tiap sub-bab: Draf AI vs Diterima
       referensi jurnal valid disuntik otomatis + daftar pustaka APA 7/IEEE
       format kampus (margin/font/spasi/sitasi) diterapkan otomatis
  → TINJAU / EDIT / ULANGI tiap blok
  → LAB REVISI: revisi via instruksi chat → file Word ter-update
  → CEK PLAGIASI (Turnitin) dalam app
  → EKSPOR: .docx (dipetakan ke Word styles) + Generate PPT Sidang
  → (V2-ish) Simulasi Sidang AI bersuara, Temukan Novelty, Olah Data
```

### 2.3 Detail fitur kunci (bukti dari /fitur + FAQ)

1. **Brainstorming Judul** — "Masukkan satu topik, dapatkan 5 judul penelitian beserta alasan dan metode yang cocok. Pilih satu, dan proyek skripsi langsung dibuat lengkap dengan kerangka Bab I–V."
2. **Studio Skripsi** — "Ruang kerja utama dengan editor kaya. Generate per sub-bagian secara berurutan, status Draf AI vs Diterima, dan ekspor ke .docx yang sudah dipetakan ke Word styles."
3. **Referensi Jurnal Otomatis** — "Untuk sub-bab yang membutuhkan rujukan, sistem menarik artikel ilmiah yang valid dari basis data akademik, lalu menyuntikkannya ke hasil AI dan menyusun daftar pustaka APA 7 / IEEE otomatis."
4. **Cek Kutipan (verifikasi sitasi)** — "Fitur Cek Kutipan menampilkan kalimat pendukung dari artikel aslinya **beserta nomor halaman** — jadi kamu bisa membuktikan sitasinya bukan karangan." Semua referensi punya DOI yang bisa diklik ke penerbit.
5. **Format Kampus Otomatis** — upload pedoman PDF/DOCX sekali → ekstrak margin, font, spasi, gaya sitasi → diterapkan ke semua hasil generate. Pedoman untuk FORMAT saja; struktur ilmiah tetap kaidah baku bidang.
6. **Sistem Kredit** — umumnya 1 kredit per sub-bab (lebih untuk Hasil & Pembahasan); kredit hanya terpotong jika generate BERHASIL.
7. **Lab Revisi** — revisi isi/format per sub-bab lewat instruksi chat; file Word langsung ter-update & bisa diunduh.
8. **Generate PPT Sidang** — identitas, diagram kerangka berpikir, tabel, speaker notes; desain otomatis.
9. **Ekstra** (per FAQ): Temukan Novelty (celah riset dari ribuan artikel), Olah Data, Simulasi Sidang penguji AI bersuara, Bimbingan Mentor 1-on-1 (Google Meet, QRIS/VA).

### 2.4 Yang TIDAK ada di Mantra (celah yang diisi Jenni)

- Tidak ada AI autocomplete inline per-ketik.
- Tidak ada AI Chat dengan konteks dokumen/seleksi teks secara interaktif di dalam editor.
- Tidak ada pencarian paper langsung di sidebar sambil menulis (ada "Cari Artikel" sebagai menu terpisah).
- Tidak ada version history / review otomatis antar-konsistensi bab.
- Tidak ada BYOK — AI mereka sentral (kredit).

---

## 3. JENNI AI — Alur Fitur (terverifikasi in-app, screenshot di `shots/`)

### 3.1 Bukti teknis

- Editor = **TipTap/ProseMirror** (element `#tiptap-editable`), UI = Mantine, backend Next.js (`/api/auth/session`).
- Dokumen user kamu: `app.jenni.ai/editor/IlJgziqKcOXfy1Za8iGx`.
- Autocomplete **dijalankan live** saat verifikasi: ghost text + sitasi inline `(Dayhoff & DeLeo, 2001)` muncul (1 kredit terpakai di akunmu).

### 3.2 Layout app

```
┌────────────────────────────────────────────────────────────────────┐
│ [nav kiri]      [top bar]              [panel kanan opsional]      │
│ PH-1 (profil)   Untitled · Share ·     Library / Find papers /     │
│ + New           Review · AI Chat ·     AI Chat / Document settings │
│ Documents       See Pricing · ⋯                                       │
│ Library         ┌──────────────────────────────────────────┐        │
│ Find papers     │ toolbar: undo/redo | T Text | B I U S |  │        │
│ AI Chat         │ code | sup/sub | link | @ Cite | gambar  │        │
│ ───────────     │ tabel | quote | autocomplete toggle      │        │
│ Complete setup  │ [Prompts]                                │        │
│  1/5 Steps      │  +  ⠿  ✦  (block handle: tambah, geser,  │        │
│ Web Extension   │      AI-per-block)                       │        │
│ Tutorials       │  editor ...                               │        │
│ Help            └──────────────────────────────────────────┘        │
│ Shortcuts         8 words                                          │
│ See Pricing                                                       │
└────────────────────────────────────────────────────────────────────┘
```

Menu `⋯` dokumen: **Version history** + **Document settings**.

### 3.3 Onboarding = loop fitur inti

"Complete setup **X/5 Steps**" dengan 5 langkah yang HANYA bisa diselesaikan dengan memakai fitur:

1. **Accept AI autocomplete**
2. **Upload source to library**
3. **Send chat message**
4. **Cite a source**
5. **Review your document**

→ Inspirasi bagus: onboarding produkmu bisa memakai pola "5 langkah = 5 fitur inti".

### 3.4 Detail fitur (semua terverifikasi langsung)

1. **Document prompt** (bukan "section prompt"): satu prompt deskripsi dokumen global — "Enter your document description to prompt Jenni" — dipakai agar autocomplete relevan. Ada juga **Prompts** (blok prompt tersimpan, tombol di toolbar baris 2) dan **Import from Word (.docx)**.
2. **Autocomplete** (ghost text): badge "Jenni AI" + teks abu-abu + sitasi inline klik-able. Aksi mengambang: **Accept [→] • ✦ Refine suggestion • 👍 • 👎**.
   - Sumbernya bisa di-toggle: **Web search** (ON/OFF) dan **Library search** — artinya autocomplete bisa dibatasi HANYA dari library kamu (source-grounded).
   - Keyboard (modal Shortcuts, tab Markdown & KaTeX):
     - `→` accept • `Shift+→` cycle • `Ctrl+/` panggil suggestion • `Alt+→` accept per-kata
     - `Ctrl+J` = AI Edit (jika ada seleksi) / AI Chat (jika tidak ada)
     - `Ctrl+↑/↓` pindah blok • `Ctrl+\` sidebar • `Ctrl+K` toolbar • `@` sisip sitasi manual • `Ctrl+/`
3. **Citation filters (di Document settings)**: Publish year (All/Last 5 years/Custom), Impact Factor (All/0.25+/3+/10+), Cited by (All/5+/20+/50+), Include preprints (toggle), **Citation Style** (default APA 7th), Font Style (Default/Serif).
4. **Library**: sumber dengan badge **IF** (impact factor), tahun, jurnal. Cara masuk: Upload PDF, Import **Zotero**, Import **Mendeley**, Add via **DOI/PMID**, Import **.bib/.ris**, Web Extension. Copy: "Add your sources and let Jenni suggest text and citations automatically."
5. **Find papers** (panel kiri, tanpa pindah halaman): "Search 250M+ papers by topic, question, **or paste a sentence from your draft**" → semantic search. Kontrol **Sort | Filter**.
6. **AI Chat** (panel kanan): context pills `Web Ask`, `Library Ask`, `Current document` (bisa ditambah/±), input "Ask AI, use **@** to mention specific PDFs", ikon lampiran/gambar/tabel, ikon jam = riwayat chat.
7. **Review** (tombol top bar) — fitur baru "Reviews": analisis klaim vs sumber, kategori Claim Confidence (Misrepresented / Contradicted / Unsupported / Weakly Supported / Overstated) + Proofread (Word Choice, Grammar) + inline feedback.
8. **Version history** (⋯ menu). **Share** (kolaborasi realtime, komentar, version history).
9. **Ekspor**: .docx, LaTeX, HTML (per landing page — 10.000+ style sitasi via CSL).
10. **AI Edit pada seleksi teks** (`Ctrl+J`) — menu edit/generate untuk teks terpilih.
11. **Block-level AI**: ikon ✦ di handle tiap blok (generate/improve per blok).

### 3.5 Yang TIDAK ada di Jenni (celah yang diisi Mantra)

- Tidak ada proyek "skripsi" dengan struktur Bab I–V + section status.
- Tidak ada brainstorming judul (5 judul + alasan + metode) sebelum menulis.
- Tidak ada wizard proyek (tipe penelitian, metode, pedoman kampus).
- Tidak ada format kampus (margin/font/spasi → DOCX styled).
- Tidak ada Lab Revisi (paste masukan dosen → diff per section).
- Tidak ada PPT sidang / simulasi sidang.
- Tidak ada BYOK (model mereka sentral, kredit/subscription).

---

## 4. DUA FITUR YANG DIGABUNGKAN (keputusan)

1. **FITUR A — "Alur Proyek Penelitian Terstruktur" (ala Mantra):**
   topik + metode → brainstorming 5 judul → proyek + kerangka bab → generate per sub-bab berurutan dengan status (Draf AI → Diterima) → konsistensi antar bab → format kampus → ekspor DOCX. Ini Tulang.

2. **FITUR B — "Workspace Penulisan Interaktif + Sitasi Terjaga" (ala Jenni):**
   editor rich-text dengan autocomplete ghost text (→ accept), document/section prompt, library (PDF/DOI/Zotero), pencarian paper semantic di sidebar, AI Chat dengan context pills, AI Edit seleksi, Review klaim, version history. Ini Otot.

**Titik temu yang membuatnya lebih dari sekadar gabungan:** setiap hasil FITUR A (generate sub-bab) dirender KE DALAM editor FITUR B sebagai blok yang bisa diedit per-kata dengan autocomplete — dan sitasi dari FITUR A (sumber tervalidasi) menjadi satu-satunya sumber yang boleh dipakai autocomplete/chat di FITUR B (source-grounded, seperti toggle "Library search only" di Jenni).

---

## 5. ALUR ENAK FINAL — Produk Terintegrasi (draft)

```
A. SETUP (sekali)
   Settings → BYOK: provider (OpenAI-compatible / Ollama / adapter),
   base URL, API key (encrypted di server / env var), model LLM + embedding.
   Akademi: OpenAlex + Crossref (+ Semantic Scholar, Unpaywall).

B. ONBOARDING PROYEK (Fitur A)
   1. Pilih tipe (Skripsi/Tesis/Disertasi/Jurnal/Proposal)
   2. Topik + bidang + objek + metode (+ metode SPK: AHP/TOPSISIS/... — jangan hardcode IT)
   3. Preferensi sitasi: bahasa, style (APA7/IEEE/Harvard/Vancouver/CSL), range tahun, min. sitasi, preprint
   4. (Opsional) Upload pedoman kampus → ekstrak format → user edit hasil ekstrak
   5. Brainstorming: 5 judul + alasan + metode + risiko → [USE THIS TITLE]
        → PROYEK DIBUAT + KERANGKA BAB I–V + ResearchMemory (judul, rumusan, tujuan, variabel, dsb.)

C. MENULIS (Fitur B, di dalam proyek)
   Layout 3 kolom:
   KIRI:  struktur bab/sub-bab (status: EMPTY/AI_DRAFT/USER_EDITED/NEEDS_REVISION/REVIEWED/APPROVED)
          + Library + Find papers (semantic, 1 query, Sort/Filter)
   TENGAH: editor TipTap
          - autocomplete ghost text (context: section prompt + ResearchMemory + sumber terpilih)
            → accept, Shift+→ cycle, Ctrl+/ panggil, Refine, 👍/👎
          - @ untuk sisip sitasi (hanya dari Source set proyek)
          - blok ✦ (generate/improve per blok)
          - seleksi → AI Edit (Ctrl+J) dengan DIFF sebelum overwrite
   KANAN: AI Chat (pills: Current section / Current document / Library / PDF terpilih / Web)
          + panel Section prompt + panel Review

D. GENERATE SUB-BAB (Fitur A di dalam editor)
   [Generate] per sub-bab:
   ResearchMemory + section prompt + approved sections + retrieval sumber
   → LLM → validasi source_id → draft disisipkan sebagai blok berstatus AI_DRAFT
   → user: Accept / Regenerate / Edit manual → APPROVED
   (kredit = panggilan API-mu sendiri; log tiap run: model, token, latensi)

E. SITASI (aman)
   LLM TIDAK BOLEH membuat referensi. Model hanya boleh memakai [[SOURCE_xxx]]
   dari hasil retrieval (OpenAlex/Crossref/unpaywall). Backend validasi → render
   (APA7/IEEE). Klik sitasi → drawer sumber + status verifikasi
   (VERIFIED_METADATA / EVIDENCE_FOUND / METADATA_ONLY / NEEDS_REVIEW).

F. REVIEW & REVISI
   Review Center: klaim vs sumber, grammar, koherensi, konsistensi antar bab
   (ResearchMemory.sampleSize=50 vs teks "35 responden" → warning),
   severity Critical/Warning/Suggestion → klik melompat ke paragraf.
   Revision Lab (V2): paste masukan dosen → deteksi section → diff → accept/reject.

G. EKSPOR
   DOCX (cover, heading styles, margin/font/spasi sesuai CampusStyle, tabel, gambar,
   caption, daftar pustaka dari CitationUsage — bukan teks LLM) → PDF/LaTeX/BibTeX (V2)
   PPT Sidang + Simulasi Sidang (V2, PptxGenJS).
```

**Onboarding produk (pola Jenni 5-langkah, dimodi):**
1. Set API key (BYOK) → 2. Buat proyek (wizard) → 3. Generate 1 sub-bab →
4. Accept autocomplete pertama → 5. Sisip 1 sitasi terverifikasi.

---

## 6. KOREKSI & PENAJAMAN PRD MENTAH KAMU (berdasarkan verifikasi)

| # | Asumsi di PRD | Realita terverifikasi | Saran |
|---|---|---|---|
| 1 | "Section prompt" per sub-bab ala Jenni | Jenni memakai **document prompt global** + Prompts tersimpan (blok), bukan prompt per-heading | Pertahankan **section prompt** (itu keunggulan Mantra-ish & beda dari Jenni), tapi tambahkan document prompt global sebagai fallback/inherit. |
| 2 | Autocomplete "TAB accept" | Jenni: `→` accept, `Shift+→` cycle, `Ctrl+/` panggil, `Alt+→` per-kata, `Ctrl+J` AI Edit/Chat | Ikuti model keyboard Jenni (uji dulu; familiar bagi pengguna yang pernah pakai). |
| 3 | AI Chat context: document/section/selected/library/PDF/external | Real: pill `Web Ask`, `Library Ask`, `Current document` + `@` mention PDF | Tambah `Selected text` (keunggulanmu) + `Current section` (struktur bab) — kombinasi yang tidak dimiliki Jenni. |
| 4 | Filter pencarian paper: year/journal/author/citation/OA/type | Real (Jenni Doc settings): publish year / impact factor / cited-by / preprint + "paste a sentence from your draft" | Tambahkan filter **impact factor** & **preprint toggle**, dan copy "paste a sentence dari draft-mu" (semantic) — menarik untuk skripsi. |
| 5 | Editor: TipTap (rekomendasi) | Jenni memang **TipTap/ProseMirror** + Mantine | Konsisten; tambahkan **block handle** (+, geser, ✦ AI-per-block) seperti Jenni. |
| 6 | Citation verification status | Jeni memakai kategori Review: Claim Confidence (Unsupported/Misrepresented/Contradicted/Overstated/Weakly Supported) | Gabungkan: status verifikasi sumber (PRD-mu) + score kepercayaan klaim (ala Jenni) di drawer sitasi. |
| 7 | Ekspor DOCX | Mantra: "dipetakan ke Word styles"; Jenni: docx/LaTeX/HTML + 10.000 style CSL | DOCX via **Word styles mapping** (bukan screenshot) + CSL processor untuk style. |
| 8 | (baru) Onboarding | Jenni: 5 langkah = 5 fitur inti | Ikuti pola ini (lihat §5). |
| 9 | (baru) Toggle sumber autocomplete | Jenni: Web search / Library search bisa di-toggle | Wajib di BYOK-mu: toggle "hanya dari Library proyek" = mode aman (source-grounded). |
| 10 | (baru) Kredit | Mantra: 1 kredit/sub-bab, gagal tidak memotong | Di BYOK biayamu = token; tampilkan **estimasi biaya per generate** sebelum user klik (transparansi, pengganti sistem kredit). |

---

## 7. ARsitektur BYOK (ringkas, detail di AGENT PROMPT kamu)

```
Browser (Next.js + TipTail + Mantine/Tailwind)
   → API Gateway (Next.js route handlers)
        → AI Orchestrator (prompt modules, research memory, section prompts)
             → AIProvider { chat() stream() embed() }   ← OpenAI-compatible, Ollama, adapter
        → Retrieval (pgvector: chunks PDF + approved sections)
        → AcademicProvider { searchPapers() getPaper() resolveDOI() }
             → OpenAlex + Crossref (+ Semantic Scholar, Unpaywall)
        → PostgreSQL/Prisma (project, section, source, citation, citationusage, airon)
        → File storage (pedoman kampus, PDF, ekspor)
Rules wajib:
- API key: env var (single-user) / encrypted at rest (multi-user); TIDAK PERNAH ke browser/log.
- Sitasi: LLM hanya boleh memakai SOURCE_id dari retrieval; backend validasi sebelum render.
- Semua aksi AI destruktif (replace teks, generate) = draft dulu → diff/preview → accept.
```

## 8. URUTAN BANGUN MVP (diperketat)

1. Repo + docs (PRD/ARCHITECTURE/DATABASE/AI_PIPELINE/ROADMAP) — sudah ada bahan mentahnya.
2. Database Prisma + auth (single-user mode dulu).
3. BYOK provider settings + smoke test chat/stream/embed.
4. Dashboard + wizard proyek + brainstorming judul (JSON struktural) + ResearchMemory.
5. Struktur Bab I–V (add/delete/rename/drag, status) di sidebar.
6. Editor TipTap + autosave debounced + block handle + version history.
7. Section prompt + document prompt + generate sub-bab (pipeline retrieval → LLM → validasi SOURCE_id).
8. Autocomplete ghost text (debounce + AbortController, context retrieval).
9. Find papers (OpenAlex+Crossref, dedup DOI, filter year/IF/cited/preprint) + Library.
10. Citation pipeline (drawer verifikasi, APA7/IEEE, bibliography dari CitationUsage).
11. AI Chat (context pills + @mention) + AI Edit seleksi (DIFF).
12. PDF ingest (chunk + embed + tanya PDF).
13. Review center (konsistensi ResearchMemory dulu, klaim vs sumber setelah).
14. Ekspor DOCX (Word styles + CampusStyle) → selesai MVP.

## 9. EVIDENSI (screenshot di `shots/`)

| File | Isi |
|---|---|
| jenni-04-library.png | Library: sumber + IF badge, upload PDF/Zotero/Mendeley/DOI/.bib |
| jenni-06-findpapers.png | Find papers: search 250M+, Sort/Filter, contoh query |
| jenni-07-aichat.png | AI Chat: pills Web/Library/Current document, @mention, riwayat |
| jenni-16-docsettings.png | Document settings: prompt, sumber toggle, citation filters, style, font |
| jenni-19-typing-real.png | Editor + toolbar + autocomplete ghost text + sitasi inline + Accept/Refine/👍👎 |
| jenni-18-shortcuts-full.png | Daftar shortcut lengkap (accept/cycle/call/AI Edit/Chat/blok) |
| mantra-01-login.png / mantra-hf-02-filled.png | Form login Mantra + Turnstile (bukti pembatasan verifikasi) |

---

## CATATAN AMAN

- Kredensial yang kamu kirim di chat sebaiknya **jangan disimpan** di file mana pun (tidak kusimpan). Disarankan ganti password kedua akun tersebut karena sudah tersampaikan via chat.
- Tidak ada apa pun yang di-clone dari kode/branding kedua situs; hanya alur produk yang didokumentasikan untuk dibangun ulang orisinal.
