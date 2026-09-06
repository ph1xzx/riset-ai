import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, rowToProject } from "@/lib/api";
import { genId, nowIso, safeError } from "@/lib/util";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/campus";

/**
 * Import a project from Markdown sections (client parses the .md file).
 * Body: { title, campusStyle?, sections: [{ title, content, level? }] }
 * → 201 { project, sections, words, images }
 */
export async function POST(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const title = String(body.title || "Impor Markdown").trim();
  const sections: any[] = Array.isArray(body.sections) ? body.sections : [];
  if (!sections.length) return NextResponse.json({ error: "Tidak ada section untuk diimpor" }, { status: 400 });

  const campusStyle = body.campusStyle
    ? typeof body.campusStyle === "string"
      ? body.campusStyle
      : JSON.stringify(body.campusStyle)
    : JSON.stringify(DEFAULT_CAMPUS_STYLE);

  try {
    const projectId = genId("p");
    const now = nowIso();

    db.prepare(
      `INSERT INTO projects (id, user_id, title, type, topic, field, object, case_study, problem, method,
        language, citation_style, year_from, year_to, min_citations, include_preprint, campus_style, document_prompt, memory, source_file_name, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      projectId, u.user.id, title.slice(0, 300), "Skripsi", title.slice(0, 300), "", "", "", "", "",
      "id", "APA7", null, null, null, 0, campusStyle, "", null, null, now, now
    );

    const insSec = db.prepare(
      `INSERT INTO sections (id, project_id, title, "order", level, content, status, updated_at) VALUES (?,?,?,?,?,?,?,?)`
    );
    let words = 0;
    const tx = db.transaction(() => {
      sections.forEach((s, i) => {
        const content = String(s.content || "");
        insSec.run(
          genId("s"), projectId, String(s.title || `Section ${i + 1}`).slice(0, 300),
          i, Math.min(Math.max(Number(s.level) || 1, 1), 4), content,
          content.trim() ? "USER_EDITED" : "EMPTY", now
        );
        words += content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
      });
    });
    tx();

    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
    return NextResponse.json(
      { project: rowToProject(row), sections: sections.length, words, images: 0 },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Gagal mengimpor") }, { status: 422 });
  }
}
