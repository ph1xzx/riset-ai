/* SAPU BENTROK ANTAR-FITUR — proyek impor besar sebagai kelinci percobaan */
import { validateFormat } from "@/lib/format-validator";
import { buildMarkdownPackage } from "@/lib/markdown-package";
import fs from "fs";

const BASE = "http://localhost:3000";
const PID = "cmtk0ugyl005i9uarhxd578w6";
const line = (t: string) => console.log(`\n=== ${t} ===`);

const getProject = () => fetch(`${BASE}/api/projects/${PID}`).then((r) => r.json());

/* 1. validator SEBELUM reformat */
line("1) Cek Format sebelum reformat");
let pj: any = await getProject();
const before = validateFormat(pj.sections.map((s: any) => ({ title: s.title, level: s.level, content: s.content || "" })));
console.log("  masalah:", before.length, before.slice(0, 3).map((i) => i.code).join(", "));

/* 2. apply template + reformat */
line("2) Apply template + reformat");
const tpl = (await fetch(`${BASE}/api/templates`).then((r) => r.json())).templates[0];
const ap = await fetch(`${BASE}/api/projects/${PID}/apply-template`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ templateId: tpl.id, reformat: true }),
}).then((r) => r.json());
console.log("  diterapkan:", ap.templateName, "| dirapikan:", ap.reformatted, "section");

/* 3. validator SESUDAH — tidak boleh nambah */
line("3) Cek Format sesudah reformat");
pj = await getProject();
const after = validateFormat(pj.sections.map((s: any) => ({ title: s.title, level: s.level, content: s.content || "" })));
console.log("  masalah:", after.length, after.slice(0, 3).map((i) => i.code).join(", "));
console.log("  verdict:", after.length <= before.length ? "OK (tidak nambah)" : "REGRESI!");

/* 4. Export MD — build_config harus ikut template, aset aman */
line("4) Export MD setelah template");
const { bytes, manifest } = await buildMarkdownPackage(pj, BASE);
console.log("  zip bytes:", bytes.length.toLocaleString("id-ID"), "| chapters:", manifest.chapters.length, "| aset:", manifest.required_assets.length);
console.log("  build_config:", JSON.stringify(manifest.build_config));

/* 5. Export DOCX + PDF setelah semua */
line("5) Export DOCX & PDF setelah template+reformat");
const ex = await fetch(`${BASE}/api/projects/${PID}/export`, { method: "POST" });
fs.writeFileSync("/tmp/sweep.docx", Buffer.from(await ex.arrayBuffer()));
console.log("  docx:", ex.status, fs.statSync("/tmp/sweep.docx").size.toLocaleString("id-ID"), "bytes");
const pdf = await fetch(`${BASE}/api/projects/${PID}/export-pdf`, { method: "POST" });
const pdfBuf = Buffer.from(await pdf.arrayBuffer());
console.log("  pdf :", pdf.status, pdfBuf.subarray(0, 5).toString(), pdfBuf.length.toLocaleString("id-ID"), "bytes");

/* 6. halaman UI terkait */
line("6) Halaman UI");
for (const p of [`/projects/${PID}`, `/projects/${PID}/preview`, "/templates", "/new", "/import"]) {
  const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
  console.log(`  ${p} → ${r.status}`);
}
