import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/research";
import { getSessionUser } from "@/lib/auth-token";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * IMPOR MARKDOWN → proyek baru.
 * body: { title, campusStyle?, sections: [{ title, level: 1|2, html }] }
 * HTML section memakai tag yang sama dengan impor docx (p/h3/strong/em/table/img/ul/ol)
 * sehingga Export DOCX + editor bekerja tanpa perubahan.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  const b = await req.json();
  const sections: { title: string; level: number; html: string }[] = Array.isArray(b.sections)
    ? b.sections
    : [];
  if (!sections.length) return NextResponse.json({ error: "sections wajib diisi" }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      userId: session?.id || null,
      title: b.title || "Impor Markdown",
      type: b.type || "Skripsi (Markdown)",
      topic: b.title || "",
      campusStyle: JSON.stringify(b.campusStyle || DEFAULT_CAMPUS_STYLE),
      sections: {
        create: sections.map((s, i) => ({
          title: s.title || `Bagian ${i + 1}`,
          level: s.level === 2 ? 2 : 1,
          order: i,
          content: s.html || "",
          status: "USER_EDITED",
        })),
      },
    },
    include: { sections: { orderBy: { order: "asc" } }, memory: true },
  });

  return NextResponse.json({ project, sections: project.sections.length }, { status: 201 });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
