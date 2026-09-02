"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import MarketingNav from "@/components/marketing/MarketingNav";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [univ, setUniv] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pass !== pass2) {
      setErr("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, university: univ, email, password: pass }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal mendaftar");
      router.push("/dashboard");
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
          Fig. 03 — Awal mula
        </div>
      </div>

      {/* Kolom kanan: form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-20 max-w-[720px] mx-auto w-full py-28">
        <div className="mkt-label mb-4">Daftar</div>
        <h1 className="mkt-h1" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)" }}>
          <span className="hl">M</span>ulai dari
          <br />
          topik.
        </h1>
        <p className="mt-5 text-[14px] leading-relaxed" style={{ color: "#4a4d55" }}>
          Satu akun untuk semua proyek skripsi/tesis. Bawa API key-mu sendiri — tanpa billing.
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
              type="text"
              placeholder="Nama lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <input
              className="mkt-input"
              type="text"
              placeholder="Universitas / kampus"
              value={univ}
              onChange={(e) => setUniv(e.target.value)}
            />
          </div>
          <div>
            <input
              className="mkt-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <input
              className="mkt-input"
              type="password"
              placeholder="Kata sandi (minimal 8 karakter)"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <input
              className="mkt-input"
              type="password"
              placeholder="Ulangi kata sandi"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <button type="submit" className="mkt-btn mkt-btn--accent w-full justify-center" disabled={busy}>
            {busy ? "Membuat akun…" : <>Buat akun <ArrowRight size={14} /></>}
          </button>
        </form>

        <div className="mt-8 text-[13px]" style={{ color: "#84868c" }}>
          Sudah punya akun?{" "}
          <Link href="/login" className="underline" style={{ color: "#16181d" }}>
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}
