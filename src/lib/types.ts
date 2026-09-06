export interface Section {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  order: number;
  level: number;
  content: string;
  status: string; // EMPTY | DRAFTING | AI_DRAFT | USER_EDITED | APPROVED
  prompt: string;
  updatedAt: string;
}

export interface ProjectRow {
  id: string;
  userId: string;
  title: string;
  type: string;
  topic: string;
  field: string;
  object: string;
  caseStudy: string;
  problem: string;
  method: string;
  language: string;
  citationStyle: string;
  yearFrom: number | null;
  yearTo: number | null;
  minCitations: number | null;
  includePreprint: boolean;
  campusStyle: string;
  documentPrompt: string;
  memory: string | null;
  sourceFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function rowToSection(row: any): Section {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    order: row.order,
    level: row.level,
    content: row.content,
    status: row.status,
    prompt: row.prompt,
    updatedAt: row.updated_at,
  };
}
