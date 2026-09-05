"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Upload, BookOpenCheck, Clock, FileText } from "lucide-react";

type Project = {
  id: string;
  title: string;
  type: string;
  method: string;
  updatedAt: string;
  _count: { sections: number; sources: number };
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    setLoading(true);
    fetch("/api/projects")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Proyek belum bisa dimuat.");
        return j;
      })
      .then((j) => setProjects(Array.isArray(j) ? j : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5">
            Workspace
          </div>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            Proyek <span className="font-light">Penelitian</span>
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Kelola struktur penelitian, sumber, dan naskah dalam satu workspace dengan API key milikmu.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className="btn-outline">
            <Upload size={15} /> Impor Skripsi
          </Link>
          <Link href="/new" className="btn-primary">
            <Plus size={15} /> Proyek Baru
          </Link>
        </div>
      </div>

      {error ? (
        <div className="card p-8 text-center" role="alert">
          <div className="font-semibold mb-1">Dashboard belum bisa dibuka</div>
          <p className="text-sm text-ink-500 mb-4">{error}</p>
          <button type="button" className="btn-outline" onClick={load}>Coba lagi</button>
        </div>
      ) : loading ? (
        <div className="text-ink-400 text-sm py-20 text-center">Memuat…</div>
      ) : projects.length === 0 ? (
        <div className="card p-8 text-center">
          <BookOpenCheck size={40} className="mx-auto text-ink-300 mb-3" />
          <div className="font-semibold mb-1">Belum ada proyek</div>
          <p className="text-sm text-ink-500 mb-5">
            Mulai dari topik baru (wizard + brainstorming judul), atau impor skripsi .docx yang sudah ada.
          </p>
          <div className="flex justify-center gap-2">
            <Link href="/new" className="btn-primary">
              <Plus size={15} /> Buat Proyek
            </Link>
            <Link href="/import" className="btn-outline">
              <Upload size={15} /> Impor .docx
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card p-4 hover:border-ink-500 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold group-hover:text-brand-600 line-clamp-2">{p.title}</div>
                <FileText size={16} className="text-ink-300 shrink-0" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip bg-ink-950 text-bone-50">{p.type}</span>
                {p.method && <span className="chip bg-ink-100 text-ink-600">{p.method}</span>}
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-ink-500">
                <span>
                  {p._count.sections} section • {p._count.sources} sumber
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(p.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
