-- ============================================================
--  RISET-AI — SETUP LENGKAP SUPABASE (jalankan SEKALI di SQL Editor)
--  Isi: 1) Seluruh skema database (18 tabel + index)
--       2) Seed awal Settings (baris id=1)
--       3) Bucket storage "uploads" + policy akses
--  Jalankan di project BARU. Bagian seed & storage idempoten; bagian skema
--  bila diulang akan error "already exists" (tidak merusak apa pun).
--  Setelah ini TIDAK perlu `prisma db push` lagi.
-- ============================================================

-- ============ 1) SKEMA DATABASE ============
-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "imageModel" TEXT NOT NULL DEFAULT '',
    "embeddingModel" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled research',
    "type" TEXT NOT NULL DEFAULT 'Skripsi',
    "topic" TEXT NOT NULL DEFAULT '',
    "field" TEXT NOT NULL DEFAULT '',
    "object" TEXT NOT NULL DEFAULT '',
    "caseStudy" TEXT NOT NULL DEFAULT '',
    "problem" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'id',
    "citationStyle" TEXT NOT NULL DEFAULT 'APA7',
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "minCitations" INTEGER,
    "includePreprint" BOOLEAN NOT NULL DEFAULT false,
    "campusStyle" TEXT NOT NULL DEFAULT '{}',
    "documentPrompt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchMemory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "problems" TEXT NOT NULL DEFAULT '[]',
    "questions" TEXT NOT NULL DEFAULT '[]',
    "objectives" TEXT NOT NULL DEFAULT '[]',
    "researchObject" TEXT NOT NULL DEFAULT '',
    "methodology" TEXT NOT NULL DEFAULT '',
    "population" TEXT NOT NULL DEFAULT '',
    "sample" TEXT NOT NULL DEFAULT '',
    "sampleSize" TEXT NOT NULL DEFAULT '',
    "variables" TEXT NOT NULL DEFAULT '[]',
    "criteria" TEXT NOT NULL DEFAULT '[]',
    "alternatives" TEXT NOT NULL DEFAULT '[]',
    "dataCollection" TEXT NOT NULL DEFAULT '[]',
    "analysisMethod" TEXT NOT NULL DEFAULT '',
    "limitations" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'EMPTY',
    "prompt" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL DEFAULT '[]',
    "year" INTEGER,
    "journal" TEXT NOT NULL DEFAULT '',
    "doi" TEXT,
    "abstract" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "pdfUrl" TEXT NOT NULL DEFAULT '',
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "openAccess" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'openalex',
    "type" TEXT NOT NULL DEFAULT 'article',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "impactFactor" DOUBLE PRECISION,
    "verified" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceChunk" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "page" INTEGER,
    "index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionSource" (
    "collectionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "CollectionSource_pkey" PRIMARY KEY ("collectionId","sourceId")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT,
    "inText" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'apa',
    "status" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
    "matchedTitle" TEXT,
    "matchedYear" INTEGER,
    "matchedJournal" TEXT,
    "doi" TEXT,
    "url" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationUsage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitationUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIssue" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sectionId" TEXT,
    "message" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ReviewIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "task" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "latency" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prodi" TEXT NOT NULL DEFAULT '',
    "university" TEXT NOT NULL DEFAULT '',
    "sourceText" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "university" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchMemory_projectId_key" ON "ResearchMemory"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "ResearchMemory" ADD CONSTRAINT "ResearchMemory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationUsage" ADD CONSTRAINT "CitationUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationUsage" ADD CONSTRAINT "CitationUsage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIssue" ADD CONSTRAINT "ReviewIssue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRun" ADD CONSTRAINT "AIRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============ 2) SEED AWAL ============
-- Baris Settings global (id=1) — diisi nanti lewat halaman /settings aplikasi
INSERT INTO "Settings" ("id", "updatedAt") VALUES (1, now())
ON CONFLICT ("id") DO NOTHING;

-- ============ 3) STORAGE: bucket uploads + policy ============
-- bucket publik (server mengambil file via URL saat parsing)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- anon boleh INSERT ke bucket uploads (upload dari browser)
create policy "riset_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'uploads');

-- siapa pun boleh SELECT (baca) file di bucket uploads
create policy "riset_public_read" on storage.objects
  for select
  using (bucket_id = 'uploads');

-- anon boleh UPDATE/menimpa (upsert saat re-upload nama sama)
create policy "riset_anon_update" on storage.objects
  for update to anon
  using (bucket_id = 'uploads');

-- SELESAI. Verifikasi cepat:
--   select count(*) from information_schema.tables where table_schema='public';  -- harus 18
--   select * from storage.buckets;                                              -- ada 'uploads'
