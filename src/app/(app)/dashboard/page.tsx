"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Upload, BookOpenCheck, Clock, FileText, ArrowUpRight, Search, ScrollText } from "lucide-react";

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
          <h1 className="font-display text-2xl font-medium tracking-tight">
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_250px] gap-3">
          <section className="card overflow-hidden" aria-labelledby="projects-title">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ink-100">
              <div>
                <h2 id="projects-title" className="font-semibold text-sm">Proyek kerja</h2>
                <p className="text-[11px] text-ink-400 mt-0.5">Buka naskah terakhir dan lanjutkan dari struktur yang tersimpan.</p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-400">{projects.length} proyek</span>
            </div>
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_110px_120px_130px] gap-3 px-4 py-2 bg-ink-50 border-b border-ink-100 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-400">
              <span>Proyek</span><span>Tipe</span><span>Isi</span><span>Terakhir diubah</span>
            </div>
            <div className="divide-y divide-ink-100">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_110px_120px_130px] gap-1 sm:gap-3 px-4 py-3 hover:bg-brand-50/40 transition-colors group">
                  <div className="min-w-0 flex items-start gap-2">
                    <FileText size={15} className="text-ink-300 shrink-0 mt-0.5" />
                    <span className="font-medium text-sm truncate group-hover:text-brand-700" title={p.title}>{p.title}</span>
                  </div>
                  <div className="text-[11px] text-ink-500 sm:pt-0.5">{p.type}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-ink-400 sm:pt-0.5">{p._count.sections} section · {p._count.sources} sumber</div>
                  <div className="flex items-center gap-1 text-[11px] text-ink-500 sm:pt-0.5"><Clock size={12} />{new Date(p.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                </Link>
              ))}
            </div>
          </section>

          <aside className="space-y-3">
            <div className="card p-4">
              <div className="font-semibold text-sm mb-2">Langkah berikutnya</div>
              <div className="space-y-1">
                <Link href="/new" className="flex items-center justify-between gap-2 border border-ink-100 px-3 py-2.5 text-xs hover:border-brand-300 hover:bg-brand-50/40"><span className="flex items-center gap-2"><Plus size={14} className="text-brand-600" />Buat proyek baru</span><ArrowUpRight size={13} /></Link>
                <Link href="/import" className="flex items-center justify-between gap-2 border border-ink-100 px-3 py-2.5 text-xs hover:border-brand-300 hover:bg-brand-50/40"><span className="flex items-center gap-2"><Upload size={14} className="text-brand-600" />Impor DOCX</span><ArrowUpRight size={13} /></Link>
                <Link href="/find-papers" className="flex items-center justify-between gap-2 border border-ink-100 px-3 py-2.5 text-xs hover:border-brand-300 hover:bg-brand-50/40"><span className="flex items-center gap-2"><Search size={14} className="text-brand-600" />Cari sumber</span><ArrowUpRight size={13} /></Link>
              </div>
            </div>
            <div className="card p-4">
              <div className="font-semibold text-sm mb-2">Akses cepat</div>
              <div className="space-y-2 text-xs text-ink-500">
                <Link href="/templates" className="flex items-center gap-2 hover:text-brand-700"><ScrollText size={14} />Template pedoman</Link>
                <Link href="/library" className="flex items-center gap-2 hover:text-brand-700"><BookOpenCheck size={14} />Library sumber</Link>
                <Link href="/settings" className="flex items-center gap-2 hover:text-brand-700">Atur provider dan API key</Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
