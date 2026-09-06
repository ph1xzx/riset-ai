"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

interface ImportPreview {
  structure: { title: string; level: number; content?: string }[];
  campusStyle: any;
  title: string;
  imageCount: number;
  fileUrl: string;
  fileName: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Skripsi (Impor)");
  const [citationStyle, setCitationStyle] = useState("APA7");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

  async function process(f: File) {
    setFile(f);
    setErr("");
    setPreview(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const up = await fetch("/api/uploads", { method: "POST", body: fd });
      const upj = await up.json();
      if (!up.ok) throw new Error(upj.error || "Upload gagal");
      const res = await fetch("/api/import/guideline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: upj.url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal membaca DOCX");
      setPreview({ ...j, fileUrl: upj.url, fileName: f.name });
      setTitle(j.title || f.name.replace(/\.docx$/i, ""));
    } catch (e: any) {
      setErr(e.message);
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    if (!preview) return;
    setCreating(true);
    setErr("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || preview.title,
          type,
          topic: preview.title,
          language: "id",
          citationStyle,
          campusStyle: preview.campusStyle,
          structure: preview.structure.map((h) => ({ title: h.title, level: h.level, content: (h as any).content || "" })),
          sourceFileName: preview.fileName,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal membuat proyek");
      router.push(`/projects/${j.id}`);
    } catch (e: any) {
      setErr(e.message);
      setCreating(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="font-display text-xl font-bold mb-1">Impor DOCX</h1>
      <p className="text-[12px] text-ink-500 mb-6">
        Upload pedoman kampus atau skripsi lama — struktur heading, margin, font, dan spasi akan terdeteksi otomatis.
      </p>

      {!preview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) process(f);
          }}
          className={`card border-2 border-dashed p-12 text-center transition-colors ${drag ? "border-ink-500 bg-ink-50" : "border-ink-200"}`}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={26} className="animate-spin text-ink-400" />
              <div className="text-[13px] text-ink-500">Membaca struktur & mendeteksi format…</div>
            </div>
          ) : (
            <>
              <Upload size={26} className="mx-auto text-ink-300 mb-3" />
              <div className="text-[14px] font-medium">Seret file .docx ke sini</div>
              <div className="text-[12px] text-ink-500 mt-1 mb-4">atau</div>
              <label className="btn-primary cursor-pointer">
                Pilih file DOCX
                <input type="file" accept=".docx" className="hidden" onChange={(e) => e.target.files?.[0] && process(e.target.files[0])} />
              </label>
            </>
          )}
          {err && <div className="text-[12px] text-red-600 mt-4">{err}</div>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-emerald-700 text-[13px] font-medium mb-3">
              <CheckCircle2 size={15} /> Terdeteksi
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-[12px]">
              <div><span className="text-ink-400">Heading:</span> {preview.structure.length}</div>
              <div><span className="text-ink-400">Gambar:</span> {preview.imageCount}</div>
              <div>
                <span className="text-ink-400">Margin (K/A/B/Ki):</span>{" "}
                {preview.campusStyle.margins.left}/{preview.campusStyle.margins.top}/{preview.campusStyle.margins.right}/{preview.campusStyle.margins.bottom} cm
              </div>
              <div>
                <span className="text-ink-400">Font:</span> {preview.campusStyle.body.font} {preview.campusStyle.body.size}pt · spasi {preview.campusStyle.body.lineSpacing}
              </div>
            </div>
            <div className="mt-3 max-h-48 overflow-auto thin-scroll border border-ink-100 rounded-md p-3 bg-ink-50/40">
              {preview.structure.map((h, i) => (
                <div key={i} className="text-[12px] text-ink-600" style={{ paddingLeft: (h.level - 1) * 14 }}>
                  {h.title}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <div>
              <label className="label">Judul proyek</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tipe</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  <option>Skripsi (Impor)</option>
                  <option>Pedoman Kampus</option>
                  <option>Seminar</option>
                </select>
              </div>
              <div>
                <label className="label">Gaya sitasi</label>
                <select className="input" value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>
                  <option>APA7</option><option>IEEE</option><option>Harvard</option><option>Vancouver</option>
                </select>
              </div>
            </div>
            {err && <div className="text-[12px] text-red-600">{err}</div>}
            <button className="btn-primary" onClick={createProject} disabled={creating}>
              {creating ? "Membuat…" : <>Buat proyek dari impor <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
