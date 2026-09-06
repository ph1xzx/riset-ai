"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TableExtension from "@tiptap/extension-table";
import {
  Bold, Italic, Underline as IconUnderline, Strikethrough, Highlighter, List, ListOrdered,
  Table, Link as IconLink, Undo2, Redo2, Heading1, Heading2, Heading3, AlignLeft, AlignCenter,
  Quote, RemoveFormatting, Quote as IconQuote, Check, X, Tag,
} from "lucide-react";

interface GhostState {
  from: number;
  to: number;
  done: boolean;
  error?: string;
}

interface EditorProps {
  projectId: string;
  sectionId: string;
  initialHtml: string;
  initialStatus: string;
  sources: any[];
  onCitationClick: (sourceId: string) => void;
  onStatusChange?: (status: string) => void;
}

const GhostMark = Mark.create({
  name: "ghost",
  parseHTML() {
    return [{ tag: "span[class='ghost-text']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "ghost-text" }, HTMLAttributes), 0];
  },
});

export function Editor({ projectId, sectionId, initialHtml, initialStatus, sources, onCitationClick, onStatusChange }: EditorProps) {
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [citePicker, setcitePicker] = useState(false);
  const ghostRef = useRef<GhostState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAbort = useRef<AbortController | null>(null);
  const sectionRef = useRef(sectionId);
  sectionRef.current = sectionId;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableExtension,
      GhostMark,
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: "tiptap prose-sm min-h-[60vh] px-2 py-4", spellcheck: "true" },
    },
    onUpdate: ({ editor }) => {
      setStatus("USER_EDITED");
      onStatusChange?.("USER_EDITED");
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(editor), 1200);
      scheduleAutocomplete();
    },
  });

  // Re-mount content when section changes
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(initialHtml || "");
    setGhost(null);
    ghostRef.current = null;
    setStatus(initialStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const persist = useCallback(
    async (ed: TiptapEditor) => {
      try {
        const res = await fetch(`/api/sections/${sectionRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: ed.getHTML(), status: "USER_EDITED" }),
        });
        setSaveState(res.ok ? "saved" : "idle");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("idle");
      }
    },
    []
  );

  // ---------- citation click (delegated on the DOM) ----------
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: MouseEvent) => {
      const sup = (e.target as HTMLElement).closest?.("sup.citation");
      if (sup) {
        e.preventDefault();
        const id = sup.getAttribute("data-source-id");
        if (id) onCitationClick(id);
      }
    };
    dom.addEventListener("click", handler);
    return () => dom.removeEventListener("click", handler);
  }, [editor, onCitationClick]);

  // ---------- ghost text autocomplete ----------
  const clearGhost = useCallback(() => {
    const g = ghostRef.current;
    if (g && editor) {
      const { tr } = editor.state;
      editor.view.dispatch(tr.delete(g.from, g.to));
    }
    ghostRef.current = null;
    setGhost(null);
    autoAbort.current?.abort();
  }, [editor]);

  const scheduleAutocomplete = useCallback(() => {
    if (!editor) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      const { state } = editor;
      const pos = state.selection.from;
      const $pos = state.doc.resolve(pos);
      const text = $pos.parent.textBetween(0, $pos.parent.content.size, " ");
      // only trigger at end of a paragraph with enough context
      if ($pos.parent.type.name !== "paragraph") return;
      if (pos !== $pos.parent.content.size) return;
      if (text.trim().length < 20) return;
      if (ghostRef.current) clearGhost();
      runAutocomplete(text, pos);
    }, 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const runAutocomplete = useCallback(
    async (prefix: string, insertPos: number) => {
      if (!editor) return;
      autoAbort.current?.abort();
      const ac = new AbortController();
      autoAbort.current = ac;
      try {
        const res = await fetch(`/api/projects/${projectId}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: sectionRef.current, prefix }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let gstate: GhostState = { from: insertPos, to: insertPos, done: false };
        ghostRef.current = gstate;
        setGhost({ ...gstate });
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            let j: any;
            try {
              j = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (j.type === "token" && editor && !ac.signal.aborted) {
              // ensure doc unchanged (user stopped typing) — check selection/length
              try {
                // insert the token, then apply the ghost mark over it
                const from = gstate.to;
                const trIns = editor.state.tr.insertText(j.t, from);
                const to = from + j.t.length;
                const ghostType = editor.state.schema.marks.ghost;
                const trMark = ghostType ? trIns.addMark(from, to, ghostType.create()) : trIns;
                editor.view.dispatch(trMark);
                gstate.to = to;
                ghostRef.current = gstate;
                setGhost({ ...gstate });
              } catch {
                break;
              }
            } else if (j.type === "done") {
              gstate.done = true;
              ghostRef.current = gstate;
              setGhost({ ...gstate });
            } else if (j.type === "error") {
              gstate.error = j.error;
              ghostRef.current = gstate;
              setGhost({ ...gstate });
            }
          }
        }
      } catch {
        /* aborted or network */
      }
    },
    [editor, projectId]
  );

  const acceptGhost = useCallback(() => {
    const g = ghostRef.current;
    if (!g || !editor) return;
    const tr = editor.state.tr;
    const markType = editor.state.schema.marks.ghost;
    if (markType) {
      editor.state.doc.nodesBetween(g.from, g.to, (node, pos) => {
        node.marks.forEach((m) => {
          if (m.type.name === "ghost") tr.removeMark(pos, pos + node.nodeSize, m);
        });
      });
    }
    editor.view.dispatch(tr);
    ghostRef.current = null;
    setGhost(null);
    if (editor) persist(editor);
  }, [editor, persist]);

  const rejectGhost = useCallback(() => {
    clearGhost();
  }, [clearGhost]);

  // keyboard: Tab accept / Esc reject
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: KeyboardEvent) => {
      if (!ghostRef.current) return;
      if (e.key === "Tab") {
        e.preventDefault();
        acceptGhost();
      } else if (e.key === "Escape") {
        e.preventDefault();
        rejectGhost();
      } else if (["Enter", "Backspace", "Delete"].includes(e.key)) {
        clearGhost();
      }
    };
    dom.addEventListener("keydown", handler);
    return () => dom.removeEventListener("keydown", handler);
  }, [editor, acceptGhost, rejectGhost, clearGhost]);

  // Insert citation token
  const insertCitation = (src: any) => {
    setcitePicker(false);
    if (!editor) return;
    const text = formatInline(src, "APA7");
    const html = `<sup class="citation" data-source-id="${src.id}">${text}</sup>`;
    editor.chain().focus().insertContent(html).run();
    setStatus("USER_EDITED");
  };

  const words = editor ? (editor.getText().trim().split(/\s+/).filter(Boolean).length || 0) : 0;

  if (!editor) {
    return <div className="p-8 text-[13px] text-ink-400">Memuat editor…</div>;
  }

  const TBtn = ({ on, children, title, onClick }: any) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-h-7 min-w-7 inline-flex items-center justify-center rounded ${on ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-100"}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-ink-200 bg-white flex-wrap">
        <TBtn title="Heading 1" on={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={13} /></TBtn>
        <TBtn title="Heading 2" on={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={13} /></TBtn>
        <TBtn title="Heading 3" on={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={13} /></TBtn>
        <span className="w-px h-4 bg-ink-200 mx-1" />
        <TBtn title="Bold" on={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={13} /></TBtn>
        <TBtn title="Italic" on={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={13} /></TBtn>
        <TBtn title="Underline" on={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><IconUnderline size={13} /></TBtn>
        <TBtn title="Strikethrough" on={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={13} /></TBtn>
        <TBtn title="Highlight" on={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={13} /></TBtn>
        <span className="w-px h-4 bg-ink-200 mx-1" />
        <TBtn title="List" on={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={13} /></TBtn>
        <TBtn title="List bernomor" on={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={13} /></TBtn>
        <TBtn title="Table" on={editor.isActive("table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table size={13} /></TBtn>
        <TBtn title="Quote" on={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><IconQuote size={13} /></TBtn>
        <span className="w-px h-4 bg-ink-200 mx-1" />
        <TBtn title="Rata kiri" on={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft size={13} /></TBtn>
        <TBtn title="Rata tengah" on={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter size={13} /></TBtn>
        <TBtn title="Bersihkan format" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={13} /></TBtn>
        <span className="w-px h-4 bg-ink-200 mx-1" />
        <TBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={13} /></TBtn>
        <TBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={13} /></TBtn>
        <div className="relative">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setcitePicker((v) => !v)} className="min-h-7 px-2 inline-flex items-center gap-1 rounded text-[11px] text-ink-600 hover:bg-ink-100">
            <Tag size={12} /> Sitasi
          </button>
          {citePicker && (
            <div className="absolute left-0 top-8 z-30 card shadow-lg p-1.5 w-72 max-h-64 overflow-auto thin-scroll">
              {sources.length === 0 && <div className="text-[11px] text-ink-400 p-2">Library kosong — tambah sumber di panel Sitasi.</div>}
              {sources.map((s) => (
                <button key={s.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-ink-50 text-[11px] leading-snug" onClick={() => insertCitation(s)}>
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink-400">{words} kata</span>
          <span className={`font-mono text-[10px] ${saveState === "saved" ? "text-emerald-600" : saveState === "saving" ? "text-amber-600" : "text-ink-400"}`}>
            {saveState === "saved" ? "Tersimpan ✓" : saveState === "saving" ? "Menyimpan…" : ""}
          </span>
          <select
            className="text-[10px] font-mono uppercase border border-ink-200 rounded px-1 py-0.5 bg-white text-ink-600"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              onStatusChange?.(e.target.value);
              fetch(`/api/sections/${sectionRef.current}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: e.target.value }),
              });
            }}
          >
            <option value="EMPTY">EMPTY</option>
            <option value="AI_DRAFT">AI_DRAFT</option>
            <option value="USER_EDITED">USER_EDITED</option>
            <option value="APPROVED">APPROVED</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto thin-scroll bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <EditorContent editor={editor} />
          {ghost && (
            <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-ink-400">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              Ghost text {ghost.done ? "siap" : "tiba…"} —{" "}
              <kbd>Tab</kbd> terima · <kbd>Esc</kbd> tolak
              <button onClick={acceptGhost} className="ml-1 text-emerald-600 hover:underline inline-flex items-center gap-0.5"><Check size={10} /> terima</button>
              <button onClick={rejectGhost} className="text-red-500 hover:underline inline-flex items-center gap-0.5"><X size={10} /> tolak</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatInline(s: any, _style: string): string {
  const last = (a: string) => a.trim().split(/\s+/).pop() || a;
  if (!s.authors?.length) return `(Anonim, ${s.year ?? "t.t."})`;
  if (s.authors.length === 1) return `(${last(s.authors[0])}, ${s.year ?? "t.t."})`;
  if (s.authors.length === 2) return `(${last(s.authors[0])} & ${last(s.authors[1])}, ${s.year ?? "t.t."})`;
  return `(${last(s.authors[0])} et al., ${s.year ?? "t.t."})`;
}
