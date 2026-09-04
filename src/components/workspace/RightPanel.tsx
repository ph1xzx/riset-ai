"use client";
import { useEffect, useRef, useState } from "react";
import TaskOverlay, { useTask } from "@/components/TaskOverlay";
import Link from "next/link";
import {
  MessageSquareText, BookOpen, ShieldCheck, Send, Loader2, ExternalLink, Trash2,
  FileSearch, ExternalLink as Ext, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  FileCog, GraduationCap, ChevronDown, ChevronUp, Wand2, ImagePlus, Search, Sparkles,
  X, PanelRightClose,
} from "lucide-react";
import { stripHtml, parseJsonArray } from "@/lib/json";
import { uploadDocx } from "@/lib/upload";

type Props = {
  project: any;
  activeSectionId: string;
  onJump: (id: string) => void;
  notify: (t: string) => void;
  onInsertImage: (sectionId: string, url: string, caption?: string) => void;
  onOpenImageSearch: (query: string, sectionId?: string) => void;
  onClose?: () => void;
  onOpenCitationScan?: () => void;
};

type Tab = "chat" | "sources" | "review";

type FigureSuggestion = {
  index: number;
  sectionTitle: string;
  caption: string;
  kind: string;
  prompt: string | null;
  webQuery: string | null;
  why: string;
};

/** Kirim aksi ke Editor (window event) — editor nge-scroll & memblok teks. */
function dispatchAction(action: string) {
  window.dispatchEvent(new CustomEvent("ws:action", { detail: { action } }));
}

