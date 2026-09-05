// Client upload helper:
// - Supabase dikonfigurasi  → upload LANGSUNG ke bucket "uploads" (bypass limit body Vercel)
// - belum (testing lokal)   → POST ke /api/uploads (fallback server lokal)

const BUCKET = "uploads";

export async function uploadDocx(file: File): Promise<string> {
  return uploadFile(file);
}

let cachedUserId: string | null = null;
async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data?.user?.id) {
        cachedUserId = data.user.id;
        return cachedUserId!;
      }
    }
  } catch {}
  return "general";
}

/** Upload generik (docx/pdf/gambar) — Supabase direct atau fallback /api/uploads. */
export async function uploadFile(file: File): Promise<string> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (sbUrl && anon) {
    let cleanUrl = sbUrl.trim().replace(/\/+$/, "");
    try {
      const parsed = new URL(cleanUrl);
      cleanUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {}
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(cleanUrl, anon.trim(), { auth: { persistSession: false } });
    const userId = await getCurrentUserId();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `users/${userId}/${Date.now()}-${safeName}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw new Error(`Upload ke Supabase gagal: ${error.message}`);
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Upload gagal (${res.status})`);
  return j.url as string;
}

export async function deleteUploadedFile(url: string): Promise<void> {
  const res = await fetch("/api/uploads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `File belum bisa dihapus (${res.status})`);
}
