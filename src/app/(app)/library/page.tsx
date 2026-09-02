"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Trash2, FileSearch } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => {
      if (Array.isArray(j)) {
        setProjects(j.map((p: any) => ({ id: p.id, title: p.title })));
        if (j.length) setProjectId(j[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/sources`).then((r) => r.json()).then(setSources).catch(() => {});
  }, [projectId]);

  async function del(id: string) {
    if (!confirm("Hapus sumber ini dari library?")) return;
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    setSources((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-sm text-ink-500 mt-1">
            Sumber terverifikasi per proyek — satu-satunya sumber yang boleh disitasi AI (citation safety).
          </p>
        </div>
        <Link href="/find-papers" className="btn-outline">
          <FileSearch size={15} /> Find Papers
        </Link>
      </div>

      {projects.length > 0 && (
        <select className="input mb-4 max-w-xs" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}

      {sources.length === 0 ? (
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
                  {JSON.parse(s.authors || "[]").slice(0, 3).join(", ")} • {s.journal || "s.t."} • {s.year ?? "s.t."} •{" "}
                  {s.citationCount} sitasi • via {s.provider}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {s.doi && (
                  <a className="btn-ghost !px-2" href={s.doi ? `https://doi.org/${s.doi}` : s.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} />
                  </a>
                )}
                <button className="btn-ghost !px-2 text-rose-600" onClick={() => del(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