export default function RightPanel({ project, activeSectionId, onJump, notify, onInsertImage, onOpenImageSearch, onClose, onOpenCitationScan }: Props) {
  const [tab, setTab] = useState<Tab>("chat");
  const [ctx, setCtx] = useState({ section: true, document: false, library: false, pdfs: false });
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [defBusy, setDefBusy] = useState(false);
  const [defQs, setDefQs] = useState<any[] | null>(null);
  const [defCount, setDefCount] = useState(10);
  const [openQ, setOpenQ] = useState<number | null>(null);

  /* ---------- chat ---------- */
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [threadId, setThreadId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((project.threads?.[0]?.messages ?? []).map((m: any) => ({ role: m.role, content: m.content })));
    setThreadId(project.threads?.[0]?.id ?? "");
  }, [project.threads?.[0]?.id, project.threads?.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!input.trim() || chatBusy) return;
    const msg = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setChatBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: threadId || undefined,
          message: msg,
          contexts: {
            sectionId: ctx.section ? activeSectionId : undefined,
            useDocument: ctx.document,
            useLibrary: ctx.library,
            usePdfs: ctx.pdfs,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setThreadId(j.threadId);
      setMessages((m) => [...m, { role: "assistant", content: j.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally {
      setChatBusy(false);
    }
  }

  /* ---------- sources ---------- */
  const [sources, setSources] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${project.id}/sources`).then((r) => r.json()).then(setSources).catch(() => {});
  }, [project.id, project.sources?.length]);

  async function delSource(id: string) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    setSources((s) => s.filter((x) => x.id !== id));
  }

  /* ---------- review ---------- */
  const [reviewBusy, setReviewBusy] = useState(false);
  const task = useTask();
  const [citeBusy, setCiteBusy] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [citeResult, setCiteResult] = useState<any>(null);

  /* ---------- saran gambar ---------- */
  const [figBusy, setFigBusy] = useState(false);
  const [figs, setFigs] = useState<FigureSuggestion[] | null>(null);
  const [figGenBusy, setFigGenBusy] = useState<number | null>(null);

  async function runFigures() {
    setFigBusy(true);
    setFigs(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/figure-suggestions`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setFigs(j.figures || []);
      notify(j.figures?.length ? `Ada ${j.figures.length} usulan gambar.` : "Tidak ada usulan gambar.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setFigBusy(false);
    }
  }

  function findSectionId(title: string): string | null {
    const t = (title || "").toLowerCase();
    const sec = project.sections?.find((s: any) => (s.title || "").toLowerCase() === t)
      || project.sections?.find((s: any) => (s.title || "").toLowerCase().includes(t.slice(0, 12)) && t.length > 8);
    return sec?.id || null;
  }

  async function makeFigure(fig: FigureSuggestion) {
    setFigGenBusy(fig.index);
    task.start("Generate gambar AI", fig.caption, "Mengirim prompt ke model gambar…", true);
    try {
      task.log("Menunggu gambar dirender (bisa 10–60 detik)…");
      const res = await fetch(`/api/projects/${project.id}/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fig.prompt || fig.caption }),
        signal: task.signal(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log("Gambar jadi — menyisipkan ke section…");
      const sectionId = findSectionId(fig.sectionTitle);
      if (sectionId) {
        onInsertImage(sectionId, j.url, fig.caption);
        notify(`Gambar disisipkan di "${fig.sectionTitle}".`);
      } else {
        onInsertImage(activeSectionId, j.url, fig.caption);
        notify("Section tujuan tak ketemu — gambar disisipkan di section aktif.");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") notify(e.message);
    } finally {
      task.stop();
      setFigGenBusy(null);
    }
  }

  async function runReview() {
    setReviewBusy(true);
    setReview(null);
    task.start("Cek penulisan", undefined, "Memindai seluruh section dokumen…", true);
    try {
      task.log("Model sedang mereview tata bahasa & struktur…");
      const res = await fetch(`/api/projects/${project.id}/review`, { method: "POST", signal: task.signal() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log(`Selesai — ${j.issues.length} temuan.`);
      setReview(j);
      notify(`Cek penulisan selesai: ${j.issues.length} temuan.`);
    } catch (e: any) {
      if (e.name !== "AbortError") notify(e.message);
    } finally {
      task.stop();
      setReviewBusy(false);
    }
  }

  async function runCiteCheck() {
    setCiteBusy(true);
    setCiteResult(null);
    task.start("Cek sitasi", undefined, "Mengumpulkan sitasi dari seluruh dokumen…", true);
    try {
      task.log("Mencocokkan setiap sitasi dengan daftar pustaka…");
      const res = await fetch(`/api/projects/${project.id}/citation-check`, { method: "POST", signal: task.signal() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log(`Selesai — ${j.verified} terverifikasi, ${j.notFound} tidak ditemukan.`);
      setCiteResult(j);
    } catch (e: any) {
      if (e.name !== "AbortError") notify(e.message);
    } finally {
      task.stop();
      setCiteBusy(false);
    }
  }

  async function runDefense() {
    setDefBusy(true);
    setDefQs(null);
    task.start("Simulasi sidang", undefined, "Membaca dokumen untuk meracik pertanyaan penguji…", true);
    try {
      task.log(`Menyusun ${defCount} pertanyaan + jawaban (bisa 30–90 detik)…`);
      const res = await fetch(`/api/projects/${project.id}/defense-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: defCount }),
        signal: task.signal(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log("Pertanyaan siap.");
      setDefQs(j.questions);
    } catch (e: any) {
      if (e.name !== "AbortError") notify(e.message);
    } finally {
      task.stop();
      setDefBusy(false);
    }
  }

  async function attachPdf(file: File) {
    setPdfBusy(true);
    try {
      const url = await uploadDocx(file); // nama helper umum: .docx/.pdf sama-sama file
      const res = await fetch(`/api/projects/${project.id}/sources/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      notify(`PDF terlampir: ${j.pages} halaman, ${j.chunks} chunk. Bisa dipakai AI Chat (pill PDF) & disitasi.`);
      fetch(`/api/projects/${project.id}/sources`).then((r) => r.json()).then(setSources).catch(() => {});
    } catch (e: any) {
      notify(e.message);
    } finally {
      setPdfBusy(false);
    }
  }

  const sevCls: Record<string, string> = {
    critical: "bg-rose-100 text-rose-700",
    warning: "bg-amber-100 text-amber-700",
    suggestion: "bg-sky-100 text-sky-700",
  };

  return (
    <aside className="w-80 shrink-0 bg-white flex flex-col">
      {task.task && <TaskOverlay task={task.task} onCancel={task.cancel} />}
      <div className="flex items-center border-b border-ink-100">
        <div className="flex-1 flex">
          {(
            [
              ["chat", "AI Chat", MessageSquareText],
              ["sources", "Sources", BookOpen],
              ["review", "Review", ShieldCheck],
            ] as [Tab, string, any][]
          ).map(([t, label, Icon]) => (
            <button
              key={t}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-400 hover:text-ink-600"
              }`}
              onClick={() => setTab(t)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Sembunyikan panel kanan"
            className="px-3 py-2.5 text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-colors border-l border-ink-100 shrink-0"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ===== CARD AKSI — klik → editor nge-scroll & BLOCK teks yang akan diganti ===== */}
      <div className="grid grid-cols-2 gap-2 p-3 pb-2 border-b border-ink-100">
        {(
          [
            ["cite", "Cite", BookOpen, "Blokir paragraf → sisip sitasi", "text-brand-600 bg-brand-50"],
            ["paraphrase", "Parafrase", RefreshCw, "Blokir section → tulis ulang", "text-violet-600 bg-violet-50"],
            ["aiedit", "AI Edit", Wand2, "Blokir teks → perbaiki/parafrase", "text-amber-600 bg-amber-50"],
          ] as [string, string, any, string, string][]
        ).map(([action, label, Icon, desc, color]) => (
          <button
            key={action}
            className="flex items-center gap-2 border border-ink-100 rounded-lg px-2.5 py-2 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
            onClick={() => dispatchAction(action)}
          >
            <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${color}`}>
              <Icon size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold leading-tight">{label}</span>
              <span className="block text-[10px] text-ink-400 leading-tight truncate">{desc}</span>
            </span>
          </button>
        ))}
        <button
          className="flex items-center gap-2 border border-ink-100 rounded-lg px-2.5 py-2 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
          onClick={() => {
            setTab("review");
            runCiteCheck();
          }}
        >
          <span className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-emerald-600 bg-emerald-50">
            <ShieldCheck size={14} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold leading-tight">Cek Sitasi</span>
            <span className="block text-[10px] text-ink-400 leading-tight truncate">Verifikasi + konsistensi</span>
          </span>
        </button>
      </div>

      {/* ===== CHAT ===== */}
      {tab === "chat" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-ink-50 flex gap-1.5 flex-wrap">
            {(
              [
                ["section", "Section ini"],
                ["document", "Dokumen"],
                ["library", "Library"],
                ["pdfs", "PDF"],
              ] as [keyof typeof ctx, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                className={`chip ${ctx[k] ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}
                onClick={() => setCtx({ ...ctx, [k]: !ctx[k] })}
              >
                {ctx[k] && <CheckCircle2 size={10} />} {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-xs text-ink-400 text-center mt-8 px-4">
                Tanya apa saja tentang risetmu — dengan konteks: section aktif, dokumen, atau library.
                Contoh: <em>"ringkas rumusan masalah saya"</em>, <em>"metode apa yang cocok untuk data ini?"</em>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-[13px] leading-relaxed whitespace-pre-wrap rounded-lg px-3 py-2 ${m.role === "user" ? "bg-brand-600 text-white ml-6" : "bg-ink-50 text-ink-800 mr-6"}`}>
                {m.content}
              </div>
            ))}
            {chatBusy && (
              <div className="flex items-center gap-2 text-xs text-ink-400">
                <Loader2 size={13} className="animate-spin" /> AI menjawab…
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="p-3 border-t border-ink-100">
            <div className="flex gap-1.5">
              <input
                className="input flex-1"
                placeholder="Tanya AI…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button className="btn-primary !px-3" onClick={send} disabled={chatBusy || !input.trim()}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SOURCES ===== */}
      {tab === "sources" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-400">{sources.length} sumber (citation-safe set)</span>
            <Link href="/find-papers" className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:underline">
              <FileSearch size={12} /> Find Papers
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attachPdf(f);
                e.target.value = "";
              }}
            />
            <button className="btn-outline !py-1 !px-2 !text-[11px] w-full justify-center" onClick={() => pdfRef.current?.click()} disabled={pdfBusy}>
              {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <FileCog size={12} />} Lampirkan PDF (jurnal/pedoman) — untuk RAG & sitasi
            </button>
          </div>
          {sources.length === 0 && (
            <div className="text-xs text-ink-400 bg-ink-50 rounded-lg p-3">
              Belum ada sumber. Simpan paper dari Find Papers — AI hanya boleh mengutip sumber yang ada di sini,
              sehingga sitasi tak pernah fiktif.
            </div>
          )}
          {sources.map((s: any) => (
            <div key={s.id} className="border border-ink-100 rounded-lg p-2.5 group">
              <div className="text-[13px] font-medium leading-snug line-clamp-2">{s.title}</div>
              <div className="text-[11px] text-ink-500 mt-1">
                {parseJsonArray<string>(s.authors).slice(0, 2).join(", ")} • {s.year ?? "s.t."} • IF {s.impactFactor ?? "-"} • {s.citationCount} sitasi
              </div>
              <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {s.doi && (
                  <a className="text-[11px] text-brand-600 flex items-center gap-1 hover:underline" href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer">
                    <Ext size={11} /> DOI
                  </a>
                )}
                <button className="text-[11px] text-rose-600 flex items-center gap-1 hover:underline" onClick={() => delSource(s.id)}>
                  <Trash2 size={11} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== REVIEW ===== */}
      {tab === "review" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-xs text-ink-500">
            Cek penulisan (grammar, tone, koherensi, konsistensi data) + verifikasi sitasi terhadap Crossref —
            hasil klik → bukti/link.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-outline justify-center !text-xs" onClick={runReview} disabled={reviewBusy}>
              {reviewBusy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Cek Penulisan
            </button>
            <button className="btn-outline justify-center !text-xs" onClick={runCiteCheck} disabled={citeBusy}>
              {citeBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Cek Sitasi
            </button>
          </div>
          {onOpenCitationScan && (
            <button
              className="btn-outline w-full justify-center !text-xs mt-2 border-brand-200 bg-brand-50/40 text-brand-700 hover:bg-brand-50 flex items-center gap-1.5"
              onClick={onOpenCitationScan}
            >
              <Search size={13} className="text-brand-600" />
              <span>Scan Peluang Sitasi (Pilih Bab / Semua)</span>
            </button>
          )}
          <button className="btn-primary w-full justify-center !text-xs mt-2" onClick={runFigures} disabled={figBusy}>
            {figBusy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {figBusy ? "Menganalisa dokumen…" : "Saran Gambar"}
          </button>

          {/* Daftar usulan gambar */}
          {figs && figs.length > 0 && (
            <div className="space-y-2 mt-1">
              <div className="text-[11px] font-semibold text-ink-500">USULAN GAMBAR — klik "Buat" untuk generate & sisipkan langsung ke section terkait</div>
              {figs.map((f) => (
                <div key={f.index} className="border border-ink-100 rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          f.kind === "diagram" ? "bg-brand-50 text-brand-700" :
                          f.kind === "logo" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        }`}>{f.kind}</span>
                        <button className="text-[11px] font-semibold text-brand-600 hover:underline truncate" onClick={() => {
                          const sid = findSectionId(f.sectionTitle);
                          if (sid) onJump(sid);
                        }}>{f.sectionTitle || "Section"}</button>
                      </div>
                      <div className="text-[12px] mt-1 font-medium">{f.caption}</div>
                      <div className="text-[11px] text-ink-500 mt-0.5">{f.why}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {f.kind === "logo" && f.webQuery ? (
                      <button
                        className="btn-outline justify-center !text-[11px] !px-2"
                        onClick={() => {
                          const sid = findSectionId(f.sectionTitle);
                          if (sid) onJump(sid);
                          onOpenImageSearch(f.webQuery!, sid || undefined);
                        }}
                      >
                        <Search size={11} /> Cari di web
                      </button>
                    ) : (
                      <button
                        className="btn-primary justify-center !text-[11px] !px-2"
                        onClick={() => makeFigure(f)}
                        disabled={figGenBusy !== null}
                      >
                        {figGenBusy === f.index ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {figGenBusy === f.index ? "Membuat…" : "Buat & Sisipkan"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {figs && figs.length === 0 && (
            <div className="text-[12px] text-ink-500 mt-1">Dokumen saat ini tidak butuh tambahan gambar.</div>
          )}

          {/* Simulasi sidang */}
          <div className="border border-ink-100 rounded-lg p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold flex items-center gap-1.5">
                <GraduationCap size={14} className="text-brand-600" /> Simulasi Sidang
              </span>
              <select className="input !w-auto !py-0.5 !text-[11px]" value={defCount} onChange={(e) => setDefCount(Number(e.target.value))}>
                <option value={10}>10 soal</option>
                <option value={15}>15 soal</option>
                <option value={20}>20 soal</option>
              </select>
            </div>
            <button className="btn-outline w-full justify-center !text-xs mt-2" onClick={runDefense} disabled={defBusy}>
              {defBusy ? <Loader2 size={13} className="animate-spin" /> : <GraduationCap size={13} />}
              {defBusy ? "Penguji menyusun soal…" : "Buat Pertanyaan Penguji"}
            </button>
            {defQs && (
              <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto">
                {defQs.map((q: any, i: number) => (
                  <div key={i} className="border border-ink-100 rounded-lg">
                    <button className="w-full text-left p-2 flex items-start gap-2" onClick={() => setOpenQ(openQ === i ? null : i)}>
                      <span className="chip bg-brand-50 text-brand-700 shrink-0 mt-0.5">{q.bab || i + 1}</span>
                      <span className="text-[12px] leading-snug flex-1">{q.question}</span>
                      {openQ === i ? <ChevronUp size={13} className="text-ink-400 shrink-0" /> : <ChevronDown size={13} className="text-ink-400 shrink-0" />}
                    </button>
                    {openQ === i && (
                      <div className="px-2 pb-2 text-[11px] text-ink-500">
                        <div className="italic mb-1">Mengapa ditanya: {q.why}</div>
                        <div className="font-semibold text-ink-600 mb-0.5">Poin jawaban:</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {(q.answerPoints || []).map((p: string, j: number) => (
                            <li key={j}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {review && (
            <div className="space-y-2">
              <div className="text-[13px] text-ink-700 bg-ink-50 rounded-lg p-2.5">{review.summary}</div>
              {review.issues.map((it: any, i: number) => (
                <button
                  key={i}
                  className="w-full text-left border border-ink-100 rounded-lg p-2.5 hover:bg-ink-50"
                  onClick={() => it.sectionId && onJump(it.sectionId)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`chip ${sevCls[it.severity] ?? "bg-ink-100 text-ink-600"}`}>{it.severity}</span>
                    <span className="text-[11px] font-semibold text-ink-500">{it.category}</span>
                  </div>
                  <div className="text-[13px] mt-1.5">{it.message}</div>
                  {it.suggestion && <div className="text-[11px] text-ink-500 mt-1">💡 {it.suggestion}</div>}
                </button>
              ))}
              {review.issues.length === 0 && <div className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={15} /> Tidak ada temuan.</div>}
            </div>
          )}

          {citeResult && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <span className="chip bg-emerald-100 text-emerald-700">{citeResult.verified} verified</span>
                <span className="chip bg-amber-100 text-amber-700">{citeResult.metadataOnly} partial</span>
                <span className="chip bg-rose-100 text-rose-700">{citeResult.notFound} not found</span>
                <span className="chip bg-ink-100 text-ink-500">{citeResult.total} total</span>
              </div>
              {citeResult.results.map((r: any, i: number) => {
                const Icon = r.status === "VERIFIED_METADATA" ? CheckCircle2 : r.status === "NOT_FOUND" ? XCircle : AlertTriangle;
                const cls = r.status === "VERIFIED_METADATA" ? "text-emerald-600" : r.status === "NOT_FOUND" ? "text-rose-600" : "text-amber-600";
                return (
                  <div key={i} className="border border-ink-100 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className={cls} />
                      <code className="text-[12px] font-semibold">{r.candidate.raw}</code>
                    </div>
                    {r.matchedTitle && <div className="text-[12px] text-ink-600 mt-1 line-clamp-2">{r.matchedTitle}</div>}
                    {r.note && <div className="text-[11px] text-ink-500 mt-0.5">{r.note}</div>}
                    {r.url && (
                      <a className="text-[11px] text-brand-600 inline-flex items-center gap-1 mt-1 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={11} /> Buka bukti (DOI)
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Konsistensi inline ↔ daftar pustaka */}
          {citeResult?.consistency && (
            <div className="border border-ink-100 rounded-lg p-2.5 space-y-2">
              <div className="text-[12px] font-semibold">Konsistensi Sitasi (inline ↔ Daftar Pustaka)</div>
              {citeResult.consistency.isIeee && citeResult.consistency.ieeeOutOfRange.length > 0 && (
                <div className="text-[11px] text-rose-700 bg-rose-50 rounded p-2">
                  Nomor referensi di luar rentang daftar pustaka: {citeResult.consistency.ieeeOutOfRange.join(", ")}
                </div>
              )}
              {citeResult.consistency.missingInRefList.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold text-rose-700 mb-1">
                    ⚠️ Dikutip di body, tapi tidak ada di Daftar Pustaka ({citeResult.consistency.missingInRefList.length})
                  </div>
                  {citeResult.consistency.missingInRefList.map((x: any, i: number) => (
                    <div key={i} className="text-[12px] py-0.5">
                      <code>{x.raw}</code> <span className="text-ink-400">— {x.author}, {x.year}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Semua sitasi body ada di Daftar Pustaka.
                </div>
              )}
              {citeResult.consistency.uncitedInBody.length > 0 ? (
                <div>
                  <div className="text-[11px] font-semibold text-amber-700 mb-1">
                    Di Daftar Pustaka tapi tak pernah dikutip di body ({citeResult.consistency.uncitedInBody.length})
                  </div>
                  {citeResult.consistency.uncitedInBody.map((x: any, i: number) => (
                    <div key={i} className="text-[11px] text-ink-600 py-0.5 line-clamp-1">{x.entry}</div>
                  ))}
                </div>
              ) : (
                citeResult.consistency.totalRefEntries > 0 && (
                  <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Semua entri Daftar Pustaka dikutip di body.
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
