import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import MarketingNav from "@/components/marketing/MarketingNav";

const FEATURES = [
  {
    n: "01",
    img: "/images/feature-editor.png",
    title: "Editor AI",
    text: "Ghost-text autocomplete (Tab terima, Esc tolak), AI Edit dengan diff, parafrase per section. AI menulis, kamu tetap pegang kendali — tanpa satu pun output mockup.",
  },
  {
    n: "02",
    img: "/images/feature-cite.png",
    title: "Sitasi terverifikasi",
    text: "AI hanya boleh menyitasi dari library-mu, token divalidasi backend, lalu diverifikasi ke Crossref — klik sitasi → bukti & DOI. APA 7, IEEE, Harvard, Vancouver.",
  },
  {
    n: "03",
    img: "/images/feature-image.png",
    title: "Gambar AI",
    text: "Generate diagram & ilustrasi langsung masuk ke sub-bab yang membahasnya. Scan penulisan memberi saran gambar otomatis — termasuk logo tool (XAMPP, PHP, VS Code) dari web tanpa key.",
  },
  {
    n: "04",
    img: "/images/hero.png",
    title: "Format kampus",
    text: "Upload pedoman/skripsi lama → struktur & margin/font/spasi terdeteksi. Cek penulisan (grammar, tone, konsistensi data) lalu export DOCX rapi sesuai pedoman.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Bawa key & pedoman",
    text: "Isi API key-mu di Settings (OpenRouter, Gemini, Ollama — key tidak pernah ke browser). Upload pedoman kampus atau skripsi lama sebagai template.",
  },
  {
    n: "02",
    title: "AI menulis per sub-bab",
    text: "Brainstorm 5 judul, generate per section dengan status (DRAFTING → AI_DRAFT → APPROVED), sitasi hanya dari sumber yang kamu simpan.",
  },
  {
    n: "03",
    title: "Scan & export",
    text: "Cek penulisan, saran gambar, cek sitasi & konsistensi, simulasi sidang — lalu export DOCX dengan format kampus yang benar.",
  },
];

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

