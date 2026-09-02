"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, XCircle } from "lucide-react";

/**
 * TaskOverlay — layar loading untuk tugas panjang (generate AI, scan impor,
 * export, dsb). Menampilkan judul tugas, timer berjalan, dan LOG bertahap.
 * Log diisi dari tahap NYATA pemanggil; saat menunggu jaringan, timer elapsed
 * tetap berjalan jujur. Opsional: tombol Batal (AbortController).
 */

export type TaskLog = { at: number; msg: string };
export type TaskState = { title: string; subtitle?: string; logs: TaskLog[] };

export function useTask() {
  const [task, setTask] = useState<TaskState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function start(title: string, subtitle?: string, firstLog = "Memulai…", cancelable = false) {
    abortRef.current = cancelable ? new AbortController() : null;
    setTask({ title, subtitle, logs: [{ at: Date.now(), msg: firstLog }] });
  }
  function log(msg: string) {
    setTask((s) => (s ? { ...s, logs: [...s.logs, { at: Date.now(), msg }] } : s));
  }
  function stop() {
    abortRef.current = null;
    setTask(null);
  }
  function cancel() {
    abortRef.current?.abort();
    setTask(null);
  }
  return { task, start, log, stop, cancel, signal: () => abortRef.current?.signal, running: !!task };
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function TaskOverlay({ task, onCancel }: { task: TaskState; onCancel?: () => void }) {
  const [now, setNow] = useState(Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [task.logs.length]);

  const t0 = task.logs[0]?.at ?? now;

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-xl bg-[#101114] border border-white/10 shadow-2xl text-[#f2ede3] overflow-hidden">
        {/* kepala */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-[#8db4ff]/25" />
              <Loader2 size={20} className="animate-spin text-[#8db4ff]" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{task.title}</div>
              {task.subtitle && <div className="text-xs text-white/50 truncate">{task.subtitle}</div>}
            </div>
            <div className="ml-auto font-mono text-sm text-[#8db4ff] tabular-nums">{fmt(now - t0)}</div>
          </div>
          {/* shimmer progres tak-berbatas */}
          <div className="mt-3 h-1 rounded bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 rounded bg-[#8db4ff]/70 animate-[slide_1.2s_ease-in-out_infinite]" />
          </div>
          <style>{`@keyframes slide { 0% { transform: translateX(-100%);} 100% { transform: translateX(400%);} }`}</style>
        </div>

        {/* log */}
        <div className="px-5 py-3 max-h-56 overflow-y-auto font-mono text-[11.5px] leading-relaxed">
          {task.logs.map((l, i) => {
            const last = i === task.logs.length - 1;
            return (
              <div key={i} className={`flex gap-2 ${last ? "text-[#f2ede3]" : "text-white/45"}`}>
                <span className="text-white/30 shrink-0">[{fmt(l.at - t0)}]</span>
                <span>
                  {l.msg}
                  {last && <span className="inline-block w-1.5 h-3 ml-1 align-middle bg-[#8db4ff] animate-pulse" />}
                </span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {onCancel && (
          <div className="px-5 pb-4">
            <button
              onClick={onCancel}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-sm text-white/70 hover:text-white hover:border-white/30 transition"
            >
              <XCircle size={15} /> Batalkan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
