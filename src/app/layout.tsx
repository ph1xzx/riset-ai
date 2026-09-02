import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plexmono", display: "swap" });

export const metadata: Metadata = {
  title: "Riset AI — Workspace Penelitian BYOK",
  description:
    "Workspace penulisan skripsi/tesis dengan AI: struktur custom pedoman kampus, editor AI dengan autocomplete, sitasi terverifikasi Crossref, generate gambar, cek penulisan, ekspor DOCX format kampus. BYOK — API key milikmu.",
  openGraph: {
    title: "Riset AI — Workspace Penelitian BYOK",
    description: "Tulis skripsi dengan AI yang bisa ditelusuri. Sitasi terverifikasi, gambar AI, format kampus.",
    images: [{ url: "/images/hero.png", width: 1080, height: 1350 }],
  },
};

export const viewport: Viewport = { themeColor: "#faf8f5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${grotesk.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
