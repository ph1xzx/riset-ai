import mammoth from "mammoth";

export type ImportedBlock = {
  kind: "h1" | "h2" | "h3" | "body";
  text: string;
  html: string;
};

export type ImportedDoc = {
  title: string;
  blocks: ImportedBlock[];
  sections: { title: string; level: 1 | 2; html: string }[];
  rawHtml: string;
};

const HEADING_STYLES = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading4'] => h3:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Judul'] => h1:fresh",
  "p[style-name='Sub Judul'] => h2:fresh",
  // banyak template skripsi Indonesia pakai outline level di property paragraf
  "p[outline-level=1] => h1:fresh",
  "p[outline-level=2] => h2:fresh",
  "p[outline-level=3] => h3:fresh",
];

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Deteksi heading berbasis PATTERN teks (template Word sering memakai
// style Normal + bold saja, bukan Heading style):
//   "BAB I PENDAHULUAN" / "BAB 1 PENDAHULUAN" / "Bagian 1 ..."  → h1
//   "1.1 Latar Belakang" / "2.3.1 Uji Validitas"                → h2/h3
const RE_BAB = /^(BAB|Bagian|Bab)\s+[IVX0-9]+[\s.:—-]*[A-Z]?/i;
const RE_SUB = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{1,2}))?\s+([A-Z][^.]{3,80})$/;
// heading bawaan front-matter / back-matter (sering style Normal + bold).
// Di-anchor akhir agar "Daftar pustaka yang lengkap adalah..." TIDAK jadi heading.
const RE_BACKMATTER =
  /^(abstrak|abstract|kata pengantar|daftar isi|daftar pustaka|references?|daftar tabel|daftar gambar|daftar lampiran|lampiran)\b[\s.:—-]*[A-Z0-9]{0,3}$/i;

// Entri DAFTAR ISI: pola heading + NOMOR HALAMAN di ekor ("BAB I 1",
// "1.1 Latar Belakang 4", "LAMPIRAN 80"). Heading asli boleh berakhiran angka
// romawi sebagai bagian judul ("PROMETHEE II", "BAB I") — karena itu di LUAR
// region TOC hanya angka arab di ekor yang dianggap nomor halaman.
const RE_PAGE_DIGIT = /(?:\s|\.+)(\d{1,4})$/;
const RE_PAGE_ROMAN = /(?:\s|\.+)([ivxlc]{1,5})$/i;
function headingish(text: string): boolean {
  return (
    RE_BAB.test(text) ||
    RE_BACKMATTER.test(text) ||
    /^\d{1,2}\.\d{1,2}/.test(text) ||
    /^(daftar|lampiran)\b/i.test(text)
  );
}
function isTocLine(text: string, looseRoman = false): boolean {
  if (!text || text.length > 100 || !headingish(text)) return false;
  if (RE_PAGE_DIGIT.test(text)) return true;
  return looseRoman && RE_PAGE_ROMAN.test(text);
}

// Beberapa generator DOCX menulis tiap fragmen teks sebagai run terpisah TANPA
// spasi di boundary ("...PRIORITAS</w:t><w:t>PENGADAAN..."). Normalisasi: sisipkan
// spasi bila dua tag inline sejenis berdempetan dan kedua sisinya huruf/angka.
function fixRunSpacing(html: string): string {
  return html.replace(
    /(?<=[A-Za-z0-9])(<\/(strong|em|b|i|u|span|a)>)(?=<\2>[A-Za-z0-9])/g,
    "$1 "
  );
}

function detectHeading(text: string): "h1" | "h2" | "h3" | null {
  if (RE_BACKMATTER.test(text) && text.length < 90) return "h1";
  if (RE_BAB.test(text) && text.length < 90) return "h1";
  const m = text.match(RE_SUB);
  if (m) {
    if (m[3]) return "h3"; // x.y.z
    return "h2"; // x.y
  }
  return null;
}

/**
 * Konversi DOCX (skripsi) → blok terstruktur.
 * Heading 1/2 → section; heading 3 & isinya → tetap di dalam section induk.
 * Gambar: mammoth membakunya sebagai data-URI (ikut pindah ke editor).
 */
