// Prompt modules — dipisah dari API routes (engineering rule #12).
// Token sitasi: [[SOURCE_<sourceId>]] — backend memvalidasi sourceId sebelum render.

import type { Project, ResearchMemory, Source, Section } from "@prisma/client";
import { parseJsonArray } from "../json";
import type { SourceRef } from "../citations";

function tokenOf(sourceId: string): string {
  return `SOURCE_${sourceId}`;
}

function memoryBlock(m: ResearchMemory | null, p: Project): string {
  if (!m) {
    return `Penelitian: "${p.title}" (${p.type}). Topik: ${p.topic || "-"} | Bidang: ${p.field || "-"} | Metode: ${p.method || "-"}`;
  }
  const lines = [
    `Judul: ${m.title || p.title}`,
    `Masalah: ${parseJsonArray<string>(m.problems).join("; ") || "-"}`,
    `Rumusan masalah: ${parseJsonArray<string>(m.questions).join("; ") || "-"}`,
    `Tujuan: ${parseJsonArray<string>(m.objectives).join("; ") || "-"}`,
    `Objek: ${m.researchObject || "-"}`,
    `Metodologi: ${m.methodology || p.method || "-"}`,
    `Populasi: ${m.population || "-"}`,
    `Sampel: ${m.sample || "-"}${m.sampleSize ? ` (n=${m.sampleSize})` : ""}`,
    `Variabel: ${parseJsonArray<string>(m.variables).join(", ") || "-"}`,
    `Kriteria: ${parseJsonArray<string>(m.criteria).join(", ") || "-"}`,
    `Alternatif: ${parseJsonArray<string>(m.alternatives).join(", ") || "-"}`,
    `Pengolahan data: ${m.analysisMethod || "-"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function makeAllowed(sources: Source[]): Map<string, SourceRef> {
  const allowed = new Map<string, SourceRef>();
  for (const s of sources) {
    allowed.set(s.id, {
      id: s.id,
      title: s.title,
      authors: parseJsonArray<string>(s.authors),
      year: s.year,
      journal: s.journal,
      doi: s.doi,
    });
  }
  return allowed;
}

function sourcesBlock(sources: Source[], max = 12): string {
  if (!sources.length) return "(belum ada sumber di Library proyek — generate tetap boleh berjalan tanpa sitasi)";
  return sources
    .slice(0, max)
    .map((s) => {
      const authors = parseJsonArray<string>(s.authors).slice(0, 4).join(", ");
      return `- [${tokenOf(s.id)}] ${s.title}. ${authors}. ${s.journal || "s.t."} ${s.year ?? "s.t."}. Abstrak: ${s.abstract ? s.abstract.slice(0, 400) : "(tidak ada)"}`;
    })
    .join("\n");
}

function lang(p: Project): string {
  return p.language === "en" ? "Bahasa Inggris (formal akademik)" : "Bahasa Indonesia (formal akademik)";
}

const CITATION_RULES = [
  "Aturan sitasi WAJIB:",
  `- Kamu HANYA BOLEH merujuk sumber lewat token persis seperti [${tokenOf("<id-sumber>")}], yaitu token yang tercantum di daftar sumber (ganti <id-sumber> dengan id yang sesuai).`,
  "- DILARANG menulis referensi yang tidak ada di daftar: tidak ada nama+tahun fiktif, tidak ada 'Smith (2020)' manual.",
  "- Jika sebuah klaim didukung sumber, tulis token di akhir klausa: ...meningkatkan akurasi [SOURCE_abc123].",
  "- Jika tidak ada sumber yang relevan, tulis tanpa sitasi (jangan dipaksa).",
].join("\n");

export function brainstormMessages(p: {
  topic: string; field: string; object: string; caseStudy: string; problem: string; method: string;
}): { system: string; user: string } {
  return {
    system:
      "Kamu asisten riset akademik senior. Kembalikan HANYA JSON valid tanpa markdown fence, skema:\n" +
      '{"titles":[{"title":string,"rationale":string,"problem":string,"recommendedMethod":string,"dataNeeded":string,"advantages":string,"risks":string}],' +
      '"memory":{"problems":[string],"researchQuestions":[string],"objectives":[string],"variables":[string],"criteria":[string],"alternatives":[string]}}\n' +
      "Buat tepat 5 alternatif judul penelitian yang kuat, spesifik, feasible, dan bervariasi pendekatannya.",
    user: `Topik: ${p.topic}\nBidang: ${p.field || "-"}\nObjek: ${p.object || "-"}\nStudi kasus: ${p.caseStudy || "-"}\nMasalah awal: ${p.problem || "-"}\nMetode yang diinginkan: ${p.method || "-"}`,
  };
}

export function generateSectionMessages(opts: {
  project: Project;
  memory: ResearchMemory | null;
  section: Section;
  previousApproved: { title: string; contentText: string }[];
  sources: Source[];
}): { system: string; user: string; allowed: Map<string, SourceRef> } {
  const { project, memory, section, previousApproved, sources } = opts;
  const allowed = makeAllowed(sources);

  const system = [
    `Kamu penulis akademik profesional. Bahasa output: ${lang(project)}.`,
    CITATION_RULES,
    "Aturan penulisan: paragraf koheren (3-5 paragraf, 250-450 kata), nada akademik formal, hindari pengulangan antar sub-bab.",
    "Kembalikan HANYA isi sub-bab (tanpa heading sub-babnya), tanpa markdown code fence, tanpa daftar pustaka.",
  ].join("\n");

  const user = [
    `KONTEKS PROYEK:\n${memoryBlock(memory, project)}`,
    project.documentPrompt ? `INSTRUKSI DOKUMEN: ${project.documentPrompt}` : "",
    previousApproved.length
      ? `BAGIAN SEBELUMNYA (jaga konsistensi fakta & istilah, JANGAN mengulang isinya):\n${previousApproved.map((s) => `### ${s.title}\n${s.contentText.slice(0, 1000)}`).join("\n\n")}`
      : "",
    `DAFTAR SUMBER (satu-satunya yang boleh disitasi):\n${sourcesBlock(sources)}`,
    `TUGAS: Tulis sub-bab "${section.title}" dari proyek "${project.title}".`,
    section.prompt ? `INSTRUKSI SUB-BAB: ${section.prompt}` : "",
    `Gaya sitasi final ${project.citationStyle} — kamu tetap menulis token, sistem yang merender.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user, allowed };
}

