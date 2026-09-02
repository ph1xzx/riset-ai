import { DEFAULT_CAMPUS_STYLE } from "./research";

/**
 * PARSER PEDOMAN PENULISAN — generik.
 * Menerima teks pedoman bebas (markdown/plain) dari kampus mana pun,
 * mengekstrak aturan format menjadi TemplateConfig yang langsung dipakai
 * mesin export DOCX/PDF + validator. Teks UNPAM hanya salah satu contoh data.
 */

export type TemplateConfig = {
  pageSize: "A4" | "Letter";
  margins: { top: number; right: number; bottom: number; left: number }; // cm
  body: {
    font: string;
    size: number;
    lineSpacing: number;
    justify: boolean;
    firstLineIndentMm: number;
    spacingAfterPt: number;
  };
  heading1: { bold: boolean; uppercase: boolean; centered: boolean; size: number; pageBreakBefore: boolean };
  heading2: { bold: boolean; size: number; flushLeft: boolean };
  heading3: { size: number; flushLeft: boolean; bold: boolean };
  references: { lineSpacing: number; hangingIndentMm: number };
  citationStyle: string;
  pageNumbering: { front: "lowerRoman" | "arabic"; body: "arabic" };
  frontMatter: string[];
};

export type ParseResult = {
  config: TemplateConfig;
  detected: string[]; // ringkasan aturan yang berhasil dibaca (untuk UI)
  warnings: string[]; // aturan yang tidak ketemu → pakai default
};

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

export function baseConfig(): TemplateConfig {
  const d = DEFAULT_CAMPUS_STYLE as any;
  return {
    pageSize: d.pageSize === "Letter" ? "Letter" : "A4",
    margins: { top: 4, right: 3, bottom: 3, left: 4 },
    body: { font: "Times New Roman", size: 12, lineSpacing: 2, justify: true, firstLineIndentMm: 12.7, spacingAfterPt: 6 },
    heading1: { bold: true, uppercase: true, centered: true, size: 12, pageBreakBefore: true },
    heading2: { bold: true, size: 12, flushLeft: true },
    heading3: { size: 12, flushLeft: true, bold: false },
    references: { lineSpacing: 1, hangingIndentMm: 12.7 },
    citationStyle: "APA7",
    pageNumbering: { front: "lowerRoman", body: "arabic" },
    frontMatter: [],
  };
}

