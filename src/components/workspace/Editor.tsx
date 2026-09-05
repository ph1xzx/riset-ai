"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import TaskOverlay, { useTask } from "@/components/TaskOverlay";
import { useEditor, EditorContent, Editor as TTEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Highlight from "@tiptap/extension-highlight";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  Sparkles, Wand2, Bold, Italic, Underline as LU, Strikethrough, List, ListOrdered,
  Code, Quote as BQ, Link as LIcon, Table as TIcon, Image as IIcon, Undo2, Redo2, Heading1, Heading2,
  X, Check, Trash2, Loader2, ArrowRight, BookOpen, RefreshCw, ImagePlus, Search, Upload, Copy, History,
} from "lucide-react";
import { stripHtml, parseJsonArray } from "@/lib/json";
import { uploadFile } from "@/lib/upload";
import { countTables, normalizeTableHtml } from "@/lib/table-format";
import { cleanWordPaste } from "@/lib/word-paste";

/* ---------------- custom nodes ---------------- */

// Ghost text (saran autocomplete ala Jenni)
const GhostText = Node.create({
  name: "ghost",
  group: "inline",
  inline: true,
  content: "text*",
  parseHTML() {
    return [{ tag: "span.ghost-text" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "ghost-text" }), "…"];
  },
});

// Citasi inline (sudah divalidasi backend)
const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  content: "text*",
  atom: false,
  addAttributes() {
    return {
      sourceId: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "sup.citation" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["sup", mergeAttributes(HTMLAttributes, { class: "citation", "data-source-id": node.attrs.sourceId }), node.textContent];
  },
});

/* ---------------- diff word-level ---------------- */
function wordDiff(a: string, b: string): { left: { t: string; del: boolean }[]; right: { t: string; ins: boolean }[] } {
  const A = a.split(/(\s+)/);
  const B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left: { t: string; del: boolean }[] = [];
  const right: { t: string; ins: boolean }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      left.push({ t: A[i], del: false });
      right.push({ t: B[j], ins: false });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ t: A[i], del: true });
      i++;
    } else {
      right.push({ t: B[j], ins: true });
      j++;
    }
  }
  while (i < n) { left.push({ t: A[i], del: true }); i++; }
  while (j < m) { right.push({ t: B[j], ins: true }); j++; }
  return { left, right };
}

type StyleInfo = {
  block: string;
  marks: string[];
  inTable: boolean;
  selectedCharacters: number;
};

function readStyleInfo(ed: TTEditor): StyleInfo {
  const parent = ed.state.selection.$from.parent;
  const blockLabels: Record<string, string> = {
    paragraph: "Paragraf",
    heading: "Heading",
    blockquote: "Kutipan",
    bulletList: "Daftar poin",
    orderedList: "Daftar bernomor",
    codeBlock: "Blok kode",
    tableCell: "Sel tabel",
    tableHeader: "Header tabel",
  };
  const block = parent.type.name === "heading" ? `Heading ${parent.attrs.level}` : blockLabels[parent.type.name] || parent.type.name;
  const marks = [
    ed.isActive("bold") ? "Tebal" : "",
    ed.isActive("italic") ? "Miring" : "",
    ed.isActive("underline") ? "Garis bawah" : "",
    ed.isActive("strike") ? "Coret" : "",
    ed.isActive("link") ? "Tautan" : "",
    ed.isActive("highlight") ? "Sorotan" : "",
  ].filter(Boolean);
  return {
    block,
    marks,
    inTable: ed.isActive("table"),
    selectedCharacters: ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, " ").length,
  };
}

/* ---------------- component ---------------- */

type Props = {
  project: any;
  section: any;
  onSaved: () => void;
  notify: (t: string) => void;
};

const STATUS_LABEL: Record<string, string> = {
  EMPTY: "Kosong",
  DRAFTING: "Drafting",
  AI_DRAFT: "AI Draft — review dulu",
  USER_EDITED: "Edited",
  APPROVED: "Approved",
};