export function autocompleteMessages(opts: {
  project: Project;
  memory: ResearchMemory | null;
  section: Section;
  paragraph: string;
  sources: Source[];
}): { system: string; user: string; allowed: Map<string, SourceRef> } {
  const { project, memory, section, paragraph, sources } = opts;
  const allowed = makeAllowed(sources);
  const system = [
    `Kamu asisten penulisan akademik. Bahasa: ${lang(project)}.`,
    "Lanjutkan paragraf yang sedang diketik secara natural: 1-3 kalimat lanjutan yang SELARAS dengan alur.",
    CITATION_RULES,
    "Kembalikan HANYA teks lanjutan (jangan mengulang kalimat terakhir user), tanpa heading, tanpa fence.",
  ].join("\n");
  const user = [
    `Sub-bab: ${section.title}`,
    memory ? `KONTEKS: ${memoryBlock(memory, project).slice(0, 500)}` : "",
    sources.length ? `SUMBER: ${sourcesBlock(sources, 6)}` : "",
    `PARAGRAF (lanjutkan): "${paragraph.slice(-800)}"`,
  ].filter(Boolean)
    .join("\n");
  return { system, user, allowed };
}

export const EDIT_COMMANDS = [
  { id: "improve", label: "Improve Academic Writing" },
  { id: "paraphrase", label: "Paraphrase" },
  { id: "shorten", label: "Shorten" },
  { id: "expand", label: "Expand" },
  { id: "simplify", label: "Simplify" },
  { id: "formal", label: "More Formal" },
  { id: "fix-grammar", label: "Fix Grammar" },
  { id: "coherence", label: "Improve Coherence" },
  { id: "add-evidence", label: "Add Evidence" },
  { id: "add-citation", label: "Add Citation" },
] as const;

