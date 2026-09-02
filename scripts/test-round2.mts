/* VERIFIKASI 4 UPGRADE — jalankan: npx tsx scripts/test-round2.ts
 * 1. Parser AST (nested list/blockquote/tabel GFM)
 * 2. Smart asset resolver (saran nama mirip)
 * 3. Import MD → DOCX (blockquote + list bernomor ter-render)
 * 4. Export PDF via LibreOffice (magic %PDF)
 */
import fs from "fs";
import { markdownToSectionsAst } from "@/lib/markdown-ast";
import { markdownToSections, suggestCandidates, assetSimilarity } from "@/lib/markdown";

const BASE = "http://localhost:3000";
const line = (t: string) => console.log(`\n========== ${t} ==========`);

const SAMPLE = `# BAB IV HASIL PENELITIAN

## 4.1 Arsitektur Sistem

Paragraf pembuka arsitektur.

> "Sistem yang baik lahir dari desain yang jelas."
> — kutipan penting

- Tahap analisis
  - Studi literatur
    - Jurnal 2020-2025
  - Wawancara pakar
- Tahap implementasi

| Komponen | Teknologi | Fungsi |
| --- | --- | --- |
| Frontend | Next.js | Antarmuka |
| Database | PostgreSQL | Penyimpanan |

## 4.2 Pengujian

![Diagram ERD](assets/erd.png)

![Gambar hilang](assets/gambar-hilang.png)
`;

/* 1. PARSER AST */
line("1) Parser AST (remark-parse + remark-gfm)");
const sections = markdownToSectionsAst(SAMPLE);
for (const s of sections) console.log(`  [${s.level}] ${s.title} — html ${s.html.length} chars`);
const all = sections.map((s) => s.html).join("\n");
console.log("  cek blockquote :", /<blockquote>/.test(all) ? "PASS <blockquote>" : "FAIL");
console.log("  cek nested ul  :", /<ul><li>[^<]*<ul>/.test(all) ? "PASS nested <ul>" : "FAIL");
console.log("  cek tabel      :", /<table><tr><th>Komponen/.test(all) ? "PASS <table> GFM" : "FAIL");
console.log("  cek bold       :", /<strong>/.test(all) ? "ada" : "(tidak ada bold di sampel)");
const fallback = markdownToSections(SAMPLE);
console.log("  fallback regex : parse OK,", fallback.length, "sections (dipakai jika AST gagal)");

/* 2. SMART RESOLVER */
line("2) Smart asset resolver");
const pool = ["05-erd-database.png", "erd_database_final.png", "arsitektur-sistem.png", "foto-wisuda.png"];
for (const q of ["erd.png", "erd-database.png", "gambar-hilang.png"]) {
  const cands = suggestCandidates(q, pool);
  console.log(`  "${q}" → ${cands.map((c) => `${c.name}(${c.score.toFixed(2)})`).join(", ") || "(tanpa kandidat)"}`);
}
console.log("  skor ars vs foto-wisuda:", assetSimilarity("arsitektur-sistem.png", "foto-wisuda.png").toFixed(2), "(harus < 0.3 → tak disarankan)");

/* 3. IMPORT → DOCX */
line("3) Import MD → project → export DOCX");
const res = await fetch(`${BASE}/api/import/markdown`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sections, title: "TES-R2-Parser-AST", status: "DRAFT" }),
});
const pj: any = await res.json();
const pid: string = pj.project?.id || pj.id;
console.log("  import:", res.status, pid || JSON.stringify(pj).slice(0, 120));
const ex = await fetch(`${BASE}/api/projects/${pid}/export`, { method: "POST" });
console.log("  export docx:", ex.status, (ex.headers.get("content-type") || "").slice(0, 60));
fs.writeFileSync("/tmp/r2.docx", Buffer.from(await ex.arrayBuffer()));

/* 4. EXPORT PDF */
line("4) Export PDF (LibreOffice sidecar)");
const t0 = Date.now();
const pres = await fetch(`${BASE}/api/projects/${pid}/export-pdf`, { method: "POST" });
const ct = pres.headers.get("content-type") || "";
if (pres.ok) {
  fs.writeFileSync("/tmp/r2.pdf", Buffer.from(await pres.arrayBuffer()));
  const st = fs.statSync("/tmp/r2.pdf");
  const head = fs.readFileSync("/tmp/r2.pdf").subarray(0, 5).toString();
  console.log(`  status ${pres.status} | ${ct} | ${st.size.toLocaleString("id-ID")} bytes | magic=${head} | ${(Date.now() - t0) / 1000}s`);
} else {
  console.log("  GAGAL:", pres.status, (await pres.json().catch(() => ({}))).error);
}
console.log("\nProject tes:", pid);
