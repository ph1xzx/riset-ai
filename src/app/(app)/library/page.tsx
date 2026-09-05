"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Trash2, FileSearch, Loader2 } from "lucide-react";

type Source = {
  id: string;
  projectId: string;
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  doi: string | null;
  abstract: string;
  url: string;
  citationCount: number;
  openAccess: boolean;
  provider: string;
  addedAt: string;
};

export default function LibraryPage() {
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");

  const parseAuthors = (value: string) => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed.slice(0, 3).join(", ") : "";
    } catch {
      return value || "";
    }
  };

  useEffect(() => {
    setLoadingProjects(true);
    fetch("/api/projects")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Proyek belum bisa dimuat.");
        return j;
      })
      .then((j) => {
        const next = Array.isArray(j) ? j.map((p: any) => ({ id: p.id, title: p.title })) : [];
        setProjects(next);
        setProjectId((current) => current || next[0]?.id || "");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoadingSources(true);
    setError("");
    fetch(`/api/projects/${projectId}/sources`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Sumber belum bisa dimuat.");
        return j;
      })
      .then((j) => setSources(Array.isArray(j) ? j : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingSources(false));
  }, [projectId]);

  async function del(id: string) {
    if (!confirm("Hapus sumber ini dari library?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Sumber belum bisa dihapus.");
      setSources((s) => s.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting("");
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-sm text-ink-500 mt-1">
            Sumber terverifikasi per proyek, satu-satunya sumber yang boleh disitasi AI.
          </p>
        </div>
        <Link href="/find-papers" className="btn-outline">
          <FileSearch size={15} /> Find Papers
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div>}

      {loadingProjects ? (
        <div className="card p-8 text-center text-sm text-ink-400"><Loader2 className="mx-auto mb-2 animate-spin" size={18} />Memuat proyek…</div>
      ) : projects.length > 0 ? (
        <select className="input mb-4 max-w-xs" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Pilih proyek">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      ) : null}

      {loadingSources ? (
        <div className="card p-8 text-center text-sm text-ink-400"><Loader2 className="mx-auto mb-2 animate-spin" size={18} />Memuat sumber…</div>
      ) : !projects.length ? (
        <div className="card p-10 text-center text-sm text-ink-500">
          Belum ada proyek. <Link className="text-brand-600 underline" href="/new">Buat proyek pertama</Link> untuk mulai mengumpulkan sumber.
        </div>
      ) : sources.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-400">
          Belum ada sumber. Cari paper di <Link className="text-brand-600 underline" href="/find-papers">Find Papers</Link>.
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-[15px] line-clamp-1">{s.title}</div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {parseAuthors(s.authors)} • {s.journal || "s.t."} • {s.year ?? "s.t."} • {s.citationCount} sitasi • via {s.provider}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {s.doi && (
                  <a className="btn-ghost !px-2" href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer" aria-label={`Buka DOI ${s.title}`}>
                    <ExternalLink size={14} />
                  </a>
                )}
                <button className="btn-ghost !px-2 text-rose-600" onClick={() => del(s.id)} disabled={deleting === s.id} aria-label={`Hapus ${s.title}`}>
                  {deleting === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
