"use client";

import { useState } from "react";
import { Search, Loader2, BookmarkPlus, ExternalLink } from "lucide-react";

export default function FindPapersPage() {
  const [q, setQ] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<string[]>([]);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr("");
    setResults(null);
    try {
      const params = new URLSearchParams({ q });
      if (yearFrom) params.set("yearFrom", yearFrom);
      if (yearTo) params.set("yearTo", yearTo);
      const res = await fetch(`/api/papers/search?${params}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Pencarian gagal");
      setResults(j.results || []);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(w: any) {
    await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: w.title, authors: w.authors, year: w.year, journal: w.journal,
        doi: w.doi, url: w.url, citationCount: w.citationCount, openAccess: w.openAccess,
      }),
    });
    setSaved((s) => [...s, w.doi || w.title]);
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="font-display text-xl font-bold mb-1">Cari Paper</h1>
      <p className="text-[12px] text-ink-500 mb-6">Telusuri OpenAlex — simpan ke library, lalu pakai sebagai sumber sitasi di proyek.</p>

      <form onSubmit={search} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. PROMETHEE II procurement priority" />
        </div>
        <input className="input !w-20" type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="Dari" />
        <input className="input !w-20" type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="Sampai" />
        <button className="btn-primary" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Cari"}
        </button>
      </form>

      {err && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{err}</div>}
      {busy && <div className="text-[13px] text-ink-400 py-8 text-center">Mencari di OpenAlex…</div>}

      {results && (
        <div className="space-y-2">
          {results.length === 0 && <div className="text-[13px] text-ink-400 text-center py-8">Tidak ada hasil.</div>}
          {results.map((w, i) => (
            <div key={i} className="card p-4">
              <div className="text-[13px] font-medium leading-snug">{w.title}</div>
              <div className="text-[11px] text-ink-500 mt-1.5">
                {w.authors.slice(0, 3).join(", ")}{w.authors.length > 3 ? " et al." : ""}
                {w.year ? ` · ${w.year}` : ""}
                {w.journal ? ` · ${w.journal}` : ""}
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="chip">{w.citationCount ?? 0} sitasi</span>
                {w.openAccess && <span className="chip !border-emerald-200 !text-emerald-700">OA</span>}
                {w.doi && <span className="chip">DOI</span>}
                <div className="ml-auto flex gap-1">
                  {w.url && (
                    <a className="btn-ghost !h-7 !px-2 !text-[11px]" href={w.url.startsWith("http") ? w.url : `https://doi.org/${w.doi}`} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} /> Buka
                    </a>
                  )}
                  <button className={`btn-ghost !h-7 !px-2 !text-[11px] ${saved.includes(w.doi || w.title) ? "!text-emerald-700" : ""}`} onClick={() => save(w)}>
                    <BookmarkPlus size={12} /> {saved.includes(w.doi || w.title) ? "Tersimpan" : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
