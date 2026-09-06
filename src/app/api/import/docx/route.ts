import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, rowToProject } from "@/lib/api";
import { importDocx, ensureStorage } from "@/lib/docx-import";
import { genId, nowIso, safeError } from "@/lib/util";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

/**
 * Full DOCX import: read the uploaded file, parse it into sections, and
 * create a complete project (mirrors the live app's /api/import/docx).
 * Body: { fileUrl: "/files/xxx.docx", title?: string }
 * → 201 { project, sections, words, images }
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const fileUrl = String(body.fileUrl || body.fileName || "");
  const name = path.basename(fileUrl);
  if (!name || !name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "File harus berformat .docx" }, { status: 400 });
  }
  const full = path.join(STORAGE_DIR, name);
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: "File tidak ditemukan — unggah ulang" }, { status: 404 });
  }

  try {
    const buffer = fs.readFileSync(full);
    const result = await importDocx(buffer);
    const sections = result.sections.filter((s) => s.title.trim());
    if (!sections.length) {
      return NextResponse.json({ error: "Tidak ada heading terdeteksi di dokumen" }, { status: 422 });
    }

    const title = String(body.title || "").trim() || `${result.title || "Skripsi"} (Impor)`;
    const projectId = genId("p");
    const now = nowIso();

    db.prepare(
      `INSERT INTO projects (id, user_id, title, type, topic, field, object, case_study, problem, method,
        language, citation_style, year_from, year_to, min_citations, include_preprint, campus_style, document_prompt, memory, source_file_name, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      projectId,
      u.user.id,
      title.slice(0, 300),
      "Skripsi",
      title.slice(0, 300),
      "",
      "",
      "",
      "",
      "",
      "id",
      "APA7",
      null,
      null,
      null,
      0,
      JSON.stringify(result.campusStyle),
      "",
      null,
      name,
      now,
      now
    );

    const insSec = db.prepare(
      `INSERT INTO sections (id, project_id, title, "order", level, content, status, updated_at) VALUES (?,?,?,?,?,?,?,?)`
    );
    let words = 0;
    const tx = db.transaction(() => {
      sections.forEach((s, i) => {
        insSec.run(
          genId("s"),
          projectId,
          s.title.slice(0, 300),
          i,
          Math.min(Math.max(s.level, 1), 4),
          s.content || "",
          (s.content || "").trim() ? "USER_EDITED" : "EMPTY",
          now
        );
        words += (s.content || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
      });
    });
    tx();

    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
    return NextResponse.json(
      {
        project: rowToProject(row),
        sections: sections.length,
        words,
        images: result.imageCount,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Gagal mengimpor DOCX") }, { status: 422 });
  }
}
