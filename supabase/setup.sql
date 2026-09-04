-- ============================================================
--  RISET-AI — RESET TOTAL & FRESH SETUP SUPABASE
--  Isi: 
--    1) Reset bersih schema public (drop semua tabel lama)
--    2) Skema 18 tabel lengkap + index + foreign keys
--    3) Seed awal Settings (baris id=1)
--    4) Akun User bawaan: email 'v@.com' / password 'Thelust11'
--    5) Bucket storage 'uploads' (Public) + Policy CRUD
-- ============================================================

-- ============ 0) RESET SCHEMA PUBLIC ============
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- ============ 1) SKEMA DATABASE ============

-- 1. Settings
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

-- 2. Project
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

-- 3. ResearchMemory
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

-- 4. Section
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

-- 5. Source
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

-- 6. SourceChunk
CREATE TABLE "SourceChunk" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "page" INTEGER,
    "index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- 7. Collection
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- 8. CollectionSource
CREATE TABLE "CollectionSource" (
    "collectionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "CollectionSource_pkey" PRIMARY KEY ("collectionId","sourceId")
);

-- 9. Citation
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

-- 10. CitationUsage
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

-- 11. ChatThread
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- 12. ChatMessage
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- 13. Review
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- 14. ReviewIssue
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

-- 15. AIRun
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

-- 16. ExportJob
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- 17. WritingTemplate
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

-- 18. User
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

-- Indexes
CREATE UNIQUE INDEX "ResearchMemory_projectId_key" ON "ResearchMemory"("projectId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Foreign Keys
ALTER TABLE "ResearchMemory" ADD CONSTRAINT "ResearchMemory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Section" ADD CONSTRAINT "Section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CitationUsage" ADD CONSTRAINT "CitationUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CitationUsage" ADD CONSTRAINT "CitationUsage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewIssue" ADD CONSTRAINT "ReviewIssue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIRun" ADD CONSTRAINT "AIRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============ 2) SEED AWAL ============
-- Settings (id=1)
INSERT INTO "Settings" ("id", "updatedAt") VALUES (1, now())
ON CONFLICT ("id") DO NOTHING;

-- User bawaan: v@.com / Thelust11
INSERT INTO "User" ("id", "email", "name", "university", "passwordHash", "createdAt", "lastLoginAt")
VALUES (
    'usr_default_vian',
    'v@.com',
    'Vian',
    'Universitas',
    'scrypt$31YXDM9iTjHP0sEw1uYiVg==$FX6nFSa4n2iF1k7utwnkQdULugYvjzkaXFcrfBq5Jgl0FAtbpskmRvvqYKGkgy/z7Be+R9azwOBtCVpPs8f8Fg==',
    now(),
    now()
)
ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";


-- ============ 3) STORAGE: BUCKET & POLICIES ============
-- Buat bucket uploads jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Beri izin baca bucket ke anon & authenticated (agar health-check & listing jalan)
GRANT SELECT ON storage.buckets TO anon;
GRANT SELECT ON storage.buckets TO authenticated;

DROP POLICY IF EXISTS "riset_anon_bucket_read" ON storage.buckets;
CREATE POLICY "riset_anon_bucket_read" ON storage.buckets
  FOR SELECT TO anon
  USING (id = 'uploads');

-- Izin INSERT ke bucket uploads (upload docx/gambar dari browser)
DROP POLICY IF EXISTS "riset_anon_insert" ON storage.objects;
CREATE POLICY "riset_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'uploads');

-- Izin SELECT (baca publik)
DROP POLICY IF EXISTS "riset_public_read" ON storage.objects;
CREATE POLICY "riset_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'uploads');

-- Izin UPDATE (upsert file saat nama sama)
DROP POLICY IF EXISTS "riset_anon_update" ON storage.objects;
CREATE POLICY "riset_anon_update" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'uploads');
