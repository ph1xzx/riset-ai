// Default research structure per project type + section prompt defaults.

export type StructureNode = {
  title: string;
  level: 1 | 2;
  prompt?: string;
};

const SKRIPSI: StructureNode[] = [
  { title: "BAB I PENDAHULUAN", level: 1 },
  {
    title: "1.1 Latar Belakang",
    level: 2,
    prompt:
      "Susun menggunakan pola piramida terbalik: mulai dari konteks umum/perkembangan teknologi, lalu objek penelitian, masalah spesifik, solusi yang ada, perbandingan pendekatan, dan diakhiri alasan pemilihan metode.",
  },
  { title: "1.2 Identifikasi Masalah", level: 2, prompt: "Uraikan daftar poin masalah yang teridentifikasi dari latar belakang. Nyatakan sebagai poin, bukan kalimat tanya." },
  { title: "1.3 Rumusan Masalah", level: 2, prompt: "Bentuk rumusan masalah dalam kalimat tanya yang terukur dan selaras dengan tujuan penelitian." },
  { title: "1.4 Batasan Masalah", level: 2, prompt: "Batasan ruang lingkup penelitian agar fokus dan dapat diselesaikan." },
  { title: "1.5 Tujuan Penelitian", level: 2, prompt: "Tujuan harus menjawab satu per satu rumusan masalah." },
  { title: "1.6 Manfaat Penelitian", level: 2, prompt: "Manfaat teoretis dan praktis." },
  { title: "1.7 Sistematika Penulisan", level: 2, prompt: "Gambarkan alur pembahasan tiap bab secara ringkas." },
  { title: "BAB II LANDASAN TEORI", level: 1, prompt: "Tinjau teori pendukung, penelitian terdahulu (minimal 5-8 rujukan), dan kerangka berpikir. Gunakan rujukan dari Library proyek." },
  { title: "BAB III METODOLOGI PENELITIAN", level: 1, prompt: "Jenis & desain penelitian, populasi & sampel, teknik pengumpulan data, variabel/instrumen, dan teknik analisis sesuai metode yang dipilih." },
  { title: "BAB IV HASIL DAN PEMBAHASAN", level: 1, prompt: "Sajikan hasil sesuai data, lalu bahas dengan mengaitkan teori dari BAB II. Konsisten dengan jumlah sampel dan variabel di ResearchMemory." },
  { title: "BAB V PENUTUP", level: 1, prompt: "Kesimpulan menjawab rumusan masalah satu per satu, lalu saran pengembangan." },
];

const JURNAL_IMRAD: StructureNode[] = [
  { title: "Introduction", level: 1, prompt: "Background, research gap, objective. End with the research question." },
  { title: "Literature Review / Related Work", level: 1, prompt: "Recent, relevant studies; position this work." },
  { title: "Methodology", level: 1, prompt: "Design, data, instruments, analysis method — replicable." },
  { title: "Results", level: 1, prompt: "Findings with tables/figures, no interpretation." },
  { title: "Discussion", level: 1, prompt: "Interpret results, compare with prior work, limitations." },
  { title: "Conclusion", level: 1, prompt: "Answer the research question; implications; future work." },
];

const PROPOSAL: StructureNode[] = [
  { title: "BAB I PENDAHULUAN", level: 1 },
  { title: "1.1 Latar Belakang", level: 2 },
  { title: "1.2 Rumusan Masalah", level: 2 },
  { title: "1.3 Batasan Masalah", level: 2 },
  { title: "1.4 Tujuan", level: 2 },
  { title: "1.5 Manfaat", level: 2 },
  { title: "BAB II TINJAUAN PUSTAKA", level: 1 },
  { title: "BAB III METODOLOGI", level: 1 },
  { title: "BAB IV JADWAL KEGIATAN", level: 1 },
  { title: "DAFTAR PUSTAKA", level: 1 },
];

export function defaultStructure(type: string): StructureNode[] {
  const t = type.toLowerCase();
  if (t.includes("jurnal") || t.includes("scopus") || t.includes("sinta") || t === "journal" || t.includes("artikel")) return JURNAL_IMRAD;
  if (t.includes("proposal")) return PROPOSAL;
  return SKRIPSI;
}

export const SECTION_STATUS = {
  EMPTY: { label: "Kosong", color: "bg-ink-100 text-ink-500" },
  AI_DRAFT: { label: "Draf AI", color: "bg-amber-100 text-amber-700" },
  USER_EDITED: { label: "Diedit", color: "bg-sky-100 text-sky-700" },
  NEEDS_REVISION: { label: "Perlu Revisi", color: "bg-rose-100 text-rose-700" },
  REVIEWED: { label: "Ditinjau", color: "bg-violet-100 text-violet-700" },
  APPROVED: { label: "Selesai", color: "bg-emerald-100 text-emerald-700" },
} as const;

export const PROJECT_TYPES = [
  { id: "Skripsi", desc: "S1 — Bab I–V lengkap" },
  { id: "Tesis", desc: "S2 — analisis kritis" },
  { id: "Disertasi", desc: "S3 — novelty kuat" },
  { id: "Artikel Jurnal", desc: "IMRAD — jurnal terakreditasi" },
  { id: "Proposal", desc: "Proposal penelitian" },
];

export const METHODS = [
  "Quantitative", "Qualitative", "Mixed Method", "R&D", "Waterfall",
  "Experimental", "Case Study", "Custom",
];

export const MCDM_METHODS = ["AHP", "TOPSIS", "PROMETHEE", "SAW", "MOORA", "ELECTRE", "SMART"];


export const CITATION_STYLES = ["APA7", "IEEE", "Harvard", "Vancouver"];

export const DEFAULT_CAMPUS_STYLE = {
  pageSize: "A4",
  margins: { top: 4, right: 3, bottom: 3, left: 4 }, // cm
  body: { font: "Times New Roman", size: 12, lineSpacing: 2, firstLineIndentMm: 12.7, spacingAfterPt: 6 },
  heading1: { bold: true, uppercase: true, centered: true, size: 12, pageBreakBefore: true },
  heading2: { bold: true, size: 12, flushLeft: true },
  heading3: { bold: false, size: 12, flushLeft: true },
  references: { lineSpacing: 1, hangingIndentMm: 12.7 },
};