export async function parseDocx(buffer: Buffer): Promise<ImportedDoc> {
  const { value: rawHtml, messages } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: HEADING_STYLES, includeDefaultStyleMap: true }
  );
  if (messages.some((m) => m.type === "error")) {
    console.warn("mammoth warnings:", messages.map((m) => m.message).slice(0, 5));
  }

  // split top-level tags (gambar dipertahankan di dalam paragraf)
  const blocks: ImportedBlock[] = [];
  const re = /<(h1|h2|h3|p|div|table|blockquote|img)(\s[^>]*)?>([\s\S]*?)<\/\1>|<img(\s[^>]*)?\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawHtml)) !== null) {
    if (m[0].startsWith("<img") && !m[1]) {
      blocks.push({ kind: "body", text: "", html: m[0] });
      continue;
    }
    const tag = m[1].toLowerCase();
    const inner = fixRunSpacing(m[3] ?? "");
    const text = stripTags(inner);
    if (!text && !/<img/i.test(inner)) continue;
    // buang entri daftar isi (heading + nomor halaman) agar struktur tidak
    // terduplikasi oleh TOC
    if (text && isTocLine(text)) continue;

    if (tag === "img") {
      blocks.push({ kind: "body", text: "", html: m[0] });
      continue;
    }
    let kind: ImportedBlock["kind"] =
      tag === "h1" ? "h1" : tag === "h2" ? "h2" : tag === "h3" ? "h3" : "body";

    // fallback pattern (hanya untuk paragraf biasa → upgrade jadi heading)
    if (kind === "body" && text) {
      const det = detectHeading(text);
      if (det) {
        kind = det;
        if (tag !== "p" && tag !== "div") {
          // biarkan; tetap heading
        }
      }
    }

    const html =
      tag === "table"
        ? m[0]
        : kind === "body"
        ? `<p>${inner}</p>`
        : `<${kind}>${inner}</${kind}>`;

    blocks.push({ kind, text, html });
  }

  // region TOC: setelah heading "DAFTAR ISI", buang baris bernomor halaman
  // (termasuk romawi: "ABSTRAK iv") sampai ketemu blok non-TOC pertama
  const tocStart = blocks.findIndex(
    (b) => (b.kind === "h1" || b.kind === "h2") && /^daftar isi\b/i.test(b.text)
  );
  if (tocStart >= 0) {
    let k = tocStart + 1;
    while (k < blocks.length) {
      const t = blocks[k].text;
      const isHdr = /^(isi|halaman|hal\.?)$/i.test(t); // header kolom TOC
      const endsPage =
        Boolean(t) && t.length < 100 && (RE_PAGE_DIGIT.test(t) || RE_PAGE_ROMAN.test(t));
      if (!isHdr && !endsPage) break;
      k++;
    }
    if (k > tocStart + 1) blocks.splice(tocStart + 1, k - tocStart - 1);
  }

  // gabungkan "BAB I" + judul bab yang tertulis di baris/paragraf berikutnya
  // (template Word sering memisah nomor bab dan judulnya jadi dua paragraf)
  for (let i = 0; i < blocks.length - 1; i++) {
    const b = blocks[i];
    const n = blocks[i + 1];
    if (
      b.kind === "h1" &&
      /^bab\s+[ivx0-9]+[.]?$/i.test(b.text) &&
      (n.kind === "h1" || n.kind === "body") &&
      n.text &&
      n.text.length < 60 &&
      !/^bab\s/i.test(n.text) &&
      !/<img/i.test(n.html)
    ) {
      b.text = `${b.text} ${n.text}`.replace(/\s+/g, " ").trim();
      b.html = `<h1>${b.text}</h1>`;
      blocks.splice(i + 1, 1);
    }
  }

  // bangun sections: h1 = bab, h2 = sub-bab; h3 & body menempel di section aktif
  const sections: ImportedDoc["sections"] = [];
  let current: { title: string; level: 1 | 2; html: string } | null = null;
  let title = "";

  for (const b of blocks) {
    if (b.kind === "h1") {
      if (current) sections.push(current);
      if (!title && !/^(abstrak|abstract|kata pengantar|daftar isi|pernyataan|lembar)/i.test(b.text)) {
        title = b.text;
      }
      current = { title: b.text, level: 1, html: "" };
    } else if (b.kind === "h2") {
      if (current) sections.push(current);
      current = { title: b.text, level: 2, html: "" };
    } else {
      if (!current) {
        // jangan push di sini — push terjadi saat heading berikutnya / di akhir,
        // supaya section tidak terduplikasi
        current = { title: "(Bagian awal)", level: 1, html: "" };
      }
      // h3 tetap sebagai sub-judul dalam isi section
      if (b.kind === "h3" && b.text) {
        current.html += `<h3>${b.html.replace(/^<h3>|<\/h3>$/g, "")}</h3>`;
      } else {
        current.html += b.html;
      }
    }
  }
  if (current) sections.push(current);

  // judul proyek: prefer teks cover (paragraf pertama bagian awal) — h1 pertama
  // biasanya "LEMBAR PERSETUJUAN" / "DAFTAR GAMBAR" dll, bukan judul skripsi
  const firstSec = sections.find((s) => s.title === "(Bagian awal)");
  const coverMatch = firstSec?.html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const cover = coverMatch ? stripTags(coverMatch[1]).replace(/\s+/g, " ").trim() : "";
  if (cover.length >= 20) title = cover.slice(0, 160);

  return { title: title || "(dokumen tanpa judul)", blocks, sections, rawHtml };
}

/** Struktur (hanya heading) dari DOCX pedoman lama → custom structure. */
export async function extractStructureDocx(
  buffer: Buffer
): Promise<{ title: string; headings: { title: string; level: 1 | 2 }[] }> {
  const doc = await parseDocx(buffer);
  const headings = doc.blocks
    .filter((b) => b.kind === "h1" || b.kind === "h2")
    .map((b) => ({ title: b.text, level: b.kind === "h1" ? (1 as const) : (2 as const) }))
    .filter((h) => h.title.length > 0 && h.title.length < 120);
  return { title: doc.title, headings };
}