export function editMessages(opts: {
  project: Project;
  selection: string;
  command: string;
  sectionTitle: string;
  sources: Source[];
}): { system: string; user: string; allowed: Map<string, SourceRef> } {
  const { project, selection, command, sectionTitle, sources } = opts;
  const allowed = makeAllowed(sources);
  const system = [
    `Kamu editor penulisan akademik. Bahasa: ${lang(project)}.`,
    "Terapkan instruksi edit pada teks terpilih; pertahankan makna ilmiah dan istilah teknis.",
    CITATION_RULES,
    "Kembalikan HANYA teks hasil (pengganti penuh teks terpilih), tanpa komentar, tanpa fence.",
  ].join("\n");
  const user = [
    `Sub-bab: ${sectionTitle}`,
    `Instruksi edit: ${command}`,
    sources.length ? `SUMBER: ${sourcesBlock(sources, 6)}` : "",
    `TEKS TERPILIH:\n"""${selection}"""`,
  ].filter(Boolean)
    .join("\n");
  return { system, user, allowed };
}

export function chatMessages(opts: {
  project: Project;
  memory: ResearchMemory | null;
  contexts: { label: string; content: string }[];
  history: { role: string; content: string }[];
  userMessage: string;
  sources: Source[];
}): { system: string; user: string; allowed: Map<string, SourceRef> } {
  const { project, memory, contexts, history, userMessage, sources } = opts;
  const allowed = makeAllowed(sources);
  const system = [
    `Kamu asisten riset tertanam di workspace penulisan. Bahasa: ${lang(project)}.`,
    `KONTEKS PROYEK:\n${memoryBlock(memory, project)}`,
    sources.length
      ? `LIBRARY PROYEK (satu-satunya sumber sitasi; pakai token bila mengutip):\n${sourcesBlock(sources, 10)}`
      : "",
    "Jawab ringkas dan terstruktur (markdown ringan boleh).",
  ].filter(Boolean)
    .join("\n\n");
  const user = [
    contexts.length
      ? `KONTEKS TERLAMPIR:\n${contexts.map((c) => `### ${c.label}\n${c.content.slice(0, 2000)}`).join("\n")}`
      : "",
    history.slice(-8).map((h) => `${h.role === "user" ? "USER" : "AI"}: ${h.content.slice(0, 800)}`).join("\n"),
    `USER: ${userMessage}`,
  ].filter(Boolean)
    .join("\n\n");
  return { system, user, allowed };
}

