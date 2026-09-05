import { stripHtml } from "./json";

// Daftar dibuat konservatif supaya kata pinjaman seperti "data" tidak ikut dimiringkan.
const ENGLISH_TERMS = [
  "case study", "content analysis", "data collection", "deep learning", "design thinking",
  "focus group", "gap analysis", "literature review", "machine learning", "mixed method",
  "open access", "problem statement", "purposive sampling", "random sampling", "research gap",
  "research question", "snowball sampling", "user experience", "user interface", "background",
  "baseline", "benchmark", "chatbot", "citation", "dashboard", "dataset", "feedback", "framework",
  "frontend", "finding", "impact", "input", "interface", "keyword", "literature", "method",
  "novelty", "output", "preprint", "prompt", "reliability", "sample", "sampling", "software",
  "stakeholder", "survey", "template", "validity", "variable", "website", "workflow", "online",
  "offline", "post-test", "pre-test",
] as const;

export type EnglishTermMatch = {
  term: string;
  count: number;
  sectionIds: string[];
  sectionTitles: string[];
  examples: string[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findOccurrences(text: string, term: string): number[] {
  const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(term)})(?=$|[^A-Za-z])`, "gi");
  const positions: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    positions.push(match.index + match[1].length);
    if (!match[0].length) pattern.lastIndex++;
  }
  return positions;
}

export function scanEnglishTerms(sections: Array<{ id: string; title: string; content?: string }>): EnglishTermMatch[] {
  const matches = new Map<string, EnglishTermMatch>();
  for (const section of sections) {
    const text = stripHtml(section.content || "");
    if (!text) continue;
    for (const term of ENGLISH_TERMS) {
      const positions = findOccurrences(text, term);
      if (!positions.length) continue;
      const current = matches.get(term) || {
        term,
        count: 0,
        sectionIds: [],
        sectionTitles: [],
        examples: [],
      };
      current.count += positions.length;
      current.sectionIds.push(section.id);
      current.sectionTitles.push(section.title);
      for (const position of positions.slice(0, 2)) {
        const start = Math.max(0, text.lastIndexOf(".", position) + 1);
        const end = text.indexOf(".", position);
        const example = text.slice(start, end < 0 ? Math.min(text.length, position + 120) : end + 1).trim();
        if (example && !current.examples.includes(example)) current.examples.push(example);
      }
      matches.set(term, current);
    }
  }
  return [...matches.values()]
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .map((item) => ({ ...item, examples: item.examples.slice(0, 2) }));
}
