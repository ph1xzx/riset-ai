"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, BookMarked } from "lucide-react";

export default function LibraryPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  const load = () =>
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setErr("Gagal memuat library"));
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    await fetch(`/api/library/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">Library</h1>
          <p className="text-[12px] text-ink-500 mt-0.5">Sumber yang kamu simpan dari Cari Paper.</p>
        </div>
        <Link href="/find-papers" className="btn-outline">Cari Paper</Link>
      </div>

      {err && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{err}</div>}
      {!items ? (
        <div className="text-[13px] text-ink-400 py-8 text-center">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <BookMarked size={26} className="mx-auto text-ink-300 mb-3" />
          <h2 className="font-display font-semibold">Library kosong</h2>
          <p className="text-[13px] text-ink-500 mt-1 mb-4">Simpan paper dari halaman Cari Paper.</p>
          <Link href="/find-papers" className="btn-primary">Cari Paper</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((w) => (
            <div key={w.id} className="card p-4">
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
                <button className="ml-auto btn-ghost !h-7 !px-2 hover:!text-red-600" onClick={() => remove(w.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