export function paraphraseMessages(opts: {
  project: Project;
  section: Section;
  contentText: string;
  existingCitations: string[];
}): { system: string; user: string } {
  const { project, section, contentText, existingCitations } = opts;
  const citationRule = existingCitations.length
    ? `\nSITASI BERIKUUT ADA DI TEKS ASLI — TETAPKAN PERSIS SEPERTI ASLI (jangan ubah, hapus, atau reformat):\n${existingCitations.map((c) => `- ${c}`).join("\n")}`
    : "";
  return {
    system: [
      `Kamu editor ahli penulisan akademik. Bahasa output: ${lang(project)}.`,
      "Parafrase teks secara penuh: ganti struktur kalimat, pilihan kata, dan urutan gagasan, TAPI pertahankan semua fakta, angka, nama metode, istilah teknis, dan makna ilmiah.",
      "Nada formal akademik, koheren, tanpa pengulangan.",
      "Kembalikan HANYA hasil parafrase, tanpa heading, tanpa komentar, tanpa fence.",
    ].join("\n"),
    user: [
      `Sub-bab: ${section.title}`,
      section.prompt ? `INSTRUKSI SUB-BAB: ${section.prompt}` : "",
      citationRule,
      `TEKS:\n"""${contentText}"""`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function defenseQaMessages(opts: {
  project: Project;
  memory: ResearchMemory | null;
  sections: { title: string; contentText: string }[];
  count: number;
}): { system: string; user: string } {
  const { project, memory, sections, count } = opts;
  return {
    system:
      "Kamu penguji skripsi/tesis yang pengalaman dan tepat sasaran. Kembalikan HANYA JSON valid tanpa markdown fence:\n" +
      `{"questions":[{"bab":string,"question":string,"why":string,"answerPoints":[string]}]}\n` +
      `Buat tepat ${count} pertanyaan yang benar-benar akan ditanyakan penguji: mulai dari rumusan masalah & kebaruan, landasan teori, metodologi (sampling, validitas, alasan metode), hasil (interpretasi, keterbatasan), sampai saran pengembangan. "why" = alasan singkat mengapa penguji menanyakan ini. "answerPoints" = 2-4 poin jawaban berbasis ISI DOKUMEN (bukan teori umum).`,
    user: [
      `KONTEKS PROYEK:\n${memoryBlock(memory, project)}`,
      `ISI DOKUMEN (ringkas per section):\n${sections
        .map((s) => `### ${s.title}\n${s.contentText.slice(0, 1200)}`)
        .join("\n\n")}`,
    ].join("\n\n"),
  };
}

export function citeContextMessages(opts: {
  project: Project;
  section: Section;
  source: { title: string; authors: string[]; year: number | null; journal: string; abstract: string };
  citationDisplay: string;
}): { system: string; user: string } {
  const { project, section, source, citationDisplay } = opts;
  return {
    system: [
      `Kamu asisten penulisan akademik. Bahasa: ${lang(project)}.`,
      "Tulis SATU kalimat penghubung (15-35 kata) yang menyitaskan sumber secara natural dalam konteks sub-bab — kalimat harus berakhir tepat sebelum tanda sitasi.",
      `Kalimat HARUS relevan dengan judul/abstrak sumber, bukan klaim generik seperti "penelitian ini penting".`,
      `Akhiri output dengan TANDA SITASI PERSIS: ${citationDisplay}`,
      "Kembalikan HANYA kalimat itu, tanpa kutip pembuka, tanpa fence.",
    ].join("\n"),
    user: [
      `Sub-bab aktif: ${section.title}`,
      `SUMBER: ${source.title}. ${source.authors.slice(0, 3).join(", ")}${source.authors.length > 3 ? " et al." : ""}, ${source.year ?? "s.t."}. ${source.journal || ""}`,
      source.abstract ? `Abstrak: ${source.abstract.slice(0, 500)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function figureSuggestionsMessages(opts: {
  project: Project;
  sections: { title: string; contentText: string }[];
}): { system: string; user: string } {
  const { project, sections } = opts;
  return {
    system: [
      "Kamu analis penulisan akademik yang paham kapan sebuah dokumen butuh visual.",
      "Tugas: tunjukkan section mana yang akan JELAS lebih baik kalau ada gambar/diagram/ilustrasi, lalu beri caption, jenis, dan prompt generation yang tepat.",
      'Kembalikan HANYA JSON valid tanpa markdown fence: {"figures":[{"sectionTitle":string,"caption":string,"kind":"diagram"|"ilustrasi"|"foto"|"logo","prompt":string,"webQuery":string|null,"why":string}]},',
      "Aturan:",
      '- "diagram" untuk alur pemikiran, flowchart, arsitektur sistem, kerangka konsep, tahapan metode → "prompt" = instruksi gambar diagram vektor bersih (sukai bahasa Inggris), "webQuery" = null.',
      '- PENTING — "logo": SCAN isi section untuk nama tool/merek/framework/teknologi yang disebut eksplisit (contoh: XAMPP, PHP, MySQL, Laravel, Node.js, Python, VS Code, Figma, SPSS, NVivo, Arduino, dsb). Untuk SETIAP tool yang disebut di tinjauan pustaka/pustaka/landasan teori, buatkan SATU usulan logo dengan "prompt" = null dan "webQuery" = "<nama tool> logo" (huruf sesuai aslinya, mis. "XAMPP logo", "PHP logo"). Usulan ini otomatis dicari di web — user tidak perlu mengetik apa pun.',
      '- "foto"/"ilustrasi" untuk konteks real → "prompt" terisi, "webQuery" = null.',
      'Maksimal 5 usulan total, prioritaskan yang paling bernilai (diagram alur & logo tool yang disebutkan cukup untuk memenuhi kuota). "caption" format "Gambar X. <judul>". "why" = alasan singkat 1 kalimat. Jangan usul gambar untuk section yang sudah jelas tidak butuh visual.',
    ].join("\n"),
    user: [
      `Bahasa dokumen: ${lang(project)}`,
      `STRUKTUR & ISI DOKUMEN:\n${sections
        .map((s) => `### ${s.title}\n${s.contentText.slice(0, 900)}`)
        .join("\n\n")}`,
    ].join("\n\n"),
  };
}

export function reviewMessages(opts: {
  project: Project;
  memory: ResearchMemory | null;
  sections: { title: string; contentText: string; id: string }[];
}): { system: string; user: string } {
  const { project, memory, sections } = opts;
  return {
    system:
      "Kamu penguji skripsi yang rigor. Kembalikan HANYA JSON valid:\n" +
      '{"summary":string,"issues":[{"severity":"critical|warning|suggestion","category":string,"sectionId":string,"message":string,"suggestion":string}]}\n' +
      "Kategori: Grammar, Academic Tone, Coherence, Unsupported Claims, Citation Coverage, Research Consistency, Methodology Consistency.",
    user: [
      `KONTEKS PROYEK:\n${memoryBlock(memory, project)}`,
      `DOKUMEN per section (pakai id yang diberikan untuk field sectionId):\n${sections
        .map((s) => `### [${s.id}] ${s.title}\n${s.contentText.slice(0, 1500)}`)
        .join("\n\n")}`,
      "Periksa: grammar, nada akademik, koherensi antar bab, klaim tanpa dukungan, konsistensi data (mis. jumlah sampel/variabel/metode), keselarasan rumusan masalah - tujuan - metode - kesimpulan.",
    ].join("\n\n"),
  };
}

export function citationScanMessages(opts: {
  project: Project;
  sections: { id: string; title: string; text: string }[];
}): { system: string; user: string } {
  const { project, sections } = opts;
  return {
    system:
      "Kamu adalah asisten reviewer akademik dan pakar sitasi ilmiah bereputasi.\n" +
      "Tugasmu: memindai teks naskah akademik (skripsi/makalah) untuk menemukan kalimat, klaim fakta, statistik, teori, atau pernyataan metodologis yang BELUM memiliki sitasi (rujukan) dan SANGAT MEMBUTUHKAN sitasi ilmiah.\n\n" +
      "Aturan:\n" +
      "1. Pilih maksimal 6-8 peluang sitasi paling esensial dan berdampak tinggi.\n" +
      "2. 'claim' harus merupakan kutipan kalimat atau frasa nyata dari teks yang belum memiliki tanda sitasi.\n" +
      "3. 'reason' jelaskan dalam 1 kalimat mengapa bagian ini butuh rujukan akademik (cth: klaim metodologis, landasan teori, klaim empiris/data).\n" +
      "4. 'academicQuery' harus berupa kata kunci pencarian ilmiah (bisa Bahasa Inggris atau Indonesia) yang sangat akurat untuk menemukan jurnal riil di OpenAlex/Crossref (misal: 'PROMETHEE II multi-criteria decision loan evaluation' atau 'Convolutional Neural Network image classification accuracy').\n\n" +
      "Output WAJIB HANYA JSON valid tanpa markdown formatting atau pembuka/penutup:\n" +
      '[\n  {\n    "sectionId": string,\n    "sectionTitle": string,\n    "claim": string,\n    "reason": string,\n    "academicQuery": string\n  }\n]',
    user: [
      `PROYEK: "${project.title}" (${project.type}). Bidang: ${project.field || "-"} | Metode: ${project.method || "-"}`,
      `NASKAH YANG DIPINDAI:\n${sections
        .map((s) => `### [ID: ${s.id}] ${s.title}\n${s.text.slice(0, 2000)}`)
        .join("\n\n")}`,
      "Temukan klaim atau pernyataan tanpa sitasi yang paling membutuhkan rujukan jurnal ilmiah.",
    ].join("\n\n"),
  };
}

