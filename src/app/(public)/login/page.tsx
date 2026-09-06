"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
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
            Workspace penelitian yang jujur.
          </h2>
          <p className="mt-4 text-ink-300 text-sm max-w-sm">
            Sitasi terverifikasi · format kampus · ekspor DOCX rapi. API key milikmu, tidak pernah ke browser pihak lain.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
          Tanpa billing · tanpa mockup
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-display text-lg font-bold mb-8 inline-block">
            <span className="text-brand-600">R</span>iset AI
          </Link>
          <h1 className="font-display text-2xl font-bold mb-1">Masuk</h1>
          <p className="text-[13px] text-ink-500 mb-6">Lanjutkan ke workspace-mu.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kamu@univ.ac.id" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {err && <div className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{err}</div>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Memeriksa…" : "Masuk"}
            </button>
          </form>
          <p className="mt-6 text-[12px] text-ink-500">
            Belum punya akun?{" "}
            <Link href="/register" className="text-brand-600 font-medium hover:underline">Daftar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
