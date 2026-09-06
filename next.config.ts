import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF export & DOCX are generated server-side with pdfkit/docx (no LibreOffice needed).
  // Keep serverless-compatible; native better-sqlite3 works in Node runtime.
  serverExternalPackages: ["better-sqlite3", "pdfkit", "jszip", "mammoth", "docx"],
};

export default nextConfig;
