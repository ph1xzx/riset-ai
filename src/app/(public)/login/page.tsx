"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/marketing/MarketingNav";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal masuk");
      const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="mkt min-h-screen flex">
      <MarketingNav />

      {/* Kolom kiri: gambar editorial */}
      <div className="hidden lg:block w-1/2 relative">
        <img src="/images/auth-side.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-10 left-10 mkt-label" style={{ mixBlendMode: "difference", color: "#fff" }}>
          Fig. 02 — Ruang kerja
        </div>
      </div>

      {/* Kolom kanan: form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-20 max-w-[720px] mx-auto w-full py-28">
        <div className="mkt-label mb-4">Masuk</div>
        <h1 className="mkt-h1" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}>
          <span className="hl">L</span>anjut
          <br />
          nulis.
        </h1>
        <p className="mt-5 text-[14px] leading-relaxed" style={{ color: "#4a4d55" }}>
          Lanjutkan dari proyekmu — struktur, sitasi, dan draft terakhir ada di sana.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-7">
          {err && (
            <div className="text-[13px] px-4 py-3" style={{ background: "#fdecec", color: "#b3261e" }}>
              {err}
            </div>
          )}
          <div>
            <input
              className="mkt-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <input
              className="mkt-input"
              type="password"
              placeholder="Kata sandi"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="mkt-btn mkt-btn--accent w-full justify-center" disabled={busy}>
            {busy ? "Memeriksa…" : <>Masuk <ArrowRight size={14} /></>}
          </button>
        </form>

        <div className="mt-8 text-[13px]" style={{ color: "#84868c" }}>
          Belum punya akun?{" "}
          <Link href="/register" className="underline" style={{ color: "#16181d" }}>
            Daftar di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
