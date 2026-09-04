"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, FileText, Trash2, Sliders, X, Check, PanelLeft, PanelRight, FolderArchive, ScrollText, ShieldCheck, Eye, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import StructureTree from "@/components/workspace/StructureTree";
import Editor from "@/components/workspace/Editor";
import RightPanel from "@/components/workspace/RightPanel";
import { parseJsonObject } from "@/lib/json";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/research";
import { buildMarkdownPackage } from "@/lib/markdown-package";
import { htmlToMarkdown } from "@/lib/markdown";
import { validateFormat, type FormatIssue } from "@/lib/format-validator";
import TaskOverlay, { useTask } from "@/components/TaskOverlay";

// hash ringan untuk baseline "perubahan sejak export MD terakhir"
function mdHash(s: any): string {
  const md = htmlToMarkdown(s.content || "", (src: string) => `assets/${src.split("/").pop() || "img"}`);
  let h = 5381;
  for (let i = 0; i < md.length; i++) h = (((h << 5) + h) ^ md.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export type ProjectData = any;

export default function ProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [busyExport, setBusyExport] = useState(false);
  const [toast, setToast] = useState("");
  const [formatOpen, setFormatOpen] = useState(false);
  const [fmt, setFmt] = useState<any>(null);
  const [fmtBusy, setFmtBusy] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [mdDelta, setMdDelta] = useState<number | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [tpls, setTpls] = useState<any[]>([]);
  const [tplBusy, setTplBusy] = useState("");
  const [reformat, setReformat] = useState(false);
  const [issues, setIssues] = useState<FormatIssue[] | null>(null);
  const task = useTask();
  const pendingImage = useRef<{ sectionId: string; url: string; caption?: string } | null>(null);
  const pendingSearch = useRef<{ sectionId: string; query: string } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    if (exportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportMenuOpen]);

  // preferensi show/hide sidebar disimpan lokal
  useEffect(() => {
    try {
      const raw = localStorage.getItem("riset.sidebar");
      if (raw) {
        const v = JSON.parse(raw);
        setShowLeft(v.left !== false);
        setShowRight(v.right !== false);
      }
    } catch {
      /* pakai default */
    }
  }, []);
  function toggleSidebar(side: "left" | "right") {
    const next = { left: showLeft, right: showRight };
    next[side] = !next[side];
    setShowLeft(next.left);
    setShowRight(next.right);
    try {
      localStorage.setItem("riset.sidebar", JSON.stringify(next));
    } catch {
      /* private mode dll */
    }
  }

  function toggleZen() {
    if (!showLeft && !showRight) {
      setShowLeft(true);
      setShowRight(true);
      try {
        localStorage.setItem("riset.sidebar", JSON.stringify({ left: true, right: true }));
      } catch {}
    } else {
      setShowLeft(false);
      setShowRight(false);
      try {
        localStorage.setItem("riset.sidebar", JSON.stringify({ left: false, right: false }));
      } catch {}
    }
  }

  function openFormat() {
    setFmt({ ...DEFAULT_CAMPUS_STYLE, ...parseJsonObject(project.campusStyle, {}) } as any);
    setFormatOpen(true);
  }

  async function saveFormat() {
    setFmtBusy(true);
    await fetch(`/api/projects/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campusStyle: fmt }),
    });
    setFmtBusy(false);
    setFormatOpen(false);
    load();
    notify("Format kampus disimpan — dipakai saat Export DOCX.");
  }

  const notify = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((j) => {
        setProject(j);
        setActiveId((cur) => cur || j.sections?.[0]?.id || "");
      })
      .catch(() => setProject({ __nf: true }));
  }, [params.id]);

  useEffect(load, [load]);

  // dua arah sync: berapa section berubah sejak export MD terakhir (baseline di localStorage)
  useEffect(() => {
    if (!project || project.__nf) return;
    try {
      const raw = localStorage.getItem(`riset.mdbase.${params.id}`);
      if (!raw) {
        setMdDelta(null);
        return;
      }
      const base = JSON.parse(raw) as Record<string, string>;
      let n = 0;
      for (const s of project.sections || []) if (base[s.id] !== undefined && base[s.id] !== mdHash(s)) n++;
      setMdDelta(n);
    } catch {
      setMdDelta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const activeSection = (project?.sections || []).find((s: any) => s.id === activeId) || project?.sections?.[0] || null;

  /* Gambar: sisipkan langsung ke section tujuan (pindah section dulu bila perlu). */
  const insertImageToSection = useCallback(
    (sectionId: string, url: string, caption?: string) => {
      if (!sectionId || sectionId === activeId) {
        window.dispatchEvent(new CustomEvent("ws:action", { detail: { action: "append-image", url, caption } }));
      } else {
        pendingImage.current = { sectionId, url, caption };
        setActiveId(sectionId);
      }
    },
    [activeId]
  );

  const openImageSearch = useCallback(
    (query: string, sectionId?: string) => {
      if (sectionId && sectionId !== activeId) {
        pendingSearch.current = { sectionId, query };
        setActiveId(sectionId);
      } else {
        window.dispatchEvent(new CustomEvent("ws:action", { detail: { action: "open-image-search", query } }));
      }
    },
    [activeId]
  );

  // Setelah pindah section + Editor mount ulang → kirim pending insert/search
  useEffect(() => {
    if (!activeSection) return;
    if (pendingImage.current && pendingImage.current.sectionId === activeSection.id) {
      const p = pendingImage.current;
      pendingImage.current = null;
      window.dispatchEvent(new CustomEvent("ws:action", { detail: { action: "append-image", url: p.url, caption: p.caption } }));
    } else if (pendingSearch.current && pendingSearch.current.sectionId === activeSection.id) {
      const p = pendingSearch.current;
      pendingSearch.current = null;
      window.dispatchEvent(new CustomEvent("ws:action", { detail: { action: "open-image-search", query: p.query } }));
    }
  }, [activeSection?.id]);

  if (project?.__nf) {
    return (
      <div className="p-10 text-center">
        <p className="text-ink-500">Proyek tidak ditemukan.</p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
          Ke Dashboard
        </Link>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen text-ink-400 gap-2">
        <Loader2 className="animate-spin" size={18} /> Memuat proyek…
      </div>
    );
  }

  async function patchSection(id: string, data: object) {
    await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    load();
  }

  async function addSection(level: number) {
    const n = project.sections.length;
    await fetch(`/api/projects/${params.id}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: level === 2 ? "Sub-bab baru" : `BAB ${n}`, level }),
    });
    load();
  }

  async function delSection(id: string) {
    if (!confirm("Hapus section ini beserta isinya?")) return;
    await fetch(`/api/sections/${id}`, { method: "DELETE" });
    setActiveId("");
    load();
  }

  async function moveSection(sectionId: string, dir: -1 | 1) {
    const idx = project.sections.findIndex((s: any) => s.id === sectionId);
    const target = idx + dir;
    if (target < 0 || target >= project.sections.length) return;
    await fetch(`/api/sections/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: params.id, sectionId, targetIndex: target }),
    });
    load();
  }

  async function exportDocx() {
    setBusyExport(true);
    task.start("Export DOCX", project.title, "Mengumpulkan section & aset dokumen…");
    try {
      task.log("Merakit dokumen sesuai template pedoman (margin, font, penomoran)…");
      const res = await fetch(`/api/projects/${params.id}/export`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Export gagal");
      }
      task.log("Mengunduh file…");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.title.slice(0, 40).replace(/\s+/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
      task.log("Selesai — DOCX terunduh.");
      notify("DOCX diunduh — format mengikuti template pedoman yang aktif.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      task.stop();
      setBusyExport(false);
    }
  }

  async function exportMarkdown() {
    setBusyExport(true);
    task.start("Export paket Markdown", project.title, "Mengonversi section ke .md per bab…");
    try {
      task.log("Mengumpulkan gambar & membundel aset ke zip…");
      const { bytes, manifest } = await buildMarkdownPackage(project);
      task.log(`${manifest.chapters.length} chapter + ${manifest.required_assets.length} aset siap — mengunduh…`);
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.title.slice(0, 40).replace(/\s+/g, "-")}-markdown.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      const missing = manifest.required_assets.filter((r) => r.status === "missing").length;
      // simpan baseline untuk chip "Δ sejak export MD"
      try {
        const base: Record<string, string> = {};
        for (const s of project.sections || []) base[s.id] = mdHash(s);
        localStorage.setItem(`riset.mdbase.${params.id}`, JSON.stringify(base));
        setMdDelta(0);
      } catch {
        /* private mode */
      }
      notify(
        missing
          ? `Paket Markdown diunduh — ${missing} aset TIDAK bisa dibundel (URL web), tetap direferensikan di .md.`
          : "Paket Markdown diunduh: chapters/*.md + assets/* + manifest.json."
      );
    } catch (e: any) {
      notify(e.message);
    } finally {
      task.stop();
      setBusyExport(false);
    }
  }

  async function exportPdf() {
    setBusyPdf(true);
    task.start("Export PDF", project.title, "Menyusun DOCX terlebih dahulu…");
    try {
      task.log("Mengonversi ke PDF via LibreOffice (bisa ±1 menit)…");
      const res = await fetch(`/api/projects/${params.id}/export-pdf`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Export PDF gagal");
      }
      task.log("Mengunduh PDF…");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${project.title.slice(0, 40).replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      notify("PDF diunduh — isi & format sama dengan Export DOCX.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      task.stop();
      setBusyPdf(false);
    }
  }

  async function openTpl() {
    setShowTpl(true);
    const j = await fetch("/api/templates").then((r) => r.json()).catch(() => ({}));
    setTpls(j.templates || []);
  }

  async function applyTpl(id: string, name: string) {
    setTplBusy(id);
    try {
      const res = await fetch(`/api/projects/${params.id}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id, reformat }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const c = j.campusStyle;
      notify(
        `Template "${name}" diterapkan — export DOCX/PDF mengikuti pedoman (margin ${c.margins?.top}/${c.margins?.right}/${c.margins?.bottom}/${c.margins?.left} cm, ${c.body?.font} ${c.body?.size}pt, spasi ${c.body?.lineSpacing}).` +
          (reformat ? ` ${j.reformatted} section ikut dirapikan (judul BAB, titik, baris kosong).` : "")
      );
      setShowTpl(false);
      load();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setTplBusy("");
    }
  }

  function runFormatCheck() {
    if (!project) return;
    setIssues(
      validateFormat(
        (project.sections || []).map((s: any) => ({ title: s.title, level: s.level, content: s.content || "" }))
      )
    );
  }

  async function deleteProject() {
    if (!confirm("Hapus proyek ini permanen?")) return;
    await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  const progress = project.sections.length
    ? Math.round(
        (project.sections.filter((s: any) => ["APPROVED", "USER_EDITED"].includes(s.status)).length /
          project.sections.length) *
          100
      )
    : 0;

  return (
    <div className="flex h-screen overflow-hidden">
      {task.task && <TaskOverlay task={task.task} />}
      {/* KIRI: struktur (show/hide) */}
      <div className={showLeft ? "flex" : "hidden"}>
        <StructureTree
          project={project}
          activeId={activeSection?.id}
          onSelect={setActiveId}
          onAdd={addSection}
          onDelete={delSection}
          onMove={moveSection}
          onRename={(id, title) => patchSection(id, { title })}
        />
      </div>

      {/* TENGAH: editor */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-ink-200 bg-white">
        <div className="h-14 border-b border-ink-100 flex items-center gap-2.5 px-4 shrink-0">
          <button
            className={`btn-ghost !px-2 shrink-0 ${showLeft ? "text-brand-600" : "text-ink-400"}`}
            title={showLeft ? "Sembunyikan sidebar struktur" : "Tampilkan sidebar struktur"}
            onClick={() => toggleSidebar("left")}
          >
            <PanelLeft size={16} />
          </button>
          <FileText size={16} className="text-ink-400 shrink-0" />
          <input
            className="flex-1 min-w-[120px] font-semibold text-[15px] bg-transparent focus:outline-none truncate"
            value={project.title}
            onChange={(e) => {
              setProject({ ...project, title: e.target.value });
            }}
            onBlur={(e) =>
              fetch(`/api/projects/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: e.target.value }),
              }).then(load)
            }
          />
          <span className="chip bg-ink-100 text-ink-600 shrink-0">{project.type}</span>
          <div className="w-24 hidden 2xl:block shrink-0">
            <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-[10px] text-ink-400 mt-0.5">{progress}% selesai</div>
          </div>

          {mdDelta !== null && mdDelta > 0 && (
            <span className="chip bg-amber-100 text-amber-700 shrink-0" title="Jumlah section yang berubah sejak export Markdown terakhir">
              Δ {mdDelta}
            </span>
          )}

          {/* Pengaturan Format & Pedoman */}
          <button className="btn-outline shrink-0" onClick={openFormat} title="Pengaturan margin, font, dan spasi kampus">
            <Sliders size={14} /> <span className="hidden sm:inline">Format</span>
          </button>
          <button className="btn-outline shrink-0" onClick={openTpl} title="Terapkan template pedoman penulisan">
            <ScrollText size={14} /> <span className="hidden sm:inline">Template</span>
          </button>
          <button className="btn-outline shrink-0" onClick={runFormatCheck} title="Periksa kepatuhan format terhadap pedoman">
            <ShieldCheck size={14} /> <span className="hidden sm:inline">Cek Format</span>
          </button>

          {/* Dropdown Menu Export Bersih */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              className="btn-outline flex items-center gap-1.5"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={busyExport || busyPdf}
              title="Pilihan export skripsi (DOCX, PDF, Markdown, Pratinjau)"
            >
              {busyExport || busyPdf ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>Export</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${exportMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-ink-200 rounded-lg shadow-xl py-1 z-40 font-sans text-xs">
                <button
                  className="w-full px-3 py-2.5 text-left hover:bg-ink-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportDocx();
                  }}
                >
                  <FileText size={16} className="text-brand-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink-900">Microsoft Word (.docx)</div>
                    <div className="text-[10px] text-ink-400">Format resmi kampus, siap sidang</div>
                  </div>
                </button>
                <button
                  className="w-full px-3 py-2.5 text-left hover:bg-ink-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportPdf();
                  }}
                >
                  <Download size={16} className="text-rose-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink-900">Dokumen PDF (.pdf)</div>
                    <div className="text-[10px] text-ink-400">Konversi DOCX via LibreOffice</div>
                  </div>
                </button>
                <button
                  className="w-full px-3 py-2.5 text-left hover:bg-ink-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportMarkdown();
                  }}
                >
                  <FolderArchive size={16} className="text-amber-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink-900">Markdown Package (.zip)</div>
                    <div className="text-[10px] text-ink-400">chapters/*.md + assets + manifest</div>
                  </div>
                </button>
                <div className="border-t border-ink-100 my-1" />
                <a
                  className="w-full px-3 py-2.5 text-left hover:bg-ink-50 flex items-center gap-2.5 transition-colors"
                  href={`/projects/${params.id}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setExportMenuOpen(false)}
                >
                  <Eye size={16} className="text-ink-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink-900">Pratinjau Halaman Cetak</div>
                    <div className="text-[10px] text-ink-400">Tampilan lembar A4 ala Word</div>
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Area Kontrol Kanan — selalu ter-pinned dan tidak pernah terpotong */}
          <div className="ml-auto flex items-center gap-1 shrink-0 pl-2 border-l border-ink-100">
            <button
              className={`btn-ghost !px-2 ${!showLeft && !showRight ? "text-brand-600 bg-brand-50" : "text-ink-400"}`}
              title={!showLeft && !showRight ? "Keluar dari mode fokus" : "Mode fokus menulis (sembunyikan panel)"}
              onClick={toggleZen}
            >
              {!showLeft && !showRight ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="btn-ghost text-rose-600 !px-2" onClick={deleteProject} title="Hapus proyek">
              <Trash2 size={14} />
            </button>
            <button
              className={`btn-ghost !px-2 ${showRight ? "text-brand-600" : "text-ink-400"}`}
              title={showRight ? "Sembunyikan panel kanan (chat/sources/review)" : "Tampilkan panel kanan"}
              onClick={() => toggleSidebar("right")}
            >
              <PanelRight size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeSection ? (
            <Editor key={activeSection.id} project={project} section={activeSection} onSaved={load} notify={notify} />
          ) : (
            <div className="p-10 text-center text-ink-400 text-sm">Belum ada section.</div>
          )}
        </div>
      </div>

      {/* KANAN: chat/library/review (show/hide) */}
      <div className={showRight ? "flex" : "hidden"}>
        <RightPanel
          project={project}
          activeSectionId={activeSection?.id}
          onJump={setActiveId}
          notify={notify}
          onInsertImage={insertImageToSection}
          onOpenImageSearch={openImageSearch}
          onClose={() => toggleSidebar("right")}
        />
      </div>

      {/* MODAL FORMAT KAMPUS */}
      {formatOpen && fmt && (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-6" onClick={() => setFormatOpen(false)}>
          <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Sliders size={16} className="text-brand-600" /> Format Kampus (Template)</h3>
              <button className="text-ink-400 hover:text-ink-700" onClick={() => setFormatOpen(false)}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="label">Ukuran kertas</div>
                  <select className="input" value={fmt.pageSize} onChange={(e) => setFmt({ ...fmt, pageSize: e.target.value })}>
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                  </select>
                </div>
                <div>
                  <div className="label">Font</div>
                  <input className="input" value={fmt.body.font} onChange={(e) => setFmt({ ...fmt, body: { ...fmt.body, font: e.target.value } })} />
                </div>
              </div>
              <div>
                <div className="label">Margin (cm)</div>
                <div className="grid grid-cols-4 gap-2">
                  {(["top", "right", "bottom", "left"] as const).map((side) => (
                    <div key={side}>
                      <div className="text-[10px] text-ink-400 uppercase text-center mb-0.5">
                        {side === "top" ? "Atas" : side === "right" ? "Kanan" : side === "bottom" ? "Bawah" : "Kiri"}
                      </div>
                      <input
                        className="input text-center"
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        value={fmt.margins[side]}
                        onChange={(e) => setFmt({ ...fmt, margins: { ...fmt.margins, [side]: Number(e.target.value) } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="label">Ukuran font (pt)</div>
                  <input className="input" type="number" step="0.5" min="8" max="16" value={fmt.body.size} onChange={(e) => setFmt({ ...fmt, body: { ...fmt.body, size: Number(e.target.value) } })} />
                </div>
                <div>
                  <div className="label">Spasi baris</div>
                  <select className="input" value={fmt.body.lineSpacing} onChange={(e) => setFmt({ ...fmt, body: { ...fmt.body, lineSpacing: Number(e.target.value) } })}>
                    <option value={1}>1 (single)</option>
                    <option value={1.15}>1.15</option>
                    <option value={1.5}>1.5</option>
                    <option value={2}>2 (double)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="label">Ukuran heading bab (pt)</div>
                  <input className="input" type="number" step="0.5" min="10" max="16" value={fmt.heading1.size} onChange={(e) => setFmt({ ...fmt, heading1: { ...fmt.heading1, size: Number(e.target.value) } })} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={fmt.heading1.centered} onChange={(e) => setFmt({ ...fmt, heading1: { ...fmt.heading1, centered: e.target.checked } })} />
                    Judul bab rata tengah
                  </label>
                </div>
              </div>
              <div className="text-[11px] text-ink-400">
                Format dipakai saat <b>Export DOCX</b>. Tipografi di editor web tidak berubah (editor memakai layout layar).
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary" onClick={saveFormat} disabled={fmtBusy}>
                {fmtBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Format
              </button>
              <button className="btn-outline" onClick={() => setFmt({ ...DEFAULT_CAMPUS_STYLE })}>Reset ke default</button>
            </div>
          </div>
        </div>
      )}

      {showTpl && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setShowTpl(false)}>
          <div className="card p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <ScrollText size={16} /> Terapkan template pedoman
              </div>
              <button className="btn-ghost !px-2" onClick={() => setShowTpl(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Format proyek (margin, font, spasi, indentasi, heading, sitasi) diganti mengikuti template — berlaku untuk
              proyek baru maupun hasil impor.
            </p>
            <label className="flex items-start gap-2 text-sm border rounded-lg p-3 bg-amber-50/60 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={reformat} onChange={(e) => setReformat(e.target.checked)} />
              <span>
                <b>Sekaligus rapikan isi dokumen yang sudah ada</b>
                <span className="block text-xs text-gray-500">
                  Judul & heading dinormalkan sesuai template: BAB jadi Romawi + kapital, titik setelah nomor/akhir judul
                  dihapus, enter & indentasi manual dibersihkan. Substansi tulisan tidak diubah.
                </span>
              </span>
            </label>
            {tpls.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    margin {t.config.margins?.top}/{t.config.margins?.right}/{t.config.margins?.bottom}/{t.config.margins?.left} cm •{" "}
                    {t.config.body?.font} {t.config.body?.size}pt • spasi {t.config.body?.lineSpacing} • sitasi {t.config.citationStyle}
                  </div>
                </div>
                <button className="btn-primary !px-3 !py-1.5 text-sm" disabled={tplBusy === t.id} onClick={() => applyTpl(t.id, t.name)}>
                  {tplBusy === t.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Terapkan
                </button>
              </div>
            ))}
            {!tpls.length && (
              <div className="text-sm text-gray-400 border border-dashed rounded-lg p-4 text-center">
                Belum ada template tersimpan — buat dulu di halaman Template Pedoman.
              </div>
            )}
            <a href="/templates" className="text-xs text-blue-600 hover:underline">
              Butuh aturan lain? Sesuaikan template per-aturan (margin, font, spasi, heading…) di halaman Template Pedoman →
            </a>
          </div>
        </div>
      )}

      {issues !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setIssues(null)}>
          <div className="card p-5 w-full max-w-xl max-h-[80vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <ShieldCheck size={16} /> Hasil cek format
              </div>
              <button className="btn-ghost !px-2" onClick={() => setIssues(null)}>
                <X size={16} />
              </button>
            </div>
            {!issues.length && (
              <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                Tidak ada pelanggaran terdeteksi. Layout (justify, indentasi baris pertama, heading rata kiri, page break
                BAB, penomoran halaman) dijamin mesin export.
              </div>
            )}
            {issues.map((is, i) => (
              <div key={i} className={`text-sm rounded-lg p-2.5 ${is.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                <span className="font-mono text-[10px] opacity-60 mr-1.5">{is.code}</span>
                {is.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast bg-ink-900">{toast}</div>}
    </div>
  );
}
