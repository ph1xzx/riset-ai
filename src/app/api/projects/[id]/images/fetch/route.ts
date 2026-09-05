import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchRemoteImage } from "@/lib/image-gen";
import { saveFileBytes } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

// body: { sourceUrl }
// Ambil gambar dari internet (URL langsung, mis. logo) → simpan ke storage.
// Men-download & menyimpan (hotlink) agar file tetap ada saat export.
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const sourceUrl: string = (b.sourceUrl || "").trim();
  if (!sourceUrl) return NextResponse.json({ error: "sourceUrl wajib diisi" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  try {
    const img = await fetchRemoteImage(sourceUrl);
    const ext = img.mime.includes("jpeg") ? "jpg" : img.mime.split("/")[1]?.replace("+xml", "") || "png";
    const url = await saveFileBytes(`web-${Date.now()}.${ext}`, img.buffer, project.userId);
    return NextResponse.json({ url, mime: img.mime, bytes: img.buffer.length, source: sourceUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
