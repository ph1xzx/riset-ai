import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, rowToProject } from "@/lib/api";
import { genId, nowIso } from "@/lib/util";
import { DEFAULT_STRUCTURE, DEFAULT_CAMPUS_STYLE } from "@/lib/campus";

export async function GET() {
  const u = await apiUser();
  if ("res" in u) return u.res;
  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM sections s WHERE s.project_id = p.id) AS section_count,
        (SELECT COUNT(*) FROM sources c WHERE c.project_id = p.id) AS source_count
       FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`
    )
    .all(u.user.id) as any[];
  return NextResponse.json(
    rows.map((r) => ({
      ...rowToProject(r),
      _count: { sections: r.section_count, sources: r.source_count },
    }))
  );
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const title = String(body.title || "").trim();
  const topic = String(body.topic || "").trim();
  if (!title || !topic) {
    return NextResponse.json({ error: "Judul dan topik wajib diisi" }, { status: 400 });
  }

  const id = genId("p");
  const campusStyle = body.campusStyle
    ? typeof body.campusStyle === "string"
      ? body.campusStyle
      : JSON.stringify(body.campusStyle)
    : JSON.stringify(DEFAULT_CAMPUS_STYLE);

  db.prepare(
    `INSERT INTO projects (id, user_id, title, type, topic, field, object, case_study, problem, method,
      language, citation_style, year_from, year_to, min_citations, include_preprint, campus_style, document_prompt, memory, source_file_name, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    u.user.id,
    title.slice(0, 300),
    String(body.type || "Skripsi").slice(0, 60),
    topic,
    String(body.field || "").slice(0, 200),
    String(body.object || "").slice(0, 200),
    String(body.caseStudy || "").slice(0, 300),
    String(body.problem || "").slice(0, 1000),
    String(body.method || "").slice(0, 200),
    String(body.language || "id").slice(0, 10),
    String(body.citationStyle || "APA7").slice(0, 20),
    body.yearFrom ? Number(body.yearFrom) : null,
    body.yearTo ? Number(body.yearTo) : null,
    body.minCitations ? Number(body.minCitations) : null,
    body.includePreprint ? 1 : 0,
    campusStyle,
    String(body.documentPrompt || "").slice(0, 2000),
    body.memory ? String(body.memory).slice(0, 2000) : null,
    body.sourceFileName ? String(body.sourceFileName).slice(0, 300) : null,
    nowIso(),
    nowIso()
  );

  // Structure: use provided headings if any (optionally with content for imports), else default
  const structure: { title: string; level: number; content: string }[] =
    Array.isArray(body.structure) && body.structure.length
      ? body.structure.map((h: any) => ({
          title: String(h.title || "Section"),
          level: Math.min(4, Math.max(1, Number(h.level) || 2)),
          content: String(h.content || ""),
        }))
      : DEFAULT_STRUCTURE.map((h) => ({ ...h, content: "" }));

  const insSec = db.prepare(
    `INSERT INTO sections (id, project_id, parent_id, title, "order", level, content, status, prompt, updated_at)
     VALUES (?,?,?,?,?,?,?,?, '', ?)`
  );
  const stack: { id: string; level: number }[] = [];
  const created = structure.map((h, i) => {
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const sid = genId("s");
    const status = h.content.trim() ? "USER_EDITED" : "EMPTY";
    insSec.run(sid, id, parentId, h.title, i, h.level, h.content, status, nowIso());
    stack.push({ id: sid, level: h.level });
    return sid;
  });

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  return NextResponse.json({ ...rowToProject(row), sectionIds: created }, { status: 201 });
}
