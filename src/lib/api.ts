import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import type { ProjectRow } from "@/lib/types";

/** Resolve current user or return a 401 Response. */
export async function apiUser() {
  const user = await getCurrentUser();
  if (!user) return { res: NextResponse.json({ error: "Belum login" }, { status: 401 }) };
  return { user };
}

/** Resolve a project the user owns. */
export async function apiProject(id: string) {
  const u = await apiUser();
  if ("res" in u) return u as { res: NextResponse };
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  if (!row) return { res: NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 }) };
  if (row.user_id !== u.user.id) return { res: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) };
  return { user: u.user, project: rowToProject(row) };
}

export function rowToProject(row: any): ProjectRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    type: row.type,
    topic: row.topic,
    field: row.field,
    object: row.object,
    caseStudy: row.case_study,
    problem: row.problem,
    method: row.method,
    language: row.language,
    citationStyle: row.citation_style,
    yearFrom: row.year_from,
    yearTo: row.year_to,
    minCitations: row.min_citations,
    includePreprint: !!row.include_preprint,
    campusStyle: row.campus_style,
    documentPrompt: row.document_prompt,
    memory: row.memory,
    sourceFileName: row.source_file_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a source row to the API shape. */
export function rowToSource(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    authors: safeJson(row.authors, []),
    year: row.year,
    journal: row.journal,
    doi: row.doi,
    abstract: row.abstract,
    url: row.url,
    pdfUrl: row.pdf_url,
    citationCount: row.citation_count,
    openAccess: !!row.open_access,
    provider: row.provider,
    type: row.type,
    keywords: safeJson(row.keywords, []),
    impactFactor: row.impact_factor,
    verified: row.verified,
    addedAt: row.added_at,
  };
}

function safeJson(v: string, fallback: any): any {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
