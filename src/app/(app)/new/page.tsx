"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TaskOverlay, { useTask } from "@/components/TaskOverlay";
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle2, Loader2, FileCog } from "lucide-react";
import { PROJECT_TYPES, METHODS, MCDM_METHODS, CITATION_STYLES } from "@/lib/research";
import { uploadDocx } from "@/lib/upload";

type BrainTitle = {
  title: string;
  rationale: string;
  problem: string;
  recommendedMethod: string;
  dataNeeded: string;
  advantages: string;
  risks: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [projectId, setProjectId] = useState("");
  const task = useTask();

  // step 1
  const [type, setType] = useState("Skripsi");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [field, setField] = useState("");
  const [object, setObject] = useState("");
  const [caseStudy, setCaseStudy] = useState("");
  const [problem, setProblem] = useState("");

  // step 2
  const [method, setMethod] = useState("");
  const [customMethod, setCustomMethod] = useState("");
  const [language, setLanguage] = useState("id");
  const [citationStyle, setCitationStyle] = useState("APA7");
  // default: 5 tahun terakhir dari tahun berjalan
  const CUR_YEAR = new Date().getFullYear();
  const [yearFrom, setYearFrom] = useState(String(CUR_YEAR - 5));
  const [yearTo, setYearTo] = useState(String(CUR_YEAR));
  const [minCitations, setMinCitations] = useState("");
  const [preprint, setPreprint] = useState(true);

  // step 3 (pedoman)
  const guideRef = useRef<HTMLInputElement>(null);
  const [guide, setGuide] = useState<{ structure: any; campusStyle: any } | null>(null);
  const [tpls, setTpls] = useState<any[]>([]);
  const [tplId, setTplId] = useState("");

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then((j) => setTpls(j.templates || [])).catch(() => {});
  }, []);
  const [useGuideStructure, setUseGuideStructure] = useState(true);

  // step 4 (brainstorm)
  const [titles, setTitles] = useState<BrainTitle[] | null>(null);
  const [memory, setMemory] = useState<any>(null);
  const [chosen, setChosen] = useState("");

  const finalMethod = method === "Custom" ? customMethod || "Custom" : method;

  async function createProject() {
    if (!topic.trim()) {
      setErr("Topik wajib diisi.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          topic,
          field,
          object,
          caseStudy,
          problem,
          method: finalMethod,
          language,
          citationStyle,
          yearFrom: yearFrom ? Number(yearFrom) : null,
          yearTo: yearTo ? Number(yearTo) : null,
          minCitations: minCitations ? Number(minCitations) : null,
          includePreprint: preprint,
          campusStyle: tplId ? (tpls.find((t) => t.id === tplId)?.config ?? guide?.campusStyle) : guide?.campusStyle,
          structure: useGuideStructure && guide?.structure?.headings?.length ? guide.structure.headings : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const id = j.id as string;
      setProjectId(id);
      setStep(4);
      runBrainstorm(id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runBrainstorm(id = projectId) {
    if (!id) {
      setErr("Proyek belum siap untuk brainstorming. Coba ulangi pembuatan proyek.");
      return;
    }
    setTitles(null);
    setErr("");
    setBusy(true);
    task.start("Brainstorm judul", undefined, "Mengirim topik ke model AI…", true);
    try {
      task.log("Model sedang meracik kandidat judul + metode (30–90 detik)…");
      const res = await fetch(`/api/projects/${id}/brainstorm`, { method: "POST", signal: task.signal() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log(`${j.titles?.length || 0} kandidat judul siap.`);
      setTitles(j.titles);
      setMemory(j.memory);
    } catch (e: any) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      task.stop();
      setBusy(false);
    }
  }

  async function useTitle(t: BrainTitle) {
    setChosen(t.title);
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/projects/${projectId}/brainstorm/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t.title, recommendedMethod: t.recommendedMethod, memory }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/projects/${projectId}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  async function handleGuide(file: File) {
    setErr("");
    setBusy(true);
    try {
      const url = await uploadDocx(file);
      const res = await fetch("/api/import/guideline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: url }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setGuide({ structure: j.structure, campusStyle: j.campusStyle });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {task.task && <TaskOverlay task={task.task} onCancel={task.cancel} />}
        <div className="flex items-start gap-2 mb-6">
        {step > 1 && (
          <button className="btn-ghost !px-2" onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
          {["Tipe & Topik", "Metode & Sitasi", "Pedoman (opsional)", "Brainstorming Judul"].map((s, i) => (
            <span key={s} className={`chip ${i + 1 === step ? "bg-brand-600 text-white" : i + 1 < step ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-500"}`}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      {err && <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">{err}</div>}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <h1 className="text-xl font-bold">Tipe & Topik Penelitian</h1>
          <div>
            <div className="label">Tipe</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {PROJECT_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    type === t.id ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <div className="font-semibold">{t.id}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label">Topik penelitian *</div>
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="cth: sistem pendukung keputusan pemilihan e-wallet terbaik" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="label">Bidang</div>
              <input className="input" value={field} onChange={(e) => setField(e.target.value)} placeholder="Informatika, Manajemen, Kesehatan…" />
            </div>
            <div>
              <div className="label">Objek penelitian</div>
              <input className="input" value={object} onChange={(e) => setObject(e.target.value)} placeholder="Metode AHP-TOPSIS, algoritma CNN…" />
            </div>
            <div>
              <div className="label">Studi kasus</div>
              <input className="input" value={caseStudy} onChange={(e) => setCaseStudy(e.target.value)} placeholder="Bank X, RSUD Y…" />
            </div>
            <div>
              <div className="label">Judul (opsional, nanti bisa dari brainstorm)</div>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="label">Masalah awal</div>
            <textarea className="input" rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Kesenjangan / masalah yang ingin diselesaikan…" />
          </div>
          <button className="btn-primary" onClick={() => setStep(2)} disabled={busy}>
            Lanjut <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <h1 className="text-xl font-bold">Metode & Preferensi Sitasi</h1>
          <div>
            <div className="label">Metode penelitian</div>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`chip !px-3 !py-1.5 !text-xs ${method === m ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            {/keputusan|SPK|SPK/i.test(topic + object + field) && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-ink-400">Metode MCDM (jika SPK):</span>
                {MCDM_METHODS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={`chip !px-2.5 !text-xs ${method === m ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {method === "Custom" && (
              <input className="input mt-2" value={customMethod} onChange={(e) => setCustomMethod(e.target.value)} placeholder="Nama metode custom…" />
            )}
            <div className="text-[11px] text-ink-400 mt-1.5">Metode tidak hardcode per bidang, bebas apa pun.</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="label">Bahasa</div>
              <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <div className="label">Gaya sitasi</div>
              <select className="input" value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>
                {CITATION_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s === "APA7" ? "APA 7" : s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="label">Tahun dari</div>
                <input className="input" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
              </div>
              <div>
                <div className="label">Tahun sampai</div>
                <input className="input" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
              </div>
              <div>
                <div className="label">Min. sitasi (opsional)</div>
                <input className="input" value={minCitations} onChange={(e) => setMinCitations(e.target.value)} placeholder="0" />
              </div>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" checked={preprint} onChange={(e) => setPreprint(e.target.checked)} /> Include preprint
            </label>
          </div>
          <button className="btn-primary" onClick={createProject} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <>Buat Proyek <ArrowRight size={15} /></>}
          </button>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h1 className="text-xl font-bold">Pedoman Kampus / Skripsi Lama (opsional)</h1>
          <p className="text-sm text-ink-600">
            Upload skripsi lama atau pedoman (.docx) → struktur bab + format (margin, font, spasi) diekstrak dan dipakai
            oleh proyek ini. Struktur jadi <b>custom</b>, tidak terkunci Bab I–V.
          </p>
          <input
            ref={guideRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleGuide(f);
              e.target.value = "";
            }}
          />
          <button className="btn-outline" onClick={() => guideRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FileCog size={15} />} Pilih file pedoman
          </button>

          {tpls.length > 0 && (
            <div className="border border-ink-200 rounded-lg p-3 bg-ink-50 space-y-2">
              <div className="text-xs font-semibold text-ink-500">ATAU PAKAI TEMPLATE PEDOMAN TERSIMPAN</div>
              <select className="input" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                <option value="">Tanpa template</option>
                {tpls.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.prodi ? ` (${t.prodi})` : ""}
                  </option>
                ))}
              </select>
              {tplId && (
                <div className="text-sm text-ink-600">
                  {(() => {
                    const c = tpls.find((t) => t.id === tplId)?.config;
                    return c
                      ? `margin ${c.margins?.top}/${c.margins?.right}/${c.margins?.bottom}/${c.margins?.left} cm • ${c.body?.font} ${c.body?.size}pt • spasi ${c.body?.lineSpacing} • indent ${c.body?.firstLineIndentMm} mm • sitasi ${c.citationStyle}`
                      : "";
                  })()}
                  {guide && "Template menimpa format file pedoman di atas."}
                </div>
              )}
            </div>
          )}
          {guide && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-ink-200 rounded-lg p-3 bg-ink-50 max-h-56 overflow-y-auto">
                <div className="text-xs font-semibold text-ink-500 mb-1">
                  STRUKTUR ({guide.structure.headings.length} heading)
                </div>
                {guide.structure.headings.map((h: any, i: number) => (
                  <div key={i} className={`text-sm py-0.5 ${h.level === 1 ? "font-semibold" : "pl-4 text-ink-600"}`}>
                    {h.title}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="border border-ink-200 rounded-lg p-3 bg-ink-50 text-sm">
                  <div className="text-xs font-semibold text-ink-500 mb-1">FORMAT</div>
                  {guide.campusStyle.pageSize} • margin {guide.campusStyle.margins.top}/{guide.campusStyle.margins.right}/{guide.campusStyle.margins.bottom}/{guide.campusStyle.margins.left} cm •{" "}
                  {guide.campusStyle.body.font} {guide.campusStyle.body.size}pt • spasi {guide.campusStyle.body.lineSpacing}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useGuideStructure} onChange={(e) => setUseGuideStructure(e.target.checked)} />
                  Pakai struktur ini (tidak checked → pakai struktur default {type})
                </label>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={createProject} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <>Buat Proyek <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-brand-600" /> Brainstorming Judul
            </h1>
            <button className="btn-ghost" onClick={() => runBrainstorm()} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : "Ulangi"}
            </button>
          </div>
          <p className="text-sm text-ink-500 -mt-2">Pilih 1 → proyek langsung pakai judul + ResearchMemory + struktur.</p>

          {busy && !titles && <div className="card p-10 text-center text-ink-400 text-sm flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> AI menyusun alternatif judul…</div>}
          {!busy && !titles && !err && (
            <div className="card p-8 text-center text-sm text-ink-500">
              Belum ada alternatif judul. <button type="button" className="text-brand-700 font-semibold underline" onClick={() => runBrainstorm()}>Coba lagi</button>.
            </div>
          )}
          {err && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">{err}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(titles ?? []).map((t, i) => (
              <button
                key={i}
                onClick={() => useTitle(t)}
                disabled={busy}
                className={`card p-4 text-left hover:shadow-md transition-shadow ${chosen === t.title ? "ring-2 ring-brand-500" : ""}`}
              >
                <div className="font-semibold text-[15px]">{t.title}</div>
                <div className="mt-2 space-y-1 text-xs text-ink-600">
                  <div><b>Alasan:</b> {t.rationale}</div>
                  <div><b>Metode cocok:</b> {t.recommendedMethod}</div>
                  <div><b>Data:</b> {t.dataNeeded}</div>
                  <div className="text-emerald-700"><b>Plus:</b> {t.advantages}</div>
                  <div className="text-amber-700"><b>Risiko:</b> {t.risks}</div>
                </div>
                <div className="mt-3 text-brand-700 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Use This Title
                </div>
              </button>
            ))}
          </div>
          <div className="text-center">
            <button className="btn-ghost" onClick={() => router.push(`/projects/${projectId}`)} disabled={busy}>
              Lewati, langsung ke editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
