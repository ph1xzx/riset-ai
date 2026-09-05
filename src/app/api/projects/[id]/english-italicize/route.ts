import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function italicizeHtml(html: string, term: string): { html: string; count: number } {
  const pattern = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(term)})(?=$|[^A-Za-z])`, "gi");
  let count = 0;
  let italicDepth = 0;
  const result = html.split(/(<[^>]*>)/g).map((part) => {
    if (part.startsWith("<")) {
      if (/^<\s*\/\s*(em|i)\b/i.test(part)) italicDepth = Math.max(0, italicDepth - 1);
      if (/^<\s*(em|i)\b/i.test(part) && !part.endsWith("/>")) italicDepth++;
      return part;
    }
    if (italicDepth > 0) return part;
    return part.replace(pattern, (_all, prefix: string, match: string) => {
      count++;
      return `${prefix}<em>${match}</em>`;
    });
  }).join("");
  return { html: result, count };
}

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body tidak valid" }, { status: 400 });
  }

  const term = typeof body.term === "string" ? body.term.trim() : "";
  if (!term) return NextResponse.json({ error: "Istilah yang akan dimiringkan wajib diisi" }, { status: 400 });
  if (term.length > 100) return NextResponse.json({ error: "Istilah terlalu panjang" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const requestedIds = Array.isArray(body.sectionIds) ? body.sectionIds.filter((id: any) => typeof id === "string") : [];
  const sections = await prisma.section.findMany({
    where: { projectId: params.id, ...(requestedIds.length ? { id: { in: requestedIds } } : {}) },
    orderBy: { order: "asc" },
  });
  const changed = sections
    .map((section) => ({ section, ...italicizeHtml(section.content || "", term) }))
    .filter((item) => item.count > 0);

  if (changed.length) {
    await prisma.$transaction(
      changed.map(({ section, html }) =>
        prisma.section.update({ where: { id: section.id }, data: { content: html, status: "USER_EDITED" } })
      )
    );
  }

  return NextResponse.json({
    term,
    occurrences: changed.reduce((sum, item) => sum + item.count, 0),
    sections: changed.map(({ section, count }) => ({ id: section.id, title: section.title, occurrences: count })),
  });
}

export const dynamic = "force-dynamic";
