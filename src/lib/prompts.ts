import type { AiSettings, ChatMessage } from "./ai";
import type { ProjectRow } from "./types";
import { SourceRecord } from "./cite";

const lang = (p: ProjectRow) => (p.language === "en" ? "English" : "Bahasa Indonesia");

function projectContext(p: ProjectRow): string {
  return [
    `Proyek: ${p.title}`,
    `Jenis: ${p.type}`,
    `Topik: ${p.topic}`,
    p.field ? `Bidang: ${p.field}` : "",
    p.object ? `Objek: ${p.object}` : "",
    p.problem ? `Permasalahan: ${p.problem}` : "",
    p.method ? `Metode: ${p.method}` : "",
    `Gaya sitasi: ${p.citationStyle}`,
    `Bahasa dokumen: ${lang(p)}`,
    p.documentPrompt ? `Instruksi khusus: ${p.documentPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The library of allowed citations. The AI may ONLY cite these source ids. */
function sourceList(sources: SourceRecord[]): string {
  if (!sources.length) return "(library kosong — JANGAN membuat sitasi, tulis tanpa sitasi)";
  return sources
    .map(
      (s, i) =>
        `[id:${s.id}] ${s.title} — ${s.authors.slice(0, 2).join(", ")}${s.authors.length > 2 ? " et al." : ""} (${s.year ?? "t.t."})${s.journal ? ", " + s.journal : ""}${s.doi ? ", DOI " + s.doi : ""}`
    )
    .join("\n");
}

/**
 * Citation-safety wrapper: instructs the model to embed citations ONLY as
 * <sup class="citation" data-source-id="...">(Author, Year)</sup> using ids from
 * the provided library. Post-processing validates tokens and drops fakes.
 */
export function citationRules(sources: SourceRecord[]): string {
  if (!sources.length) {
    return "PENTING (citation safety): library sitasi KOSONG. Kamu TIDAK BOLEH membuat sitasi apa pun. Tulis narasi tanpa sitasi.";
  }
  return [
    "PENTING (citation safety): kamu HANYA boleh menyitasi sumber dari library di bawah.",
    "Format sitasi dalam konten: <sup class=\"citation\" data-source-id=\"ID_SUMBER\">(TextSitasi)</sup> — sisipkan setelah kalimat yang didukung.",
    "GANTI ID_SUMBER dengan id: persis dari library. Sumber yang tidak ada di library DITOLAK sistem.",
    "",
    "LIBRARY SUMBER:",
    sourceList(sources),
  ].join("\n");
}

export function brainstormMessages(p: ProjectRow): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "Kamu asisten riset akademik Indonesia. Balas HANYA dengan JSON valid tanpa code fence: {\"titles\":[\"...\", \"...\", \"...\", \"...\", \"...\"]} berisi 5 judul skripsi/tesis yang kuat, spesifik, dan akademis.",
    },
    {
      role: "user",
      content: `${projectContext(p)}\n\nBuat 5 alternatif judul untuk dokumen ini. Topik inti: ${p.topic}`,
    },
  ];
}

export function generateMessages(p: ProjectRow, section: { title: string; level: number }, prevTitles: string[], sources: SourceRecord[], extraPrompt?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `Kamu penulis akademik profesional. Bahasa dokumen: ${lang(p)}.`,
        "Tulis konten akademik yang formal, padat, dan konsisten. Balas HANYA dengan HTML (tag <p>, <h1>-<h4> bila perlu, <ul>/<ol>, <table>) — tanpa markdown, tanpa code fence, tanpa komentar.",
        "Tidak boleh ada placeholder seperti [TODO] atau [Nama].",
        "",
        citationRules(sources),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        projectContext(p),
        `Judul dokumen sebelumnya: ${prevTitles.join(" | ") || "(tidak ada)"}`,
        extraPrompt ? `Instruksi tambahan: ${extraPrompt}` : "",
        `Tulis bagian: "${section.title}" (level ${section.level}).`,
        "Panjang: 3–6 paragraf untuk sub-bab, 2–3 untuk bab. Sertakan sitasi dari library bila klaim memerlukan dukungan.",
      ].filter(Boolean).join("\n"),
    },
  ];
}

export function autocompleteMessages(p: ProjectRow, section: { title: string }, prefix: string, sources: SourceRecord[]): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `Kamu asisten ghost-text untuk editor akademik. Bahasa: ${lang(p)}.`,
        "Lanjutkan TULISAN yang diberikan persis dari titik berhenti. Hanya balas dengan teks lanjutan (tanpa pengulangan bagian yang sudah ada, tanpa markdown, tanpa tanda kutip pembuka).",
        "Maksimal 2-3 kalimat. Jangka untuk diterima dengan Tab.",
        "",
        sources.length
          ? "Jika perlu sitasi: gunakan <sup class=\"citation\" data-source-id=\"ID\">(Teks)</sup> hanya dengan ID dari: " +
            sourceList(sources)
          : "JANGAN menyisipkan sitasi (library kosong).",
      ].join("\n"),
    },
    {
      role: "user",
      content: `${projectContext(p)}\nBagian: ${section.title}\n\nTeks sejauh ini:\n${prefix}`,
    },
  ];
}

export function editMessages(p: ProjectRow, section: { title: string }, selection: string, command: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `Kamu editor akademik. Bahasa dokumen: ${lang(p)}.`,
        "Terapkan perintah pada teks pilihan. Balas HANYA dengan HTML hasil editan (siap menggantikan seleksi), tanpa komentar.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `${projectContext(p)}\nBagian: ${section.title}\nPerintah: ${command}\nTeks pilihan:\n${selection}`,
    },
  ];
}

export function paraphraseMessages(p: ProjectRow, section: { title: string }, content: string, sources: SourceRecord[]): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `Kamu penulis akademik. Bahasa dokumen: ${lang(p)}.`,
        "Parafrase konten berikut: ubah kalimat dan diksi namun pertahankan makna, data, dan struktur HTML. Pertahankan tag <sup class=\"citation\" ...> apa adanya.",
        "Balas HANYA dengan HTML hasil parafrase.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `${projectContext(p)}\nBagian: ${section.title}\n\nKonten:\n${content}`,
    },
  ];
}

export function reviewMessages(p: ProjectRow, content: string, sectionTitle: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        'Kamu reviewer akademik. Analisis konten lalu balas HANYA JSON valid tanpa code fence:\n{"findings":[{"type":"grammar|tone|consistency|structure","severity":"high|medium|low","quote":"...","issue":"...","suggestion":"..."}],"summary":"..."}',
    },
    {
      role: "user",
      content: `${projectContext(p)}\nBagian: ${sectionTitle}\n\nKonten (HTML):\n${content}`,
    },
  ];
}

export function figureSuggestionsMessages(p: ProjectRow, section: { title: string; content: string }): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        'Kamu analis kebutuhan visual akademik. Balas HANYA JSON valid tanpa code fence: {"suggestions":[{"caption":"...","prompt":"deskripsi gambar dalam bahasa Inggris","type":"diagram|ilustrasi|foto|logo","reason":"..."}]} maksimal 3 saran gambar yang tepat untuk sub-bab ini.',
    },
    {
      role: "user",
      content: `${projectContext(p)}\nSub-bab: ${section.title}\nKonten:\n${section.content.slice(0, 3000)}`,
    },
  ];
}

export function defenseQaMessages(p: ProjectRow, question: string, context: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Kamu penguji sidang skripsi yang tajam tetapi konstruktif. Bahasa: Indonesia.",
        "Jawab sebagai penguji: tanyakan, tantum asumsi, lalu berikan saran perbaikan singkat.",
        "Akhiri dengan 'Saran perbaikan:' maksimal 2 poin.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `${projectContext(p)}\nKonteks dokumen:\n${context.slice(0, 4000)}\n\nPertanyaan penguji: ${question}`,
    },
  ];
}

export function chatMessages(p: ProjectRow, history: { role: string; content: string }[], question: string, sources: SourceRecord[]): ChatMessage[] {
  const msgs: ChatMessage[] = [
    {
      role: "system",
      content: [
        `Kamu asisten penulisan skripsi untuk proyek ini. Bahasa: ${lang(p)}. Jawab ringkas, konkret, dan merujuk bagian dokumen bila relevan.`,
        "",
        citationRules(sources),
      ].join("\n"),
    },
    ...history.slice(-10).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: question },
  ];
  return msgs;
}

export function citationScanMessages(p: ProjectRow, content: string, sectionTitle: string, sources: SourceRecord[]): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        'Kamu auditor sitasi. Temukan klaim faktual/teori yang BELUM memiliki sitasi dan bisa didukung oleh library. Balas HANYA JSON valid: {"opportunities":[{"quote":"kalimat yang perlu sitasi","sourceId":"id dari library atau null","reason":"..."}]}',
    },
    {
      role: "user",
      content: `${projectContext(p)}\nBagian: ${sectionTitle}\n\nLIBRARY:\n${sourceList(sources)}\n\nKonten (HTML):\n${content.slice(0, 6000)}`,
    },
  ];
}

export function citationRepairMessages(p: ProjectRow, missing: string[], sources: SourceRecord[]): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        'Kamu penata sitasi. Untuk tiap item yang tidak terverifikasi, sarankan pembenaran. Balas HANYA JSON valid: {"repairs":[{"title":"judul sumber","action":"keep|update|remove","suggestion":"..."}]}',
    },
    {
      role: "user",
      content: `${projectContext(p)}\nItem bermasalah:\n${missing.join("\n")}\n\nLibrary saat ini:\n${sourceList(sources)}`,
    },
  ];
}

export { AiSettings, ChatMessage };
