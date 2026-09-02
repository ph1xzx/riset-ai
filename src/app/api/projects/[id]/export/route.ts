import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exportProjectToDocx } from "@/lib/docx-export";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { buffer, filename } = await exportProjectToDocx(params.id);
    await prisma.exportJob.create({
      data: { projectId: params.id, type: "docx", filename, status: "ok" },
    }).catch(() => {});
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
