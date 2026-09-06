"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Editor } from "./Editor";
import {
  Download, FileText, Plus, Trash2, Loader2, Sparkles, Wand2, RefreshCw, MessageSquare,
  ShieldCheck, BookOpen, Image as ImageIcon, ScanLine, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, Paperclip, Search, ChevronDown, FileDown, FileOutput, GitCompareArrows,
  Table2, Type, FlaskConical, Send,
} from "lucide-react";

interface Section {
  id: string; title: string; order: number; level: number; content: string;
  status: string; parentId: string | null;
}
interface Source {
  id: string; title: string; authors: string[]; year: number | null; journal: string;
  doi: string; abstract: string; url: string; citationCount: number | null;
  openAccess: boolean; provider: string; verified: string;
}

export function Workspace({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{ project: any; sections: Section[]; sources: Source[] } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"ai" | "cite" | "image" | "scan">("ai");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [evidence, setEvidence] = useState<Source | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busyTop, setBusyTop] = useState<string | null>(null);

  const notify = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return;
    const j = await res.json();
    setData({ project: j, sections: j.sections || [], sources: j.sources || [] });
    setActiveId((cur) => cur || (j.sections?.[0]?.id ?? null));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () => data?.sections.find((s) => s.id === activeId) || null,
    [data, activeId]
  );

  async function addSection() {
    if (!newTitle.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), level: 2, afterSectionId: activeId || undefined }),
    });
    if (res.ok) {
      const s = await res.json();
      setAddingSection(false);
      setNewTitle("");
      setActiveId(s.id);
      load();
    } else {
      notify((await res.json()).error || "Gagal menambah section", "err");
    }
  }

  async function deleteSection(id: string) {
    if (!confirm("Hapus section ini?")) return;
    await fetch(`/api/sections/${id}`, { method: "DELETE" });
    load();
  }

  async function exportFile(kind: "docx" | "pdf") {
    setBusyTop(kind);
    notify("Membuat file…");
    try {
      const res = await fetch(`/api/projects/${projectId}/export${kind === "pdf" ? "-pdf" : ""}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error || "Export gagal");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `riset-ai-${kind}.tmp`;
      a.click();
      URL.revokeObjectURL(a.href);
      notify(`${kind.toUpperCase()} diunduh ✓`);
    } catch (e: any) {
      notify(e.message, "err");
    } finally {
      setBusyTop(null);
    }
  }

  async function runUtil(name: "format-tables" | "english-italicize" | "roundtrip-audit") {
    setBusyTop(name);
    try {
      const res = await fetch(`/api/projects/${projectId}/${name}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal");
      if (name === "roundtrip-audit") {
        notify(j.verdict || "Audit selesai", j.ok === false ? "err" : "ok");
      } else {
        notify(`${name} — ${j.sectionsChanged} section diubah`);
        load();
      }
    } catch (e: any) {
      notify(e.message, "err");
    } finally {
      setBusyTop(null);
    }
  }

  if (!data) {
    return <div className="p-8 text-[13px] text-ink-400">Memuat workspace…</div>;
  }

  const counts = data.sections.reduce((acc, s) => {
    acc.total++;
    if (s.status === "APPROVED") acc.approved++;
    if (s.content.trim()) acc.filled++;
    return acc;
  }, { total: 0, filled: 0, approved: 0 });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-ink-200 px-3 sm:px-4 py-2 flex items-center gap-3">
        <Link href="/dashboard" className="text-[12px] text-ink-500 hover:text-ink-900 shrink-0">← Proyek</Link>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate" title={data.project.title}>{data.project.title}</div>
          <div className="text-[10px] font-mono text-ink-400">
            {counts.filled}/{counts.total} section terisi · {counts.approved} approved · {data.sources.length} sumber · {data.project.citationStyle}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button className="btn-ghost !h-8 !text-[12px]" onClick={() => runUtil("format-tables")} disabled={busyTop === "format-tables"} title="Normalisasi tabel">
            <Table2 size={13} /> Tabel
          </button>
          <button className="btn-ghost !h-8 !text-[12px]" onClick={() => runUtil("english-italicize")} disabled={busyTop === "english-italicize"} title="Italic-kan istilah Inggris">
            <Type size={13} /> Italic
          </button>
          <button className="btn-ghost !h-8 !text-[12px] hidden sm:inline-flex" onClick={() => runUtil("roundtrip-audit")} disabled={busyTop === "roundtrip-audit"} title="Audit roundtrip export→import">
            <GitCompareArrows size={13} /> Audit
          </button>
          <span className="w-px h-5 bg-ink-200" />
          <button className="btn-outline !h-8 !text-[12px]" onClick={() => exportFile("docx")} disabled={!!busyTop}>
            {busyTop === "docx" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} DOCX
          </button>
          <button className="btn-primary !h-8 !text-[12px]" onClick={() => exportFile("pdf")} disabled={!!busyTop}>
            {busyTop === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <FileOutput size={13} />} PDF
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Section tree */}
        <aside className="w-60 lg:w-72 shrink-0 bg-white border-r border-ink-200 flex flex-col">
          <div className="flex items-center justify-between px-3 h-10 border-b border-ink-100">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">Sections ({data.sections.length})</span>
            <button className="text-ink-400 hover:text-ink-900" onClick={() => setAddingSection(true)} title="Tambah section">
              <Plus size={14} />
            </button>
          </div>
          {addingSection && (
            <div className="px-2 py-2 border-b border-ink-100 flex gap-1">
              <input className="input !h-7 !text-[11px]" placeholder="Judul section…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSection()} autoFocus />
              <button className="btn-primary !h-7 !px-2" onClick={addSection}>OK</button>
            </div>
          )}
          <div className="flex-1 overflow-auto thin-scroll py-1">
            {data.sections.map((s) => (
              <div key={s.id} className="group flex items-center">
                <button
                  onClick={() => setActiveId(s.id)}
                  className={`flex-1 text-left px-3 py-1.5 text-[12px] truncate border-l-2 ${
                    activeId === s.id ? "border-ink-900 bg-ink-50 font-medium" : "border-transparent text-ink-600 hover:bg-ink-50"
                  }`}
                  style={{ paddingLeft: 12 + (s.level - 1) * 12 }}
                  title={s.title}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                    s.status === "APPROVED" ? "bg-ink-900" : s.status === "USER_EDITED" ? "bg-emerald-500" : s.status === "AI_DRAFT" ? "bg-blue-500" : s.status === "DRAFTING" ? "bg-amber-500" : "bg-ink-200"
                  }`} />
                  {s.title}
                </button>
                <button className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-600 px-2" onClick={() => deleteSection(s.id)} title="Hapus">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Editor */}
        <section className="flex-1 min-w-0 flex flex-col border-r border-ink-200">
          {active ? (
            <>
              <div className="shrink-0 px-4 py-2 bg-white border-b border-ink-100 flex items-center gap-2">
                <FileText size={13} className="text-ink-400" />
                <span className="text-[12px] font-medium truncate">{active.title}</span>
                <span className={`ml-auto text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                  active.status === "APPROVED" ? "bg-ink-900 text-white" :
                  active.status === "USER_EDITED" ? "bg-emerald-100 text-emerald-700" :
                  active.status === "AI_DRAFT" ? "bg-blue-100 text-blue-700" :
                  active.status === "DRAFTING" ? "bg-amber-100 text-amber-700" : "bg-ink-100 text-ink-500"
                }`}>{active.status}</span>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  key={active.id}
                  projectId={projectId}
                  sectionId={active.id}
                  initialHtml={active.content}
                  initialStatus={active.status}
                  sources={data.sources}
                  onCitationClick={(id) => {
                    const src = data.sources.find((s) => s.id === id);
                    setEvidence(src || null);
                    setTab("cite");
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[13px] text-ink-400">Pilih section di kiri.</div>
          )}
        </section>

        {/* Right panel */}
        <aside className="w-80 lg:w-96 shrink-0 bg-white flex flex-col">
          <div className="shrink-0 flex border-b border-ink-200">
            {([
              ["ai", "AI", Sparkles],
              ["cite", "Sitasi", BookOpen],
              ["image", "Gambar", ImageIcon],
              ["scan", "Scan", ScanLine],
            ] as const).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 h-10 text-[11px] font-medium flex items-center justify-center gap-1.5 border-b-2 -mb-px ${
                  tab === k ? "border-ink-900 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto thin-scroll p-3">
            {tab === "ai" && <AiPanel projectId={projectId} section={active} onToast={notify} onReload={load} />}
            {tab === "cite" && <CitePanel projectId={projectId} sources={data.sources} evidence={evidence} onToast={notify} onReload={load} onClearEvidence={() => setEvidence(null)} />}
            {tab === "image" && <ImagePanel projectId={projectId} section={active} onToast={notify} onInsertImage={(url) => {
              if (active) {
                const res = fetch(`/api/sections/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: active.content + `\n<p><img src="${url}" /></p>` }) });
                res.then(() => load());
              }
            }} />}
            {tab === "scan" && <ScanPanel projectId={projectId} section={active} onToast={notify} onReload={load} />}
          </div>
        </aside>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-[12px] font-medium flex items-center gap-2 max-w-sm ${
          toast.kind === "ok" ? "bg-ink-900 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ================= AI Panel ================= */

function AiPanel({ projectId, section, onToast, onReload }: { projectId: string; section: Section | null; onToast: (m: string, k?: "ok" | "err") => void; onReload: () => void }) {
  const [mode, setMode] = useState<"generate" | "edit" | "paraphrase" | "chat" | "defense">("generate");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState("");
  const [editSel, setEditSel] = useState("");
  const [editCmd, setEditCmd] = useState("");
  const [editResult, setEditResult] = useState<{ before: string; after: string } | null>(null);
  const [chatHist, setChatHist] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [defenseInput, setDefenseInput] = useState("");
  const [defense, setDefense] = useState<{ q: string; a: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function runGenerate() {
    if (!section) return;
    setBusy(true);
    setStream("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id, prompt }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.json()).error || "Gagal");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          let j: any;
          try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (j.type === "token") setStream((s) => s + j.t);
          else if (j.type === "done") {
            onToast(j.rejectedTokens ? `Draf dibuat — ${j.rejectedTokens} sitasi fiktif DITOLAK backend.` : `Draf AI dibuat (${j.wordCount} kata).`);
            onReload();
          } else if (j.type === "error") {
            throw new Error(j.error);
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") onToast(e.message, "err");
    } finally {
      setBusy(false);
      setStream("");
    }
  }

  async function runEdit() {
    if (!section || !editSel.trim()) return;
    setBusy(true);
    setEditResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id, selection: editSel, command: editCmd || "Parafrase agar lebih formal" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "AI edit gagal");
      setEditResult({ before: editSel, after: j.result });
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function applyEdit() {
    if (!section || !editResult) return;
    // Replace first occurrence of `before` with `after` in the section content
    const res = await fetch(`/api/sections/${section.id}`);
    const cur = await res.json();
    const next = cur.content.replace(editResult.before, () => editResult.after.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    await fetch(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: next, status: "USER_EDITED" }),
    });
    setEditResult(null);
    onToast("Edit diterapkan.");
    onReload();
  }

  async function runParaphrase() {
    if (!section) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/paraphrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Parafrase gagal");
      onToast(`Diparafrase — ${j.citationsKept} sitasi dipertahankan.`);
      onReload();
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChatInput("");
    setBusy(true);
    const hist = [...chatHist, { role: "user", content: q }];
    setChatHist(hist);
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: hist }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Chat gagal");
      setChatHist((h) => [...h, { role: "assistant", content: j.answer }]);
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function sendDefense() {
    const q = defenseInput.trim() || "Apa kelemahan terbesar dari penelitian ini?";
    setDefenseInput("");
    setBusy(true);
    const entry = { q, a: "" };
    setDefense((d) => [...d, entry]);
    try {
      const res = await fetch(`/api/projects/${projectId}/defense-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal");
      setDefense((d) => d.map((x) => (x === entry ? { ...x, a: j.answer } : x)));
    } catch (e: any) {
      setDefense((d) => d.map((x) => (x === entry ? { ...x, a: "Gagal: " + e.message } : x)));
    } finally {
      setBusy(false);
    }
  }

  const ModeBtn = ({ k, label, Icon }: any) => (
    <button onClick={() => setMode(k)} className={`chip cursor-pointer ${mode === k ? "!bg-ink-900 !text-white !border-ink-900" : ""}`}>
      <Icon size={10} /> {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <ModeBtn k="generate" label="Generate" Icon={Wand2} />
        <ModeBtn k="edit" label="AI Edit" Icon={RefreshCw} />
        <ModeBtn k="paraphrase" label="Parafrase" Icon={RefreshCw} />
        <ModeBtn k="chat" label="Chat" Icon={MessageSquare} />
        <ModeBtn k="defense" label="Sidang" Icon={FlaskConical} />
      </div>

      {mode === "generate" && (
        <div className="space-y-2">
          <textarea className="textarea !text-[12px]" rows={2} placeholder="Instruksi opsional (mis. tekankan orisinalitas, tambah contoh…)" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy} />
          {busy && (
            <div className="border border-ink-200 rounded-md p-3 bg-ink-50/50 max-h-64 overflow-auto thin-scroll">
              <div className="text-[11px] font-mono text-ink-500 whitespace-pre-wrap">{stream}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-ink-400"><Loader2 size={11} className="animate-spin" /> DRAFTING…</div>
            </div>
          )}
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={runGenerate} disabled={busy || !section}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} {section?.status === "AI_DRAFT" ? "Regenerate section" : "Generate section"}
          </button>
        </div>
      )}

      {mode === "edit" && (
        <div className="space-y-2">
          <textarea className="textarea !text-[12px]" rows={3} placeholder="Salin (pilih) teks dari editor ke sini…" value={editSel} onChange={(e) => setEditSel(e.target.value)} />
          <input className="input !h-8 !text-[12px]" placeholder="Perintah (mis. singkat 30%, resmikan, perbaiki grammar)" value={editCmd} onChange={(e) => setEditCmd(e.target.value)} />
          {editResult && (
            <div className="space-y-1.5">
              <div className="text-[11px] border border-red-100 bg-red-50 rounded p-2"><span className="diff-del">{editResult.before.slice(0, 400)}</span></div>
              <div className="text-[11px] border border-emerald-100 bg-emerald-50 rounded p-2"><span className="diff-add">{editResult.after.slice(0, 600)}</span></div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1 !h-7 !text-[11px]" onClick={applyEdit}><CheckCircle2 size={12} /> Terapkan</button>
                <button className="btn-ghost !h-7 !text-[11px]" onClick={() => setEditResult(null)}>Batal</button>
              </div>
            </div>
          )}
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={runEdit} disabled={busy || !editSel.trim() || !section}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} AI Edit
          </button>
        </div>
      )}

      {mode === "paraphrase" && (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-500">Tulis ulang seluruh section dengan diksi berbeda — makna, data, dan sitasi dipertahankan.</p>
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={runParaphrase} disabled={busy || !section}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Parafrase section
          </button>
        </div>
      )}

      {mode === "chat" && (
        <div className="space-y-2">
          <div className="max-h-72 overflow-auto thin-scroll space-y-2">
            {chatHist.length === 0 && <div className="text-[11px] text-ink-400">Tanya apa saja soal dokumen ini.</div>}
            {chatHist.map((m, i) => (
              <div key={i} className={`text-[12px] rounded-lg px-3 py-2 ${m.role === "user" ? "bg-ink-900 text-white ml-6" : "bg-ink-50 border border-ink-100 mr-6"}`}>
                {m.content}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input className="input !h-8 !text-[12px]" placeholder="Pertanyaan…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <button className="btn-primary !h-8 !px-2.5" onClick={sendChat} disabled={busy}><Send size={13} /></button>
          </div>
        </div>
      )}

      {mode === "defense" && (
        <div className="space-y-2">
          <div className="max-h-72 overflow-auto thin-scroll space-y-2">
            {defense.length === 0 && <div className="text-[11px] text-ink-400">Latihan sidang: model berperan sebagai penguji.</div>}
            {defense.map((d, i) => (
              <div key={i} className="space-y-1">
                <div className="text-[11px] font-medium bg-ink-100 rounded px-2 py-1.5">🎓 Penguji: {d.q}</div>
                <div className="text-[12px] bg-white border border-ink-100 rounded px-2 py-1.5 whitespace-pre-wrap">{d.a || "…"}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input className="input !h-8 !text-[12px]" placeholder="Pertanyaan (kosongkan = acak)…" value={defenseInput} onChange={(e) => setDefenseInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendDefense()} />
            <button className="btn-primary !h-8 !px-2.5" onClick={sendDefense} disabled={busy}><Send size={13} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Cite Panel ================= */

function CitePanel({ projectId, sources, evidence, onToast, onReload, onClearEvidence }: {
  projectId: string; sources: Source[]; evidence: Source | null;
  onToast: (m: string, k?: "ok" | "err") => void; onReload: () => void; onClearEvidence: () => void;
}) {
  const [sub, setSub] = useState<"library" | "add" | "scan" | "check">("library");
  const [newSrc, setNewSrc] = useState({ title: "", authors: "", year: "", doi: "", url: "", journal: "" });
  const [busy, setBusy] = useState(false);
  const [scanRes, setScanRes] = useState<any>(null);
  const [checkRes, setCheckRes] = useState<any>(null);

  async function addSource(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newSrc.title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSrc.title,
          authors: newSrc.authors.split(",").map((s) => s.trim()).filter(Boolean),
          year: newSrc.year ? Number(newSrc.year) : null,
          doi: newSrc.doi, url: newSrc.url, journal: newSrc.journal,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan sumber");
      onToast(`Sumber disimpan — verifikasi: ${j.verified}`);
      setNewSrc({ title: "", authors: "", year: "", doi: "", url: "", journal: "" });
      onReload();
    } catch (e2: any) {
      onToast(e2.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function runScan() {
    setBusy(true);
    setScanRes(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/citation-scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "all" }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Scan gagal");
      setScanRes(j);
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function insertOpportunity(op: any) {
    if (!op.sourceId) return;
    const src = sources.find((s) => s.id === op.sourceId);
    if (!src) return;
    onToast("Buka section terkait lalu sisipkan sitasi lewat toolbar 'Sitasi'.");
  }

  async function runCheck() {
    setBusy(true);
    setCheckRes(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/citation-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Check gagal");
      setCheckRes(j);
      onReload();
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function repair() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/citation-repair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Repair gagal");
      onToast(j.message || `${(j.repairs || []).length} sumber diperbaiki.`);
      setCheckRes(null);
      onReload();
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  const VerifiedBadge = ({ v }: { v: string }) =>
    v === "VERIFIED" ? (
      <span className="chip !border-emerald-200 !text-emerald-700"><ShieldCheck size={9} /> VERIFIED</span>
    ) : v === "NOT_FOUND" ? (
      <span className="chip !border-red-200 !text-red-600"><XCircle size={9} /> NOT_FOUND</span>
    ) : (
      <span className="chip">METADATA</span>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {([["library", "Library"], ["add", "Tambah"], ["scan", "Scan"], ["check", "Cek"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`chip cursor-pointer ${sub === k ? "!bg-ink-900 !text-white !border-ink-900" : ""}`}>{l}</button>
        ))}
      </div>

      {sub === "library" && (
        <div className="space-y-2">
          {sources.length === 0 && <div className="text-[12px] text-ink-400">Belum ada sumber. AI tidak akan menyitasi apa pun (citation safety).</div>}
          {sources.map((s) => (
            <div key={s.id} className="border border-ink-100 rounded-md p-2.5 hover:border-ink-300">
              <div className="text-[12px] font-medium leading-snug">{s.title}</div>
              <div className="text-[10px] text-ink-500 mt-1">
                {s.authors.slice(0, 2).join(", ")}{s.authors.length > 2 ? " et al." : ""}{s.year ? `, ${s.year}` : ""}{s.journal ? ` · ${s.journal}` : ""}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <VerifiedBadge v={s.verified} />
                {s.doi && <span className="chip">DOI</span>}
                {s.citationCount != null && <span className="chip">{s.citationCount} sitasi</span>}
                <div className="ml-auto flex gap-1">
                  {s.url && <a className="text-ink-400 hover:text-ink-900" href={s.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a>}
                  <button className="text-ink-300 hover:text-red-600" onClick={async () => { await fetch(`/api/sources/${s.id}`, { method: "DELETE" }); onReload(); }}><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === "add" && (
        <form onSubmit={addSource} className="space-y-2">
          <input className="input !h-8 !text-[12px]" placeholder="Judul *" value={newSrc.title} onChange={(e) => setNewSrc({ ...newSrc, title: e.target.value })} />
          <input className="input !h-8 !text-[12px]" placeholder="Penulis (pisah koma)" value={newSrc.authors} onChange={(e) => setNewSrc({ ...newSrc, authors: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input !h-8 !text-[12px]" placeholder="Tahun" value={newSrc.year} onChange={(e) => setNewSrc({ ...newSrc, year: e.target.value })} />
            <input className="input !h-8 !text-[12px]" placeholder="DOI" value={newSrc.doi} onChange={(e) => setNewSrc({ ...newSrc, doi: e.target.value })} />
          </div>
          <input className="input !h-8 !text-[12px]" placeholder="Jurnal/Penerbit" value={newSrc.journal} onChange={(e) => setNewSrc({ ...newSrc, journal: e.target.value })} />
          <input className="input !h-8 !text-[12px]" placeholder="URL" value={newSrc.url} onChange={(e) => setNewSrc({ ...newSrc, url: e.target.value })} />
          <p className="text-[10px] text-ink-400">Sumber otomatis diverifikasi ke Crossref (DOI) / OpenAlex (judul).</p>
          <button className="btn-primary w-full !h-8 !text-[12px]" disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Simpan & verifikasi</button>
        </form>
      )}

      {sub === "scan" && (
        <div className="space-y-2">
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={runScan} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />} Scan seluruh dokumen
          </button>
          {scanRes && (
            <div className="space-y-1.5">
              <div className="text-[11px] text-ink-500">{scanRes.scannedCount} section dipindai · {scanRes.opportunities.length} peluang sitasi</div>
              {scanRes.message && <div className="text-[11px] text-ink-400">{scanRes.message}</div>}
              {scanRes.opportunities?.map((op: any, i: number) => (
                <div key={i} className="border border-ink-100 rounded-md p-2">
                  <div className="text-[11px] italic">“{op.quote}”</div>
                  <div className="text-[10px] text-ink-500 mt-1">{op.reason}</div>
                  <div className="mt-1.5">
                    {op.sourceId ? (
                      <button className="chip cursor-pointer !text-emerald-700 !border-emerald-200" onClick={() => insertOpportunity(op)}>
                        + sitasi sumber terduga
                      </button>
                    ) : (
                      <span className="chip">tanpa padanan di library</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sub === "check" && (
        <div className="space-y-2">
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={runCheck} disabled={busy}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Verifikasi semua sumber
          </button>
          {checkRes && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-emerald-100 bg-emerald-50 rounded p-2"><div className="text-[16px] font-bold text-emerald-700">{checkRes.verified}</div><div className="text-[9px] font-mono uppercase text-emerald-600">verified</div></div>
                <div className="border border-ink-100 bg-ink-50 rounded p-2"><div className="text-[16px] font-bold">{checkRes.metadataOnly}</div><div className="text-[9px] font-mono uppercase text-ink-500">metadata</div></div>
                <div className="border border-red-100 bg-red-50 rounded p-2"><div className="text-[16px] font-bold text-red-600">{checkRes.notFound}</div><div className="text-[9px] font-mono uppercase text-red-500">not found</div></div>
              </div>
              {checkRes.notFound > 0 && (
                <button className="btn-outline w-full !h-8 !text-[12px]" onClick={repair} disabled={busy}>
                  <Wand2 size={13} /> Perbaiki (cari ulang di OpenAlex)
                </button>
              )}
              <div className="space-y-1 max-h-56 overflow-auto thin-scroll">
                {checkRes.results?.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 text-[11px]">
                    {r.verified === "VERIFIED" ? <CheckCircle2 size={12} className="text-emerald-600 shrink-0" /> : r.verified === "NOT_FOUND" ? <XCircle size={12} className="text-red-500 shrink-0" /> : <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                    <span className="truncate">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {evidence && (
        <div className="border-t border-ink-200 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">Bukti sitasi</span>
            <button onClick={onClearEvidence} className="text-ink-400 hover:text-ink-900"><XCircle size={13} /></button>
          </div>
          <div className="card p-3">
            <div className="text-[12px] font-medium">{evidence.title}</div>
            <div className="text-[11px] text-ink-500 mt-1">{evidence.authors.join(", ")}{evidence.year ? ` · ${evidence.year}` : ""}</div>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              <VerifiedBadge v={evidence.verified} />
              {evidence.doi && <a className="chip hover:!border-ink-500" href={`https://doi.org/${evidence.doi}`} target="_blank" rel="noreferrer">DOI: {evidence.doi}</a>}
              {evidence.citationCount != null && <span className="chip">{evidence.citationCount} sitasi</span>}
            </div>
            {evidence.abstract && <p className="text-[11px] text-ink-600 mt-2 leading-relaxed">{evidence.abstract.slice(0, 500)}{evidence.abstract.length > 500 ? "…" : ""}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Image Panel ================= */

function ImagePanel({ projectId, section, onToast, onInsertImage }: {
  projectId: string; section: Section | null;
  onToast: (m: string, k?: "ok" | "err") => void; onInsertImage: (url: string) => void;
}) {
  const [sub, setSub] = useState<"suggest" | "generate" | "logo">("suggest");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [logoQuery, setLogoQuery] = useState("xampp");

  async function runSuggest() {
    if (!section) return;
    setBusy(true);
    setSuggestions(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/figure-suggestions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal");
      setSuggestions(j.suggestions || []);
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function runGenerate(p: string) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/images/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal generate");
      setResult({ url: j.url });
      onToast("Gambar siap — sisipkan ke section.");
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function runLogo() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/images/fetch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: logoQuery }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal");
      setResult({ url: j.url });
      onToast("Logo diambil dari web (tanpa key).");
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {([["suggest", "Saran"], ["generate", "Generate"], ["logo", "Logo Tool"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`chip cursor-pointer ${sub === k ? "!bg-ink-900 !text-white !border-ink-900" : ""}`}>{l}</button>
        ))}
      </div>

      {sub === "suggest" && (
        <div className="space-y-2">
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={runSuggest} disabled={busy || !section}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} Saran gambar untuk section ini
          </button>
          {suggestions?.map((s, i) => (
            <div key={i} className="border border-ink-100 rounded-md p-2.5">
              <div className="text-[12px] font-medium">{s.caption}</div>
              <div className="text-[10px] text-ink-500 mt-0.5">{s.reason}</div>
              <button className="btn-outline !h-7 !text-[11px] mt-2" onClick={() => runGenerate(s.prompt)} disabled={busy}>
                <ImageIcon size={11} /> Generate
              </button>
            </div>
          ))}
        </div>
      )}

      {sub === "generate" && (
        <div className="space-y-2">
          <textarea className="textarea !text-[12px]" rows={3} placeholder="Deskripsi gambar (mis. 'black-and-white block diagram of a web-based decision support system with Admin, API, engine, database…')" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className="btn-primary w-full !h-8 !text-[12px]" onClick={() => runGenerate(prompt)} disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} Generate gambar
          </button>
          {result && (
            <div className="space-y-2">
              <img src={result.url} alt="hasil" className="w-full rounded-md border border-ink-200" />
              <button className="btn-outline w-full !h-8 !text-[12px]" onClick={() => onInsertImage(result.url)}>
                <Paperclip size={13} /> Sisipkan ke section aktif
              </button>
            </div>
          )}
        </div>
      )}

      {sub === "logo" && (
        <div className="space-y-2">
          <p className="text-[11px] text-ink-500">Ambil logo tool dari web tanpa API key: xampp, php, vs code, mysql, python, drawio, apache…</p>
          <div className="flex gap-1.5">
            <input className="input !h-8 !text-[12px]" value={logoQuery} onChange={(e) => setLogoQuery(e.target.value)} />
            <button className="btn-primary !h-8 !px-3" onClick={runLogo} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}</button>
          </div>
          {result && (
            <div className="space-y-2">
              <img src={result.url} alt="logo" className="max-w-[140px] rounded-md border border-ink-200 bg-white p-2" />
              <button className="btn-outline w-full !h-8 !text-[12px]" onClick={() => onInsertImage(result.url)}>
                <Paperclip size={13} /> Sisipkan ke section aktif
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Scan Panel ================= */

function ScanPanel({ projectId, section, onToast, onReload }: {
  projectId: string; section: Section | null;
  onToast: (m: string, k?: "ok" | "err") => void; onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [findings, setFindings] = useState<any[] | null>(null);
  const [summary, setSummary] = useState("");

  async function runReview(scope: "section" | "all") {
    setBusy(true);
    setFindings(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope === "section" && section ? { sectionId: section.id } : { scope: "all" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Review gagal");
      setFindings(j.findings || []);
      setSummary(j.summary || "");
      onToast(`${(j.findings || []).length} temuan cek penulisan.`);
    } catch (e: any) {
      onToast(e.message, "err");
    } finally {
      setBusy(false);
    }
  }

  const sevColor: Record<string, string> = {
    high: "border-red-200 bg-red-50",
    medium: "border-amber-200 bg-amber-50",
    low: "border-ink-100 bg-ink-50",
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-ink-500">Cek penulisan: grammar, tone, konsistensi data, struktur.</div>
      <div className="flex gap-1.5">
        <button className="btn-primary flex-1 !h-8 !text-[12px]" onClick={() => runReview("section")} disabled={busy || !section}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />} Section ini
        </button>
        <button className="btn-outline flex-1 !h-8 !text-[12px]" onClick={() => runReview("all")} disabled={busy}>
          Seluruh dokumen
        </button>
      </div>
      {summary && <div className="text-[11px] text-ink-600 border border-ink-100 rounded-md p-2.5">{summary}</div>}
      {findings?.map((f, i) => (
        <div key={i} className={`border rounded-md p-2.5 ${sevColor[f.severity] || "bg-ink-50"}`}>
          <div className="flex items-center gap-2">
            <span className="chip">{f.type}</span>
            <span className="chip">{f.severity}</span>
          </div>
          {f.quote && <div className="text-[11px] italic mt-1.5">“{f.quote}”</div>}
          <div className="text-[11px] mt-1">{f.issue}</div>
          {f.suggestion && <div className="text-[11px] text-emerald-700 mt-1">→ {f.suggestion}</div>}
        </div>
      ))}
    </div>
  );
}
