"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, CheckCircle2, Circle, Wand2, PenLine } from "lucide-react";

type Props = {
  project: any;
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: (level: number) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (id: string, title: string) => void;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  EMPTY: { label: "Kosong", cls: "bg-ink-100 text-ink-500" },
  DRAFTING: { label: "Draft", cls: "bg-sky-100 text-sky-700" },
  AI_DRAFT: { label: "AI Draft", cls: "bg-violet-100 text-violet-700" },
  USER_EDITED: { label: "Edited", cls: "bg-sky-100 text-sky-700" },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
};

export default function StructureTree({ project, activeId, onSelect, onAdd, onDelete, onMove, onRename }: Props) {
  const [editing, setEditing] = useState<string>("");
  const [editVal, setEditVal] = useState("");
  const sections: any[] = project.sections || [];

  return (
    <aside className="w-72 shrink-0 bg-ink-50/60 border-r border-ink-200 flex flex-col">
      <div className="px-4 py-3 border-b border-ink-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Struktur Dokumen</div>
        <div className="text-[11px] text-ink-400 mt-0.5">Custom — dari pedoman atau impor, bebas edit</div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sections.map((s, i) => {
          const st = STATUS[s.status] ?? STATUS.EMPTY;
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={`group rounded-lg cursor-pointer transition-colors ${
                active ? "bg-white shadow-sm ring-1 ring-ink-200" : "hover:bg-white/70"
              }`}
              onClick={() => onSelect(s.id)}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <span className={active ? "w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" : "w-1.5 h-1.5 rounded-full bg-ink-200 shrink-0"} />
                {editing === s.id ? (
                  <input
                    autoFocus
                    className="flex-1 min-w-0 text-sm bg-transparent border border-brand-300 rounded px-1 py-0.5"
                    value={editVal}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditVal(e.target.value)}
                    onBlur={() => {
                      if (editVal.trim()) onRename(s.id, editVal.trim());
                      setEditing("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditing("");
                    }}
                  />
                ) : (
                  <span
                    className={`flex-1 min-w-0 truncate text-[13px] ${s.level >= 4 ? "pl-12 text-ink-500" : s.level === 3 ? "pl-8 text-ink-500" : s.level === 2 ? "pl-4 text-ink-600" : "font-semibold"} ${
                      active ? "text-ink-900" : ""
                    }`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditing(s.id);
                      setEditVal(s.title);
                    }}
                    title="Klik dua kali untuk rename"
                  >
                    {s.title}
                  </span>
                )}
                <span className={`chip ${st.cls} shrink-0`}>{st.label}</span>
                <div className="hidden group-hover:flex items-center shrink-0">
                  <button className="p-0.5 text-ink-400 hover:text-ink-700" title="Naik" onClick={(e) => { e.stopPropagation(); onMove(s.id, -1); }}>
                    <ChevronUp size={13} />
                  </button>
                  <button className="p-0.5 text-ink-400 hover:text-ink-700" title="Turun" onClick={(e) => { e.stopPropagation(); onMove(s.id, 1); }}>
                    <ChevronDown size={13} />
                  </button>
                  <button className="p-0.5 text-ink-400 hover:text-ink-700" title="Rename" onClick={(e) => { e.stopPropagation(); setEditing(s.id); setEditVal(s.title); }}>
                    <PenLine size={13} />
                  </button>
                  <button className="p-0.5 text-ink-400 hover:text-rose-600" title="Hapus" onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-ink-100 space-y-1">
        <button className="btn-ghost w-full justify-center !py-1.5 text-xs" onClick={() => onAdd(1)}>
          <Plus size={13} /> Section / Bab
        </button>
        <button className="btn-ghost w-full justify-center !py-1.5 text-xs" onClick={() => onAdd(2)}>
          <Plus size={13} /> Sub-bab
        </button>
        <button className="btn-ghost w-full justify-center !py-1.5 text-xs" onClick={() => onAdd(3)}>
          <Plus size={13} /> Sub-sub-bab
        </button>
      </div>
    </aside>
  );
}
