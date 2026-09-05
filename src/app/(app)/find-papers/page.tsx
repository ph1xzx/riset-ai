"use client";
import { useEffect, useState } from "react";
import TaskOverlay, { useTask } from "@/components/TaskOverlay";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bookmark, ExternalLink, Loader2, BookMarked } from "lucide-react";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  doi: string | null;
  abstract: string;
  url: string;
  pdfUrl: string;
  citationCount: number;
  openAccess: boolean;
  provider: string;
};

export default function FindPapersPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  // default: 5 tahun terakhir dari tahun berjalan
  const CUR_YEAR = new Date().getFullYear();
  const [yearFrom, setYearFrom] = useState(String(CUR_YEAR - 5));
  const [yearTo, setYearTo] = useState(String(CUR_YEAR));
  const [minCit, setMinCit] = useState("");
  const [oaOnly, setOaOnly] = useState(false);
  const [preprint, setPreprint] = useState(true);
  const [busy, setBusy] = useState(false);
  const task = useTask();
  const [results, setResults] = useState<Paper[]>([]);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState("");

  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  useEffect(() => {
    fetch("/api/projects")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Proyek belum bisa dimuat.");
        return j;
      })
      .then((j) => {
        if (Array.isArray(j)) {
          const next = j.map((p: any) => ({ id: p.id, title: p.title }));
          setProjects(next);
          if (next.length) setProjectId(next[0].id);
        }
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  async function search() {
    if (!q.trim() || !projectId) {
      if (!projectId) setErr("Belum ada proyek. Buka dashboard untuk membuat proyek dulu.");
      return;
    }
    setBusy(true);
    setErr("");
    task.start("Scan paper", q, "Menyusun query pencarian…", true);
    try {
      const p = new URLSearchParams({ q, limit: "15" });
      if (yearFrom) p.set("yearFrom", yearFrom);
      if (yearTo) p.set("yearTo", yearTo);
      if (minCit) p.set("minCitations", minCit);
      if (oaOnly) p.set("openAccess", "1");
      if (!preprint) p.set("preprint", "0");
      task.log("Menghubungi OpenAlex, lalu memindai paper yang cocok…");
      const res = await fetch(`/api/papers/search?${p}`, { signal: task.signal() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log(`${j.results?.length || 0} paper ditemukan.`);
      setResults(j.results);
      setSearched(true);
    } catch (e: any) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      task.stop();
      setBusy(false);
    }
  }

  async function save(p: Paper) {
    if (!projectId || savingId) return;
    setSavingId(p.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicId: p.id, provider: p.provider }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Paper belum bisa disimpan.");
      setSaved((s) => ({ ...s, [p.id]: true }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {task.task && <TaskOverlay task={task.task} onCancel={task.cancel} />}
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Find Papers</h1>
        <p className="text-sm text-ink-500 mt-1">
          Pencarian 200M+ paper via <b>OpenAlex + Crossref</b> (gratis, tanpa key). Simpan ke Library proyek →
          sumber itu yang boleh dipakai AI untuk sitasi (citation safety).
        </p>
      </div>

      <div className="card p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 border border-ink-200 rounded-lg px-3">
            <Search size={16} className="text-ink-400" />
            <input
              className="flex-1 py-2.5 text-sm focus:outline-none"
              placeholder="Cari topik, pertanyaan, atau tempel satu kalimat dari draft-mu…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
          </div>
          <button className="btn-primary justify-center" onClick={search} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Cari
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 items-center text-sm">
          <label className="flex items-center gap-1.5">
            <input className="input w-16" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
            –
            <input className="input w-16" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-ink-600">
            Min. sitasi <input className="input w-16" value={minCit} onChange={(e) => setMinCit(e.target.value)} placeholder="0" />
          </label>
          <label className="flex items-center gap-1.5 text-ink-600">
            <input type="checkbox" checked={oaOnly} onChange={(e) => setOaOnly(e.target.checked)} /> Open access
          </label>
          <label className="flex items-center gap-1.5 text-ink-600">
            <input type="checkbox" checked={preprint} onChange={(e) => setPreprint(e.target.checked)} /> Include preprint
          </label>
          <label className="text-xs text-ink-500 ml-auto flex items-center gap-2">
            Simpan ke
            <select className="input !w-auto min-w-48" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!projects.length} aria-label="Proyek tujuan penyimpanan">
              {projects.length ? projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>) : <option value="">Belum ada proyek</option>}
            </select>
          </label>
        </div>
      </div>

      {err && <div className="text-sm text-rose-600 mb-4">{err}</div>}

      {searched && results.length === 0 && !busy && (
        <div className="card p-10 text-center text-ink-500 text-sm">Tidak ada hasil. Coba kata kunci lain.</div>
      )}

      <div className="space-y-3">
        {results.map((p) => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-[15px] leading-snug">
                  {p.title}{" "}
                  {p.openAccess && <span className="chip bg-emerald-100 text-emerald-700 align-middle">OA</span>}
                  {p.provider === "crossref" && <span className="chip bg-ink-100 text-ink-500 align-middle">crossref</span>}
                </div>
                <div className="text-xs text-ink-500 mt-1">
                  {p.authors.slice(0, 4).join(", ")}{p.authors.length > 4 ? " et al." : ""} • {p.journal || "s.t."} •{" "}
                  {p.year ?? "s.t."} • {p.citationCount} sitasi
                </div>
                {p.abstract && <div className="text-sm text-ink-600 mt-2 line-clamp-2">{p.abstract}</div>}
              </div>
              <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                <button
                  className={saved[p.id] ? "btn-primary" : "btn-outline"}
                  onClick={() => save(p)}
                  disabled={saved[p.id] || !projectId || savingId === p.id}
                >
                  {savingId === p.id ? <Loader2 size={14} className="animate-spin" /> : saved[p.id] ? <BookMarked size={14} /> : <Bookmark size={14} />}
                  {saved[p.id] ? "Tersimpan" : "Simpan"}
                </button>
                {p.doi && (
                  <a className="btn-ghost justify-center" href={p.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> DOI
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!searched && (
        <div className="card p-10 text-center text-sm text-ink-400">
          Contoh: <em>“decision support e-wallet TOPSIS”</em>, <em>“early disease detection machine learning”</em>,
          atau tempel satu kalimat dari latar belakangmu.
          {projectId ? (
            <>
              {" "}
              <Link className="text-brand-600 underline" href={`/projects/${projectId}`}>
                Buka proyek
              </Link>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
