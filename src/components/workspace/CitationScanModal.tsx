"use client";
import { useState, useMemo } from "react";
import {
  X, Search, Sparkles, BookOpen, ExternalLink, Check, Loader2,
  FileText, ArrowRight, ShieldAlert, Layers, AlertTriangle
} from "lucide-react";

export type CitationOpportunity = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  claim: string;
  reason: string;
  academicQuery: string;
  suggestedPapers: Array<{
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    journal: string;
    doi: string | null;
    url: string;
    citationCount: number;
    inTextCitation: string;
    metadata: any;
  }>;
};

type Props = {
  project: any;
  isOpen: boolean;
  onClose: () => void;
  onInsertCitation: (sectionId: string, claim: string, citationText: string, source: any) => Promise<void>;
  notify: (msg: string) => void;
};

export default function CitationScanModal({ project, isOpen, onClose, onInsertCitation, notify }: Props) {
  const [scope, setScope] = useState<"all" | "chapter" | "section">("all");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [stepMsg, setStepMsg] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<CitationOpportunity[] | null>(null);
  const [insertedIds, setInsertedIds] = useState<Record<string, boolean>>({});
  const [savingLibrary, setSavingLibrary] = useState<Record<string, boolean>>({});
  const [savedLibrary, setSavedLibrary] = useState<Record<string, boolean>>({});

  const sections: any[] = project?.sections || [];

  // Organisir sections menjadi kelompok Bab dan Sub-bab untuk dropdown
  const structureOptions = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      isChapter: boolean;
      subCount?: number;
      level: number;
    }> = [];

    let currentChapter: { id: string; title: string; subCount: number } | null = null;

    sections.forEach((s) => {
      if (s.level === 1) {
        if (currentChapter) {
          items.push({
            id: currentChapter.id,
            title: `${currentChapter.title} (Seluruh Bab)`,
            isChapter: true,
            subCount: currentChapter.subCount,
            level: 1,
          });
        }
        currentChapter = { id: s.id, title: s.title, subCount: 0 };
      } else {
        if (currentChapter) currentChapter.subCount++;
        items.push({
          id: s.id,
          title: s.title,
          isChapter: false,
          level: s.level || 2,
        });
      }
    });

    if (currentChapter) {
      items.push({
        id: (currentChapter as any).id,
        title: `${(currentChapter as any).title} (Seluruh Bab)`,
        isChapter: true,
        subCount: (currentChapter as any).subCount,
        level: 1,
      });
    }

    return items;
  }, [sections]);

  if (!isOpen) return null;

  async function runScan() {
    setBusy(true);
    setScanError(null);
    setScanNotice(null);
    setStepMsg("Memindai naskah untuk mencari kalimat tanpa rujukan…");
    setOpportunities(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/citation-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          targetId: scope !== "all" ? selectedTargetId : undefined,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = j.error || `Error ${res.status}: Gagal memindai sitasi`;
        setScanError(msg);
        setOpportunities([]);
        notify(msg);
        return;
      }

      if (j.notice) setScanNotice(j.notice);
      setOpportunities(j.opportunities || []);

      if (!j.opportunities || j.opportunities.length === 0) {
        notify(j.message || "Tidak ditemukan klaim yang memerlukan sitasi tambahan pada bagian ini.");
      } else {
        notify(`Ditemukan ${j.opportunities.length} kalimat yang membutuhkan rujukan ilmiah.`);
      }
    } catch (e: any) {
      setScanError(e.message || "Gagal menghubungi server");
      setOpportunities([]);
      notify(e.message);
    } finally {
      setBusy(false);
      setStepMsg("");
    }
  }

  async function handleInsert(opp: CitationOpportunity, paper: any) {
    const key = `${opp.id}-${paper.id}`;
    try {
      await onInsertCitation(opp.sectionId, opp.claim, paper.inTextCitation, paper.metadata);
      setInsertedIds((prev) => ({ ...prev, [key]: true }));
      notify(`Sitasi ${paper.inTextCitation} berhasil disisipkan ke section & Daftar Pustaka.`);
    } catch (e: any) {
      notify(e.message);
    }
  }

  async function handleSaveToLibrary(paper: any) {
    const key = paper.id;
    setSavingLibrary((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/projects/${project.id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: paper.metadata }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal menyimpan sumber");
      }
      setSavedLibrary((prev) => ({ ...prev, [key]: true }));
      notify(`Jurnal "${paper.title.slice(0, 40)}…" ditambahkan ke Library.`);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSavingLibrary((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div
        className="card w-full max-w-3xl max-h-[90vh] flex flex-col bg-white shadow-2xl border border-ink-200 rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 bg-[#faf9f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Search size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900 text-base flex items-center gap-2">
                Scan Penulisan & Rekomendasi Jurnal
              </h3>
              <p className="text-xs text-ink-500">
                Pindai pernyataan/klaim yang belum bersitasi dan temukan jurnal ilmiah pendukung secara otomatis.
              </p>
            </div>
          </div>
          <button
            className="text-ink-400 hover:text-ink-700 p-1 rounded-lg hover:bg-ink-100 transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Kontrol Cakupan Scan */}
        <div className="px-6 py-3.5 bg-ink-50/50 border-b border-ink-100 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-ink-700 flex items-center gap-1.5 shrink-0">
            <Layers size={14} className="text-brand-600" /> Cakupan Scan:
          </span>

          <select
            className="input !py-1.5 !text-xs flex-1 min-w-[240px] bg-white"
            value={scope === "all" ? "all" : `${scope}:${selectedTargetId}`}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "all") {
                setScope("all");
                setSelectedTargetId("");
              } else {
                const [s, tid] = val.split(":");
                setScope(s as any);
                setSelectedTargetId(tid);
              }
            }}
          >
            <option value="all">📑 Seluruh Dokumen (Semua Bab & Sub-bab)</option>
            <optgroup label="Pilih Bab atau Sub-bab Spesifik">
              {structureOptions.map((opt) => (
                <option
                  key={`${opt.isChapter ? "chapter" : "section"}:${opt.id}`}
                  value={`${opt.isChapter ? "chapter" : "section"}:${opt.id}`}
                >
                  {opt.isChapter ? `📁 ${opt.title}` : `　📄 ${opt.title}`}
                </option>
              ))}
            </optgroup>
          </select>

          <button
            className="btn-primary !py-1.5 !text-xs flex items-center gap-1.5 shrink-0 shadow-sm"
            onClick={runScan}
            disabled={busy}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>{busy ? "Memindai…" : "Mulai Scan"}</span>
          </button>
        </div>

        {/* Area Konten / Hasil */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {scanNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-600 shrink-0" />
                <span>{scanNotice}</span>
              </span>
              <a
                href="/settings"
                target="_blank"
                className="font-semibold text-amber-900 underline hover:no-underline shrink-0"
              >
                Pengaturan API Key →
              </a>
            </div>
          )}

          {scanError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-900 text-sm">Gagal Melakukan Pemindaian</div>
                  <div className="mt-1 text-rose-800">{scanError}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 pl-7">
                <button className="btn-outline !py-1 !px-2.5 !text-[11px] bg-white text-rose-700 border-rose-300 hover:bg-rose-50" onClick={runScan}>
                  Coba Lagi
                </button>
                <a
                  href="/settings"
                  target="_blank"
                  className="btn-outline !py-1 !px-2.5 !text-[11px] bg-white text-ink-700 hover:bg-ink-50"
                >
                  Buka Menu Settings
                </a>
              </div>
            </div>
          )}

          {busy && (
            <div className="py-16 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-brand-600 mx-auto" />
              <div className="text-sm font-medium text-ink-800">{stepMsg}</div>
              <div className="text-xs text-ink-400 max-w-md mx-auto">
                Menganalisis argumen dan metode di naskah Anda, lalu mencocokkannya dengan database OpenAlex & Crossref.
              </div>
            </div>
          )}

          {!busy && opportunities === null && !scanError && (
            <div className="py-12 text-center space-y-3 border-2 border-dashed border-ink-100 rounded-xl p-8">
              <BookOpen size={36} className="text-ink-300 mx-auto" />
              <div className="text-sm font-semibold text-ink-700">Pilih Cakupan & Mulai Pemindaian</div>
              <p className="text-xs text-ink-400 max-w-md mx-auto">
                Fitur ini membantu Anda menemukan kalimat atau paragraf yang rentan dikritik penguji karena belum mencantumkan rujukan ilmiah, serta langsung memberikan jurnal asli yang dapat Anda sisipkan.
              </p>
              <button className="btn-outline !text-xs mt-2" onClick={runScan}>
                Pindai Sekarang
              </button>
            </div>
          )}

          {!busy && opportunities !== null && opportunities.length === 0 && !scanError && (
            <div className="py-12 text-center space-y-2 border border-emerald-100 bg-emerald-50/50 rounded-xl p-6">
              <Check size={32} className="text-emerald-600 mx-auto" />
              <div className="text-sm font-semibold text-emerald-800">Naskah Terverifikasi dengan Baik!</div>
              <p className="text-xs text-emerald-700 max-w-md mx-auto">
                Tidak ditemukan pernyataan empiris atau klaim baru tanpa sitasi pada cakupan yang dipilih.
              </p>
            </div>
          )}

          {!busy && opportunities && opportunities.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-ink-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Ditemukan {opportunities.length} Kalimat yang Membutuhkan Rujukan
                </span>
                <span className="text-[11px] text-ink-400">
                  Format sitasi: {project.citationStyle || "APA"}
                </span>
              </div>

              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="border border-ink-200 rounded-xl p-4 bg-white shadow-sm hover:border-brand-300 transition-colors space-y-3"
                >
                  {/* Info Section & Alasan */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="chip bg-brand-50 text-brand-700 font-medium">
                        {opp.sectionTitle}
                      </span>
                      <span className="text-xs text-ink-500 flex items-center gap-1">
                        <ShieldAlert size={12} className="text-amber-500" />
                        {opp.reason}
                      </span>
                    </div>
                  </div>

                  {/* Klaim / Kalimat yang butuh sitasi */}
                  <div className="bg-[#faf9f5] border-l-4 border-amber-400 px-3.5 py-2.5 rounded-r-lg">
                    <div className="text-[11px] uppercase tracking-wider font-mono text-ink-400 mb-1">
                      Kutipan Naskah:
                    </div>
                    <div className="text-xs text-ink-800 font-serif italic leading-relaxed">
                      "{opp.claim}"
                    </div>
                  </div>

                  {/* Jurnal Rekomendasi */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-semibold text-ink-500 flex items-center gap-1.5">
                      <BookOpen size={12} className="text-brand-600" /> Jurnal Rujukan yang Cocok:
                    </div>

                    {opp.suggestedPapers.length === 0 ? (
                      <div className="text-xs text-ink-400 italic p-2 bg-ink-50 rounded-lg">
                        Tidak ditemukan jurnal yang cocok otomatis. Anda dapat mencari dengan kata kunci: "{opp.academicQuery}" di menu Find Papers.
                      </div>
                    ) : (
                      opp.suggestedPapers.map((paper) => {
                        const insertKey = `${opp.id}-${paper.id}`;
                        const isInserted = insertedIds[insertKey];
                        const isSaved = savedLibrary[paper.id];
                        const isSaving = savingLibrary[paper.id];

                        return (
                          <div
                            key={paper.id}
                            className="border border-ink-100 rounded-lg p-3 bg-white hover:bg-ink-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-ink-900 line-clamp-1">
                                {paper.title}
                              </div>
                              <div className="text-[11px] text-ink-500 mt-0.5">
                                {paper.authors.slice(0, 2).join(", ")}
                                {paper.authors.length > 2 ? " et al." : ""} • {paper.journal} • {paper.year ?? "s.t."}
                                {paper.citationCount > 0 && ` • ${paper.citationCount} sitasi`}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="chip bg-brand-50 text-brand-700 font-mono text-[10px]">
                                  {paper.inTextCitation}
                                </span>
                                {paper.doi && (
                                  <a
                                    href={paper.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-ink-400 hover:text-brand-600 inline-flex items-center gap-0.5"
                                  >
                                    DOI <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Tombol Aksi per Jurnal */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                className={`btn !py-1 !px-2.5 !text-[11px] ${
                                  isSaved
                                    ? "bg-ink-100 text-ink-500 cursor-default"
                                    : "btn-outline"
                                }`}
                                onClick={() => handleSaveToLibrary(paper)}
                                disabled={isSaved || isSaving}
                                title="Simpan jurnal ke Library proyek tanpa menyisipkan ke teks"
                              >
                                {isSaving ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : isSaved ? (
                                  <Check size={11} />
                                ) : (
                                  <BookOpen size={11} />
                                )}
                                <span>{isSaved ? "Di Library" : "Simpan"}</span>
                              </button>

                              <button
                                className={`btn !py-1 !px-2.5 !text-[11px] ${
                                  isInserted
                                    ? "bg-emerald-600 text-white cursor-default"
                                    : "btn-primary"
                                }`}
                                onClick={() => handleInsert(opp, paper)}
                                disabled={isInserted}
                                title="Sisipkan tanda sitasi langsung ke naskah dan tambahkan ke Daftar Pustaka"
                              >
                                {isInserted ? <Check size={11} /> : <ArrowRight size={11} />}
                                <span>{isInserted ? "Tersisip ✓" : "Sisipkan Sitasi"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3 border-t border-ink-100 bg-[#faf9f5] flex items-center justify-between text-xs text-ink-400">
          <div>
            Didukung oleh OpenAlex & Crossref — bebas sitasi fiktif (citation-safety).
          </div>
          <button className="btn-outline !py-1 !px-3" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
