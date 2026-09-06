"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save } from "lucide-react";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const load = () =>
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => setErr("Gagal memuat template"));
  useEffect(() => {
    load();
  }, []);

  async function saveTemplate() {
    setErr("");
    try {
      const body = {
        name: editing.name,
        prodi: editing.prodi,
        university: editing.university,
        config: editing.config,
        hasSource: editing.hasSource,
      };
      const url = editing.id ? `/api/templates/${editing.id}` : "/api/templates";
      const method = editing.id ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan");
      setEditing(null);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-bold">Template Format Kampus</h1>
          <p className="text-[12px] text-ink-500 mt-0.5">Aturan margin, font, spasi, dan heading untuk ekspor DOCX.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setCreating(true);
            setEditing({
              id: "", name: "", prodi: "", university: "",
              config: {
                pageSize: "A4",
                margins: { top: 3, right: 3, bottom: 3, left: 4 },
                body: { font: "Times New Roman", size: 12, lineSpacing: 1.5, firstLineIndentMm: 12.7, spacingAfterPt: 6 },
                heading1: { bold: true, uppercase: true, centered: true, size: 12, pageBreakBefore: true },
                heading2: { bold: true, size: 12, flushLeft: true },
                heading3: { bold: false, size: 12, flushLeft: true },
                references: { lineSpacing: 1, hangingIndentMm: 12.7 },
              },
            });
          }}
        >
          <Plus size={14} /> Template Baru
        </button>
      </div>

      {err && <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{err}</div>}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium flex items-center gap-2">
                {t.name} {t.builtin && <span className="chip">bawaan</span>}
              </div>
              <div className="text-[11px] text-ink-500 mt-1 font-mono">
                margin {t.config.margins.left}/{t.config.margins.top}/{t.config.margins.right}/{t.config.margins.bottom}cm · {t.config.body.font} {t.config.body.size}pt · spasi {t.config.body.lineSpacing}
                {t.config.heading1.uppercase ? " · H1 KAPITAL" : ""}
                {t.config.heading1.pageBreakBefore ? " · H1 page-break" : ""}
              </div>
            </div>
            {!t.builtin && (
              <div className="flex gap-1 shrink-0">
                <button className="btn-ghost !h-8 !px-2" onClick={() => { setCreating(false); setEditing({ ...t, config: { ...t.config } }); }}>
                  <Pencil size={13} />
                </button>
                <button className="btn-ghost !h-8 !px-2 hover:!text-red-600" onClick={() => remove(t.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(editing) && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-auto thin-scroll p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-bold mb-4">{editing.id ? "Edit template" : "Template baru"}</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Nama</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Prodi</label>
                  <input className="input" value={editing.prodi} onChange={(e) => setEditing({ ...editing, prodi: e.target.value })} />
                </div>
                <div>
                  <label className="label">Universitas</label>
                  <input className="input" value={editing.university} onChange={(e) => setEditing({ ...editing, university: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Ukuran kertas</label>
                <select className="input" value={editing.config.pageSize} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, pageSize: e.target.value } })}>
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["left", "top", "right", "bottom"] as const).map((k) => (
                  <div key={k}>
                    <label className="label">Margin {k}</label>
                    <input className="input" type="number" step={0.5} value={editing.config.margins[k]} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, margins: { ...editing.config.margins, [k]: Number(e.target.value) } } })} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Font</label>
                  <input className="input" value={editing.config.body.font} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, body: { ...editing.config.body, font: e.target.value } } })} />
                </div>
                <div>
                  <label className="label">Size (pt)</label>
                  <input className="input" type="number" value={editing.config.body.size} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, body: { ...editing.config.body, size: Number(e.target.value) } } })} />
                </div>
                <div>
                  <label className="label">Spasi</label>
                  <select className="input" value={editing.config.body.lineSpacing} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, body: { ...editing.config.body, lineSpacing: Number(e.target.value) } } })}>
                    <option value={1}>1</option><option value={1.5}>1.5</option><option value={2}>2</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={!!editing.config.heading1.uppercase} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, heading1: { ...editing.config.heading1, uppercase: e.target.checked } } })} />
                  H1 KAPITAL
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={!!editing.config.heading1.centered} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, heading1: { ...editing.config.heading1, centered: e.target.checked } } })} />
                  H1 tengah
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={!!editing.config.heading1.pageBreakBefore} onChange={(e) => setEditing({ ...editing, config: { ...editing.config, heading1: { ...editing.config.heading1, pageBreakBefore: e.target.checked } } })} />
                  H1 halaman baru
                </label>
              </div>
              {err && <div className="text-[12px] text-red-600">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setEditing(null)}>Batal</button>
                <button className="btn-primary" onClick={saveTemplate} disabled={creating}>
                  <Save size={14} /> Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
