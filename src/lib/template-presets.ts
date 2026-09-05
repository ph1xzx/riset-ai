import type { TemplateConfig } from "./template-parser";
import { baseConfig } from "./template-parser";

/**
 * SARAN TEMPLATE BAWAAN, data contoh gaya pedoman yang umum dipakai.
 * Semua preset bisa dipakai langsung ATAU disesuaikan per-aturan di editor.
 */

export type Preset = {
  id: string;
  name: string;
  prodi: string;
  university: string;
  category: "Kampus" | "Skripsi" | "Tesis" | "Artikel" | "Laporan";
  description: string;
  config: TemplateConfig;
};

function cfg(over: {
  margins?: Partial<TemplateConfig["margins"]>;
  body?: Partial<TemplateConfig["body"]>;
  heading1?: Partial<TemplateConfig["heading1"]>;
  heading2?: Partial<TemplateConfig["heading2"]>;
  heading3?: Partial<TemplateConfig["heading3"]>;
  references?: Partial<TemplateConfig["references"]>;
  citationStyle?: string;
  front?: "lowerRoman" | "arabic";
  frontMatter?: string[];
}): TemplateConfig {
  const b = baseConfig();
  return {
    ...b,
    margins: { ...b.margins, ...over.margins },
    body: { ...b.body, ...over.body },
    heading1: { ...b.heading1, ...over.heading1 },
    heading2: { ...b.heading2, ...over.heading2 },
    heading3: { ...b.heading3, ...over.heading3 },
    references: { ...b.references, ...over.references },
    citationStyle: over.citationStyle ?? b.citationStyle,
    pageNumbering: { ...b.pageNumbering, front: over.front ?? b.pageNumbering.front },
    frontMatter: over.frontMatter ?? b.frontMatter,
  };
}

export const TEMPLATE_PRESETS: Preset[] = [
  {
    id: "unpam-ti",
    name: "Pedoman Skripsi TI, UNPAM",
    prodi: "Teknik Informatika",
    university: "Universitas Pamulang",
    category: "Kampus",
    description:
      "Margin 4/4/3/3 cm • TNR 12pt • spasi 2 • after 0pt • indentasi 5 ketukan • BAB Romawi kapital center (halaman baru) • heading rata kiri • nomor awal Romawi • APA • pustaka hanging spasi 1.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 2, spacingAfterPt: 0, firstLineIndentMm: 12.7 },
      citationStyle: "APA7",
      references: { lineSpacing: 1, hangingIndentMm: 12.7 },
    }),
  },
  {
    id: "skripsi-umum",
    name: "Skripsi Umum Indonesia",
    prodi: "",
    university: "",
    category: "Skripsi",
    description:
      "Gaya paling lazim: margin kiri 4 cm, lainnya 3 cm • TNR 12pt • spasi 2 • indentasi 1,27 cm • heading rata kiri • nomor awal Romawi • APA7.",
    config: cfg({
      margins: { top: 3, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 2, spacingAfterPt: 6, firstLineIndentMm: 12.7 },
    }),
  },
  {
    id: "skripsi-spasi-15",
    name: "Skripsi Spasi 1,5 (hemat halaman)",
    prodi: "",
    university: "",
    category: "Skripsi",
    description:
      "Untuk pedoman yang membolehkan spasi 1,5: margin 4/4/3/3 • TNR 12pt • spasi 1,5 • indentasi 1 cm • APA7.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 1.5, spacingAfterPt: 6, firstLineIndentMm: 10 },
    }),
  },
  {
    id: "laporan-ta",
    name: "Laporan TA / Magang (Arial 11)",
    prodi: "",
    university: "",
    category: "Laporan",
    description:
      "Gaya laporan teknis: margin 4/4/3/3 • Arial 11pt • spasi 1,5 • heading bold rata kiri • IEEE.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { font: "Arial", size: 11, lineSpacing: 1.5, firstLineIndentMm: 10 },
      citationStyle: "IEEE",
    }),
  },
  {
    id: "jurnal-apa",
    name: "Artikel Jurnal (APA 7)",
    prodi: "",
    university: "",
    category: "Artikel",
    description:
      "Format manuskrip jurnal APA: margin 2,54 cm semua sisi • TNR 12pt • spasi 2 • tanpa indentasi bab khusus • APA7.",
    config: cfg({
      margins: { top: 2.5, left: 2.5, right: 2.5, bottom: 2.5 },
      body: { lineSpacing: 2, spacingAfterPt: 0, firstLineIndentMm: 12.7 },
      heading1: { centered: false, uppercase: false, pageBreakBefore: false },
      citationStyle: "APA7",
    }),
  },
  {
    id: "skripsi-ieee",
    name: "Skripsi Teknik (IEEE)",
    prodi: "Teknik / Informatika",
    university: "",
    category: "Skripsi",
    description:
      "Contoh format skripsi teknis: margin 4/3/3/3 cm, TNR 12pt, spasi 1,5, heading bertingkat rata kiri, sitasi IEEE, dan daftar pustaka hanging indent.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 1.5, spacingAfterPt: 6, firstLineIndentMm: 10 },
      heading1: { centered: true, uppercase: true, pageBreakBefore: true },
      heading2: { flushLeft: true },
      citationStyle: "IEEE",
      references: { lineSpacing: 1, hangingIndentMm: 10 },
    }),
  },
  {
    id: "tesis-analitis",
    name: "Tesis Analitis (APA 7)",
    prodi: "",
    university: "",
    category: "Tesis",
    description:
      "Titik awal untuk tesis dengan pembahasan lebih padat: margin 4/3/3/3 cm, TNR 12pt, spasi 1,5, paragraf justify, sitasi APA7.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 1.5, spacingAfterPt: 6, firstLineIndentMm: 12.7 },
      heading1: { centered: true, uppercase: true, pageBreakBefore: true },
      citationStyle: "APA7",
    }),
  },
  {
    id: "artikel-ieee",
    name: "Artikel Konferensi (IEEE)",
    prodi: "",
    university: "",
    category: "Artikel",
    description:
      "Contoh manuskrip ringkas: kertas A4, margin 2,54 cm, TNR 10pt, spasi tunggal, heading ringkas, dan sitasi IEEE.",
    config: cfg({
      margins: { top: 2.54, left: 2.54, right: 2.54, bottom: 2.54 },
      body: { size: 10, lineSpacing: 1, spacingAfterPt: 3, firstLineIndentMm: 6.35 },
      heading1: { centered: false, uppercase: false, pageBreakBefore: false, size: 10 },
      heading2: { size: 10, flushLeft: true },
      heading3: { size: 10, flushLeft: true },
      citationStyle: "IEEE",
      references: { lineSpacing: 1, hangingIndentMm: 6.35 },
      front: "arabic",
    }),
  },
  {
    id: "laporan-magang-formal",
    name: "Laporan Magang Formal",
    prodi: "",
    university: "",
    category: "Laporan",
    description:
      "Titik awal laporan kegiatan: margin 4/3/3/3 cm, Arial 11pt, spasi 1,5, heading rata kiri, dan sitasi Harvard.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { font: "Arial", size: 11, lineSpacing: 1.5, firstLineIndentMm: 10 },
      heading1: { centered: true, uppercase: true, pageBreakBefore: true },
      heading2: { flushLeft: true },
      citationStyle: "Harvard",
    }),
  },
];
