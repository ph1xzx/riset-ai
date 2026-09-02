"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, FileSearch, Library, Settings, Plus, Upload, FlaskConical, ScrollText } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find-papers", label: "Find Papers", icon: FileSearch },
  { href: "/library", label: "Library", icon: Library },
  { href: "/import", label: "Impor Skripsi", icon: Upload },
  { href: "/templates", label: "Template Pedoman", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

/* Sidebar gelap editorial — menyambung dengan side-menu panel landing
   (#101114, teks bone, mono uppercase, hover #8db4ff). */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);

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
      <aside className="w-60 shrink-0 bg-[#101114] text-[#fbfaf7] flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <div className="w-8 h-8 rounded-none bg-[#3564ff] text-white flex items-center justify-center">
            <FlaskConical size={18} />
          </div>
          <div>
            <div className="font-display font-medium leading-none tracking-tight text-[17px]">
              Riset<span className="font-light">AI</span>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40 mt-0.5">
              BYOK workspace
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-none px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? "bg-white/10 text-[#8db4ff]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <n.icon size={15} />
                {n.label}
              </Link>
            );
          })}
          <Link
            href="/new"
            className={`mt-2 flex items-center justify-center gap-2 rounded-none border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
              pathname.startsWith("/new")
                ? "border-[#8db4ff] text-[#8db4ff]"
                : "border-[#3564ff] bg-[#3564ff] text-white hover:bg-transparent hover:text-[#3564ff]"
            }`}
          >
            <Plus size={15} />
            Proyek Baru
          </Link>
        </nav>

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
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
