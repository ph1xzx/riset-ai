"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, FileText, Trash2, Sliders, X, Check, PanelLeft, PanelRight, FolderArchive, ScrollText, ShieldCheck, Eye, ChevronDown, Maximize2, Minimize2, Search, Table as TableIcon } from "lucide-react";
import StructureTree from "@/components/workspace/StructureTree";
import Editor from "@/components/workspace/Editor";
import RightPanel from "@/components/workspace/RightPanel";
import CitationScanModal from "@/components/workspace/CitationScanModal";
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

type RoundtripAudit = {
  ok: boolean;
  filename: string;
  original: { sections: number; words: number; tables: number };
  roundtrip: { sections: number; words: number; tables: number };
  missingSections: string[];
  issues: { severity: "error" | "warn"; code: string; msg: string }[];
};

export type ProjectData = any;

export default function ProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
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
  const [busyTables, setBusyTables] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [roundtripBusy, setRoundtripBusy] = useState(false);
  const [roundtrip, setRoundtrip] = useState<RoundtripAudit | null>(null);
  const task = useTask();
  const pendingImage = useRef<{ sectionId: string; url: string; caption?: string } | null>(null);
  const pendingSearch = useRef<{ sectionId: string; query: string } | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [citationScanOpen, setCitationScanOpen] = useState(false);

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

  useEffect(() => {
    if (window.innerWidth < 768) {
      setShowLeft(false);
      setShowRight(false);
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

  async function handleInsertScannedCitation(sectionId: string, claim: string, citationText: string, metadata: any) {
    const res = await fetch(`/api/projects/${params.id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Gagal menyimpan sumber ke library");
    }
    const savedSource = await res.json();
    load();

    if (sectionId === activeId) {
      window.dispatchEvent(
        new CustomEvent("ws:action", {
          detail: { action: "insert-citation", claim, citationText, sourceId: savedSource.id },
        })
      );
    } else {
      setActiveId(sectionId);
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("ws:action", {
            detail: { action: "insert-citation", claim, citationText, sourceId: savedSource.id },
          })
        );
      }, 250);
    }
  }

  function openFormat() {
    const saved = parseJsonObject(project.campusStyle, {}) as any;
    setFmt({
      ...DEFAULT_CAMPUS_STYLE,
      ...saved,
      margins: { ...DEFAULT_CAMPUS_STYLE.margins, ...(saved.margins || {}) },
      body: { ...DEFAULT_CAMPUS_STYLE.body, ...(saved.body || {}) },
      heading1: { ...DEFAULT_CAMPUS_STYLE.heading1, ...(saved.heading1 || {}) },
      heading2: { ...DEFAULT_CAMPUS_STYLE.heading2, ...(saved.heading2 || {}) },
      heading3: { ...DEFAULT_CAMPUS_STYLE.heading3, ...(saved.heading3 || {}) },
      references: { ...DEFAULT_CAMPUS_STYLE.references, ...(saved.references || {}) },
    } as any);
    setFormatOpen(true);
  }

  async function saveFormat() {
    setFmtBusy(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campusStyle: fmt }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Format belum bisa disimpan.");
      setFormatOpen(false);
      load();
      notify("Format kampus disimpan dan akan dipakai saat export DOCX.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setFmtBusy(false);
    }
  }

  const notify = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(() => {
    setProjectError("");
    fetch(`/api/projects/${params.id}`)
      .then((r) => {
        if (r.status === 404) {
          setProject({ __nf: true });
          return null;
        }
        if (!r.ok) throw new Error("Proyek belum bisa dimuat.");
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        setProject(j);
        setActiveId((cur) => cur || j.sections?.[0]?.id || "");
      })
      .catch((e: Error) => setProjectError(e.message))
      .finally(() => setProjectLoading(false));
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

  async function italicizeEnglish(term: string, sectionIds: string[]) {
    const res = await fetch(`/api/projects/${params.id}/english-italicize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term, sectionIds }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Istilah belum bisa dimiringkan.");
    if (sectionIds.includes(activeId)) {
      window.dispatchEvent(new CustomEvent("ws:action", { detail: { action: "italicize-term", term } }));
    }
    notify(`${j.occurrences || 0} kemunculan "${term}" dimiringkan.`);
    load();
  }

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

  if (!project && projectError) {
    return (
      <div className="p-10 text-center" role="alert">
        <p className="text-ink-600 font-semibold">Proyek belum bisa dimuat</p>
        <p className="text-sm text-ink-500 mt-1">{projectError}</p>
        <div className="flex justify-center gap-2 mt-4">
          <button type="button" className="btn-outline" onClick={load}>Coba lagi</button>
          <Link href="/dashboard" className="btn-primary">Ke Dashboard</Link>
        </div>
      </div>
    );
  }
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
  if (!project || projectLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-ink-400 gap-2">
        <Loader2 className="animate-spin" size={18} /> Memuat proyek…
      </div>
    );
  }

  async function patchSection(id: string, data: object) {
    const res = await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      notify(j?.error || "Perubahan section belum tersimpan.");
      return;
    }
    load();
  }

  async function addSection(level: number) {
    const n = project.sections.length;
    const res = await fetch(`/api/projects/${params.id}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: level === 3 ? "Sub-sub-bab baru" : level === 2 ? "Sub-bab baru" : `BAB ${n}`, level }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      notify(j?.error || "Section baru belum bisa dibuat.");
      return;
    }
    load();
  }

  async function delSection(id: string) {
    if (!confirm("Hapus section ini beserta isinya?")) return;
    const res = await fetch(`/api/sections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      notify(j?.error || "Section belum bisa dihapus.");
      return;
    }
    setActiveId("");
    load();
  }

  async function moveSection(sectionId: string, dir: -1 | 1) {
    const idx = project.sections.findIndex((s: any) => s.id === sectionId);
    const target = idx + dir;
    if (target < 0 || target >= project.sections.length) return;
    const res = await fetch(`/api/sections/${params.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: params.id, sectionId, targetIndex: target }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      notify(j?.error || "Urutan section belum bisa diubah.");
      return;
    }
    load();
  }

  async function exportDocx() {
    const preflightIssues = runFormatCheck();
    if (preflightIssues.some((issue) => issue.severity === "error")) {
      notify("Export ditahan karena ada masalah format wajib. Periksa hasil cek format.");
      return;
    }
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
      task.log("Selesai, DOCX terunduh.");
      notify("DOCX diunduh. Format mengikuti template pedoman yang aktif.");
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
      task.log(`${manifest.chapters.length} chapter + ${manifest.required_assets.length} aset siap, mengunduh…`);
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
          ? `Paket Markdown diunduh. ${missing} aset tidak bisa dibundel (URL web), tetap direferensikan di .md.`
          : "Paket Markdown diunduh: chapters/*.md + assets/* + manifest.json."
      );
    } catch (e: any) {
      notify(e.message);
    } finally {
      task.stop();
      setBusyExport(false);
    }
  }

  async function formatProjectTables() {
    setBusyTables(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/format-tables`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Tabel belum bisa dirapikan.");
      setEditorRevision((value) => value + 1);
      await load();
      notify(
        j.tables
          ? `${j.tables} tabel diperiksa. ${j.sections ? `${j.sections} section diperbarui.` : "Semua tabel sudah rapi."}`
          : "Belum ada tabel di proyek ini."
      );
    } catch (e: any) {
      notify(e.message || "Tabel belum bisa dirapikan.");
    } finally {
      setBusyTables(false);
    }
  }

  async function runRoundtripAudit() {
    setRoundtripBusy(true);
    task.start("Audit DOCX", project.title, "Mengekspor lalu membaca ulang dokumen untuk mencari perubahan isi…");
    try {
      task.log("Membandingkan section, jumlah kata, dan tabel…");
      const res = await fetch(`/api/projects/${params.id}/roundtrip-audit`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Audit DOCX belum bisa dijalankan.");
      setRoundtrip(j as RoundtripAudit);
      notify(j.ok ? "Audit DOCX selesai. Tidak ada kehilangan isi besar." : "Audit DOCX menemukan bagian yang perlu diperiksa.");
    } catch (e: any) {
      notify(e.message || "Audit DOCX belum bisa dijalankan.");
    } finally {
      task.stop();
      setRoundtripBusy(false);
    }
  }

  async function exportPdf() {
    const preflightIssues = runFormatCheck();
    if (preflightIssues.some((issue) => issue.severity === "error")) {
      notify("Export ditahan karena ada masalah format wajib. Periksa hasil cek format.");
      return;
    }
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
      notify("PDF diunduh. Isi dan format sama dengan Export DOCX.");
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
    const currentStyle = parseJsonObject(project.campusStyle, {}) as any;
    if (Boolean(currentStyle.formatLocked)) {
      notify("Profil format terkunci. Buka kunci di Format sebelum menerapkan template.");
      return;
    }
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
        `Template "${name}" diterapkan. Export DOCX/PDF mengikuti pedoman (margin ${c.margins?.top}/${c.margins?.right}/${c.margins?.bottom}/${c.margins?.left} cm, ${c.body?.font} ${c.body?.size}pt, spasi ${c.body?.lineSpacing}).` +
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

  function runFormatCheck(): FormatIssue[] {
    if (!project) return [];
    const found = validateFormat(
      (project.sections || []).map((s: any) => ({ title: s.title, level: s.level, content: s.content || "", status: s.status }))
    );
    setIssues(found);
    return found;
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
  const projectFormatLocked = Boolean((parseJsonObject(project.campusStyle, {}) as any).formatLocked);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {task.task && <TaskOverlay task={task.task} />}
      {/* KIRI: struktur (show/hide) */}
      <div className={showLeft ? "fixed inset-y-0 left-0 z-30 flex bg-white shadow-xl md:static md:z-auto md:shadow-none" : "hidden"}>
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
        <div className="min-h-14 md:h-14 border-b border-ink-200 bg-white flex flex-wrap md:flex-nowrap items-center gap-2 px-2 sm:px-3 py-2 md:py-0 shrink-0 md:overflow-x-auto no-scrollbar">
          <button
            className={`btn-ghost !h-9 !w-9 !p-0 justify-center shrink-0 border border-transparent hover:border-ink-200 ${showLeft ? "text-brand-600" : "text-ink-400"}`}
            title={showLeft ? "Sembunyikan sidebar struktur" : "Tampilkan sidebar struktur"}
            onClick={() => toggleSidebar("left")}
          >
            <PanelLeft size={16} />
          </button>
          <span className="h-8 w-px bg-ink-200 shrink-0" />
          <div className="flex items-center gap-2 min-w-[150px] sm:min-w-[220px] max-w-[min(42vw,360px)] sm:max-w-[min(31vw,360px)] shrink-0">
            <FileText size={16} className="text-brand-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-ink-400 leading-none mb-1">Dokumen kerja</div>
              <input
                className="w-full min-w-0 font-semibold text-sm bg-transparent focus:outline-none truncate"
                value={project.title}
                aria-label="Judul dokumen"
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
            </div>
          </div>
          <span className="chip bg-ink-100 text-ink-600 shrink-0">{project.type}</span>
          <div className="w-24 hidden xl:block shrink-0 pl-1">
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

          <span className="h-8 w-px bg-ink-200 shrink-0 mx-1" />

          {/* Ribbon: perintah dokumen */}
          <button className="btn-outline !h-9 shrink-0" onClick={openFormat} title="Pengaturan margin, font, dan spasi kampus">
            <Sliders size={14} /> <span className="hidden sm:inline">Format</span>
          </button>
          <button className="btn-outline !h-9 shrink-0" onClick={openTpl} title="Terapkan template pedoman penulisan">
            <ScrollText size={14} /> <span className="hidden sm:inline">Template</span>
          </button>
          <button className="btn-outline !h-9 shrink-0" onClick={formatProjectTables} disabled={busyTables} title="Seragamkan header, kolom, dan baris seluruh tabel">
            {busyTables ? <Loader2 size={14} className="animate-spin" /> : <TableIcon size={14} />} <span className="hidden sm:inline">Rapikan Tabel</span>
          </button>
          <button className="btn-outline !h-9 shrink-0" onClick={runFormatCheck} title="Periksa kepatuhan format terhadap pedoman">
            <ShieldCheck size={14} /> <span className="hidden sm:inline">Cek Format</span>
          </button>
          <button
            className="btn-outline !h-9 shrink-0 text-brand-700 bg-brand-50/40 hover:bg-brand-50 border-brand-200"
            onClick={() => setCitationScanOpen(true)}
            title="Pindai naskah untuk mencari bagian tanpa sitasi & temukan jurnal yang cocok"
          >
            <Search size={14} className="text-brand-600" /> <span className="hidden sm:inline">Scan Sitasi</span>
          </button>

          {/* Dropdown Menu Export Bersih */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              className="btn-outline !h-9 flex items-center gap-1.5"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={busyExport || busyPdf || roundtripBusy}
              title="Pilihan export skripsi (DOCX, PDF, Markdown, Pratinjau)"
            >
              {busyExport || busyPdf || roundtripBusy ? (
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
                <button
                  className="w-full px-3 py-2.5 text-left hover:bg-ink-50 flex items-center gap-2.5 transition-colors"
                  onClick={() => {
                    setExportMenuOpen(false);
                    runRoundtripAudit();
                  }}
                  disabled={roundtripBusy}
                >
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-ink-900">Audit kompatibilitas Word</div>
                    <div className="text-[10px] text-ink-400">Export lalu baca ulang untuk cek isi dan tabel</div>
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

              {/* Kontrol kanan tetap tersedia dan tidak terpotong. */}
          <div className="ml-auto flex items-center gap-1 shrink-0 pl-2 border-l border-ink-200">
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
            <Editor key={`${activeSection.id}:${editorRevision}`} project={project} section={activeSection} onSaved={load} notify={notify} />
          ) : (
            <div className="p-10 text-center text-ink-400 text-sm">Belum ada section.</div>
          )}
        </div>
      </div>

      {/* KANAN: chat/library/review (show/hide) */}
      <div className={showRight ? "fixed inset-y-0 right-0 z-30 flex bg-white shadow-xl md:static md:z-auto md:shadow-none" : "hidden"}>
        <RightPanel
          project={project}
          activeSectionId={activeSection?.id}
          onJump={setActiveId}
          notify={notify}
          onInsertImage={insertImageToSection}
          onOpenImageSearch={openImageSearch}
          onItalicizeTerm={italicizeEnglish}
          onClose={() => toggleSidebar("right")}
          onOpenCitationScan={() => setCitationScanOpen(true)}
        />
      </div>

      {/* MODAL FORMAT KAMPUS */}
      {formatOpen && fmt && (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-3 sm:p-6" onClick={() => setFormatOpen(false)}>
          <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Sliders size={16} className="text-brand-600" /> Format Kampus (Template)</h3>
              <button className="text-ink-400 hover:text-ink-700" onClick={() => setFormatOpen(false)}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="label">Ukuran kertas</div>
                  <select className="input" value={fmt.pageSize} disabled={Boolean(fmt.formatLocked)} onChange={(e) => setFmt({ ...fmt, pageSize: e.target.value })}>
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                  </select>
                </div>
                <div>
                  <div className="label">Font</div>
                  <input className="input" value={fmt.body.font} disabled={Boolean(fmt.formatLocked)} onChange={(e) => setFmt({ ...fmt, body: { ...fmt.body, font: e.target.value } })} />
                </div>
              </div>
              <div>
                <div className="label">Margin (cm)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        disabled={Boolean(fmt.formatLocked)}
                        onChange={(e) => setFmt({ ...fmt, margins: { ...fmt.margins, [side]: Number(e.target.value) } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="label">Ukuran font (pt)</div>
                  <input className="input" type="number" step="0.5" min="8" max="16" value={fmt.body.size} disabled={Boolean(fmt.formatLocked)} onChange={(e) => setFmt({ ...fmt, body: { ...fmt.body, size: Number(e.target.value) } })} />
                </div>
                <div>
                  <div className="label">Spasi baris</div>
                  <select className="input" value={fmt.body.lineSpacing} disabled={Boolean(fmt.formatLocked)} onChange={(e) => setFmt({ ...fmt, body: { ...fmt.body, lineSpacing: Number(e.target.value) } })}>
                    <option value={1}>1 (single)</option>
                    <option value={1.15}>1.15</option>
                    <option value={1.5}>1.5</option>
                    <option value={2}>2 (double)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="label">Ukuran heading bab (pt)</div>
                  <input className="input" type="number" step="0.5" min="10" max="16" value={fmt.heading1.size} disabled={Boolean(fmt.formatLocked)} onChange={(e) => setFmt({ ...fmt, heading1: { ...fmt.heading1, size: Number(e.target.value) } })} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={fmt.heading1.centered} disabled={Boolean(fmt.formatLocked)} onChange={(e) => setFmt({ ...fmt, heading1: { ...fmt.heading1, centered: e.target.checked } })} />
                    Judul bab rata tengah
                  </label>
                </div>
              </div>
              <div className={`rounded-lg border p-3 text-sm ${fmt.formatLocked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-ink-200 bg-ink-50 text-ink-600"}`}>
                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(fmt.formatLocked)}
                    onChange={(e) => setFmt({ ...fmt, formatLocked: e.target.checked })}
                  />
                  {fmt.formatLocked ? "Profil format terkunci" : "Kunci profil format setelah disimpan"}
                </label>
                <p className="text-[11px] mt-1 opacity-80">
                  {fmt.formatLocked
                    ? "Buka centang ini untuk mengubah format atau menerapkan template baru."
                    : "Kunci profil supaya format export tidak berubah saat template atau pengaturan lain dipakai."}
                </p>
              </div>
              <div className="text-[11px] text-ink-400">
                Format dipakai saat <b>Export DOCX</b>. Tipografi di editor web tidak berubah (editor memakai layout layar).
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-primary" onClick={saveFormat} disabled={fmtBusy}>
                {fmtBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Format
              </button>
              <button className="btn-outline" onClick={() => setFmt({ ...DEFAULT_CAMPUS_STYLE, formatLocked: false })} disabled={Boolean(fmt.formatLocked) || fmtBusy}>Reset ke default</button>
            </div>
          </div>
        </div>
      )}

      {showTpl && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => setShowTpl(false)}>
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
              Format proyek (margin, font, spasi, indentasi, heading, sitasi) diganti mengikuti template. Berlaku untuk
              proyek baru maupun hasil impor.
            </p>
            {projectFormatLocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Profil format sedang terkunci. Buka kuncinya dari tombol Format sebelum menerapkan template.
              </div>
            )}
            <label className="flex items-start gap-2 text-sm border rounded-lg p-3 bg-amber-50/60 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={reformat} disabled={projectFormatLocked} onChange={(e) => setReformat(e.target.checked)} />
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
                <button className="btn-primary !px-3 !py-1.5 text-sm" disabled={projectFormatLocked || tplBusy === t.id} onClick={() => applyTpl(t.id, t.name)}>
                  {tplBusy === t.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Terapkan
                </button>
              </div>
            ))}
            {!tpls.length && (
              <div className="text-sm text-gray-400 border border-dashed rounded-lg p-4 text-center">
                Belum ada template tersimpan. Buat dulu di halaman Template Pedoman.
              </div>
            )}
            <a href="/templates" className="text-xs text-blue-600 hover:underline">
              Butuh aturan lain? Sesuaikan template per-aturan (margin, font, spasi, heading…) di halaman Template Pedoman →
            </a>
          </div>
        </div>
      )}

      {issues !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => setIssues(null)}>
          <div className="card p-5 w-full max-w-xl max-h-[80vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <ShieldCheck size={16} /> Hasil cek format sebelum export
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

      {roundtrip && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => setRoundtrip(null)}>
          <div className="card p-5 w-full max-w-2xl max-h-[82vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="roundtrip-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2" id="roundtrip-title">
                  <ShieldCheck size={16} className={roundtrip.ok ? "text-emerald-600" : "text-amber-600"} /> Audit kompatibilitas Word
                </div>
                <p className="text-xs text-ink-500 mt-1">DOCX dibuat lalu dibaca ulang untuk memeriksa struktur isi sebelum kamu mengirimkannya ke pembimbing.</p>
              </div>
              <button className="btn-ghost !px-2" onClick={() => setRoundtrip(null)} aria-label="Tutup audit DOCX"><X size={16} /></button>
            </div>
            <div className={`rounded-lg p-3 text-sm ${roundtrip.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {roundtrip.ok ? "Struktur utama dan tabel berhasil melewati pemeriksaan." : "Ada bagian yang perlu kamu cek sebelum dokumen dianggap aman untuk round-trip."}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                ["Section", `${roundtrip.original.sections} → ${roundtrip.roundtrip.sections}`],
                ["Kata", `${roundtrip.original.words} → ${roundtrip.roundtrip.words}`],
                ["Tabel", `${roundtrip.original.tables} → ${roundtrip.roundtrip.tables}`],
                ["File", roundtrip.filename.replace(/\.docx$/i, "")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-ink-100 bg-ink-50/50 p-2 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
                  <div className="text-sm font-semibold text-ink-800 truncate" title={value}>{value}</div>
                </div>
              ))}
            </div>
            {roundtrip.issues.length ? (
              <div className="space-y-2">
                {roundtrip.issues.map((issue, index) => (
                  <div key={`${issue.code}-${index}`} className={`rounded-lg p-2.5 text-sm ${issue.severity === "error" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>
                    <span className="font-mono text-[10px] opacity-60 mr-1.5">{issue.code}</span>{issue.msg}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-ink-500 border border-dashed border-ink-200 rounded-lg p-3">Tidak ada peringatan dari pemeriksaan ini.</div>
            )}
            {roundtrip.missingSections.length > 0 && (
              <div className="text-xs text-ink-500">Section yang perlu dicek: {roundtrip.missingSections.join(", ")}</div>
            )}
          </div>
        </div>
      )}

      {citationScanOpen && (
        <CitationScanModal
          project={project}
          isOpen={citationScanOpen}
          onClose={() => setCitationScanOpen(false)}
          onInsertCitation={handleInsertScannedCitation}
          notify={notify}
        />
      )}

      {toast && <div className="toast bg-ink-900">{toast}</div>}
    </div>
  );
}
