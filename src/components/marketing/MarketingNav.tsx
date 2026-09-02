"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

// Header editorial: mengambang (mix-blend-difference), logo di tengah,
// label di dua sisi — pola tema serotoninn.com (tema saja, bukan salinan).
export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const onScroll = () => setSmall(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const MENU = [
    { href: "#fitur", label: "Fitur" },
    { href: "#cara-kerja", label: "Cara Kerja" },
    { href: "#galeri", label: "Galeri" },
    { href: "/new", label: "Mulai Proyek" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <>
      <nav className={`mkt-nav ${small ? "is-small" : ""}`}>
        <div className="mkt-nav-left">
          <a href="#fitur">Fitur</a>
          <a href="#cara-kerja">Cara Kerja</a>
          <button onClick={() => setMenuOpen(true)}>Menu</button>
        </div>
        <Link href="/" className="mkt-logo" onClick={() => setMenuOpen(false)}>
          <span className="hl">R</span>iset&nbsp;AI
        </Link>
        <div className="mkt-nav-right">
          <Link href="/login">Masuk</Link>
          <Link href="/register">Daftar</Link>
        </div>
      </nav>

      {/* Side menu: panel gelap + kolom art */}
      <div className={`mkt-menu ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <div className="mkt-menu-panel">
          {MENU.map((m, i) => (
            <Link
              key={m.href}
              href={m.href}
              className="mkt-menu-item"
              style={{ transitionDelay: menuOpen ? `${0.12 + i * 0.06}s` : "0s" }}
              onClick={() => setMenuOpen(false)}
            >
              <span className="hl">{m.label.charAt(0)}</span>
              {m.label.slice(1)}
            </Link>
          ))}
          <div className="mt-auto pt-10">
            <div className="mkt-label" style={{ color: "rgba(251,250,247,.45)" }}>
              Riset AI — BYOK workspace
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "rgba(251,250,247,.35)" }}>
              API key milikmu · tanpa mockup · sitasi terverifikasi
            </div>
          </div>
          <button
            className="absolute bottom-6 right-6"
            style={{
              background: "none",
              border: "1px solid rgba(251,250,247,.35)",
              borderRadius: 999,
              cursor: "pointer",
              color: "#fbfaf7",
              fontFamily: "var(--font-plexmono)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontSize: "11px",
              padding: "0.5rem 1rem",
            }}
            onClick={() => setMenuOpen(false)}
          >
            Tutup ×
          </button>
        </div>
        <div className="mkt-menu-art" onClick={() => setMenuOpen(false)} style={{ cursor: "pointer" }}>
          <img src="/images/menu-art.png" alt="" />
        </div>
      </div>
    </>
  );
}
