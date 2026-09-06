import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", weight: ["400", "500", "600", "700"] });
const plex = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plexmono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Riset AI — Workspace Penelitian BYOK",
  description:
    "Workspace penulisan skripsi/tesis dengan AI: struktur custom pedoman kampus, editor AI dengan autocomplete, sitasi terverifikasi Crossref, generate gambar, cek penulisan, ekspor DOCX format kampus. BYOK — API key milikmu.",
  openGraph: {
    title: "Riset AI — Workspace Penelitian BYOK",
    description: "Tulis skripsi dengan AI yang bisa ditelusuri. Sitasi terverifikasi, gambar AI, format kampus.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${grotesk.variable} ${plex.variable}`}>
      <body className="font-sans antialiased text-ink-900 bg-paper">{children}</body>
    </html>
  );
}