export default function Editor({ project, section, onSaved, notify }: Props) {
  const [busyGen, setBusyGen] = useState(false);
  const task = useTask();
  const [busyAc, setBusyAc] = useState(false);
  const [ghostActive, setGhostActive] = useState(false);
  const ghostReq = useRef<any>(null);
  const justSetGhost = useRef(false);
  const lastSave = useRef(0);
  const [promptOpen, setPromptOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [imgTab, setImgTab] = useState<"gen" | "url" | "search" | "upload">("gen");
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgQuery, setImgQuery] = useState("");
  const [imgResults, setImgResults] = useState<any[] | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgNote, setImgNote] = useState("");
  const [imgCaption, setImgCaption] = useState("");
  const [imgSection, setImgSection] = useState(""); // "" = section aktif
  const [imgLimit, setImgLimit] = useState<{ message: string; prompt: string } | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [promptVal, setPromptVal] = useState(section.prompt || "");
  const [citing, setCiting] = useState(false);
  const [citeQuery, setCiteQuery] = useState("");
  const [sel, setSel] = useState<{ from: number; to: number; text: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [customCmd, setCustomCmd] = useState("");
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  const [diffMode, setDiffMode] = useState<"selection" | "section">("selection");
  const [diffHtml, setDiffHtml] = useState<string>("");
  const [paraBusy, setParaBusy] = useState(false);
  const [ctxBusy, setCtxBusy] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ action: string; before: string; after: string; createdAt: string }>>([]);
  const [styleInspectorOpen, setStyleInspectorOpen] = useState(false);
  const [styleInfo, setStyleInfo] = useState<StyleInfo | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`riset.ai-history.${section.id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setAiHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAiHistory([]);
    }
  }, [section.id]);

  function rememberAiChange(action: string, before: string, after: string) {
    const entry = { action, before, after, createdAt: new Date().toISOString() };
    setAiHistory((current) => {
      const next = [entry, ...current].slice(0, 20);
      try {
        localStorage.setItem(`riset.ai-history.${section.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Tulis di sini — atau klik Generate AI…" }),
      CharacterCount,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      GhostText,
      Citation,
    ],
    content: section.content || "",
    editorProps: {
      attributes: { class: "tiptap", "data-placeholder": "Tulis di sini — atau klik Generate AI…" },
      transformPastedHTML: cleanWordPaste,
    },
    onCreate: ({ editor }) => setStyleInfo(readStyleInfo(editor)),
    onTransaction: ({ editor }) => setStyleInfo(readStyleInfo(editor)),
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setSel({ from, to, text: editor.state.doc.textBetween(from, to, " ") });
      } else setSel(null);
      setStyleInfo(readStyleInfo(editor));
    },
  });

  // reset prompt field saat section berubah
  useEffect(() => {
    setPromptVal(section.prompt || "");
  }, [section.id, section.prompt]);

  // Card aksi di panel kanan → fokus editor, scroll, BLOCK teks yang akan diganti.
  // Pakai ref "latest" agar handler selalu melihat state/function render terbaru.
  // Blokir rentang teks via chain command TipTap: selectAll untuk seluruh
  // section, setTextSelection {from,to} untuk rentang (clamp otomatis).
  const selectRange = (from: number, to: number) => {
    const ed = editor;
    if (!ed) return;
    const size = ed.state.doc.content.size;
    if (from <= 0 && to >= size) {
      ed.chain().focus().selectAll().scrollIntoView().run();
    } else {
      const f = Math.max(0, Math.min(from, size));
      const t = Math.max(f, Math.min(to, size));
      ed.chain().focus().setTextSelection({ from: f, to: t }).scrollIntoView().run();
    }
  };

  const wsActionRef = useRef<(action: string, detail?: any) => void>(() => {});
  wsActionRef.current = (action: string, detail?: any) => {
    const ed = editor;
    if (!ed) return;
    const s = ed.state.selection;
    const block = { from: s.$from.start(), to: s.$from.end() };
    if (action === "focus") {
      ed.chain().focus().scrollIntoView().run();
    } else if (action === "cite") {
      // blokir paragraf tempat kursor; sitasi disisipkan di posisi blok
      selectRange(block.from, block.to);
      setCiting(true);
    } else if (action === "paraphrase") {
      // konfirmasi dulu (dialog boleh me-reset selection), lalu BLOCK seluruh
      // isi section = teks yang akan diganti, baru jalankan flow
      const text = stripHtml(section.content);
      if (text.trim().length < 40) {
        notify("Section masih terlalu pendek untuk diparafrase.");
        return;
      }
      if (!confirm("Parafrase seluruh isi section ini?")) return;
      selectRange(0, ed.state.doc.content.size);
      setTimeout(() => paraphrase(true), 80);
    } else if (action === "aiedit") {
      if (!s.empty && s.to - s.from > 1) {
        ed.chain().focus().scrollIntoView().run();
        runEdit("Parafrase", { from: s.from, to: s.to, text: ed.state.doc.textBetween(s.from, s.to, " ") });
      } else {
        selectRange(block.from, block.to);
        notify("Paragraf diblok — klik kartu AI Edit lagi untuk meneruskannya.");
      }
    } else if (action === "append-image") {
      // dari Saran Gambar: sisipkan gambar + caption di AKHIR section aktif
      const d = detail as { url: string; caption?: string } | undefined;
      if (d?.url) appendImageNode(d.url, d.caption);
    } else if (action === "open-image-search") {
      // dari Saran Gambar (jenis logo): buka modal Gambar tab "Cari" dengan query terisi
      const q = String((detail as any)?.query || "");
      setImgTab("search");
      setImgQuery(q);
      setImgNote("");
      setImgLimit(null);
      setImgOpen(true);
    } else if (action === "italicize-term") {
      italicizeTerm(String((detail as any)?.term || ""));
    } else if (action === "insert-citation") {
      const d = detail as { claim?: string; citationText?: string; sourceId?: string } | undefined;
      if (d?.sourceId && d?.citationText) {
        const docText = ed.state.doc.textBetween(0, ed.state.doc.content.size, " ");
        let inserted = false;
        if (d.claim && docText.includes(d.claim.trim())) {
          const targetClaim = d.claim.trim();
          ed.state.doc.descendants((node, pos) => {
            if (!inserted && node.isText && node.text && node.text.includes(targetClaim)) {
              const idx = node.text.indexOf(targetClaim);
              const targetPos = pos + idx + targetClaim.length;
              ed.chain().focus().setTextSelection(targetPos).insertContent(` <sup class="citation" data-source-id="${d.sourceId}">${d.citationText}</sup>`).run();
              inserted = true;
              return false;
            }
          });
        }
        if (!inserted) {
          ed.chain().focus().insertContent(` <sup class="citation" data-source-id="${d.sourceId}">${d.citationText}</sup>`).run();
        }
        onSaved();
      }
    }
  };
  /* ---------------- gambar ---------------- */
  // TipTap butuh view ter-mount sebelum chain command jalan (penting saat
  // section baru remount untuk insert cross-section). Retry ringan.
  function whenEditorReady(fn: (ed: TTEditor) => void, tries = 20) {
    let n = 0;
    const tick = () => {
      const ed = editor;
      if (ed && (ed as any).view) {
        fn(ed);
      } else if (n < tries) {
        n++;
        setTimeout(tick, 40);
      }
    };
    tick();
  }

  function appendImageNode(url: string, caption?: string) {
    whenEditorReady((ed) => {
      // satu insertContent (1 transaction) → pasti lolos throttle autosave
      const cap = caption ? `<p><em>${caption.replace(/</g, "&lt;")}</em></p>` : "";
      ed
        .chain()
        .focus("end")
        .insertContent(`<p><img src="${url}" /></p>${cap}`)
        .run();
      // paksa save agar langsung persist (jangan andalkan throttle)
      const html = ed.getHTML();
      fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: html }),
      }).catch(() => {});
      onSaved();
    });
  }

  function italicizeTerm(term: string) {
    const ed = editor;
    const value = term.trim();
    if (!ed || !value) return;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z])(${escaped})(?=$|[^A-Za-z])`, "gi");
    const ranges: Array<{ from: number; to: number }> = [];
    ed.state.doc.descendants((node, pos, parent) => {
      if (!node.isText || !node.text || parent?.type.name === "citation" || node.marks.some((mark) => mark.type.name === "italic")) return;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(node.text)) !== null) {
        const from = pos + match.index + match[1].length;
        ranges.push({ from, to: from + match[2].length });
        if (!match[0].length) pattern.lastIndex++;
      }
    });
    if (!ranges.length) {
      notify(`Istilah "${value}" tidak ditemukan di section aktif.`);
      return;
    }
    const chain = ed.chain().focus();
    for (const range of ranges.reverse()) chain.setTextSelection(range).setItalic();
    chain.run();
    onSaved();
  }

  async function formatTables() {
    const ed = editor;
    if (!ed) return;
    const before = ed.getHTML();
    const tableCount = countTables(before);
    if (!tableCount) {
      notify("Belum ada tabel di section aktif.");
      return;
    }
    const after = normalizeTableHtml(before);
    if (after === before) {
      notify("Tabel di section ini sudah rapi.");
      return;
    }
    ed.chain().focus().setContent(after).run();
    try {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: after, status: "USER_EDITED" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Tabel belum tersimpan.");
      notify(`${tableCount} tabel dirapikan. Header, kolom, dan baris sudah diseragamkan.`);
      onSaved();
    } catch (e: any) {
      notify(e.message || "Tabel belum tersimpan.");
    }
  }

  function insertImage(url: string, caption?: string) {
    const ed = editor;
    if (!ed) return;
    // sisip di kursor (atau akhir section jika tidak ada kursor eksplisit)
    ed.chain().focus().setImage({ src: url }).run();
    if (caption) {
      ed.chain().focus().insertContent({ type: "paragraph", content: [{ type: "text", text: caption, marks: [{ type: "italic" }] }] }).run();
    }
    setImgOpen(false);
    setImgCaption("");
    onSaved();
  }

  // Sisipkan gambar ke section PILIHAN user (bukan selalu section aktif).
  // Section aktif → insert di kursor; section lain → append ke kontennya via API.
  function insertImageAt(targetId: string, url: string, caption?: string) {
    if (targetId === section.id) {
      insertImage(url, caption);
      return;
    }
    const t = (project.sections || []).find((s: any) => s.id === targetId);
    if (!t) {
      notify("Section tujuan tidak ditemukan.");
      return;
    }
    const cap = caption ? `<p><em>${caption.replace(/</g, "&lt;")}</em></p>` : "";
    fetch(`/api/sections/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `${t.content || ""}<p><img src="${url}" /></p>${cap}` }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal menyimpan section tujuan");
        notify(`Gambar disisipkan di section "${t.title}".`);
        onSaved();
      })
      .catch((e) => notify(e.message));
    setImgOpen(false);
    setImgCaption("");
  }

  async function runImageGenerate() {
    setImgBusy(true);
    setImgNote("");
    task.start("Generate gambar AI", undefined, "Mengirim prompt ke model gambar…", true);
    try {
      task.log("Menunggu gambar dirender (bisa 10–60 detik)…");
      const res = await fetch(`/api/projects/${project.id}/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt }),
        signal: task.signal(),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // limit kuota/rate → jangan cuma error: tampilkan prompt + opsi salin/upload
        if (j.limit) {
          setImgLimit({ message: j.error || "Limit generate gambar tercapai.", prompt: j.prompt || imgPrompt });
          return;
        }
        throw new Error(j.error);
      }
      setImgLimit(null);
      task.log("Gambar jadi — menyisipkan ke section…");
      insertImageAt(imgSection || section.id, j.url, imgCaption);
    } catch (e: any) {
      if (e.name !== "AbortError") setImgNote(e.message);
    } finally {
      task.stop();
      setImgBusy(false);
    }
  }

  async function runImageFetch() {
    setImgBusy(true);
    setImgNote("");
    try {
      const res = await fetch(`/api/projects/${project.id}/images/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: imgUrl }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      insertImageAt(imgSection || section.id, j.url, imgCaption);
    } catch (e: any) {
      setImgNote(e.message);
    } finally {
      setImgBusy(false);
    }
  }

  async function runImageUpload() {
    if (!imgFile) return;
    setImgBusy(true);
    setImgNote("");
    try {
      const url = await uploadFile(imgFile);
      insertImageAt(imgSection || section.id, url, imgCaption);
    } catch (e: any) {
      setImgNote(e.message);
    } finally {
      setImgBusy(false);
    }
  }

  function copyLimitPrompt() {
    if (!imgLimit) return;
    navigator.clipboard
      .writeText(imgLimit.prompt)
      .then(() => notify("Prompt disalin — tempel di tool gambar lain, lalu upload hasilnya."))
      .catch(() => notify("Gagal menyalin — blok manual teks promptnya."));
  }

  async function runImageSearch() {
    setImgBusy(true);
    setImgNote("");
    setImgResults(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/images/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: imgQuery }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setImgResults(j.results || []);
      if (j.note) setImgNote(j.note);
    } catch (e: any) {
      setImgNote(e.message);
    } finally {
      setImgBusy(false);
    }
  }

  useEffect(() => {
    (window as any).__risetEditor = editor; // debug hook
    function onWsAction(e: Event) {
      const d = (e as CustomEvent).detail || {};
      wsActionRef.current(String(d.action ?? ""), d);
    }
    window.addEventListener("ws:action", onWsAction);
    return () => {
      window.removeEventListener("ws:action", onWsAction);
      delete (window as any).__risetEditor;
    };
  }, [editor]);

  const hasGhost = useCallback(() => {
    if (!editor) return false;
    let found = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "ghost") found = true;
      return !found;
    });
    return found;
  }, [editor]);

  // ops manual ProseMirror (ghost + citasi)
  const ghostOps = {
    setGhost(text: string) {
      if (!editor) return;
      const { state } = editor;
      const $from = state.selection.$from;
      const blockEnd = $from.end($from.depth);
      const node = editor.schema.nodes.ghost.create(null, [editor.schema.text(text)]);
      justSetGhost.current = true;
      editor.view.dispatch(state.tr.insert(blockEnd, node));
    },
    removeGhost() {
      if (!editor) return false;
      let removed = false;
      const tr = editor.state.tr;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "ghost") {
          tr.delete(pos, pos + node.nodeSize);
          removed = true;
          return false;
        }
        return true;
      });
      if (removed) editor.view.dispatch(tr);
      return removed;
    },
    acceptGhost() {
      if (!editor) return false;
      let found: { pos: number; size: number; text: string } | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "ghost" && !found) {
          found = { pos, size: node.nodeSize, text: node.textContent };
          return false;
        }
        return true;
      });
      const f = found as { pos: number; size: number; text: string } | null;
      if (!f) return false;
      editor.view.dispatch(editor.state.tr.replaceWith(f.pos, f.pos + f.size, editor.schema.text(f.text)));
      return true;
    },
    insertCitation(attrs: { sourceId: string; display: string }) {
      if (!editor) return;
      const node = editor.schema.nodes.citation.create({ sourceId: attrs.sourceId }, [
        editor.schema.text(` ${attrs.display} `),
      ]);
      const { from, to } = editor.state.selection;
      editor.view.dispatch(editor.state.tr.replaceSelectionWith(node).scrollIntoView());
      void from; void to;
    },
  };

  // autosave
  useEffect(() => {
    if (!editor) return;
    const f = editor.on("transaction", () => {
      const now = Date.now();
      if (now - lastSave.current < 1000) return;
      lastSave.current = now;
      const html = editor.getHTML();
      fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: html }),
      }).catch(() => {});
    });
    return () => {
      f.off("transaction");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, section.id]);

  // ghost trigger
  const scheduleGhost = useCallback(() => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    if ($from.parent.type.spec.code) return;
    const text = $from.parent.textContent;
    if (text.length < 60) return;
    if (hasGhost()) return;
    clearTimeout(ghostReq.current);
    ghostReq.current = setTimeout(async () => {
      if (editor.isDestroyed) return;
      const sel = editor.state.selection;
      const nf = sel.$from;
      if (sel.from !== sel.to || sel.from !== nf.end(nf.depth)) return; // cursor harus di ujung
      if (hasGhost()) return;
      const para = nf.parent.textContent.slice(-900);
      setBusyAc(true);
      try {
        const res = await fetch(`/api/projects/${project.id}/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: section.id, paragraph: para }),
        });
        const j = await res.json();
        if (!res.ok) {
          if (j.error && /API key|belum/i.test(j.error)) notify(j.error);
          return;
        }
        if (j.suggestion?.trim()) {
          if (!editor.isDestroyed) {
            ghostOps.setGhost(j.suggestion.trim());
            setGhostActive(true);
          }
        }
      } catch {
        /* silent */
      } finally {
        setBusyAc(false);
      }
    }, 1200);
  }, [editor, project.id, section.id, hasGhost, notify]);

  useEffect(() => {
    if (!editor) return;
    const f = editor.on("update", () => {
      if (justSetGhost.current) {
        justSetGhost.current = false;
        return; // update dari sisipan ghost sendiri
      }
      // ketik user → hapus ghost lama
      if (hasGhost()) {
        ghostOps.removeGhost();
        setGhostActive(false);
      }
      scheduleGhost();
    });
    return () => {
      f.off("update");
    };
  }, [editor, scheduleGhost, hasGhost]);

  const acceptGhost = useCallback(() => {
    if (!editor) return false;
    if (!hasGhost()) return false;
    ghostOps.acceptGhost();
    setGhostActive(false);
    notify("Saran diterima (Tab/→)");
    return true;
  }, [editor, hasGhost, notify]);

  const dismissGhost = useCallback(() => {
    if (!editor || !hasGhost()) return;
    ghostOps.removeGhost();
    setGhostActive(false);
  }, [editor, hasGhost]);

  /* ---------------- actions ---------------- */

  async function generate() {
    if (!editor) return;
    if (stripHtml(section.content).length > 100 && !confirm("Section sudah berisi — overwrite draf dengan AI?")) return;
    setBusyGen(true);
    task.start("Generate draf AI", section.title, "Mengirim konteks section ke model…", true);
    try {
      task.log("Menunggu respons model (bisa 30–90 detik)…");
      const res = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id }),
        signal: task.signal(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log("Draf diterima — memasang ke editor…");
      editor.chain().focus().setContent(j.html).run();
      onSaved();
      const nCite = (j.html.match(/<sup class="citation"/g) || []).length;
      notify(
        j.rejectedTokens?.length
          ? `Draf dibuat — ${j.rejectedTokens.length} sitasi fiktif DITOLAK backend (citation safety).`
          : `Draf AI dibuat dengan ${nCite} sitasi terverifikasi.`
      );
    } catch (e: any) {
      if (e.name !== "AbortError") notify(e.message);
    } finally {
      task.stop();
      setBusyGen(false);
    }
  }

  async function runEdit(
    command: string,
    explicitSel?: { from: number; to: number; text: string }
  ) {
    const useSel = explicitSel ?? sel;
    if (!editor || !useSel) return;
    setSel(useSel);
    setEditBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id, selection: useSel.text, command }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setDiffMode("selection");
      setDiff({ before: useSel.text, after: j.result });
    } catch (e: any) {
      notify(e.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function applyEdit() {
    if (!editor || !diff) return;
    const appliedDiff = diff;
    if (diffMode === "section" && diffHtml) {
      editor.chain().focus().setContent(diffHtml).run();
    } else if (sel) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: sel.from, to: sel.to })
        .insertContent(diff.after)
        .run();
      setSel(null);
    }
    rememberAiChange(diffMode === "section" ? "Parafrase section" : "AI Edit", appliedDiff.before, appliedDiff.after);
    try {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editor.getHTML(), status: "USER_EDITED" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Perubahan belum tersimpan.");
    } catch (e: any) {
      notify(e.message || "Perubahan belum tersimpan.");
    }
    setDiff(null);
    setDiffHtml("");
    onSaved();
  }

  async function paraphrase(skipConfirm = false) {
    if (!editor) return;
    const text = stripHtml(section.content);
    if (text.trim().length < 40) {
      notify("Section masih terlalu pendek untuk diparafrase.");
      return;
    }
    if (!skipConfirm && !confirm("Parafrase seluruh isi section ini? (versi lama bisa di-undo)")) return;
    setParaBusy(true);
    task.start("Parafrase section", section.title, "Mengirim teks ke model…", true);
    try {
      task.log("Menunggu hasil parafrase…");
      const res = await fetch(`/api/projects/${project.id}/paraphrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: section.id }),
        signal: task.signal(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      task.log("Hasil diterima — menyiapkan perbandingan…");
      setDiffMode("section");
      setDiffHtml(j.html);
      setDiff({ before: j.before, after: j.after });
    } catch (e: any) {
      if (e.name !== "AbortError") notify(e.message);
    } finally {
      task.stop();
      setParaBusy(false);
    }
  }

  async function insertWithContext(sourceId: string, display: string) {
    const ed = editor;
    if (!ed) return;
    setCtxBusy(sourceId);
    try {
      const res = await fetch(`/api/projects/${project.id}/cite-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, sectionId: section.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error) notify(j.error);
        else ghostOps.insertCitation({ sourceId, display });
        return;
      }
      ed.chain().focus().insertContent(j.sentence).run();
      onSaved();
    } catch {
      ghostOps.insertCitation({ sourceId, display });
    } finally {
      setCtxBusy(null);
    }
  }

  async function setStatus(status: string) {
    await fetch(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onSaved();
  }

  async function savePrompt() {
    await fetch(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptVal }),
    });
    setPromptOpen(false);
    onSaved();
  }

  function keydown(e: React.KeyboardEvent) {
    if (e.key === "Tab" || e.key === "ArrowRight") {
      if (acceptGhost()) e.preventDefault();
    } else if (e.key === "Escape") {
      dismissGhost();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      if (sel) runEdit("Improve");
      else notify("Pilih teks dulu (Ctrl+J untuk AI Edit)");
    }
  }

  if (!editor) return <div className="p-8 text-ink-400 text-sm">Memuat editor…</div>;

  const st = section.status || "EMPTY";
  const sources = project.sources || [];
  const filteredSources = sources.filter((s: any) =>
    (s.title + " " + (s.journal || "")).toLowerCase().includes(citeQuery.toLowerCase())
  );

  const EDIT_CMDS = [
    "Improve Academic Writing",
    "Paraphrase",
    "More Critical",
    "Concise Academic",
    "Shorten",
    "Expand",
    "Simplify",
    "More Formal",
    "Fix Grammar",
    "Improve Coherence",
    "Add Evidence",
    "Add Citation",
  ];

  return (
    <div onKeyDown={keydown} className="h-full flex flex-col">
      {task.task && <TaskOverlay task={task.task} onCancel={task.cancel} />}
      {/* header section */}
      <div className="px-8 pt-4 pb-2 border-b border-ink-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-[72ch] mx-auto">
          <h2 className="text-lg font-bold flex-1 min-w-0 truncate">{section.title}</h2>
          <button
            className={`chip ${
              st === "APPROVED"
                ? "bg-emerald-100 text-emerald-700"
                : st === "AI_DRAFT"
                ? "bg-violet-100 text-violet-700"
                : "bg-ink-100 text-ink-600"
            }`}
          >
            {STATUS_LABEL[st] ?? st}
          </button>
          <select
            className="text-xs border border-ink-200 rounded-lg px-2 py-1 bg-white"
            value={st}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="EMPTY">Kosong</option>
            <option value="DRAFTING">Drafting</option>
            <option value="AI_DRAFT">AI Draft</option>
            <option value="USER_EDITED">Edited</option>
            <option value="APPROVED">Approved</option>
          </select>
          <button className="btn-outline !py-1.5 text-xs" onClick={() => setPromptOpen(!promptOpen)}>
            Prompt
          </button>
          <button className="btn-outline !py-1.5 text-xs" onClick={() => setHistoryOpen(true)} title="Lihat riwayat perubahan AI di browser ini">
            <History size={13} /> <span className="hidden 2xl:inline">Riwayat AI</span>
          </button>
          <button
            type="button"
            className={`btn-outline !py-1.5 text-xs ${styleInspectorOpen ? "bg-brand-50 text-brand-700 border-brand-200" : ""}`}
            onClick={() => {
              setStyleInspectorOpen((open) => !open);
              if (editor) setStyleInfo(readStyleInfo(editor));
            }}
            aria-pressed={styleInspectorOpen}
            title="Lihat format blok dan teks yang sedang dipilih"
          >
            <Search size={13} /> <span className="hidden 2xl:inline">Inspector</span>
          </button>
          <button className="btn-outline !py-1.5 text-xs" onClick={() => paraphrase()} disabled={paraBusy} title="Tulis ulang section dengan kata-kata baru; sitasi dijaga">
            {paraBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Parafrase
          </button>
          <button className="btn-primary !py-1.5 text-xs" onClick={generate} disabled={busyGen}>
            {busyGen ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {busyGen ? "Generating…" : "Generate AI"}
          </button>
        </div>
        {promptOpen && (
          <div className="mt-2 max-w-[72ch] mx-auto flex gap-2 items-start">
            <textarea
              className="input flex-1 !text-xs"
              rows={2}
              value={promptVal}
              onChange={(e) => setPromptVal(e.target.value)}
              placeholder="Instruksi khusus untuk sub-bab ini (cth: fokus pada data kuesioner 85 responden)…"
            />
            <button className="btn-ghost !py-1.5 text-xs" onClick={savePrompt}>
              <Check size={13} /> Simpan
            </button>
          </div>
        )}
      </div>

      {styleInspectorOpen && styleInfo && (
        <div className="border-b border-ink-100 bg-ink-50/70 px-8 py-2">
          <div className="max-w-[72ch] mx-auto flex flex-wrap items-center gap-2 text-[11px] text-ink-600">
            <span className="font-semibold text-ink-800">Inspector format</span>
            <span className="chip bg-white text-ink-600">Blok: {styleInfo.block}</span>
            <span className="chip bg-white text-ink-600">Pilihan: {styleInfo.selectedCharacters} karakter</span>
            {styleInfo.inTable && <span className="chip bg-amber-100 text-amber-700">Di dalam tabel</span>}
            {styleInfo.marks.length ? (
              styleInfo.marks.map((mark) => <span key={mark} className="chip bg-brand-100 text-brand-700">{mark}</span>)
            ) : (
              <span className="chip bg-white text-ink-400">Tanpa mark</span>
            )}
            <span className="text-ink-400 basis-full sm:basis-auto">Paste dari Word dibersihkan otomatis. Profil format kampus dipakai saat export.</span>
            <button type="button" className="btn-ghost !px-1.5 !py-1 ml-auto" onClick={() => setStyleInspectorOpen(false)} aria-label="Tutup inspector format">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* toolbar */}
      <div className="border-b border-ink-100 bg-white px-8 py-1.5 sticky top-[64px] z-10">
        <div className="flex items-center gap-0.5 max-w-[72ch] mx-auto flex-wrap">
          <TBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 size={14} /></TBtn>
          <TBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 size={14} /></TBtn>
          <Sep />
          <TBtn title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} on={editor.isActive("heading", { level: 1 })}><Heading1 size={14} /></TBtn>
          <TBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} on={editor.isActive("heading", { level: 2 })}><Heading2 size={14} /></TBtn>
          <Sep />
          <TBtn title="Tebal" onClick={() => editor.chain().focus().toggleBold().run()} on={editor.isActive("bold")}><Bold size={14} /></TBtn>
          <TBtn title="Miring" onClick={() => editor.chain().focus().toggleItalic().run()} on={editor.isActive("italic")}><Italic size={14} /></TBtn>
          <TBtn title="Garis bawah" onClick={() => editor.chain().focus().toggleUnderline().run()} on={editor.isActive("underline")}><LU size={14} /></TBtn>
          <TBtn title="Coret" onClick={() => editor.chain().focus().toggleStrike().run()} on={editor.isActive("strike")}><Strikethrough size={14} /></TBtn>
          <Sep />
          <TBtn title="Daftar poin" onClick={() => editor.chain().focus().toggleBulletList().run()} on={editor.isActive("bulletList")}><List size={14} /></TBtn>
          <TBtn title="Daftar bernomor" onClick={() => editor.chain().focus().toggleOrderedList().run()} on={editor.isActive("orderedList")}><ListOrdered size={14} /></TBtn>
          <TBtn title="Kutipan" onClick={() => editor.chain().focus().toggleBlockquote().run()} on={editor.isActive("blockquote")}><BQ size={14} /></TBtn>
          <TBtn title="Kode" onClick={() => editor.chain().focus().toggleCode().run()} on={editor.isActive("code")}><Code size={14} /></TBtn>
          <Sep />
          <TBtn
            onClick={() => {
              const url = window.prompt("URL link:");
              if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
            on={editor.isActive("link")}
            title="Tautan"
          >
            <LIcon size={14} />
          </TBtn>
          <TBtn
            onClick={() => {
              setImgNote("");
              setImgLimit(null);
              setImgSection("");
              setImgFile(null);
              setImgOpen(true);
            }}
            on={editor.isActive("image")}
            title="Sisipkan gambar"
          >
            <IIcon size={14} />
          </TBtn>
          <TBtn
            onClick={() => {
              if (!editor.isActive("table"))
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              else editor.chain().focus().deleteTable().run();
            }}
            on={editor.isActive("table")}
            title={editor.isActive("table") ? "Hapus tabel" : "Sisipkan tabel"}
          >
            <TIcon size={14} />
          </TBtn>
          <TBtn onClick={formatTables} title="Rapikan tabel">
            <TIcon size={14} />
          </TBtn>
          <Sep />
          <button className="btn !py-1 !px-2 text-xs bg-brand-50 text-brand-700 hover:bg-brand-100" onClick={() => setCiting(true)}>
            <BookOpen size={13} /> Cite
          </button>
          <span className="ml-auto text-[11px] text-ink-400">
            {editor.storage.characterCount?.words?.() ?? 0} kata
            {ghostActive && <span className="text-violet-600 font-medium ml-2">✨ AI — Tab/→ terima, Esc tolak</span>}
            {busyAc && <Loader2 size={11} className="inline ml-2 animate-spin" />}
          </span>
        </div>
      </div>

      {/* editing surface */}
      <div className="relative">
        <EditorContent editor={editor} />

        {/* selection AI menu */}
        {sel && sel.text.length > 10 && (
          <div
            className="absolute z-30 card p-1.5 shadow-xl w-64"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              top: Math.max(8, editor.view.coordsAtPos(sel.to).top - 8),
            }}
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide flex items-center gap-1">
                <Wand2 size={11} /> AI Edit ({sel.text.split(/\s+/).length} kata)
              </span>
              <button className="text-ink-400 hover:text-ink-700" onClick={() => setSel(null)}>
                <X size={13} />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {EDIT_CMDS.map((c) => (
                <button
                  key={c}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-ink-50 flex items-center gap-2"
                  onClick={() => runEdit(c)}
                  disabled={editBusy}
                >
                  {editBusy ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} className="text-brand-500" />}
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-1 px-1">
              <input
                className="input !py-1 !text-xs flex-1"
                placeholder="Atur instruksi sendiri…"
                value={customCmd}
                onChange={(e) => setCustomCmd(e.target.value)}
              />
              <button className="btn-primary !py-1 !px-2 !text-xs" onClick={() => customCmd && runEdit(customCmd)} disabled={!customCmd.trim() || editBusy}>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {historyOpen && (
          <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-6" onClick={() => setHistoryOpen(false)}>
            <div className="card w-full max-w-2xl max-h-[80vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ai-history-title">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 id="ai-history-title" className="font-semibold flex items-center gap-2"><History size={16} className="text-brand-600" /> Riwayat perubahan AI</h3>
                  <p className="text-[11px] text-ink-400 mt-1">Perubahan yang sudah diterapkan di section ini, tersimpan di browser ini.</p>
                </div>
                <button type="button" className="btn-ghost !px-2" onClick={() => setHistoryOpen(false)} aria-label="Tutup riwayat AI"><X size={16} /></button>
              </div>
              {aiHistory.length === 0 ? (
                <div className="text-sm text-ink-400 border border-dashed border-ink-200 p-4 text-center">Belum ada perubahan AI yang diterapkan.</div>
              ) : (
                <div className="space-y-2">
                  {aiHistory.map((item, index) => (
                    <div key={`${item.createdAt}-${index}`} className="border border-ink-100 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="chip bg-brand-50 text-brand-700">{item.action}</span>
                        <time className="text-[10px] text-ink-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("id-ID")}</time>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed">
                        <div className="bg-rose-50/60 rounded p-2"><div className="font-semibold text-rose-700 mb-1">Sebelum</div>{item.before.slice(0, 280)}{item.before.length > 280 ? "…" : ""}</div>
                        <div className="bg-emerald-50/60 rounded p-2"><div className="font-semibold text-emerald-700 mb-1">Sesudah</div>{item.after.slice(0, 280)}{item.after.length > 280 ? "…" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* diff modal */}
        {diff && (
          <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-6">
            <div className="card w-full max-w-3xl max-h-[80vh] overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  {diffMode === "section" ? <RefreshCw size={16} className="text-brand-600" /> : <Wand2 size={16} className="text-brand-600" />}
                  {diffMode === "section" ? "Review hasil parafrase (seluruh section)" : "Review perubahan AI"}
                </h3>
                <button className="text-ink-400 hover:text-ink-700" onClick={() => setDiff(null)}><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm leading-relaxed">
                <div className="border border-ink-200 rounded-lg p-3 bg-rose-50/30">
                  <div className="text-[11px] font-semibold text-ink-400 mb-1.5">SEBELUM</div>
                  <p>
                    {wordDiff(diff.before, diff.after).left.map((w, i) => (
                      <span key={i} className={w.del ? "bg-rose-200 text-rose-800 line-through" : ""}>{w.t}</span>
                    ))}
                  </p>
                </div>
                <div className="border border-ink-200 rounded-lg p-3 bg-emerald-50/30">
                  <div className="text-[11px] font-semibold text-ink-400 mb-1.5">SESUDAH</div>
                  <p>
                    {wordDiff(diff.before, diff.after).right.map((w, i) => (
                      <span key={i} className={w.ins ? "bg-emerald-200 text-emerald-900" : ""}>{w.t}</span>
                    ))}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn-primary" onClick={applyEdit}>
                  <Check size={14} /> {diffMode === "section" ? "Ganti Isi Section" : "Terapkan"}
                </button>
                <button className="btn-outline" onClick={() => { setDiff(null); setDiffHtml(""); }}>
                  <Trash2 size={14} /> Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* cite modal */}
        {citing && (
          <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-6" onClick={() => setCiting(false)}>
            <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2"><BookOpen size={15} className="text-brand-600" /> Sisipkan sitasi</h3>
                <button className="text-ink-400 hover:text-ink-700" onClick={() => setCiting(false)}><X size={15} /></button>
              </div>
              <input className="input mb-2" placeholder="Cari dari library proyek…" value={citeQuery} onChange={(e) => setCiteQuery(e.target.value)} autoFocus />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {filteredSources.length === 0 && (
                  <div className="text-sm text-ink-400 p-3">
                    Library kosong — cari paper di Find Papers lalu simpan ke proyek. AI hanya boleh mengutip sumber di library (citation safety).
                  </div>
                )}
                {filteredSources.map((s: any) => {
                  const authors = parseJsonArray<string>(s.authors);
                  const display = `(${authors.slice(0, 2).join(", ")}${authors.length > 2 ? " et al." : ""}, ${s.year ?? "s.t."})`;
                  const isPdf = s.provider === "pdf";
                  return (
                    <div key={s.id} className="p-2.5 rounded-lg hover:bg-brand-50 border border-transparent hover:border-brand-200">
                      <div className="text-sm font-medium leading-snug">
                        {isPdf && <span className="chip bg-amber-100 text-amber-700 mr-1">PDF</span>}
                        {s.title}
                      </div>
                      <div className="text-[11px] text-ink-500 mt-0.5">{authors.slice(0, 3).join(", ")} • {s.journal} • {s.year}{!isPdf ? ` • ${s.citationCount} sitasi` : ""}</div>
                      {s.abstract && (
                        <div className="text-[11px] text-ink-400 mt-1 line-clamp-2">
                          Konteks: {s.abstract.slice(0, 160)}…
                        </div>
                      )}
                      <div className="flex gap-1.5 mt-2">
                        <button
                          className="btn-outline !py-1 !px-2 !text-[11px]"
                          onClick={() => {
                            ghostOps.insertCitation({ sourceId: s.id, display });
                            setCiting(false);
                            onSaved();
                          }}
                        >
                          <BookOpen size={11} /> Insert sitasi
                        </button>
                        <button
                          className="btn-outline !py-1 !px-2 !text-[11px]"
                          title="AI membuat kalimat konteks yang sesuai judul/abstrak sumber, lalu sisipkan beserta sitasinya"
                          onClick={() => insertWithContext(s.id, display)}
                          disabled={ctxBusy === s.id || ctxBusy !== null}
                        >
                          {ctxBusy === s.id ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} className="text-brand-500" />}
                          Sertakan kalimat konteks
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MODAL GAMBAR: Generate AI / Dari URL / Cari di web */}
        {imgOpen && (
          <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-6" onClick={() => setImgOpen(false)}>
            <div className="card w-full max-w-xl p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <ImagePlus size={16} className="text-brand-600" /> Sisipkan Gambar
                </h3>
                <button className="text-ink-400 hover:text-ink-700" onClick={() => setImgOpen(false)}><X size={16} /></button>
              </div>
              <div className="flex gap-1 mb-3">
                {(
                  [
                    ["gen", "Generate AI", Sparkles],
                    ["upload", "Upload File", Upload],
                    ["url", "Dari URL", LIcon],
                    ["search", "Cari di Web", Search],
                  ] as ["gen" | "url" | "search" | "upload", string, any][]
                ).map(([t, label, Icon]) => (
                  <button
                    key={t}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      imgTab === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-100 text-ink-500 hover:bg-ink-50"
                    }`}
                    onClick={() => setImgTab(t)}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              {imgTab === "gen" && (
                <div>
                  <div className="label">Prompt gambar</div>
                  <textarea
                    className="input min-h-[72px]"
                    placeholder="mis. Diagram alur penelitian: rumusan masalah → metode AHP-TOPSIS → hasil rekomendasi, gaya vektor bersih, label Bahasa Indonesia"
                    value={imgPrompt}
                    onChange={(e) => setImgPrompt(e.target.value)}
                  />
                  <div className="text-[11px] text-ink-400 mt-1">
                    Pakai API key di Settings. Base URL Google → endpoint gambar Gemini; OpenAI-compatible → <code>/images/generations</code>.
                  </div>
                </div>
              )}
              {imgTab === "upload" && (
                <div>
                  <div className="label">File gambar dari perangkat</div>
                  <input
                    type="file"
                    accept="image/*"
                    className="input !p-1.5"
                    onChange={(e) => setImgFile(e.target.files?.[0] || null)}
                  />
                  {imgFile && (
                    <div className="text-[11px] text-ink-600 mt-1">
                      Terpilih: <b>{imgFile.name}</b> ({(imgFile.size / 1024).toFixed(0)} KB)
                    </div>
                  )}
                  <div className="text-[11px] text-ink-400 mt-1">
                    PNG/JPG/GIF/WebP/SVG — disimpan ke storage proyek, ikut ter-embed saat Export DOCX.
                    Cocok dipakai saat generate AI kena limit: buat gambar di tool lain, upload di sini.
                  </div>
                </div>
              )}
              {imgTab === "url" && (
                <div>
                  <div className="label">URL gambar langsung</div>
                  <input
                    className="input"
                    placeholder="https://… (mis. URL langsung logo VS Code, diagram, foto)"
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                  />
                  <div className="text-[11px] text-ink-400 mt-1">
                    Gambar di-download & disimpan ke storage proyek — ikut masuk saat Export DOCX.
                  </div>
                </div>
              )}
              {imgTab === "search" && (
                <div>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="mis. logo vscode, flowchart research methodology…"
                      value={imgQuery}
                      onChange={(e) => setImgQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runImageSearch()}
                    />
                    <button className="btn-primary" onClick={runImageSearch} disabled={imgBusy || !imgQuery.trim()}>
                      {imgBusy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Cari
                    </button>
                  </div>
                  {imgResults && (
                    <div className="grid grid-cols-2 gap-2 mt-3 max-h-64 overflow-y-auto">
                      {imgResults.map((r: any, i: number) => (
                        <button
                          key={i}
                          className="border border-ink-100 rounded-lg p-2 text-left hover:border-brand-400 hover:bg-brand-50/40"
                          onClick={() => insertImageAt(imgSection || section.id, r.url, imgCaption)}
                          title={`Sisipkan: ${r.title}`}
                        >
                          <img src={r.url} alt={r.title} className="w-full h-24 object-contain bg-white rounded mb-1" />
                          <div className="text-[11px] font-medium leading-tight line-clamp-1">{r.title}</div>
                          <div className="text-[10px] text-ink-400">{r.source}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="label">Taruh gambar di section</div>
                  <select className="input" value={imgSection || section.id} onChange={(e) => setImgSection(e.target.value)}>
                    {(project.sections || []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.level === 2 ? "– " : ""}
                        {s.title}
                        {s.id === section.id ? " (aktif)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="label">Caption <span className="text-ink-400 font-normal">(opsional)</span></div>
                  <input className="input" placeholder="mis. Alur pemikiran penelitian" value={imgCaption} onChange={(e) => setImgCaption(e.target.value)} />
                </div>
              </div>

              {imgLimit && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Sparkles size={13} /> Generate gambar kena limit
                  </div>
                  <div className="mt-0.5">{imgLimit.message}</div>
                  <div className="mt-2 label !text-amber-800">Prompt kamu (siap pakai di tool gambar lain)</div>
                  <textarea className="input !text-xs min-h-[64px] bg-white" readOnly value={imgLimit.prompt} onFocus={(e) => e.currentTarget.select()} />
                  <div className="flex gap-2 mt-2">
                    <button className="btn-outline !py-1 !px-2 !text-[11px]" onClick={copyLimitPrompt}>
                      <Copy size={12} /> Salin Prompt
                    </button>
                    <button className="btn-primary !py-1 !px-2 !text-[11px]" onClick={() => setImgTab("upload")}>
                      <Upload size={12} /> Upload Gambar Manual
                    </button>
                  </div>
                </div>
              )}

              {imgNote && <div className="mt-2 text-[12px] text-rose-700 bg-rose-50 rounded-lg p-2">{imgNote}</div>}

              <div className="flex gap-2 mt-4">
                {imgTab === "gen" && (
                  <button className="btn-primary" onClick={runImageGenerate} disabled={imgBusy || !imgPrompt.trim()}>
                    {imgBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {imgBusy ? "Membuat gambar…" : "Generate & Sisipkan"}
                  </button>
                )}
                {imgTab === "upload" && (
                  <button className="btn-primary" onClick={runImageUpload} disabled={imgBusy || !imgFile}>
                    {imgBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {imgBusy ? "Mengunggah…" : "Upload & Sisipkan"}
                  </button>
                )}
                {imgTab === "url" && (
                  <button className="btn-primary" onClick={runImageFetch} disabled={imgBusy || !imgUrl.trim()}>
                    {imgBusy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                    {imgBusy ? "Mengunduh…" : "Download & Sisipkan"}
                  </button>
                )}
                {imgTab === "search" && (
                  <button className="btn-outline" onClick={() => setImgOpen(false)}>
                    <X size={14} /> Tutup
                  </button>
                )}
                <button className="btn-outline" onClick={() => setImgOpen(false)}>Batal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TBtn({ children, onClick, on, title }: { children: React.ReactNode; onClick: () => void; on?: boolean; title?: string }) {
  return (
    <button
      type="button"
      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md transition-colors ${on ? "bg-brand-100 text-brand-700" : "text-ink-500 hover:bg-ink-100"}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
function Sep() {
  return <div className="w-px h-4 bg-ink-200 mx-1" />;
}
