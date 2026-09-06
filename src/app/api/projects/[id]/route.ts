import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject, rowToProject } from "@/lib/api";
import { nowIso } from "@/lib/util";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  const sections = db
    .prepare('SELECT * FROM sections WHERE project_id = ? ORDER BY "order" ASC, id ASC')
    .all(id) as any[];
  const sources = db.prepare("SELECT * FROM sources WHERE project_id = ? ORDER BY added_at DESC").all(id) as any[];
  return NextResponse.json({
    ...r.project,
    sections: sections.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      parentId: s.parent_id,
      title: s.title,
      order: s.order,
      level: s.level,
      content: s.content,
      status: s.status,
      prompt: s.prompt,
      updatedAt: s.updated_at,
    })),
    sources: sources.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      title: s.title,
      authors: safe(s.authors),
      year: s.year,
      journal: s.journal,
      doi: s.doi,
      abstract: s.abstract,
      url: s.url,
      pdfUrl: s.pdf_url,
      citationCount: s.citation_count,
      openAccess: !!s.open_access,
      provider: s.provider,
      type: s.type,
      keywords: safe(s.keywords),
      impactFactor: s.impact_factor,
      verified: s.verified,
      addedAt: s.added_at,
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const allowed: Record<string, string> = {
    title: "title", type: "type", topic: "topic", field: "field", object: "object",
    caseStudy: "case_study", problem: "problem", method: "method", language: "language",
    citationStyle: "citation_style", campusStyle: "campus_style", documentPrompt: "document_prompt",
    memory: "memory",
  };
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, col] of Object.entries(allowed)) {
    if (body[k] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(typeof body[k] === "object" ? JSON.stringify(body[k]) : String(body[k]).slice(0, 4000));
    }
  }
  for (const k of ["yearFrom", "yearTo", "minCitations"]) {
    if (body[k] !== undefined) {
      const col = k === "yearFrom" ? "year_from" : k === "yearTo" ? "year_to" : "min_citations";
      sets.push(`${col} = ?`);
      vals.push(body[k] === null || body[k] === "" ? null : Number(body[k]));
    }
  }
  if (body.includePreprint !== undefined) {
    sets.push("include_preprint = ?");
    vals.push(body.includePreprint ? 1 : 0);
  }
  if (!sets.length) return NextResponse.json({ error: "Tidak ada field yang diperbarui" }, { status: 400 });
  sets.push("updated_at = ?");
  vals.push(nowIso(), id);
  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  return NextResponse.json(rowToProject(row));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

function safe(v: string): any {
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
}
