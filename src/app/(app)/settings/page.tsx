"use client";
import { useEffect, useState } from "react";
import { KeyRound, Save, CheckCircle2, AlertTriangle, Database } from "lucide-react";

export default function SettingsPage() {
  const [form, setForm] = useState({
    provider: "openai-compatible",
    baseUrl: "",
    apiKey: "",
    model: "",
    imageModel: "",
    temperature: 0.4,
    maxTokens: 4096,
  });
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [health, setHealth] = useState<any>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  async function runHealthCheck() {
    setHealthBusy(true);
    try {
      const j = await fetch("/api/health").then((r) => r.json());
      setHealth(j);
    } catch (e: any) {
      setHealth({ overall: "fail", runtime: "?", node: "?", checks: [{ name: "Endpoint /api/health", status: "fail", detail: e.message }] });
    } finally {
      setHealthBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((j) => {
      setStatus(j);
      setForm((f) => ({ ...f, provider: j.provider || "openai-compatible", baseUrl: j.baseUrl || "", model: j.model || "", imageModel: j.imageModel || "" }));
    });
  }, []);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, apiKey: form.apiKey || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setMsg("Tersimpan. API key hanya hidup di server (database), tidak pernah dikirim ke browser lagi.");
      setForm((f) => ({ ...f, apiKey: "" }));
      fetch("/api/settings").then((r) => r.json()).then(setStatus);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings — BYOK</h1>
        <p className="text-sm text-ink-500 mt-1">
          Bring Your Own API Key. Semua panggilan AI memakai provider pilihanmu; aplikasi tidak memakai key/akun siapa pun.
        </p>
      </div>

      {status && !status.configured && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          API key belum diset — fitur AI (generate, autocomplete, chat, review) masih terkunci. Pencarian paper &
          impor/ekspor DOCX tetap jalan.
        </div>
      )}

      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="label">Provider</div>
            <select className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>
          <div>
            <div className="label">Base URL</div>
            <input
              className="input"
              placeholder="https://api.openai.com/v1  (kosongkan untuk default)"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>
        </div>
        <div>
          <div className="label flex items-center gap-1.5">
            <KeyRound size={13} /> API Key
          </div>
          <input
            className="input"
            type="password"
            placeholder={status?.maskKey ? `tersimpan: ${status.maskKey}` : "sk-…"}
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          />
          <div className="text-[11px] text-ink-400 mt-1">
            Terenkripsi di sisi server (database). Tidak dikirim balik setelah disimpan.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="label">Model</div>
            <input className="input" placeholder="gpt-4o-mini / gemini-2.5-flash / llama3.1:8b / …" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div>
            <div className="label">Model Gambar <span className="text-ink-400 font-normal">(opsional)</span></div>
            <input className="input" placeholder="gemini-2.5-flash-image / dall-e-3 / …" value={form.imageModel} onChange={(e) => setForm({ ...form, imageModel: e.target.value })} />
          </div>
        </div>
        <div className="text-[11px] text-ink-500 bg-ink-50 rounded-lg p-2.5 leading-relaxed">
          <b>Generate gambar</b> memakai API key yang sama di atas. Jika Base URL adalah Google
          (<code>generativelanguage.googleapis.com</code>), endpoint gambar Gemini dipakai otomatis — isi
          <b> Model Gambar</b> mis. <code>gemini-2.5-flash-image</code> (kosongkan untuk auto-fallback).
          Provider OpenAI-compatible memakai <code>/images/generations</code>.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="label">Max tokens</div>
            <input className="input" type="number" value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <div className="label">Temperature ({form.temperature})</div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.1}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={busy}>
            <Save size={15} /> Simpan
          </button>
          {msg && (
            <span className="text-sm text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> {msg}
            </span>
          )}
          {err && <span className="text-sm text-rose-600">{err}</span>}
        </div>
      </div>

      <div className="card p-6">
        <div className="font-semibold flex items-center gap-2 mb-2">
          <Database size={16} className="text-brand-600" /> Infrastruktur
        </div>
        <ul className="text-sm text-ink-600 space-y-1.5">
          <li>
            • Supabase: <b>{status?.supabase ? "terhubung (Postgres + Storage)" : "belum diset — mode lokal (fallback)"}</b>
          </li>
          <li>• Akademik: OpenAlex + Crossref (keyless, gratis)</li>
          <li>• Contoh endpoint: OpenRouter <code className="text-xs bg-ink-100 px-1 rounded">https://openrouter.ai/api/v1</code>, Ollama{" "}
            <code className="text-xs bg-ink-100 px-1 rounded">http://localhost:11434/v1</code></li>
        </ul>
      </div>

      <div className="card p-6 space-y-3">
        <div className="font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="text-brand-600" /> Cek koneksi sistem
        </div>
        <p className="text-sm text-ink-600">
          Menguji seluruh konfigurasi env & layanan: database, skema tabel, Supabase Storage, AUTH_SECRET, konfigurasi
          AI, dan LibreOffice. Endpoint yang sama: <code className="text-xs bg-ink-100 px-1 rounded">/api/health</code>
        </p>
        <button className="btn-outline" onClick={runHealthCheck} disabled={healthBusy}>
          {healthBusy ? "Memeriksa…" : "Jalankan pemeriksaan"}
        </button>
        {health && (
          <div className="space-y-1.5">
            <div
              className={`chip ${
                health.overall === "ok" ? "bg-emerald-100 text-emerald-700" : health.overall === "warn" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
              }`}
            >
              Status keseluruhan: {health.overall.toUpperCase()} • {health.runtime} • node {health.node}
            </div>
            {health.checks.map((c: any, i: number) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 ${
                  c.status === "ok" ? "bg-emerald-50 text-emerald-800" : c.status === "warn" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
                }`}
              >
                <b>{c.status === "ok" ? "✓" : c.status === "warn" ? "⚠" : "✗"} {c.name}</b>
                <span className="block text-xs opacity-80">{c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
