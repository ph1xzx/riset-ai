// Diagnostik import: jalankan parseDocx asli terhadap file .docx,
// cetak judul section + sampel HTML mentah dari mammoth (tanpa modifikasi).
import fs from "fs";
import mammoth from "mammoth";
import { parseDocx } from "../src/lib/docx-import";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx scripts/diag-import.ts <file.docx>");
  const buffer = fs.readFileSync(file);

  const { value: rawHtml } = await mammoth.convertToHtml({ buffer }, { includeDefaultStyleMap: true });
  console.log("=== RAW MAMMOTH (first 2000 chars) ===");
  console.log(rawHtml.slice(0, 2000));
  console.log("\n=== RAW around PRIORITAS ===");
  const i = rawHtml.indexOf("PRIORITAS");
  if (i >= 0) console.log(rawHtml.slice(Math.max(0, i - 300), i + 400));
  console.log("\n=== RAW around Disusun ===");
  const j = rawHtml.indexOf("Disusun");
  if (j >= 0) console.log(rawHtml.slice(Math.max(0, j - 200), j + 400));

  const doc = await parseDocx(buffer);
  console.log("\n=== PARSE RESULT ===");
  console.log("title:", doc.title);
  console.log("blocks:", doc.blocks.length, "sections:", doc.sections.length);
  for (const s of doc.sections) {
    console.log(`- L${s.level} | ${s.title} | html len ${s.html.length}`);
  }
  console.log("\n=== FIRST SECTION HTML (first 1200) ===");
  console.log(doc.sections[0]?.html.slice(0, 1200));
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
