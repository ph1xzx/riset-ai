"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard, FileSearch, Library, FilePlus2, Upload, Settings,
  ScrollText, FlaskConical, Menu, X, Search, LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find-papers", label: "Cari Paper", icon: FileSearch },
  { href: "/library", label: "Library", icon: Library },
  { href: "/new", label: "Proyek Baru", icon: FilePlus2 },
  { href: "/import", label: "Impor DOCX", icon: Upload },
  { href: "/templates", label: "Template", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = (onNav?: () => void) =>
    NAV.map((n) => {
      const active = pathname === n.href || pathname.startsWith(n.href + "/");
      return (
        <Link
          key={n.href}
          href={n.href}
          onClick={onNav}
          className={`flex items-center min-h-10 border-l-2 font-medium text-xs transition-colors gap-2.5 px-2.5 rounded-r ${
            active
              ? "border-ink-900 bg-ink-50 text-ink-900"
              : "border-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900"
          }`}
        >
          <n.icon size={15} />
          <span>{n.label}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-ink-900">
      <header className="sticky top-0 z-40 h-14 shrink-0 bg-white border-b border-ink-200 flex items-center px-3 sm:px-4 gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 md:w-48 lg:w-52 shrink-0 min-w-0">
          <span className="w-8 h-8 shrink-0 bg-brand-600 text-white flex items-center justify-center rounded-md">
            <FlaskConical size={17} />
          </span>
          <span className="font-display text-[16px] font-semibold tracking-tight truncate">
            Riset <span className="font-normal text-ink-500">AI</span>
          </span>
        </Link>
        <form className="hidden md:flex items-center w-full max-w-sm h-8 border border-ink-200 bg-ink-50/40 text-ink-500 rounded-md" onSubmit={(e) => e.preventDefault()}>
          <Search size={14} className="ml-2.5 shrink-0" />
          <input className="min-w-0 flex-1 bg-transparent px-2 text-xs text-ink-800 outline-none" placeholder="Cari di Riset AI" />
          <kbd className="mr-2">Ctrl + K</kbd>
        </form>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden min-h-9 min-w-9 inline-flex items-center justify-center text-ink-600 hover:bg-ink-50"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-ink-200 p-2.5 space-y-0.5">
          {navLinks(() => setMobileOpen(false))}
          <LogoutRow />
        </div>
      )}

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="shrink-0 bg-white border-r border-ink-200 hidden md:flex md:w-48 lg:w-52 flex-col">
          <div className="flex items-center border-b border-ink-100 px-3 h-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Workspace</span>
          </div>
          <nav className="flex-1 space-y-0.5 p-2.5" aria-label="Navigasi utama">{navLinks()}</nav>
          <div className="border-t border-ink-100 p-2.5">
            <LogoutRow />
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function LogoutRow() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-900 rounded"
    >
      <LogOut size={14} /> Keluar
    </button>
  );
}
