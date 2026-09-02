import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateImage } from "@/lib/image-gen";
import { saveFileBytes } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

// body: { prompt }
// Generate gambar (Gemini native / OpenAI-compatible) → simpan ke storage → kembalikan URL.
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const prompt: string = (b.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt wajib diisi" }, { status: 400 });
  if (prompt.length > 1500) return NextResponse.json({ error: "prompt terlalu panjang" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const s = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!s?.apiKey) {
    return NextResponse.json(
      { error: "API key belum dikonfigurasi. Buka menu Settings, isi Provider / Base URL / API Key / Model, lalu coba lagi." },
      { status: 400 }
    );
  }

  try {
    const img = await generateImage(
      { baseUrl: s.baseUrl, apiKey: s.apiKey, imageModel: s.imageModel, model: s.model },
      prompt
    );
    const ext = img.mime.includes("jpeg") ? "jpg" : img.mime.split("/")[1]?.replace("+xml", "") || "png";
    const url = await saveFileBytes(`img-${Date.now()}.${ext}`, img.buffer);
    return NextResponse.json({ url, mime: img.mime, model: img.model, bytes: img.buffer.length });
  } catch (e: any) {
    // limit kuota/rate → kasih tahu UI supaya fallback ke "salin prompt / upload manual"
    return NextResponse.json(
      { error: e.message, limit: Boolean(e.limit), prompt: e.limit ? prompt : undefined },
      { status: e.limit ? 429 : 502 }
    );
  }
}
