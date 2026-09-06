import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { genId, nowIso } from "@/lib/util";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/campus";

const BUILTIN = [
  {
    id: "builtin-id-umum",
    name: "Skripsi Umum Indonesia",
    prodi: "",
    university: "",
    config: { ...DEFAULT_CAMPUS_STYLE },
    hasSource: false,
    builtin: true,
  },
];

export async function GET() {
  const u = await apiUser();
  if ("res" in u) return u.res;
  const rows = db.prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY updated_at DESC").all(u.user.id) as any[];
  return NextResponse.json({
    templates: [
      ...BUILTIN,
      ...rows.map((t) => ({
        id: t.id,
        name: t.name,
        prodi: t.prodi,
        university: t.university,
        config: safe(t.config),
        hasSource: !!t.has_source,
        updatedAt: t.updated_at,
        builtin: false,
      })),
    ],
  });
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
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nama template wajib diisi" }, { status: 400 });
  const id = genId("tpl");
  const config = body.config ? (typeof body.config === "string" ? body.config : JSON.stringify(body.config)) : JSON.stringify(DEFAULT_CAMPUS_STYLE);
  db.prepare(
    "INSERT INTO templates (id, user_id, name, prodi, university, config, has_source, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(id, u.user.id, name, String(body.prodi || ""), String(body.university || ""), config, body.hasSource ? 1 : 0, nowIso());
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as any;
  return NextResponse.json({
    id: row.id, name: row.name, prodi: row.prodi, university: row.university,
    config: safe(row.config), hasSource: !!row.has_source, updatedAt: row.updated_at, builtin: false,
  }, { status: 201 });
}

function safe(v: string): any {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
