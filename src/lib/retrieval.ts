// Contextual retrieval ringan untuk MVP: keyword overlap antara
// (judul section + prompt section + research memory) vs
// (judul + abstrak + keywords sumber).
// Modul ini sengaja terisolasi — bisa diganti embedding/cosine
// tanpa mengubah pipeline lain.

import type { Source, Section, ResearchMemory, Project } from "@prisma/client";
import { parseJsonArray } from "./json";

const STOPWORDS = new Set(
  "yang dan dengan dari untuk pada oleh atau dalam the of and to in a an is are was were for with from by pada di ke dari".split(/\s+/)
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9à-öø-ÿ\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function scoreSource(queryTokens: Set<string>, s: Source): number {
  const titleTokens = new Set(tokenize(s.title));
  const abstractTokens = new Set(tokenize(s.abstract));
  const kwTokens = new Set(parseJsonArray<string>(s.keywords).flatMap((k) => tokenize(k)));
  let sc = 0;
  for (const t of queryTokens) {
    if (titleTokens.has(t)) sc += 3;
    if (kwTokens.has(t)) sc += 2;
    if (abstractTokens.has(t)) sc += 1;
  }
  if (s.citationCount > 20) sc += 0.5;
  return sc;
}

export function retrieveSources(
  sources: Source[],
  opts: { section?: Section | null; memory: ResearchMemory | null; project: Project; max?: number }
): Source[] {
  const max = opts.max ?? 10;
  const q = [
    opts.section?.title ?? "",
    opts.section?.prompt ?? "",
    opts.project.topic ?? "",
    opts.memory ? parseJsonArray<string>(opts.memory.variables).join(" ") : "",
    opts.memory ? opts.memory.methodology ?? "" : "",
  ].join(" ");
  const queryTokens = new Set(tokenize(q));
  if (!queryTokens.size) return sources.slice(0, max);

  const scored = sources
    .map((s) => ({ s, sc: scoreSource(queryTokens, s) }))
    .sort((a, b) => b.sc - a.sc);
  const out: Source[] = [];
  for (const { s, sc } of scored) {
    if (sc > 0 || out.length < 3) out.push(s); // minimal 3 sumber konteks
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}
