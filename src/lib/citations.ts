// Citation safety system.
// RULE: the LLM must never invent references. It may only reference source
// tokens like [[SOURCE_123]] that map to real records retrieved/searched.
// The backend validates every token before rendering.

import type { Prisma } from "@prisma/client";
import { parseJsonArray } from "./json";

export type SourceRef = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  doi: string | null;
};

export type ValidatedCitation = {
  marker: string; // [[SOURCE_123]]
  sourceId: string;
  valid: boolean;
  display: string;
  ref?: SourceRef;
};

function apaAuthors(authors: string[], year: number | null): string {
  if (!authors.length) return "(s.t.)";
  if (authors.length === 1) return authors[0];
  if (authors.length <= 7) return `${authors.slice(0, -1).join(", ")} & ${authors[authors.length - 1]}`;
  return `${authors[0]} et al.`;
}

export function renderInline(ref: SourceRef, style: string, ordinal?: number): string {
  const year = ref.year ?? "s.t.";
  if (style === "IEEE") {
    return ordinal != null ? `[${ordinal}]` : "[?]";
  }
  if (style === "Harvard") {
    return `(${apaAuthors(ref.authors, ref.year)}, ${year})`;
  }
  // APA 7 (default) & Vancouver fallback
  if (style === "Vancouver" && ordinal != null) return `[${ordinal}]`;
  return `(${apaAuthors(ref.authors, ref.year)}, ${year})`;
}

export function renderBibliographyEntry(ref: SourceRef, style: string, ordinal?: number): string {
  const authors = apaAuthors(ref.authors, ref.year);
  const year = ref.year ?? "s.t.";
  if (style === "IEEE") {
    const a = ref.authors.map((x) => {
      const parts = x.split(" ");
      const init = parts.slice(1, -1).map((p) => p[0] + ".");
      return [init.join(" "), parts[parts.length - 1]].filter(Boolean).join(" ");
    });
    return `[${ordinal}] ${a.join(", ")}, "${ref.title}," ${ref.journal ? ref.journal + ", " : ""}${year}.`;
  }
  if (style === "Vancouver" && ordinal != null) {
    return `${ordinal}. ${ref.authors.slice(0, 3).join("; ")}; ${ref.title}. ${ref.journal}.${year}.`;
  }
  if (style === "Harvard") {
    return `${ref.authors.map((a) => {
      const parts = a.split(" ");
      return parts[parts.length - 1] + ", " + parts.slice(0, -1).map((p) => p[0] + ".").join(" ");
    }).join("; ")} (${year}) "${ref.title}." ${ref.journal ? ref.journal + ", " : ""}`;
  }
  // APA 7
  return `${authors} (${year}). ${ref.title}. ${ref.journal ? ref.journal + "." : ""}${ref.doi ? ` https://doi.org/${ref.doi}` : ""}`;
}

/**
 * Find all [[SOURCE_xxx]] markers in generated text and validate them
 * against the provided map of allowed source ids.
 */
export function validateSourceTokens(text: string, allowed: Map<string, SourceRef>): ValidatedCitation[] {
  const re = /\[\[SOURCE_([A-Za-z0-9]+)\]\]/g;
  const out: ValidatedCitation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sourceId = m[1];
    const ref = allowed.get(sourceId);
    out.push({
      marker: m[0],
      sourceId,
      valid: Boolean(ref),
      display: ref ? renderInline(ref, "APA7") : "",
      ref,
    });
  }
  return out;
}

/**
 * Replace validated [[SOURCE_xxx]] markers with rendered inline citations.
 * Invalid (unknown) markers are removed — never rendered.
 * Returns the cleaned text + the list of used source ids (ordered).
 */
export function renderCitations(
  text: string,
  allowed: Map<string, SourceRef>,
  style: string
): { text: string; usedSourceIds: string[] } {
  const orderedIds: string[] = [];
  const ordinal = new Map<string, number>();
  let out = text.replace(/\[\[SOURCE_([A-Za-z0-9]+)\]\]/g, (_all, sid: string) => {
    const ref = allowed.get(sid);
    if (!ref) return "";
    if (!orderedIds.includes(sid)) orderedIds.push(sid);
    const o = orderedIds.length;
    ordinal.set(sid, o);
    const display = renderInline(ref, style, o);
    // avoid duplicated trailing punctuation like (Author, 2024).
    return display;
  });
  // tidy spacing around citations
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1");
  return { text: out, usedSourceIds: orderedIds };
}

export function toSourceRef(row: {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  doi: string | null;
}): SourceRef {
  return {
    id: row.id,
    title: row.title,
    authors: parseJsonArray<string>(row.authors),
    year: row.year,
    journal: row.journal,
    doi: row.doi,
  };
}
