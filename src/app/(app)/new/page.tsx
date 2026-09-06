"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles, Loader2, Upload } from "lucide-react";

const TYPES = ["Skripsi", "Tesis", "Skripsi (Impor)"];
const STYLES = ["APA7", "IEEE", "Harvard", "Vancouver"];
const LANGS = [
  { v: "id", label: "Bahasa Indonesia" },
  { v: "en", label: "English" },
];

const METHOD_CARDS = [
  {
    key: "Quantitative",
    title: "Jalur kuantitatif",
    method: "Kuantitatif",
    reason: "Cocok bila topikmu berfokus pada pengukuran, statistik, atau pemodelan numerik.",
    nextStep: "Tentukan variabel, sumber data, dan teknik analisis.",
  },
  {
    key: "R&D",
    title: "Pengembangan sistem",
    method: "R&D / Waterfall",
    reason: "Cocok bila kamu membangun sistem atau produk (aplikasi, web, perangkat).",
    nextStep: "Tuliskan pengguna sasaran, kebutuhan utama, skenario uji, dan kriteria selesai.",
  },
  {
    key: "Case",
    title: "Mulai dari studi kasus yang terukur",
    method: "Case Study",
    reason: "Detail brief belum cukup untuk mengunci metode, jadi kasus dan batasan ruang lingkup perlu dipertegas lebih dulu.",
    nextStep: "Tambahkan objek, lokasi atau konteks, data yang tersedia, dan hasil yang ingin dicapai.",
  },
];

interface GuidelineResult {
  structure: { title: string; level: number }[];
  campusStyle: any;
  title: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // step 1: brief
  const [topic, setTopic] = useState("");
  const [field, setField] = useState("");
  const [object, setObject] = useState("");
  const [caseStudy, setCaseStudy] = useState("");
  const [problem, setProblem] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState(TYPES[0]);

  // step 2: method
  const [method, setMethod] = useState("");

  // step 3: citation
  const [language, setLanguage] = useState("id");
  const [citationStyle, setCitationStyle] = useState("APA7");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [minCitations, setMinCitations] = useState("");
  const [includePreprint, setIncludePreprint] = useState(false);
  const [documentPrompt, setDocumentPrompt] = useState("");

  // step 4: campus style
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("builtin-id-umum");
  const [guideline, setGuideline] = useState<GuidelineResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState("");

