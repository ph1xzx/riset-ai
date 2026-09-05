"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  LayoutDashboard,
  FileSearch,
  Library,
  Settings,
  Plus,
  Upload,
  FlaskConical,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Search,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find-papers", label: "Cari Paper", icon: FileSearch },
  { href: "/library", label: "Pustaka", icon: Library },
  { href: "/import", label: "Impor", icon: Upload },
  { href: "/templates", label: "Template", icon: ScrollText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const isCollapsed = collapsed && !mobileOpen;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("riset.shell.compact") === "true");
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => setAiReady(Boolean(j.configured)))
      .catch(() => setAiReady(false));
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user || null))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("riset.shell.compact", String(next));
      } catch {}
      return next;
    });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const target = q.includes("paper") || q.includes("jurnal")
      ? "/find-papers"
      : q.includes("template") || q.includes("pedoman")
      ? "/templates"
      : q.includes("impor") || q.includes("docx")
      ? "/import"
      : q.includes("setting") || q.includes("pengaturan")
      ? "/settings"
      : q.includes("baru") || q.includes("proyek")
      ? "/new"
      : "/dashboard";
    setSearch("");
    router.push(target);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-ink-900">
      <header className="sticky top-0 z-40 h-14 shrink-0 bg-white border-b border-ink-200 flex items-center px-3 sm:px-4">
        <div className="flex items-center gap-2.5 md:w-48 lg:w-52 shrink-0 min-w-0">
          <Link href="/dashboard" className="w-8 h-8 shrink-0 bg-brand-600 text-white flex items-center justify-center" aria-label="Riset AI, Dashboard">
            <FlaskConical size={17} />
          </Link>
          <Link href="/dashboard" className="font-display text-[16px] font-semibold tracking-tight truncate">
            Riset <span className="font-normal text-ink-500">AI</span>
          </Link>
        </div>

        <form onSubmit={submitSearch} className="hidden md:flex items-center w-full max-w-sm h-8 border border-ink-200 bg-ink-50/40 text-ink-500">
          <Search size={14} className="ml-2.5 shrink-0" />
          <input
            ref={searchRef}
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-ink-800 outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari di Riset AI"
            aria-label="Cari di Riset AI"
          />
          <kbd className="mr-2 font-mono text-[9px] text-ink-400">Ctrl + K</kbd>
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 mr-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-400">
            <span className={`w-1.5 h-1.5 rounded-full ${aiReady === null ? "bg-ink-300" : aiReady ? "bg-emerald-500" : "bg-amber-500"}`} />
            {aiReady === null ? "Memeriksa" : aiReady ? "AI siap" : "API belum diset"}
          </div>
          <Link href="/settings" className="min-h-9 min-w-9 inline-flex items-center justify-center text-ink-500 hover:bg-ink-50 hover:text-ink-900" aria-label="Buka pengaturan" title="Pengaturan">
            <Settings size={16} />
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="md:hidden min-h-9 min-w-9 inline-flex items-center justify-center text-ink-600 hover:bg-ink-50"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="md:hidden fixed inset-0 top-14 z-40 bg-ink-950/25"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={`shrink-0 bg-white border-r border-ink-200 flex-col transition-[width,transform] duration-200 ease-in-out ${
            mobileOpen ? "fixed inset-y-14 left-0 z-50 flex w-60" : "hidden md:flex"
          } ${isCollapsed ? "md:w-14" : "md:w-48 lg:w-52"}`}
        >
          <div className={`flex items-center border-b border-ink-100 ${isCollapsed ? "justify-center px-2" : "justify-between px-3"} h-12`}>
            {!isCollapsed && <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Workspace</span>}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={isCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              aria-label={isCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              className="hidden md:inline-flex min-h-9 min-w-9 items-center justify-center text-ink-400 hover:bg-ink-50 hover:text-ink-900"
            >
              {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          <nav className={`flex-1 space-y-0.5 ${isCollapsed ? "p-2" : "p-2.5"}`} aria-label="Navigasi utama">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center min-h-10 border-l-2 font-medium text-xs transition-colors ${
                    isCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                  } ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900"}`}
                >
                  <Icon size={15} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
            <Link
              href="/new"
              onClick={() => setMobileOpen(false)}
              title={isCollapsed ? "Proyek Baru" : undefined}
              className={`mt-3 flex items-center min-h-10 justify-center border font-medium text-xs transition-colors ${
                isCollapsed ? "px-0 border-brand-200 text-brand-700" : "gap-2 px-2.5 border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              <Plus size={15} />
              {!isCollapsed && <span>Proyek Baru</span>}
            </Link>
          </nav>

          <div className={`border-t border-ink-100 ${isCollapsed ? "p-2" : "p-3"}`}>
            {!isCollapsed && (
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-400 truncate" title={me?.email}>
                {me ? me.email : "Sesi lokal"}
              </div>
            )}
            {me && (
              <button
                type="button"
                onClick={logout}
                title="Keluar"
                className={`mt-1.5 flex items-center min-h-9 text-xs text-ink-400 hover:text-rose-600 ${isCollapsed ? "justify-center w-full" : "gap-2"}`}
              >
                <LogOut size={14} />
                {!isCollapsed && <span>Keluar</span>}
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
