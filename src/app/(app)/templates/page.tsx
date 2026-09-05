"use client";
import { useCallback, useEffect, useState } from "react";
import { ScrollText, Plus, Trash2, Wand2, CheckCircle2, AlertTriangle, SlidersHorizontal, Sparkles, Pencil } from "lucide-react";

type Tpl = {
  id: string;
  name: string;
  prodi: string;
  university: string;
  hasSource: boolean;
  updatedAt: string;
  config: any;
};

const FONTS = ["Times New Roman", "Arial", "Calibri", "Cambria", "Tahoma", "Garamond"];
const SPACING = [1, 1.15, 1.5, 2];
const CITES = ["APA7", "IEEE", "Harvard", "Vancouver"];

export default function TemplatesPage() {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", prodi: "", university: "", sourceText: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [presetFilter, setPresetFilter] = useState("Semua");
  const [parseInfo, setParseInfo] = useState<{ detected: string[]; warnings: string[]; config: any } | null>(null);

  /* editor per-aturan: null = tertutup */
  const [ed, setEd] = useState<{ id?: string; name: string; prodi: string; university: string; sourceText: string; config: any } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/templates").then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Template tersimpan belum bisa dimuat.");
        return j;
      }),
      fetch("/api/templates/presets").then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "Saran template belum bisa dimuat.");
        return j;
      }),
    ])
      .then(([saved, suggested]) => {
        setTpls(saved.templates || []);
        setPresets(suggested.presets || []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function analyze() {
    if (!form.sourceText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/templates/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: form.sourceText }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Pedoman belum bisa dianalisis.");
      setParseInfo(j);
      setMsg("Analisis selesai. Periksa peringatan sebelum menyimpan template.");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNew() {
    if (!form.name.trim()) return setMsg("Nama template wajib diisi.");
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg(`Template "${form.name}" tersimpan. ${j.detected?.length || 0} aturan terbaca dari pedoman.`);
      setForm({ name: "", prodi: "", university: "", sourceText: "" });
      setParseInfo(null);
      load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function usePreset(p: any) {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, prodi: p.prodi, university: p.university, config: p.config }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg(`Template "${p.name}" ditambahkan dari saran. Siap diterapkan ke proyek.`);
      load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  function tweakPreset(p: any) {
    setEd({ name: `${p.name} (salinan)`, prodi: p.prodi, university: p.university, sourceText: "", config: JSON.parse(JSON.stringify(p.config)) });
  }

  function tweakSaved(t: Tpl) {
    setEd({ id: t.id, name: t.name, prodi: t.prodi, university: t.university, sourceText: "", config: JSON.parse(JSON.stringify(t.config)) });
  }

  async function saveEditor() {
    if (!ed) return;
    if (!ed.name.trim()) return setMsg("Nama template wajib diisi.");
    setBusy(true);
    setMsg("");
    try {
      const body = JSON.stringify({ name: ed.name, prodi: ed.prodi, university: ed.university, sourceText: ed.sourceText || undefined, config: ed.config });
      const res = await fetch(ed.id ? `/api/templates/${ed.id}` : "/api/templates", {
        method: ed.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg(`Template "${ed.name}" tersimpan dengan aturan hasil pilihanmu.`);
      setEd(null);
      load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Hapus template "${name}"?`)) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Template belum bisa dihapus.");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const set = (path: string, v: any) => {
    if (!ed) return;
    const c = JSON.parse(JSON.stringify(ed.config));
    const keys = path.split(".");
    let cur = c;
    for (const k of keys.slice(0, -1)) cur = cur[k];
    cur[keys[keys.length - 1]] = v;
    setEd({ ...ed, config: c });
  };

  const Num = ({ label, path, step = 0.1, w = "w-20" }: any) => (
    <div>
      <div className="label">{label}</div>
      <input
        type="number"
        step={step}
        className={`input ${w}`}
        value={ed!.config[path.split(".")[0]]?.[path.split(".")[1]] ?? ""}
        onChange={(e) => set(path, e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );

  const Chk = ({ label, path }: any) => {
    const [a, b] = path.split(".");
    return (
      <label className="flex items-center gap-2 text-sm pr-3">
        <input type="checkbox" checked={!!ed!.config[a]?.[b]} onChange={(e) => set(path, e.target.checked)} />
        {label}
      </label>
    );
  };

  const categories = ["Semua", ...Array.from(new Set(presets.map((p) => p.category).filter(Boolean)))];
  const visiblePresets = presetFilter === "Semua" ? presets : presets.filter((p) => p.category === presetFilter);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText size={20} />
        <h1 className="text-xl font-bold">Template Pedoman Penulisan</h1>
      </div>
      <p className="text-sm text-gray-500">
        Pilih dari saran di bawah (bisa dipakai langsung atau disesuaikan <b>satu per satu</b> aturannya), atau tempel
        teks pedoman kampusmu sendiri. Template yang aktif menentukan format export DOCX/PDF proyek.
      </p>

      {msg && <div className="chip bg-blue-50 text-blue-700">{msg}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div>}

      {/* ===== SARAN TEMPLATE ===== */}
      <div className="space-y-3">
        <div className="font-semibold flex items-center gap-2">
          <Sparkles size={16} /> Saran template, pilih titik awal lalu sesuaikan
        </div>
        <p className="text-sm text-ink-500">Preset ini adalah contoh format umum. Cocokkan kembali dengan pedoman resmi kampus atau jurnalmu.</p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <button key={category} type="button" className={`chip !px-3 !py-1.5 ${presetFilter === category ? "bg-ink-950 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`} onClick={() => setPresetFilter(category)} aria-pressed={presetFilter === category}>
              {category}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="card p-8 text-center text-sm text-ink-400">Memuat saran template…</div>
        ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {visiblePresets.map((p) => (
            <div key={p.id} className="card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm">{p.name}</div>
                {p.category && <span className="chip bg-brand-50 text-brand-700 shrink-0">{p.category}</span>}
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">{p.description}</div>
              <div className="flex gap-2">
                <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => usePreset(p)} disabled={busy}>
                  Pakai
                </button>
                <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => tweakPreset(p)}>
                  <SlidersHorizontal size={12} /> Sesuaikan per-aturan
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* ===== DARI TEKS PEDOMAN ===== */}
      <div className="card p-4 space-y-3">
        <div className="font-semibold flex items-center gap-2">
          <Plus size={16} /> Template dari teks pedoman
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="label">Nama template</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pedoman Skripsi TI, UNPAM" />
          </div>
          <div>
            <div className="label">Program studi</div>
            <input className="input" value={form.prodi} onChange={(e) => setForm({ ...form, prodi: e.target.value })} placeholder="Teknik Informatika" />
          </div>
          <div>
            <div className="label">Universitas</div>
            <input className="input" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} placeholder="Universitas Pamulang" />
          </div>
        </div>
        <div>
          <div className="label">Teks pedoman (tempel utuh, boleh markdown/plain)</div>
          <textarea
            className="input h-40 font-mono text-xs"
            value={form.sourceText}
            onChange={(e) => setForm({ ...form, sourceText: e.target.value })}
            placeholder={"# TEMPLATE PEDOMAN PENULISAN SKRIPSI\nMargin:\n* Atas: 4 cm\n…"}
          />
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={analyze} disabled={busy || !form.sourceText.trim()}>
            <Wand2 size={14} /> Analisis dulu
          </button>
          <button className="btn-primary" onClick={saveNew} disabled={busy}>
            Simpan template
          </button>
          {parseInfo && (
            <button
              className="btn-outline"
              onClick={() =>
                setEd({ name: form.name || "Template baru", prodi: form.prodi, university: form.university, sourceText: form.sourceText, config: JSON.parse(JSON.stringify(parseInfo.config)) })
              }
            >
              <SlidersHorizontal size={14} /> Sesuaikan per-aturan
            </button>
          )}
        </div>

        {parseInfo && (
          <div className="border-t pt-3 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" /> {parseInfo.detected.length} aturan terbaca
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parseInfo.detected.map((d, i) => (
                <span key={i} className="chip bg-emerald-50 text-emerald-700">{d}</span>
              ))}
            </div>
            {parseInfo.warnings.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parseInfo.warnings.map((w, i) => (
                  <span key={i} className="chip bg-amber-50 text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={11} /> {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== TEMPLATE TERSIMPAN ===== */}
      <div className="space-y-3">
        <div className="font-semibold">Template tersimpan</div>
        {tpls.map((t) => (
          <div key={t.id} className="card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-gray-500">
                  {[t.prodi, t.university].filter(Boolean).join(", ") || "Tanpa prodi/universitas"}
                  {t.hasSource && " • teks pedoman tersimpan"}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn-outline !px-2 !py-1" onClick={() => tweakSaved(t)} title="Sesuaikan per-aturan">
                  <Pencil size={14} />
                </button>
                <button className="btn-outline !px-2 !py-1" onClick={() => remove(t.id, t.name)} title="Hapus">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="chip bg-gray-100">
                margin {t.config.margins?.top}/{t.config.margins?.right}/{t.config.margins?.bottom}/{t.config.margins?.left} cm
              </span>
              <span className="chip bg-gray-100">
                {t.config.body?.font} {t.config.body?.size}pt spasi {t.config.body?.lineSpacing}
              </span>
              <span className="chip bg-gray-100">indent {t.config.body?.firstLineIndentMm} mm</span>
              <span className="chip bg-gray-100">sitasi {t.config.citationStyle}</span>
              <span className="chip bg-gray-100">
                halaman awal {t.config.pageNumbering?.front === "lowerRoman" ? "romawi" : "arab"}
              </span>
            </div>
          </div>
        ))}
        {!tpls.length && (
          <div className="text-sm text-gray-400 border border-dashed rounded-lg p-6 text-center">
            Belum ada template tersimpan. Pakai salah satu saran di atas.
          </div>
        )}
      </div>

      {/* ===== EDITOR PER-ATURAN ===== */}
      {ed && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => setEd(null)}>
          <div className="card p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <SlidersHorizontal size={16} /> Sesuaikan aturan satu per satu
              </div>
              <button className="btn-ghost !px-2" onClick={() => setEd(null)}>✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="label">Nama template</div>
                <input className="input" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} />
              </div>
              <div>
                <div className="label">Ukuran kertas</div>
                <select className="input" value={ed.config.pageSize} onChange={(e) => setEd({ ...ed, config: { ...ed.config, pageSize: e.target.value } })}>
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
            </div>

            <fieldset className="border rounded-lg p-3 space-y-2">
              <legend className="text-xs font-bold px-1">HALAMAN & MARGIN (cm)</legend>
              <div className="flex gap-3 flex-wrap">
                <Num label="Atas" path="margins.top" step={0.1} />
                <Num label="Kiri" path="margins.left" step={0.1} />
                <Num label="Kanan" path="margins.right" step={0.1} />
                <Num label="Bawah" path="margins.bottom" step={0.1} />
              </div>
            </fieldset>

            <fieldset className="border rounded-lg p-3 space-y-2">
              <legend className="text-xs font-bold px-1">TEKS ISI</legend>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <div className="label">Font</div>
                  <select className="input w-40" value={ed.config.body?.font} onChange={(e) => set("body.font", e.target.value)}>
                    {FONTS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <Num label="Ukuran (pt)" path="body.size" step={1} />
                <div>
                  <div className="label">Spasi</div>
                  <select className="input w-24" value={ed.config.body?.lineSpacing} onChange={(e) => set("body.lineSpacing", Number(e.target.value))}>
                    {SPACING.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Num label="Spacing after (pt)" path="body.spacingAfterPt" step={1} />
                <Num label="Indentasi baris 1 (mm)" path="body.firstLineIndentMm" step={0.1} w="w-24" />
              </div>
            </fieldset>

            <fieldset className="border rounded-lg p-3 space-y-2">
              <legend className="text-xs font-bold px-1">HEADING</legend>
              <div className="flex flex-wrap">
                <Chk label="BAB kapital semua" path="heading1.uppercase" />
                <Chk label="BAB di tengah" path="heading1.centered" />
                <Chk label="BAB bold" path="heading1.bold" />
                <Chk label="BAB baru = halaman baru" path="heading1.pageBreakBefore" />
                <Chk label="Subbab bold" path="heading2.bold" />
                <Chk label="Anak subbab bold" path="heading3.bold" />
                <Chk label="Semua heading rata kiri (bukan tangga)" path="heading2.flushLeft" />
              </div>
            </fieldset>

            <fieldset className="border rounded-lg p-3 space-y-2">
              <legend className="text-xs font-bold px-1">NOMOR HALAMAN, SITASI & PUSTAKA</legend>
              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <div className="label">Nomor halaman awal</div>
                  <select className="input w-32" value={ed.config.pageNumbering?.front} onChange={(e) => set("pageNumbering.front", e.target.value)}>
                    <option value="lowerRoman">Romawi (i, ii)</option>
                    <option value="arabic">Arab (1, 2)</option>
                  </select>
                </div>
                <div>
                  <div className="label">Gaya sitasi</div>
                  <select className="input w-32" value={ed.config.citationStyle} onChange={(e) => set("citationStyle", e.target.value)}>
                    {CITES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="label">Spasi daftar pustaka</div>
                  <select className="input w-24" value={ed.config.references?.lineSpacing} onChange={(e) => set("references.lineSpacing", Number(e.target.value))}>
                    {SPACING.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Num label="Hanging indent (mm)" path="references.hangingIndentMm" step={0.1} w="w-24" />
              </div>
            </fieldset>

            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveEditor} disabled={busy}>
                <CheckCircle2 size={14} /> Simpan aturan
              </button>
              <button className="btn-outline" onClick={() => setEd(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
