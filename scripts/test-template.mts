/* VERIFIKASI FITUR TEMPLATE PEDOMAN — jalankan: npx tsx scripts/test-template.mts <projectId>
 * 1. Parser pedoman (teks UNPAM sebagai contoh data)
 * 2. CRUD /api/templates
 * 3. Terapkan ke proyek (termasuk hasil impor) → export DOCX → cek XML
 * 4. Format checker pada section yang sengaja salah
 */
import fs from "fs";
import { parsePedoman } from "@/lib/template-parser";
import { validateFormat } from "@/lib/format-validator";

const BASE = "http://localhost:3000";
const line = (t: string) => console.log(`\n========== ${t} ==========`);
const projectId = process.argv[2];
const pedoman = fs.readFileSync("templates/unpam-ti.md", "utf-8");

/* 1. PARSER */
line("1) Parser pedoman generik (data contoh: UNPAM TI)");
const p = parsePedoman(pedoman);
const c = p.config;
console.log("  margin    :", JSON.stringify(c.margins));
console.log("  body      :", JSON.stringify(c.body));
console.log("  heading1  :", JSON.stringify(c.heading1));
console.log("  sitasi    :", c.citationStyle, "| halaman awal:", c.pageNumbering.front);
console.log("  frontMatter:", c.frontMatter.length, "item →", c.frontMatter.slice(0, 3).join(", "), "…");
console.log("  referensi :", JSON.stringify(c.references));
console.log("  terbaca   :", p.detected.length, "aturan | peringatan:", p.warnings.length);
for (const d of p.detected) console.log("    ✓", d);
for (const w of p.warnings) console.log("    ⚠", w);

/* 2. CRUD TEMPLATE */
line("2) API template (buat → list → hapus-tes)");
const created = await fetch(`${BASE}/api/templates`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Pedoman Skripsi TI — UNPAM",
    prodi: "Teknik Informatika",
    university: "Universitas Pamulang",
    sourceText: pedoman,
  }),
}).then((r) => r.json());
console.log("  POST /api/templates → id:", created.id);
const list = await fetch(`${BASE}/api/templates`).then((r) => r.json());
console.log("  GET  /api/templates →", list.templates.length, "template:", list.templates.map((t: any) => t.name).join("; "));

/* 3. TERAPKAN KE PROYEK + EXPORT */
if (projectId) {
  line("3) Terapkan ke proyek (hasil impor) → export DOCX");
  const ap = await fetch(`${BASE}/api/projects/${projectId}/apply-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId: created.id }),
  }).then((r) => r.json());
  console.log("  apply →", ap.templateName, "| margin:", JSON.stringify(ap.campusStyle?.margins));
  const ex = await fetch(`${BASE}/api/projects/${projectId}/export`, { method: "POST" });
  console.log("  export docx:", ex.status);
  fs.writeFileSync("/tmp/tpl.docx", Buffer.from(await ex.arrayBuffer()));
} else {
  console.log("\n  (lewati langkah 3 — tidak ada projectId)");
}

/* 4. FORMAT CHECKER */
line("4) Format checker (section sengaja salah)");
const bad = [
  { title: "BAB 3 METODOLOGI PENELITIAN.", level: 1, content: "" },
  { title: "3.1 Metode Penelitian", level: 2, content: "<p>Menurut (Harandi, 2019) metode X dipakai.</p>" },
  { title: "3.4 Pengujian", level: 2, content: "<h3>3.4.2 Tanpa induk 3.4.1</h3>" },
  { title: "DAFTAR PUSTAKA", level: 1, content: "<p>Sudarsono, B. (2020). Buku Tidak Disitasi. Jakarta: X.</p>" },
];
const issues = validateFormat(bad);
for (const i of issues) console.log(`  [${i.severity.toUpperCase()}] ${i.code}: ${i.msg}`);
console.log("  total:", issues.length, "masalah");
const clean = validateFormat([
  { title: "BAB III METODOLOGI PENELITIAN", level: 1, content: "" },
  { title: "3.1 Metode Penelitian", level: 2, content: "<p>Menurut (Harandi, 2019) metode X.</p>" },
  { title: "3.2 Pengujian", level: 2, content: "" },
  { title: "DAFTAR PUSTAKA", level: 1, content: "<p>Harandi, R. (2019). Judul. Jurnal X.</p>" },
]);
console.log("  kontrol bersih →", clean.length, "masalah (harus 0)");
