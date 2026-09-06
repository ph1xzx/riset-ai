"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const PROVIDERS = [
  { v: "openrouter", label: "OpenRouter", base: "https://openrouter.ai/api/v1", hint: "1 model key untuk ratusan model", model: "anthropic/claude-sonnet-4" },
  { v: "gemini", label: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", hint: "AI Studio API key (Key-free tier tersedia)", model: "gemini-2.5-flash" },
  { v: "ollama", label: "Ollama (lokal)", base: "http://localhost:11434/v1", hint: "Model lokal, gratis & offline", model: "llama3.1" },
  { v: "custom", label: "OpenAI-compatible", base: "", hint: "Base URL lain (LM Studio, vLLM, gateway internal)", model: "" },
];

export default function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setErr("Gagal memuat settings"));
  }, []);

  if (!s) return <div className="p-6 text-[13px] text-ink-400">Memuat…</div>;

  function changeProvider(p: string) {
    const meta = PROVIDERS.find((x) => x.v === p)!;
    setS({ ...s, provider: p, baseUrl: meta.base, model: meta.model });
  }

  async function save() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: s.provider,
          baseUrl: s.baseUrl,
          model: s.model,
          imageModel: s.imageModel,
          temperature: s.temperature,
          maxTokens: s.maxTokens,
          apiKey,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan");
      setS({ ...s, ...j });
      setApiKey("");
      setOk("Tersimpan. Key hanya dikirim sekali ke server dan tidak pernah dikirim ke browser.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function testConn() {
    setTesting(true);
    setErr("");
    setOk("");
    try {
      // Save first so the test uses latest values
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: s.provider, baseUrl: s.baseUrl, model: s.model, imageModel: s.imageModel, temperature: s.temperature, maxTokens: s.maxTokens, apiKey }),
      });
      const res = await fetch("/api/health?json=1");
      const j = await res.json();
      const aiCheck = (j.checks || []).find((c: any) => c.name.includes("AI"));
      if (aiCheck?.status === "ok") setOk(`Koneksi OK — ${aiCheck.detail}`);
      else setErr(aiCheck?.detail || "Konfigurasi AI belum lengkap");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="font-display text-xl font-bold mb-1">Settings</h1>
      <p className="text-[12px] text-ink-500 mb-6">BYOK — API key milikmu. Key disimpan di server dan tidak pernah dikirim ke browser.</p>

      <div className="card p-5 space-y-5">
        <div>
          <label className="label">Provider</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.v}
                onClick={() => changeProvider(p.v)}
                className={`text-left border rounded-md p-3 transition-colors ${s.provider === p.v ? "border-ink-900 ring-2 ring-ink-200" : "border-ink-200 hover:border-ink-300"}`}
              >
                <div className="text-[13px] font-medium">{p.label}</div>
                <div className="text-[11px] text-ink-500 mt-0.5">{p.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Base URL</label>
          <input className="input font-mono !text-[12px]" value={s.baseUrl} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Model teks</label>
            <input className="input font-mono !text-[12px]" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} placeholder="mis. anthropic/claude-sonnet-4" />
          </div>
          <div>
            <label className="label">Model gambar (opsional)</label>
            <input className="input font-mono !text-[12px]" value={s.imageModel || ""} onChange={(e) => setS({ ...s, imageModel: e.target.value })} placeholder="mis. google/gemini-2.5-flash-image-preview" />
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><KeyRound size={12} /> API Key {s.maskKey && <span className="font-mono normal-case text-ink-400">(sekarang: {s.maskKey})</span>}</label>
          <input className="input font-mono !text-[12px]" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={s.maskKey ? "Kosongkan jika tidak diganti" : "Masukkan API key-mu"} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Temperature: {s.temperature}</label>
            <input type="range" min={0} max={1} step={0.1} value={s.temperature} onChange={(e) => setS({ ...s, temperature: Number(e.target.value) })} className="w-full accent-ink-900" />
          </div>
          <div>
            <label className="label">Max tokens: {s.maxTokens}</label>
            <input type="range" min={500} max={16000} step={500} value={s.maxTokens} onChange={(e) => setS({ ...s, maxTokens: Number(e.target.value) })} className="w-full accent-ink-900" />
          </div>
        </div>

        {err && <div className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-center gap-2"><AlertTriangle size={14} /> {err}</div>}
        {ok && <div className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 flex items-center gap-2"><CheckCircle2 size={14} /> {ok}</div>}

        <div className="flex gap-2">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
          <button className="btn-outline" onClick={testConn} disabled={testing}>
            {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Uji koneksi
          </button>
        </div>
      </div>

      <div className="card p-5 mt-4">
        <h2 className="font-display font-semibold text-[14px] mb-2">Catatan</h2>
        <ul className="text-[12px] text-ink-600 space-y-1.5 list-disc pl-4">
          <li>OpenRouter: satu key untuk ratusan model. Format model: <code className="font-mono">vendor/nama-model</code>.</li>
          <li>Gemini: gunakan endpoint OpenAI-compatible di atas; key dari AI Studio.</li>
          <li>Ollama: jalankan <code className="font-mono">ollama serve</code> di mesin yang sama dengan server.</li>
          <li>Model gambar (untuk generate diagram): isi "Model gambar" dengan model image-capable.</li>
        </ul>
      </div>
    </div>
  );
}
