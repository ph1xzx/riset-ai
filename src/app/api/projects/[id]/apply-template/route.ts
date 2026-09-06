import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { nowIso } from "@/lib/util";

/** Apply a campus template (builtin or user) to a project's campusStyle. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, u.user.id) as any;
  if (!proj) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const templateId = String(body.templateId || "");
  if (!templateId) return NextResponse.json({ error: "templateId wajib diisi" }, { status: 400 });

  let config: any;
  if (templateId.startsWith("builtin-")) {
    const { DEFAULT_CAMPUS_STYLE } = await import("@/lib/campus");
    config = templateId === "builtin-id-umum" ? DEFAULT_CAMPUS_STYLE : null;
    if (!config) return NextResponse.json({ error: "Template bawaan tidak dikenal" }, { status: 404 });
  } else {
    const t = db.prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?").get(templateId, u.user.id) as any;
    if (!t) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
    try {
      config = JSON.parse(t.config);
    } catch {
      return NextResponse.json({ error: "Konfigurasi template rusak" }, { status: 400 });
    }
  }

  db.prepare("UPDATE projects SET campus_style = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(config), nowIso(), id);
  return NextResponse.json({ campusStyle: config });
}
