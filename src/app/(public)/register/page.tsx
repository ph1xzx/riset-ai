"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registrasi gagal");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex auth-side w-1/2 flex-col justify-between p-10 text-white">
        <Link href="/" className="font-display text-xl font-bold">
          <span className="text-brand-500">R</span>iset AI
        </Link>
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight max-w-md">
            Mulai dari topik, selesai dengan DOCX format kampus.
          </h2>
          <p className="mt-4 text-ink-300 text-sm max-w-sm">
            Gratis. Bawa API key-mu (OpenRouter, Gemini, atau Ollama) — semua data milikmu.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
          API key milikmu · tanpa mockup
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-display text-lg font-bold mb-8 inline-block">
            <span className="text-brand-600">R</span>iset AI
          </Link>
          <h1 className="font-display text-2xl font-bold mb-1">Daftar</h1>
          <p className="text-[13px] text-ink-500 mb-6">Gratis, tanpa billing.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Nama</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@univ.ac.id" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" required minLength={6} />
            </div>
            {err && <div className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{err}</div>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Membuat akun…" : "Daftar"}
            </button>
          </form>
          <p className="mt-6 text-[12px] text-ink-500">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
