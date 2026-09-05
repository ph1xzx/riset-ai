import { NextRequest, NextResponse } from "next/server";
import { deleteStoredFile, listStoredFiles, managedStoragePath, saveFileBytes } from "@/lib/storage";
import { getSessionUser } from "@/lib/auth-token";

export const runtime = "nodejs";

function ownerPrefix(userId: string | null): string {
  return `users/${userId || "general"}/`;
}

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  try {
    return NextResponse.json({ files: await listStoredFiles(session?.id) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Daftar file belum bisa dimuat" }, { status: 500 });
  }
}

/** Fallback upload lokal saat Supabase belum dikonfigurasi. */
export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof (file as any).arrayBuffer !== "function") {
    return NextResponse.json({ error: "file wajib diunggah" }, { status: 400 });
  }
  if ((file as File).size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran file maksimal 50 MB" }, { status: 413 });
  }
  try {
    const name = String((file as File).name || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
    const url = await saveFileBytes(name, Buffer.from(await (file as File).arrayBuffer()), session?.id);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Upload gagal" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req);
  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url : "";
  if (!url) return NextResponse.json({ error: "url file wajib" }, { status: 400 });

  const objectPath = managedStoragePath(url);
  if (!objectPath) return NextResponse.json({ error: "File bukan bagian dari storage aplikasi" }, { status: 400 });
  if (objectPath.startsWith("users/") && !objectPath.startsWith(ownerPrefix(session?.id || null))) {
    return NextResponse.json({ error: "Kamu tidak punya akses ke file ini" }, { status: 403 });
  }

  try {
    await deleteStoredFile(url);
    return NextResponse.json({ ok: true, path: objectPath });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "File belum bisa dihapus" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
