import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchImages } from "@/lib/image-gen";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

// body: { query }
// Cari gambar keyless (Wikimedia Commons + Openverse) → daftar hasil untuk dipilih.
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const query: string = (b.query || "").trim();
  if (!query) return NextResponse.json({ error: "query wajib diisi" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  try {
    const results = await searchImages(query, 8);
    if (!results.length) {
      return NextResponse.json(
        { results: [], note: "Tidak ditemukan — coba kata kunci lain, atau tempel URL langsung di tab 'Dari URL'." },
        { status: 200 }
      );
    }
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
