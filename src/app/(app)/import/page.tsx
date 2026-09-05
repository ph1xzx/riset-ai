"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TaskOverlay, { useTask } from "@/components/TaskOverlay";
import { Upload, FileCog, CheckCircle2, Loader2, ArrowRight, Trash2, RefreshCw, FileText } from "lucide-react";
import { deleteUploadedFile, uploadDocx } from "@/lib/upload";
import MarkdownImport from "@/components/MarkdownImport";

type StoredFile = {
  name: string;
  url: string;
  size: number | null;
  createdAt: string | null;
};

function formatBytes(size: number | null): string {
  if (size == null) return "ukuran tidak tersedia";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const task = useTask();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // hasil ekstraksi pedoman
  const [guide, setGuide] = useState<{
    structure: { headings: { title: string; level: number }[]; title: string };
    campusStyle: any;
    fileUrl: string;
  } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [filesBusy, setFilesBusy] = useState(false);
  const [deletingFile, setDeletingFile] = useState("");

  async function loadStoredFiles() {
    setFilesBusy(true);
    try {
      const res = await fetch("/api/uploads");
      const j = await res.json().catch(() => ({}));
      if (res.ok) setStoredFiles(Array.isArray(j.files) ? j.files : []);
    } finally {
      setFilesBusy(false);
    }
  }

  useEffect(() => {
    void loadStoredFiles();
  }, []);

  async function removeStoredFile(file: StoredFile) {
    if (!confirm(`Hapus file "${file.name}" dari storage? Jika masih dipakai dokumen, gambar atau PDF itu tidak akan tampil.`)) return;
    setDeletingFile(file.url);
    try {
      await deleteUploadedFile(file.url);
      setStoredFiles((files) => files.filter((item) => item.url !== file.url));
      setMsg(`File "${file.name}" dihapus dari storage.`);
    } catch (e: any) {
      setErr(e.message || "File belum bisa dihapus.");
    } finally {
      setDeletingFile("");
    }
  }

  async function handleImportSkripsi(file: File) {
    setBusy(true);
    setErr("");
    setMsg(`Membaca "${file.name}"…`);
    task.start("Scan & impor skripsi", file.name, "Mengunggah file dokumen…");
    try {
      const url = await uploadDocx(file);
      task.log("Upload OK — mem-parse heading → section…");
      const res = await fetch("/api/import/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Import gagal");
      task.log(`Mengekstrak format kampus & ${j.sections} section (${j.words} kata${typeof j.images === "number" ? `, ${j.images} gambar` : ""})…`);
      task.log("Selesai — membuka proyek…");
      setMsg(`Impor selesai: ${j.sections} section, ${j.words} kata. Membuka…`);
      router.push(`/projects/${j.project.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    } finally {
      task.stop();
    }
  }

  async function handleGuideline(file: File) {
    setBusy(true);
    setErr("");
    setMsg(`Mengekstrak struktur + format dari "${file.name}"…`);
    try {
      const url = await uploadDocx(file);
      const res = await fetch("/api/import/guideline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ekstraksi gagal");
      setGuide({ structure: j.structure, campusStyle: j.campusStyle, fileUrl: url });
      setMsg("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createFromGuideline() {
    if (!guide) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle || guide.structure.title || "Proyek baru",
          type: "Skripsi",
          topic: newTopic || guide.structure.title,
          campusStyle: guide.campusStyle,
          structure: guide.structure.headings.map((h) => ({ title: h.title, level: h.level })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal membuat proyek");
      router.push(`/projects/${j.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {task.task && <TaskOverlay task={task.task} />}
      <div>
        <h1 className="text-xl font-bold">Impor & Pedoman</h1>
        <p className="text-sm text-ink-500 mt-1">
          Dua mode: impor skripsi .docx untuk <b>cek penulisan & sitasi</b>, atau unggah skripsi lama sebagai
          <b> pedoman struktur + format</b> (custom, bukan Bab I–V kaku).
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 items-start">
      {/* ---- IMPOR SKRIPSI ---- */}
      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-1">
          <Upload size={18} className="text-brand-600" /> Impor Skripsi (.docx)
        </h2>
        <p className="text-sm text-ink-500 mb-4">
          Dokumen dipecah menjadi section berdasarkan heading (custom structure), format kampus (margin/font/spasi)
          diekstrak otomatis. Setelah itu kamu bisa jalankan <b>Cek Penulisan</b> dan <b>Cek Sitasi</b>.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportSkripsi(f);
            e.target.value = "";
          }}
        />
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Pilih File .docx
        </button>
        {msg && <div className="mt-3 text-sm text-ink-600 flex items-center gap-2">{busy && <Loader2 size={14} className="animate-spin" />}{msg}</div>}
        {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}
      </div>

      {/* ---- PEDOMAN ---- */}
      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-1">
          <FileCog size={18} className="text-brand-600" /> Upload Pedoman (skripsi lama)
        </h2>
        <p className="text-sm text-ink-500 mb-4">
          Ekstrak <b>struktur bab</b> (heading) dan <b>format</b> (halaman, margin, font, ukuran, spasi) → jadi template proyek baru.
        </p>
        <input
          ref={guideRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleGuideline(f);
            e.target.value = "";
          }}
        />
        <button className="btn-outline" onClick={() => guideRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Pilih File Pedoman
        </button>

        {guide && (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div>
              <div className="label">Struktur terdeteksi ({guide.structure.headings.length})</div>
              <div className="border border-ink-200 rounded-lg max-h-64 overflow-y-auto p-3 bg-ink-50">
                {guide.structure.headings.length === 0 && <div className="text-sm text-ink-400">Tidak ada heading terdeteksi.</div>}
                {guide.structure.headings.map((h, i) => (
                  <div key={i} className={`text-sm py-0.5 ${h.level >= 4 ? "pl-14 text-ink-500" : h.level === 3 ? "pl-10 text-ink-500" : h.level === 2 ? "pl-5 text-ink-600" : "font-semibold"}`}>
                    {h.title}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Format terdeteksi (bisa diedit di proyek)</div>
              <div className="border border-ink-200 rounded-lg p-3 bg-ink-50 text-sm space-y-1">
                <div>Halaman: <b>{guide.campusStyle.pageSize}</b></div>
                <div>
                  Margin (T/K/B/L): <b>{guide.campusStyle.margins.top}/{guide.campusStyle.margins.right}/{guide.campusStyle.margins.bottom}/{guide.campusStyle.margins.left} cm</b>
                </div>
                <div>Font: <b>{guide.campusStyle.body.font}</b>, {guide.campusStyle.body.size}pt</div>
                <div>Spasi: <b>{guide.campusStyle.body.lineSpacing}</b></div>
              </div>
              <div className="mt-4 space-y-2">
                <div>
                  <div className="label">Judul proyek baru</div>
                  <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Judul penelitian…" />
                </div>
                <div>
                  <div className="label">Topik</div>
                  <input className="input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Topik / rumusan singkat…" />
                </div>
                <button className="btn-primary w-full justify-center" onClick={createFromGuideline} disabled={busy}>
                  Buat Proyek dengan Struktur Ini <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* ---- IMPOR MARKDOWN PACKAGE ---- */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
        <MarkdownImport notify={setMsg} />

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={18} className="text-brand-600" /> File yang diupload
            </h2>
            <p className="text-sm text-ink-500 mt-1">Kelola DOCX, PDF, dan gambar yang tersimpan di storage akun ini.</p>
          </div>
          <button type="button" className="btn-ghost !px-2" onClick={() => void loadStoredFiles()} disabled={filesBusy} title="Muat ulang daftar file">
            <RefreshCw size={14} className={filesBusy ? "animate-spin" : ""} />
          </button>
        </div>
        {filesBusy && !storedFiles.length ? (
          <div className="text-sm text-ink-400 flex items-center gap-2 py-4" aria-live="polite">
            <Loader2 size={14} className="animate-spin" /> Memuat daftar file…
          </div>
        ) : storedFiles.length ? (
          <div className="divide-y divide-ink-100 border border-ink-100 rounded-lg mt-4">
            {storedFiles.map((file) => (
              <div key={file.url} className="flex items-center gap-3 p-3">
                <FileText size={16} className="text-ink-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" title={file.name}>{file.name}</div>
                  <div className="text-[11px] text-ink-400">{formatBytes(file.size)}{file.createdAt ? ` • ${new Date(file.createdAt).toLocaleDateString("id-ID")}` : ""}</div>
                </div>
                <button
                  type="button"
                  className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1 text-xs text-rose-600 hover:bg-rose-50 rounded-md"
                  onClick={() => void removeStoredFile(file)}
                  disabled={deletingFile === file.url}
                  title={`Hapus ${file.name}`}
                  aria-label={`Hapus ${file.name}`}
                >
                  {deletingFile === file.url ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span className="hidden sm:inline">Hapus</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-ink-400 border border-dashed border-ink-200 rounded-lg p-4 mt-4 text-center">
            Belum ada file yang tersimpan.
          </div>
        )}
      </div>
      </div>

      {msg && !busy && (
        <div className="flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle2 size={16} /> {msg}
        </div>
      )}
    </div>
  );
}
