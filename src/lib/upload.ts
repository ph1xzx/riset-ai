// Client upload helper:
// - Supabase dikonfigurasi  → upload LANGSUNG ke bucket "uploads" (bypass limit body Vercel)
// - belum (testing lokal)   → POST ke /api/uploads (fallback server lokal)

const BUCKET = "uploads";

export async function uploadDocx(file: File): Promise<string> {
  return uploadFile(file);
}

/** Upload generik (docx/pdf/gambar) — Supabase direct atau fallback /api/uploads. */
export async function uploadFile(file: File): Promise<string> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (sbUrl && anon) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(sbUrl, anon, { auth: { persistSession: false } });
    const path = `imports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
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
