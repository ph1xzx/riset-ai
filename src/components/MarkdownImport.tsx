"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { FolderArchive, Loader2, Upload, CheckCircle2, XCircle, X, FileCode2 } from "lucide-react";
import { markdownToSections, scanImageRefs, suggestCandidates, type MdSection } from "@/lib/markdown";
import { markdownToSectionsAst } from "@/lib/markdown-ast";
import { uploadFile } from "@/lib/upload";

type AssetRow = {
  filename: string;
  key: string;
  status: "ready" | "missing";
  source: "zip" | "uploaded";
  url?: string;
  alias?: string; // nama file zip pengganti (dari smart resolver)
};

/* Impor Markdown Package (.md / .zip berisi chapters + assets + manifest.json).
   Smart Asset Resolver: daftar referensi gambar, yang hilang bisa di-upload
   sesuai nama file sebelum proyek dibuat. */
export default function MarkdownImport({ notify }: { notify: (t: string) => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [chapters, setChapters] = useState<{ name: string; text: string }[]>([]);
  const [zipAssets, setZipAssets] = useState<Map<string, Blob>>(new Map());
  const [manifest, setManifest] = useState<any | null>(null);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [open, setOpen] = useState(false);

  async function handleFiles(list: FileList) {
    setBusy(true);
    setErr("");
    try {
      const chs: { name: string; text: string }[] = [];
      const za = new Map<string, Blob>();
      let man: any = null;
      for (const f of Array.from(list)) {
        if (/\.zip$/i.test(f.name)) {
          const z = await JSZip.loadAsync(f);
          if (z.files["manifest.json"]) man = JSON.parse(await z.files["manifest.json"].async("text"));
          for (const n of Object.keys(z.files)) {
            const e = z.files[n];
            if (e.dir) continue;
            const base = n.split("/").pop() || n;
            if (/\.md$/i.test(base)) chs.push({ name: base, text: await e.async("text") });
            else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(base)) za.set(base, await e.async("blob"));
          }
        } else if (/\.md$/i.test(f.name)) {
          chs.push({ name: f.name, text: await f.text() });
        }
      }
      if (!chs.length) throw new Error("Tidak ada .md ditemukan — upload file .md atau .zip paket markdown.");
      if (man?.chapters?.length) {
        const order = new Map<string, number>(man.chapters.map((c: any, i: number) => [c.file_name, i]));
        chs.sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
      } else chs.sort((a, b) => a.name.localeCompare(b.name));

      const seen = new Map<string, AssetRow>();
      for (const c of chs)
        for (const r of scanImageRefs(c.text))
          if (!seen.has(r.filename))
            seen.set(r.filename, {
              filename: r.filename,
              key: r.key,
              status: za.has(r.filename) ? "ready" : "missing",
              source: "zip",
            });

      setChapters(chs);
      setZipAssets(za);
      setManifest(man);
      setRows([...seen.values()]);
      setOpen(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadForRow(filename: string, file: File) {
    try {
      const url = await uploadFile(file);
      setRows((rs) => rs.map((r) => (r.filename === filename ? { ...r, status: "ready", source: "uploaded", url } : r)));
    } catch (e: any) {
      notify(`Upload ${filename} gagal: ${e.message}`);
    }
  }

  async function buildProject() {
    setBusy(true);
    setErr("");
    try {
      const urlBy: Record<string, string> = {};
      for (const r of rows) {
        if (r.status !== "ready") continue;
        if (r.url) urlBy[r.filename] = r.url;
        else {
          const blob = zipAssets.get(r.alias ?? r.filename);
          if (blob) urlBy[r.filename] = await uploadFile(new File([blob], r.filename));
        }
      }
      const missing = rows.filter((r) => r.status === "missing");
      const sections: MdSection[] = [];
      for (const c of chapters) {
        const text = c.text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (mm, alt, path) => {
          if (/^https?:\/\//i.test(path)) return mm;
          const url = urlBy[path.split("/").pop() || path];
          return url ? `![${alt}](${url})` : ""; // gambar hilang → dilewati
        });
        try {
          sections.push(...markdownToSectionsAst(text));
        } catch {
          sections.push(...markdownToSections(text));
        }
      }
      if (!sections.length) throw new Error("Tidak ada konten ter-parse dari markdown.");
      const bc = manifest?.build_config;
      const campus = bc
        ? {
            pageSize: "A4",
            margins: { top: bc.margins_cm.top, right: bc.margins_cm.right, bottom: bc.margins_cm.bottom, left: bc.margins_cm.left },
            body: { font: bc.font_family, size: bc.font_size_body, lineSpacing: bc.line_spacing },
            heading1: { bold: true, uppercase: true, centered: true, size: bc.font_size_body },
            heading2: { bold: true, size: bc.font_size_body },
          }
        : undefined;
      const title = manifest?.project_title || sections[0]?.title || "Impor Markdown";
      const res = await fetch("/api/import/markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, campusStyle: campus, sections }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Impor markdown gagal");
      setOpen(false);
      notify(
        missing.length
          ? `Proyek dibuat — ${missing.length} gambar hilang dilewati.`
          : "Proyek dibuat dari markdown — semua aset ter-link."
      );
      router.push(`/projects/${j.project.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const ready = rows.filter((r) => r.status === "ready").length;
  const claimed = new Set(
    rows.filter((r) => r.status === "ready" && r.source === "zip").map((r) => r.alias ?? r.filename)
  );

  return (
    <div className="card p-4 sm:p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <FileCode2 size={18} className="text-brand-600" /> Impor Markdown Package (.md / .zip)
      </h2>
      <p className="text-sm text-ink-500 mb-4">
        Kebalikan dari <b>Export MD</b>: unggah chapters markdown (+ folder assets & manifest.json dalam .zip).
        Referensi gambar discan — yang belum ada bisa di-upload sesuai nama file, lalu dirakit jadi proyek +
        bisa langsung <b>Export DOCX</b> dengan format kampus.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".md,.zip"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <FolderArchive size={15} />} Pilih .md / .zip
      </button>
      {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}

      {open && (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-3 sm:p-6" onClick={() => !busy && setOpen(false)}>
          <div className="card w-full max-w-xl max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Smart Asset Resolver</h3>
              <button className="text-ink-400 hover:text-ink-700" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="text-sm text-ink-600 mb-3">
              {chapters.length} chapter .md terdeteksi
              {manifest ? " (urutan dari manifest.json)" : ""} — {ready}/{rows.length} aset gambar siap.
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {rows.length === 0 && <div className="text-sm text-ink-400">Tidak ada referensi gambar lokal di dokumen.</div>}
              {rows.map((r) => (
                <div key={r.filename} className="flex items-center gap-2 border border-ink-200 rounded-none px-3 py-2 text-sm">
                  {r.status === "ready" ? (
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-rose-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{r.filename}</div>
                    <div className="text-[10px] text-ink-400 truncate">
                      {r.key} • {r.status === "ready" ? (r.source === "zip" ? "ada di paket" : "ter-upload") : "belum diunggah"}
                    </div>
                  </div>
                  {r.status === "missing" && (
                    <div className="flex items-center gap-1 shrink-0">
                      {zipAssets.size > 0 &&
                        suggestCandidates(
                          r.filename,
                          [...zipAssets.keys()].filter((n) => !claimed.has(n))
                        ).map((c) => (
                          <button
                            key={c.name}
                            className="btn-ghost !py-0.5 !px-1.5 !text-[10px] font-mono"
                            title={`Kemiripan nama ${Math.round(c.score * 100)}% — klik untuk memakai file ini`}
                            onClick={() =>
                              setRows((rs) =>
                                rs.map((x) =>
                                  x.filename === r.filename
                                    ? { ...x, status: "ready", source: "zip", alias: c.name }
                                    : x
                                )
                              )
                            }
                          >
                            ≈ {c.name}
                          </button>
                        ))}
                      <label className="btn-outline !py-1 !px-2 !text-[11px] cursor-pointer">
                        <Upload size={11} /> Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadForRow(r.filename, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-primary" onClick={buildProject} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <FileCode2 size={14} />}
                Buat Proyek + Build
              </button>
              <button className="btn-outline" onClick={() => setOpen(false)} disabled={busy}>
                Batal
              </button>
            </div>
            <div className="text-[11px] text-ink-400 mt-2">
              Gambar yang tetap hilang akan dilewati dari dokumen (referensinya dibuang) — proyek tetap dibuat.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
