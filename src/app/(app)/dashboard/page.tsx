"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FilePlus2, Upload, ArrowRight, Trash2, CheckCircle2, CircleDashed } from "lucide-react";

interface Project {
  id: string;
  title: string;
  type: string;
  method: string;
  citationStyle: string;
  updatedAt: string;
  _count: { sections: number; sources: number };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [err, setErr] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (res.ok) setProjects(data);
      else setErr(data.error || "Gagal memuat");
    } catch {
      setErr("Gagal memuat proyek");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">Proyek</h1>
          <p className="text-[12px] text-ink-500 mt-0.5">Dokumen penelitian-mu, dari bab 1 sampai sidang.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className="btn-outline">
            <Upload size={14} /> Impor DOCX
          </Link>
          <Link href="/new" className="btn-primary">
            <FilePlus2 size={14} /> Proyek Baru
          </Link>
        </div>
      </div>

      {err && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{err}</div>}

      {!projects ? (
        <div className="text-[13px] text-ink-400 py-10 text-center">Memuat…</div>
      ) : projects.length === 0 ? (
        <div className="card p-10 text-center">
          <CircleDashed size={28} className="mx-auto text-ink-300 mb-3" />
          <h2 className="font-display font-semibold">Belum ada proyek</h2>
          <p className="text-[13px] text-ink-500 mt-1 mb-5">Mulai dari topik baru, atau impor skripsi/pedoman DOCX.</p>
          <div className="flex justify-center gap-2">
            <Link href="/new" className="btn-primary"><FilePlus2 size={14} /> Proyek Baru</Link>
            <Link href="/import" className="btn-outline"><Upload size={14} /> Impor DOCX</Link>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <div key={p.id} className="card p-4 flex flex-col gap-3 hover:border-ink-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/projects/${p.id}`} className="font-medium text-[13px] leading-snug line-clamp-3 hover:text-brand-600">
                  {p.title}
                </Link>
                {toDelete === p.id ? (
                  <button
                    onClick={async () => {
                      await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
                      setToDelete(null);
                      load();
                    }}
                    className="text-[11px] text-red-600 border border-red-200 rounded px-2 py-0.5 shrink-0"
                  >
                    Yakin?
                  </button>
                ) : (
                  <button onClick={() => setToDelete(p.id)} className="text-ink-300 hover:text-red-600 shrink-0" aria-label="Hapus">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="chip">{p.type}</span>
                {p.method && <span className="chip">{p.method}</span>}
                <span className="chip">Sitasi: {p.citationStyle}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-ink-500 mt-auto">
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-ink-400" /> {p._count.sections} section
                  </span>
                  <span>{p._count.sources} sumber</span>
                </span>
                <span className="font-mono">{new Date(p.updatedAt).toLocaleDateString("id-ID")}</span>
              </div>
              <Link href={`/projects/${p.id}`} className="btn-ghost !h-8 w-full">
                Buka workspace <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