  // step 5: create + brainstorm
  const [creating, setCreating] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);
  const [usedTitle, setUsedTitle] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [brainBusy, setBrainBusy] = useState(false);
  const [projectId, setProjectId] = useState("");

  async function loadTemplates() {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (res.ok) setTemplates(data.templates || []);
    } catch {
      /* optional */
    }
  }
  function goStep4() {
    setStep(4);
    loadTemplates();
  }

  async function onImportGuideline(file: File) {
    setImportErr("");
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/uploads", { method: "POST", body: fd });
      const upj = await up.json();
      if (!up.ok) throw new Error(upj.error || "Upload gagal");
      const res = await fetch("/api/import/guideline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: upj.url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Impor gagal");
      setGuideline(j);
      if (!title) setTitle(j.title || "");
    } catch (e: any) {
      setImportErr(e.message);
    } finally {
      setImportBusy(false);
    }
  }

  async function createProject() {
    if (!topic.trim()) {
      setErr("Topik wajib diisi.");
      return;
    }
    setErr("");
    setCreating(true);
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const body: any = {
        title: title.trim() || topic.trim().slice(0, 80),
        type,
        topic,
        field,
        object,
        caseStudy,
        problem,
        method,
        language,
        citationStyle,
        yearFrom: yearFrom ? Number(yearFrom) : null,
        yearTo: yearTo ? Number(yearTo) : null,
        minCitations: minCitations ? Number(minCitations) : null,
        includePreprint,
        documentPrompt,
        campusStyle: guideline ? guideline.campusStyle : tpl?.config || null,
        structure: guideline?.structure?.length ? guideline.structure.map((h) => ({ title: h.title, level: h.level })) : undefined,
      };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal membuat proyek");
      setProjectId(j.id);
      setStep(5);
      setCreating(false);
      await brainstorm(j.id, body.title);
    } catch (e: any) {
      setErr(e.message);
      setCreating(false);
    }
  }

  async function brainstorm(projectId: string, projTitle: string) {
    setBrainBusy(true);
    setTitles([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/brainstorm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || projTitle }),
      });
      const j = await res.json();
      if (!res.ok) {
        // Non-fatal: user can still enter the project
        setErr(j.error || "Brainstorm gagal — kamu tetap bisa buka proyek.");
        return;
      }
      setTitles(j.titles || []);
    } catch {
      setErr("Brainstorm gagal — kamu tetap bisa buka proyek.");
    } finally {
      setBrainBusy(false);
    }
  }

  async function useTitle(t: string) {
    setUsedTitle(t);
  }

  const next = () => {
    setErr("");
    if (step === 1 && !topic.trim()) {
      setErr("Topik wajib diisi.");
      return;
    }
    if (step === 3) goStep4();
    else setStep((s) => s + 1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        {step > 1 && (
          <button className="btn-ghost !px-2" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft size={14} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold">
            {step === 1 && "Proyek baru — brief topik"}
            {step === 2 && "Proyek baru — rekomendasi metode"}
            {step === 3 && "Proyek baru — sitasi & bahasa"}
            {step === 4 && "Proyek baru — format kampus"}
            {step === 5 && "Proyek dibuat — brainstorm judul"}
          </h1>
          <p className="text-[11px] text-ink-500">Langkah {step} dari 5</p>
        </div>
      </div>

      <div className="card p-5">
        {err && <div className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{err}</div>}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Judul (opsional — bisa diisi dari brainstorm)</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Isi manual, atau biarkan kosong dan pakai hasil brainstorm" />
            </div>
            <div>
              <label className="label">Topik * </label>
              <textarea className="textarea" rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: Sistem Pendukung Keputusan prioritas pengadaan barang dan jasa dengan metode PROMETHEE II" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Bidang</label>
                <input className="input" value={field} onChange={(e) => setField(e.target.value)} placeholder="mis. Teknik Informatika" />
              </div>
              <div>
                <label className="label">Objek / perusahaan</label>
                <input className="input" value={object} onChange={(e) => setObject(e.target.value)} placeholder="mis. PT Prisma Gapura" />
              </div>
            </div>
            <div>
              <label className="label">Studi kasus / lokasi</label>
              <input className="input" value={caseStudy} onChange={(e) => setCaseStudy(e.target.value)} placeholder="mis. Layanan proteksi kebakaran APAR" />
            </div>
            <div>
              <label className="label">Permasalahan</label>
              <textarea className="textarea" rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Masalah apa yang diselesaikan?" />
            </div>
            <div>
              <label className="label">Jenis dokumen</label>
              <div className="flex gap-2 flex-wrap">
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setType(t)} className={`chip !text-[11px] !py-1 cursor-pointer ${type === t ? "!bg-ink-900 !text-white !border-ink-900" : ""}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-600">Berdasarkan brief-mu, jalur ini yang paling cocok. Klik untuk memilih:</p>
            {METHOD_CARDS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.method)}
                className={`w-full text-left card p-4 transition-colors ${method === m.method ? "!border-ink-900 ring-2 ring-ink-200" : "hover:border-ink-300"}`}
              >
                <div className="font-medium text-[13px]">{m.title}</div>
                <div className="text-[12px] text-ink-500 mt-1">{m.reason}</div>
                <div className="text-[11px] font-mono text-ink-400 mt-2">→ {m.nextStep}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Bahasa dokumen</label>
                <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGS.map((l) => (
                    <option key={l.v} value={l.v}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Gaya sitasi</label>
                <select className="input" value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>
                  {STYLES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Tahun dari</label>
                <input className="input" type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="2020" />
              </div>
              <div>
                <label className="label">Tahun sampai</label>
                <input className="input" type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="2026" />
              </div>
              <div>
                <label className="label">Min. sitasi</label>
                <input className="input" type="number" value={minCitations} onChange={(e) => setMinCitations(e.target.value)} placeholder="20" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-700">
              <input type="checkbox" checked={includePreprint} onChange={(e) => setIncludePreprint(e.target.checked)} />
              Sertakan preprint pada pencarian sumber
            </label>
            <div>
              <label className="label">Instruksi khusus untuk AI (opsional)</label>
              <textarea className="textarea" rows={3} value={documentPrompt} onChange={(e) => setDocumentPrompt(e.target.value)} placeholder="mis. Gunakan gaya bahasa formal, hindari kata slang, tekankan orisinalitas…" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="label">Pilih template format kampus</label>
              <select className="input" value={guideline ? "guideline" : templateId} onChange={(e) => { if (e.target.value !== "guideline") setTemplateId(e.target.value); }}>
                <option value="builtin-id-umum">Skripsi Umum Indonesia (bawaan)</option>
                {templates.filter((t) => !t.builtin).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.prodi ? ` — ${t.prodi}` : ""}</option>
                ))}
                {guideline && <option value="guideline">Deteksi dari impor DOCX ✓</option>}
              </select>
            </div>
            <div className="border-t border-ink-100 pt-4">
              <label className="label">Atau: upload pedoman / skripsi lama (.docx) untuk deteksi otomatis</label>
              <div className="flex items-center gap-3">
                <label className="btn-outline cursor-pointer">
                  <Upload size={14} /> {importBusy ? "Membaca…" : "Pilih file DOCX"}
                  <input type="file" accept=".docx" className="hidden" onChange={(e) => e.target.files?.[0] && onImportGuideline(e.target.files[0])} />
                </label>
                {guideline && (
                  <span className="text-[12px] text-emerald-700">
                    ✓ {guideline.structure.length} heading · margin {guideline.campusStyle?.margins?.left}/{guideline.campusStyle?.margins?.top}/{guideline.campusStyle?.margins?.right}/{guideline.campusStyle?.margins?.bottom} cm · {guideline.campusStyle?.body?.font} {guideline.campusStyle?.body?.size}pt · spasi {guideline.campusStyle?.body?.lineSpacing}
                  </span>
                )}
              </div>
              {importErr && <div className="text-[12px] text-red-600 mt-2">{importErr}</div>}
              {guideline && (
                <div className="mt-3 max-h-40 overflow-auto thin-scroll border border-ink-100 rounded-md p-3 bg-ink-50/40">
                  {guideline.structure.slice(0, 20).map((h, i) => (
                    <div key={i} className="text-[12px] text-ink-600" style={{ paddingLeft: (h.level - 1) * 14 }}>
                      {h.title}
                    </div>
                  ))}
                  {guideline.structure.length > 20 && <div className="text-[11px] text-ink-400 mt-1">+{guideline.structure.length - 20} heading lagi</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            {brainBusy && (
              <div className="flex items-center gap-2 text-[13px] text-ink-500">
                <Loader2 size={15} className="animate-spin" /> AI membuat 5 alternatif judul…
              </div>
            )}
            {titles.length > 0 && (
              <div className="space-y-2">
                {titles.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => useTitle(t)}
                    className={`w-full text-left card p-3 text-[13px] transition-colors ${usedTitle === t ? "!border-ink-900 ring-2 ring-ink-200" : "hover:border-ink-300"}`}
                  >
                    <span className="font-mono text-[10px] text-ink-400 mr-2">{i + 1}.</span>
                    {t}
                  </button>
                ))}
              </div>
            )}
            {!brainBusy && titles.length === 0 && !err && (
              <div className="text-[13px] text-ink-500">
                Tidak ada hasil brainstorm (API key belum diset?). Kamu tetap bisa masuk ke proyek.
              </div>
            )}
            {usedTitle && (
              <p className="text-[12px] text-emerald-700">Judul terpilih akan dipakai. Masuk ke proyek untuk mulai menulis.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-ink-100">
          {step < 5 ? (
            <button className="btn-primary" onClick={next} disabled={creating}>
              {step === 3 ? "Lanjut ke format kampus" : step === 4 ? "Buat proyek" : "Lanjut"} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={!usedTitle}
              onClick={async () => {
                if (usedTitle && projectId) {
                  await fetch(`/api/projects/${projectId}/brainstorm/use`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: usedTitle }),
                  });
                }
                router.push(projectId ? `/projects/${projectId}` : "/dashboard");
              }}
            >
              <Sparkles size={14} /> Masuk ke workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