export default function LandingPage() {
  return (
    <div className="mkt min-h-screen">
      <MarketingNav />

      {/* ============ HERO ============ */}
      <header className="relative px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24 max-w-[1440px] mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="mkt-label mb-6">Workspace penelitian · Skripsi / Tesis / Jurnal</div>
            <h1 className="mkt-h1">
              <span className="hl">S</span>krpsi jadi,
              <br />
              sitasi <span className="hl">b</span>isa
              <br />
              ditelusuri.
            </h1>
            <p className="mt-7 max-w-md text-[15px] leading-relaxed" style={{ color: "#4a4d55" }}>
              Workspace penulisan <b>BYOK</b> — API key milikmu, tidak ada output palsu. Struktur
              mengikuti pedoman kampus, sitasi terverifikasi Crossref, gambar AI masuk ke sub-bab
              yang tepat, export DOCX rapi.
            </p>
            <div className="mt-9 flex gap-3 flex-wrap">
              <Link className="mkt-btn mkt-btn--accent" href="/register">
                Mulai menulis <ArrowRight size={14} />
              </Link>
              <Link className="mkt-btn" href="/login">
                Masuk
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src="/images/hero.png"
              alt="Komposisi dokumen penelitian"
              className="w-full max-w-[520px] ml-auto shadow-[0_40px_80px_rgba(23,27,34,0.12)]"
            />
            <div className="mkt-label mt-4 text-right">Fig. 01 — Alur penelitian</div>
          </div>
        </div>
      </header>

      {/* ============ MARQUEE ============ */}
      <div className="mkt-marquee" aria-hidden>
        <div className="mkt-marquee-inner">
          {[...MARQUEE, ...MARQUEE].map((t, i) => (
            <span key={i} className="mx-6">
              {t} <span className="mx-4">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ============ FITUR ============ */}
      <section id="fitur" className="px-6 md:px-12 py-20 md:py-28 max-w-[1440px] mx-auto">
        <div className="flex items-end justify-between mb-12 gap-6 flex-wrap">
          <div>
            <div className="mkt-label mb-3">Fitur</div>
            <h2 className="mkt-h2">
              <span className="hl">S</span>emua yang kamu butuhkan
              <br />
              dari bab 1 sampai sidang.
            </h2>
          </div>
          <div className="mkt-label hidden md:block">(04 — modul inti)</div>
        </div>
        <div className="grid md:grid-cols-2 gap-x-10 gap-y-16">
          {FEATURES.map((f) => (
            <div key={f.n} className="group">
              <div className="flex items-baseline gap-3 mb-4">
                <span className="mkt-label">({f.n})</span>
                <h3 className="mkt-h3">
                  <span className="hl">{f.title.charAt(0)}</span>
                  {f.title.slice(1)}
                </h3>
              </div>
              <div className="overflow-hidden bg-bone-200">
                <img
                  src={f.img}
                  alt={f.title}
                  className="w-full transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "#4a4d55" }}>
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CARA KERJA ============ */}
      <section id="cara-kerja" className="border-y" style={{ borderColor: "rgba(22,24,29,.1)" }}>
        <div className="px-6 md:px-12 py-20 md:py-28 max-w-[1440px] mx-auto">
          <div className="mkt-label mb-3">Cara kerja</div>
          <h2 className="mkt-h2 mb-14">
            <span className="hl">T</span>iga langkah,
            <br />
            dari topik sampai DOCX.
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((s) => (
              <div key={s.n} className="relative pt-8" style={{ borderTop: "1px solid rgba(22,24,29,.2)" }}>
                <div
                  className="font-display text-[64px] leading-none"
                  style={{ fontWeight: 100, letterSpacing: "-0.04em" }}
                >
                  {s.n}
                </div>
                <h3 className="mkt-h3 mt-4">
                  <span className="hl">{s.title.charAt(0)}</span>
                  {s.title.slice(1)}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "#4a4d55" }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ GALERI ============ */}
      <section id="galeri" className="px-6 md:px-12 py-20 md:py-28 max-w-[1440px] mx-auto">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="mkt-label mb-3">Galeri</div>
            <h2 className="mkt-h2">
              <span className="hl">D</span>alam workspace.
            </h2>
          </div>
          <Link
            href="/register"
            className="mkt-label hover:underline flex items-center gap-1"
            style={{ color: "#16181d" }}
          >
            Buka workspace <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { img: "/images/feature-editor.png", cap: "Editor — autocomplete & AI edit" },
            { img: "/images/feature-image.png", cap: "Gambar — saran per sub-bab" },
            { img: "/images/feature-cite.png", cap: "Sitasi — klik → bukti" },
          ].map((g) => (
            <figure key={g.cap}>
              <div className="bg-bone-200 overflow-hidden">
                <img src={g.img} alt={g.cap} className="w-full" />
              </div>
              <figcaption className="mkt-label mt-3">{g.cap}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section
        className="px-6 md:px-12 py-24 md:py-32 text-center"
        style={{ background: "#101114", color: "#fbfaf7" }}
      >
        <div className="mkt-label" style={{ color: "rgba(251,250,247,.5)" }}>
          Siap?
        </div>
        <h2 className="mkt-h2 mx-auto mt-4" style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)" }}>
          <span className="hl">M</span>ulai bab pertama
          <br />
          sekarang.
        </h2>
        <div className="mt-10 flex gap-3 justify-center flex-wrap">
          <Link className="mkt-btn mkt-btn--accent" href="/register">
            Daftar — gratis <ArrowRight size={14} />
          </Link>
          <Link
            className="mkt-btn"
            href="/login"
            style={{ background: "transparent", color: "#fbfaf7", borderColor: "rgba(251,250,247,.4)" }}
          >
            Sudah punya akun?
          </Link>
        </div>
        <div className="mkt-label mt-8" style={{ color: "rgba(251,250,247,.4)" }}>
          Tanpa billing · tanpa mockup · API key milikmu
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="px-6 md:px-12 pt-14 pb-8">
        <div className="max-w-[1440px] mx-auto grid md:grid-cols-4 gap-10">
          <div>
            <div className="mkt-logo" style={{ mixBlendMode: "normal" }}>
              <span className="hl">R</span>iset&nbsp;AI
            </div>
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "#84868c" }}>
              Workspace penulisan akademik BYOK. Struktur custom, sitasi terverifikasi, gambar AI,
              format kampus.
            </p>
          </div>
          <div>
            <div className="mkt-label mb-3">Produk</div>
            {["Fitur", "Cara Kerja", "Galeri"].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase().replace(" ", "-")}`}
                className="block text-[13px] py-1 hover:underline"
                style={{ color: "#4a4d55" }}
              >
                {l}
              </a>
            ))}
          </div>
          <div>
            <div className="mkt-label mb-3">Akses</div>
            {[
              { l: "Masuk", h: "/login" },
              { l: "Daftar", h: "/register" },
              { l: "Dashboard", h: "/dashboard" },
            ].map((x) => (
              <Link key={x.l} href={x.h} className="block text-[13px] py-1 hover:underline" style={{ color: "#4a4d55" }}>
                {x.l}
              </Link>
            ))}
          </div>
          <div>
            <div className="mkt-label mb-3">Prinsip</div>
            <ul className="text-[13px] space-y-1" style={{ color: "#4a4d55" }}>
              <li>BYOK — key tidak pernah ke browser</li>
              <li>Tanpa mockup / output palsu</li>
              <li>Sitasi hanya dari library-mu</li>
            </ul>
          </div>
        </div>
        <div
          className="max-w-[1440px] mx-auto mt-12 pt-6 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(22,24,29,.12)" }}
        >
          <div className="mkt-label">© 2026 Riset AI — mode single user</div>
          <div className="mkt-label hidden md:block">Dibuat untuk mahasiswa & pembimbing</div>
        </div>
      </footer>
    </div>
  );
}
