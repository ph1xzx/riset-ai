"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, FileSearch, Library, Settings, Plus, Upload, FlaskConical, ScrollText, ChevronLeft, ChevronRight, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find-papers", label: "Find Papers", icon: FileSearch },
  { href: "/library", label: "Library", icon: Library },
  { href: "/import", label: "Impor Skripsi", icon: Upload },
  { href: "/templates", label: "Template Pedoman", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

/* Sidebar gelap editorial — menyambung dengan side-menu panel landing
   (#101114, teks bone, mono uppercase, hover #8db4ff).
   Mendukung mode collapsible (w-14 rail) agar ruang editor lebih luas. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("riset.shell.collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("riset.shell.collapsed", String(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => setAiReady(j.configured))
      .catch(() => setAiReady(false));
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user || null))
      .catch(() => {});
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`shrink-0 bg-[#101114] text-[#fbfaf7] flex flex-col transition-all duration-200 ease-in-out ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        {/* Header brand + toggle */}
        {collapsed ? (
          <div className="flex flex-col items-center justify-center h-16 border-b border-white/10 relative group">
            <div className="w-8 h-8 rounded-none bg-[#3564ff] text-white flex items-center justify-center">
              <FlaskConical size={18} />
            </div>
            <button
              onClick={toggleCollapsed}
              title="Perluas sidebar"
              className="absolute inset-0 flex items-center justify-center bg-[#101114]/90 opacity-0 group-hover:opacity-100 text-[#8db4ff] transition-opacity"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-none bg-[#3564ff] text-white flex items-center justify-center">
                <FlaskConical size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-display font-medium leading-none tracking-tight text-[17px]">
                  Riset<span className="font-light">AI</span>
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40 mt-0.5">
                  BYOK workspace
                </div>
              </div>
            </div>
            <button
              onClick={toggleCollapsed}
              title="Ciutkan sidebar"
              className="text-white/40 hover:text-white p-1 rounded transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}

        {/* Nav list */}
        <nav className={`flex-1 space-y-0.5 ${collapsed ? "p-2" : "p-3"}`}>
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                title={collapsed ? n.label : undefined}
                className={`flex items-center rounded-none font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                  collapsed ? "justify-center py-2.5 px-0" : "gap-3 px-3 py-2"
                } ${
                  active
                    ? "bg-white/10 text-[#8db4ff]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <n.icon size={collapsed ? 18 : 15} />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            );
          })}
          <Link
            href="/new"
            title={collapsed ? "Proyek Baru" : undefined}
            className={`mt-2 flex items-center justify-center rounded-none border font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
              collapsed ? "py-2.5 px-0" : "gap-2 px-3 py-2"
            } ${
              pathname.startsWith("/new")
                ? "border-[#8db4ff] text-[#8db4ff]"
                : "border-[#3564ff] bg-[#3564ff] text-white hover:bg-transparent hover:text-[#3564ff]"
            }`}
          >
            <Plus size={collapsed ? 18 : 15} />
            {!collapsed && <span>Proyek Baru</span>}
          </Link>
        </nav>

        {/* Footer status & logout */}
        {collapsed ? (
          <div className="p-2 border-t border-white/10 flex flex-col items-center gap-3">
            <span
              title={aiReady === null ? "Memeriksa AI…" : aiReady ? "API key aktif" : "API key belum diset"}
              className={`w-2.5 h-2.5 rounded-full ${
                aiReady === null ? "bg-white/30" : aiReady ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {me && (
              <button
                onClick={logout}
                title={`Keluar (${me.email})`}
                className="text-white/40 hover:text-[#ff9a9a] p-1 transition-colors"
              >
                <LogOut size={16} />
              </button>
            )}
            <button
              onClick={toggleCollapsed}
              title="Perluas sidebar"
              className="text-white/40 hover:text-white p-1 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
              <span
                className={`w-2 h-2 rounded-full ${
                  aiReady === null ? "bg-white/30" : aiReady ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {aiReady === null ? "Memeriksa AI…" : aiReady ? "API key aktif" : "API key belum diset"}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30 mt-1.5 truncate">
              {me ? me.email : "Sesi lokal"}
            </div>
            {me && (
              <button
                onClick={logout}
                className="mt-2 w-full text-left font-mono text-[10px] uppercase tracking-[0.12em] text-white/45 hover:text-[#ff9a9a] transition-colors"
              >
                Keluar →
              </button>
            )}
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
