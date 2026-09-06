import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { generateImage } from "@/lib/ai";
import { getAiSettings } from "@/lib/ai";
import { safeError } from "@/lib/util";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

/**
 * Generate an AI image (diagram/illustration) via the configured image model
 * and save it to storage. Returns the public URL.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, u.user.id) as any;
  if (!proj) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "Prompt gambar wajib diisi" }, { status: 400 });

  try {
    const { dataUrl, model } = await generateImage(settings, prompt);
    let url: string;
    if (dataUrl.startsWith("data:image/")) {
      const m = dataUrl.match(/^data:image\/([a-z]+);base64,(.+)$/);
      const ext = m?.[1] === "jpeg" ? "jpg" : (m?.[1] || "png");
      const name = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
      fs.writeFileSync(path.join(STORAGE_DIR, name), Buffer.from(m![2], "base64"));
      url = `/files/${name}`;
      db.prepare("INSERT INTO uploads (id, user_id, name, path, size, created_at) VALUES (?,?,?,?,?,?)")
        .run(`up${Date.now().toString(36)}`, u.user.id, name, name, m![2].length * 0.75, new Date().toISOString());
    } else {
      url = dataUrl;
    }
    return NextResponse.json({ url, model });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Generate gambar gagal. Cek model gambar di Settings.") }, { status: 502 });
  }
}
