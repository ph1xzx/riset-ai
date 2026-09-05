import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const LOCAL_UPLOADS = path.join(process.cwd(), "uploads");
const MIME_BY_EXTENSION: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

type Ctx = { params: { path: string[] } };

/** Menyajikan file fallback lokal yang URL-nya dikembalikan oleh saveFileBytes. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const requested = Array.isArray(params.path) ? params.path.join("/") : "";
  const fileName = path.basename(requested);
  if (!requested || !fileName || fileName !== requested || fileName === "." || fileName === "..") {
    return NextResponse.json({ error: "Path file tidak valid" }, { status: 400 });
  }

  const uploadsRoot = path.resolve(LOCAL_UPLOADS);
  const filePath = path.resolve(uploadsRoot, fileName);
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Path file tidak valid" }, { status: 400 });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  const extension = path.extname(fileName).slice(1).toLowerCase();
  const bytes = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": MIME_BY_EXTENSION[extension] || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export const dynamic = "force-dynamic";
