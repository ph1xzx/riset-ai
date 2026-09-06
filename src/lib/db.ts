import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "riset.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'openrouter',
      base_url TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
      model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4',
      image_model TEXT NOT NULL DEFAULT '',
      temperature REAL NOT NULL DEFAULT 0.3,
      max_tokens INTEGER NOT NULL DEFAULT 5000,
      api_key TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Skripsi',
      topic TEXT NOT NULL DEFAULT '',
      field TEXT NOT NULL DEFAULT '',
      object TEXT NOT NULL DEFAULT '',
      case_study TEXT NOT NULL DEFAULT '',
      problem TEXT NOT NULL DEFAULT '',
      method TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'id',
      citation_style TEXT NOT NULL DEFAULT 'APA7',
      year_from INTEGER,
      year_to INTEGER,
      min_citations INTEGER,
      include_preprint INTEGER NOT NULL DEFAULT 0,
      campus_style TEXT NOT NULL DEFAULT '{}',
      document_prompt TEXT NOT NULL DEFAULT '',
      memory TEXT,
      source_file_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id TEXT,
      title TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'EMPTY',
      prompt TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id);

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '[]',
      year INTEGER,
      journal TEXT NOT NULL DEFAULT '',
      doi TEXT NOT NULL DEFAULT '',
      abstract TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      pdf_url TEXT NOT NULL DEFAULT '',
      citation_count INTEGER,
      open_access INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL DEFAULT 'manual',
      type TEXT NOT NULL DEFAULT 'article',
      keywords TEXT NOT NULL DEFAULT '[]',
      impact_factor REAL,
      verified TEXT NOT NULL DEFAULT 'METADATA_ONLY',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prodi TEXT NOT NULL DEFAULT '',
      university TEXT NOT NULL DEFAULT '',
      config TEXT NOT NULL DEFAULT '{}',
      has_source INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '[]',
      year INTEGER,
      journal TEXT NOT NULL DEFAULT '',
      doi TEXT NOT NULL DEFAULT '',
      abstract TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      citation_count INTEGER,
      open_access INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL DEFAULT 'openalex',
      keywords TEXT NOT NULL DEFAULT '[]',
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_library_user ON library(user_id);

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      section_id TEXT,
      action TEXT NOT NULL,
      before_text TEXT NOT NULL DEFAULT '',
      after_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default template on first run (global, owner = null via a dedicated row is not
  // allowed by FK; we seed it per-user lazily in the templates API instead).
}

initDb();

export type SectionStatus = "EMPTY" | "DRAFTING" | "AI_DRAFT" | "USER_EDITED" | "APPROVED";

export function sectionCounts(projectId: string) {
  const row = db
    .prepare("SELECT COUNT(*) c, SUM(CASE WHEN status IN ('AI_DRAFT','USER_EDITED','APPROVED') AND content != '' THEN 1 ELSE 0 END) filled FROM sections WHERE project_id = ?")
    .get(projectId) as { c: number; filled: number | null };
  return { total: row.c, filled: row.filled || 0 };
}
