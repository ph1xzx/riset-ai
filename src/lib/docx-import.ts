import mammoth from "mammoth";
import { normalizeTableHtml } from "./table-format";

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

export type ImportedImage = {
  mime: string;
  bytes: Buffer;
  index: number;
};

/** Simpan asset DOCX ke storage lalu kembalikan URL yang bisa dibuka browser. */
export type ImportedImageStore = (image: ImportedImage) => Promise<string>;

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
  const re = /<(h1|h2|h3|p|div|table|blockquote|ul|ol|pre|dl|figure|li|img)(\s[^>]*)?>([\s\S]*?)<\/\1>|<img(\s[^>]*)?\/?>/gi;
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

    const preserveContainer = ["table", "blockquote", "ul", "ol", "pre", "dl", "figure"].includes(tag);
    const html = preserveContainer
      ? normalizeTableHtml(m[0])
      : kind === "body"
      ? `<p>${inner}</p>`
      : `<${kind}>${inner}</${kind}>`;

    blocks.push({ kind, text, html });
  }

  // region TOC: Word sering mengubah field daftar isi menjadi heading biasa,
  // sehingga nomor halaman tidak selalu ikut keluar dari Mammoth. Kalau ada
  // outline BAB yang berulang setelah DAFTAR ISI, blok pertama adalah TOC dan
  // harus dibuang agar tidak menjadi section kosong yang menduplikasi naskah.
  const tocStart = blocks.findIndex(
    (b) => (b.kind === "h1" || b.kind === "h2") && /^daftar isi\b/i.test(b.text)
  );
  if (tocStart >= 0) {
    const chapterEntries = blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => index > tocStart && block.kind === "h1" && RE_BAB.test(block.text))
      .map(({ block, index }) => ({
        index,
        key: block.text.match(/^bab\s+([ivx0-9]+)/i)?.[1]?.toUpperCase() || "",
      }))
      .filter((entry) => entry.key);

    const firstChapter = chapterEntries[0];
    const repeatedChapter = firstChapter && chapterEntries.find((entry) => entry.key === firstChapter.key && entry.index > firstChapter.index);
    if (repeatedChapter) {
      // Kemunculan kedua chapter pertama adalah awal naskah. Bagian sebelum itu
      // merupakan outline yang disalin ke daftar isi.
      blocks.splice(tocStart + 1, repeatedChapter.index - tocStart - 1);
    } else {
      let k = tocStart + 1;
      while (k < blocks.length) {
        const t = blocks[k].text;
        const isHdr = /^(isi|halaman|hal\.?)$/i.test(t);
        const endsPage =
          Boolean(t) && t.length < 100 && (RE_PAGE_DIGIT.test(t) || RE_PAGE_ROMAN.test(t));
        if (!isHdr && !endsPage) break;
        k++;
      }
      if (k > tocStart + 1) blocks.splice(tocStart + 1, k - tocStart - 1);
    }
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

const DATA_IMAGE_RE = /data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)(?=["'])/gi;

export function docxImageExtension(mime: string): string {
  const subtype = mime.split("/")[1]?.toLowerCase() || "png";
  if (subtype === "jpeg") return "jpg";
  if (subtype === "svg+xml") return "svg";
  return subtype.replace(/[^a-z0-9]/g, "") || "png";
}

/**
 * Mammoth menghasilkan gambar sebagai data URI. Data URI cocok untuk preview
 * kecil, tetapi membuat response proyek dan autosave menjadi sangat besar.
 * Materialisasi memindahkannya ke storage dan mengganti src menjadi URL biasa.
 */
export async function materializeDocxImages(
  doc: ImportedDoc,
  store: ImportedImageStore
): Promise<{ doc: ImportedDoc; images: number; stored: number }> {
  const cache = new Map<string, string>();
  let nextIndex = 0;
  let imageOccurrences = 0;
  let storedImages = 0;

  async function replaceInHtml(html: string): Promise<string> {
    const matches = Array.from(html.matchAll(DATA_IMAGE_RE));
    if (!matches.length) return html;

    let output = html;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const dataUri = match[0];
      const index = match.index;
      if (index == null) continue;

      const mime = match[1].toLowerCase();
      const base64 = match[2].replace(/\s+/g, "");
      let url = cache.get(dataUri);
      if (!url) {
        nextIndex += 1;
        url = await store({ mime, bytes: Buffer.from(base64, "base64"), index: nextIndex });
        cache.set(dataUri, url);
        storedImages += 1;
      }

      output = `${output.slice(0, index)}${url}${output.slice(index + dataUri.length)}`;
      imageOccurrences += 1;
    }
    return output;
  }

  const sections = [];
  for (const section of doc.sections) {
    sections.push({ ...section, html: await replaceInHtml(section.html) });
  }

  return { doc: { ...doc, sections }, images: imageOccurrences, stored: storedImages };
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