export function parsePedoman(text: string): ParseResult {
  const cfg = baseConfig();
  const detected: string[] = [];
  const warnings: string[] = [];
  const t = text.replace(/\r\n/g, "\n");

  /* --- margin: "Atas: 4 cm", "Kiri: 4 cm", dst. --- */
  const marginPairs: [RegExp, "top" | "right" | "bottom" | "left", string][] = [
    [/(?:^|\n)\s*\**\s*(?:Atas|Top)\b[^0-9\n]{0,10}(\d+(?:[.,]\d+)?)\s*(?:cm|centimeter)/i, "top", "Atas"],
    [/(?:^|\n)\s*\**\s*(?:Kiri|Left)\b[^0-9\n]{0,10}(\d+(?:[.,]\d+)?)\s*(?:cm|centimeter)/i, "left", "Kiri"],
    [/(?:^|\n)\s*\**\s*(?:Kanan|Right)\b[^0-9\n]{0,10}(\d+(?:[.,]\d+)?)\s*(?:cm|centimeter)/i, "right", "Kanan"],
    [/(?:^|\n)\s*\**\s*(?:Bawah|Bottom)\b[^0-9\n]{0,10}(\d+(?:[.,]\d+)?)\s*(?:cm|centimeter)/i, "bottom", "Bawah"],
  ];
  for (const [re, key, label] of marginPairs) {
    const v = num(t.match(re)?.[1]);
    if (v !== null) {
      cfg.margins[key] = v;
      detected.push(`Margin ${label}: ${v} cm`);
    } else warnings.push(`Margin ${label} tidak ditemukan — pakai default ${cfg.margins[key]} cm`);
  }

  /* --- ukuran kertas --- */
  if (/\bLetter\b/i.test(t)) {
    cfg.pageSize = "Letter";
    detected.push("Kertas: Letter");
  } else if (/\bA4\b/i.test(t)) {
    detected.push("Kertas: A4");
  } else warnings.push("Ukuran kertas tidak disebut — pakai A4");

  /* --- font utama --- */
  const fontHit = t.match(/Font(?: utama| isi)?[^A-Za-z\n]{0,6}(Times New Roman|Tahoma|Arial|Calibri|Cambria|Garamond)/i);
  if (fontHit) {
    cfg.body.font = fontHit[1];
    detected.push(`Font isi: ${fontHit[1]}`);
  } else warnings.push("Font tidak disebut — pakai Times New Roman");

  /* --- ukuran font isi --- */
  const sizeHit =
    num(t.match(/Ukuran font isi[^0-9\n]{0,8}(\d+(?:[.,]\d+)?)\s*pt/i)?.[1]) ??
    num(t.match(/Ukuran(?:nya)?\s*:?\s*\n?\s*(\d+(?:[.,]\d+)?)\s*pt/i)?.[1]);
  if (sizeHit !== null) {
    cfg.body.size = sizeHit;
    cfg.heading1.size = sizeHit;
    cfg.heading2.size = sizeHit;
    cfg.heading3.size = sizeHit;
    detected.push(`Ukuran font isi: ${sizeHit} pt`);
  } else warnings.push("Ukuran font tidak disebut — pakai 12 pt");

  /* --- line spacing --- */
  const lsHit =
    num(t.match(/Line spacing\s*:?\s*\n?\s*(\d+(?:[.,]\d+)?)/i)?.[1]) ??
    num(t.match(/(\d+(?:[.,]\d+)?)\s*spasi/i)?.[1]);
  if (lsHit !== null) {
    cfg.body.lineSpacing = lsHit;
    detected.push(`Spasi isi: ${lsHit}`);
  } else warnings.push("Spasi tidak disebut — pakai 2");

  /* --- perataan --- */
  if (/justify|rata kiri[- ]kanan/i.test(t)) detected.push("Perataan isi: Justify");
  else warnings.push("Perataan tidak disebut — pakai Justify");

  /* --- first line indent (ketukan): 1 ketukan ≈ 2,54 mm --- */
  const ketukan = num(t.match(/indentasi[^0-9\n]{0,40}(\d+(?:[.,]\d+)?)\s*ketukan/i)?.[1]);
  if (ketukan !== null) {
    cfg.body.firstLineIndentMm = Math.round(ketukan * 2.54 * 10) / 10;
    cfg.references.hangingIndentMm = cfg.body.firstLineIndentMm;
    detected.push(`Indentasi baris pertama: ${ketukan} ketukan (≈ ${cfg.body.firstLineIndentMm} mm)`);
  } else if (/first line indent/i.test(t)) {
    detected.push("First line indent disebut tanpa angka — pakai 12,7 mm");
  } else warnings.push("Indentasi paragraf tidak disebut — pakai 12,7 mm (5 ketukan)");

  /* --- spacing after paragraf --- */
  if (/spacing after\s*:?\s*\n?\s*0\s*pt/i.test(t)) {
    cfg.body.spacingAfterPt = 0;
    detected.push("Spacing after paragraf: 0 pt");
  }

  /* --- aturan BAB (heading 1) --- */
  if (/kapital seluruhnya|uppercase/i.test(t)) detected.push("Judul BAB: kapital seluruhnya");
  else cfg.heading1.uppercase = false;
  if (/(?:posisi\s*)?center/i.test(t)) detected.push("Judul BAB: center");
  if (/dimulai pada halaman baru|page break/i.test(t)) detected.push("BAB baru: page break");
  else cfg.heading1.pageBreakBefore = false;
  if (/\bbold\b/i.test(t)) detected.push("Heading: bold");

  /* --- heading rata kiri (bukan tangga) --- */
  if (/sejajar dengan margin kiri|left indent\s*=\s*0|tidak boleh.*menjorok/i.test(t)) {
    detected.push("Heading 2/3/4: rata margin kiri (bukan tangga)");
  } else warnings.push("Aturan posisi heading tidak eksplisit — default rata kiri");

  /* --- penomoran halaman --- */
  if (/romawi kecil|romawi/i.test(t)) {
    cfg.pageNumbering.front = "lowerRoman";
    detected.push("Nomor halaman awal: Romawi kecil");
  }
  if (/angka arab|\barab\b/i.test(t)) {
    cfg.pageNumbering.body = "arabic";
    detected.push("Nomor halaman BAB: Arab (1, 2, 3…)");
  }

  /* --- gaya sitasi --- */
  const cite = t.match(/\b(APA|IEEE|Harvard|Vancouver|MLA)\b/i);
  if (cite) {
    cfg.citationStyle = cite[1].toUpperCase() === "APA" ? "APA7" : cite[1].toUpperCase();
    detected.push(`Sitasi: ${cfg.citationStyle}`);
  } else warnings.push("Gaya sitasi tidak disebut — pakai APA7");

  /* --- daftar pustaka: hanging indent + spasi 1 --- */
  if (/hanging indent/i.test(t)) detected.push("Daftar pustaka: hanging indent");
  const dpBlock = t.split(/DAFTAR PUSTAKA/i)[1] || "";
  const dpLs = num(dpBlock.slice(0, 600).match(/line spacing\s*:?\s*\n?\s*(\d+(?:[.,]\d+)?)/i)?.[1]);
  if (dpLs !== null) {
    cfg.references.lineSpacing = dpLs;
    detected.push(`Spasi daftar pustaka: ${dpLs}`);
  }

  /* --- urutan bagian awal (front matter) --- */
  const fmBlock = t.match(/Urutan dokumen\s*:?\s*\n((?:\s*\d+[.)]\s*\n?[^0-9\n]*\n?){3,})/i)?.[1];
  if (fmBlock) {
    cfg.frontMatter = fmBlock
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    detected.push(`Bagian awal: ${cfg.frontMatter.length} item terdeteksi`);
  }

  return { config: cfg, detected, warnings };
}

/** Gabung config template ke campusStyle proyek (2 level, template menang). */
export function mergeStyle(base: Record<string, any>, over: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object")
      out[k] = { ...base[k], ...v };
    else out[k] = v;
  }
  return out;
}
