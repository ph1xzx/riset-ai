import Link from "next/link";
import { FlaskConical, ArrowRight, Sparkles, Check } from "lucide-react";

const MARQUEE = [
  "Sitasi terverifikasi",
  "Format kampus",
  "BYOK — API key milikmu",
  "Gambar AI",
  "Cek penulisan",
  "Ekspor DOCX",
  "Tanpa mockup",
  "Autocomplete AI",
];

const FEATURES = [
  {
    no: "01",
    title: "Editor AI",
    desc: "Ghost-text autocomplete (Tab terima, Esc tolak), AI Edit dengan diff, parafrase per section. AI menulis, kamu tetap pegang kendali — tanpa satu pun output mockup.",
    icon: Sparkles,
  },
  {
    no: "02",
    title: "Sitasi terverifikasi",
    desc: "AI hanya boleh menyitasi dari library-mu, token divalidasi backend, lalu diverifikasi ke Crossref — klik sitasi → bukti & DOI. APA 7, IEEE, Harvard, Vancouver.",
    icon: Check,
  },
  {
    no: "03",
    title: "Gambar AI",
    desc: "Generate diagram & ilustrasi langsung masuk ke sub-bab yang membahasnya. Scan penulisan memberi saran gambar otomatis — termasuk logo tool (XAMPP, PHP, VS Code) dari web tanpa key.",
    icon: FlaskConical,
  },
  {
    no: "04",
    title: "Format kampus",
    desc: "Upload pedoman/skripsi lama → struktur & margin/font/spasi terdeteksi. Cek penulisan (grammar, tone, konsistensi data) lalu export DOCX rapi sesuai pedoman.",
    icon: Check,
  },
];

const STEPS = [
  {
    no: "01",
    title: "Bawa key & pedoman",
    desc: "Isi API key-mu di Settings (OpenRouter, Gemini, Ollama — key tidak pernah ke browser). Upload pedoman kampus atau skripsi lama sebagai template.",
  },
  {
    no: "02",
    title: "AI menulis per sub-bab",
    desc: "Brainstorm 5 judul, generate per section dengan status (DRAFTING → AI_DRAFT → APPROVED), sitasi hanya dari sumber yang kamu simpan.",
  },
  {
    no: "03",
    title: "Scan & export",
    desc: "Cek penulisan, saran gambar, cek sitasi & konsistensi, simulasi sidang — lalu export DOCX dengan format kampus yang benar.",
  },
];

export default function LandingPage() {
  return (
    <div className="mkt min-h-screen">
      {/* Nav */}
      <header className="mkt-nav">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="mkt-logo">
            <span className="hl">R</span>iset AI
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-ink-600">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara Kerja</a>
            <a href="#galeri">Galeri</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/new" className="btn-ghost !h-8 !text-xs">Mulai Proyek</Link>
            <Link href="/dashboard" className="btn-primary !h-8 !text-xs">Dashboard</Link>
          </div>
        </div>
      </header>

      {/* Marquee */}
      <div className="mkt-marquee mt-14">
        <div className="mkt-marquee-inner">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-500">
              <span className="w-1 h-1 rounded-full bg-brand-500 inline-block" />
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-20 text-center">
        <div className="mkt-kicker mb-4">Riset AI — BYOK workspace</div>
        <h1 className="mkt-h1 max-w-3xl mx-auto">
          Tulis skripsi dengan AI yang <span className="text-brand-600">bisa ditelusuri</span>.
        </h1>
        <p className="mt-5 text-ink-600 max-w-xl mx-auto text-[15px] leading-relaxed">
          API key milikmu · tanpa mockup · sitasi terverifikasi. Dari bab 1 sampai sidang dalam satu workspace.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="mkt-btn mkt-btn--accent">
            Daftar — gratis <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="mkt-btn mkt-btn--ghost">Sudah punya akun?</Link>
        </div>
        <p className="mt-4 text-[11px] font-mono uppercase tracking-wider text-ink-400">
          Tanpa billing · tanpa mockup · API key milikmu
        </p>
      </section>

      {/* Features */}
      <section id="fitur" className="max-w-6xl mx-auto px-5 py-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="mkt-kicker mb-2">(04 — modul inti)</div>
            <h2 className="mkt-h2">Semua yang kamu butuhkan dari bab 1 sampai sidang.</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.no} className="mkt-card">
              <div className="flex items-center justify-between mb-3">
                <span className="mkt-kicker">({f.no})</span>
                <f.icon size={16} className="text-ink-400" />
              </div>
              <h3 className="mkt-h3 mb-2">{f.title}</h3>
              <p className="text-[13px] text-ink-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="bg-ink-950 text-white py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="mkt-kicker !text-ink-400 mb-2">(03 langkah)</div>
          <h2 className="mkt-h2 !text-white mb-10">Tiga langkah, dari topik sampai DOCX.</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.no} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="font-mono text-2xl text-brand-500 mb-3">{s.no}</div>
                <h3 className="font-display font-semibold mb-2">{s.title}</h3>
                <p className="text-[13px] text-ink-300 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="galeri" className="max-w-6xl mx-auto px-5 py-20">
        <div className="flex items-end justify-between mb-8">
          <h2 className="mkt-h2">Dalam workspace.</h2>
          <Link href="/register" className="btn-outline">Buka workspace</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: "Editor — autocomplete & AI edit", tone: "from-[#eff4ff] to-[#fbfaf7]" },
            { title: "Gambar — saran per sub-bab", tone: "from-[#f2ede3] to-[#fbfaf7]" },
            { title: "Sitasi — klik → bukti", tone: "from-[#eef2ee] to-[#fbfaf7]" },
          ].map((g) => (
            <div key={g.title} className={`rounded-xl border border-ink-100 bg-gradient-to-b ${g.tone} h-44 flex items-end p-4`}>
              <span className="text-[12px] font-medium text-ink-700">{g.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-5 pb-24">
        <div className="rounded-2xl bg-ink-900 text-white p-10 text-center">
          <h2 className="mkt-h2 !text-white">Siap? Mulai bab pertama sekarang.</h2>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/register" className="mkt-btn bg-white text-ink-900 hover:bg-ink-100">
              Daftar — gratis
            </Link>
            <Link href="/login" className="mkt-btn text-white/80 hover:bg-white/10">
              Sudah punya akun?
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8">
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-ink-400">
          <span>Riset AI — v2.0</span>
          <span>BYOK · Crossref · OpenAlex</span>
        </div>
      </footer>
    </div>
  );
}
