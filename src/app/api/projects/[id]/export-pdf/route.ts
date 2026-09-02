import { NextRequest, NextResponse } from "next/server";
import { exportProjectToDocx } from "@/lib/docx-export";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
export const maxDuration = 300;

const pexec = promisify(execFile);

async function findSoffice(): Promise<string | null> {
  for (const c of ["soffice", "libreoffice", "/usr/bin/soffice", "/usr/bin/libreoffice"]) {
    try {
      await pexec(c, ["--version"], { timeout: 15000 });
      return c;
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  return null;
}

/** Export PDF: DOCX akademis → konversi LibreOffice headless. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const soffice = await findSoffice();
  if (!soffice) {
    return NextResponse.json(
      {
        error:
          "LibreOffice tidak tersedia di environment ini. Export DOCX lalu konversi lokal, atau pasang libreoffice-writer di server.",
      },
      { status: 502 }
    );
  }

  const { buffer, filename } = await exportProjectToDocx(params.id);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "risetpdf-"));
  const docxPath = path.join(dir, filename);
  fs.writeFileSync(docxPath, buffer);
  try {
    await pexec(
      soffice,
      ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, docxPath],
      { timeout: 200000, env: { ...process.env, HOME: dir } }
    );
    const pdfPath = path.join(dir, filename.replace(/\.docx$/i, ".pdf"));
    if (!fs.existsSync(pdfPath)) throw new Error("Konversi selesai tapi file PDF tidak ditemukan");
    const pdf = fs.readFileSync(pdfPath);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/\.docx$/i, ".pdf")}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Konversi PDF gagal: ${e.message}` }, { status: 502 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
