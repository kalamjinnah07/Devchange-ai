// Core application types for DevChange AI
// These mirror the Prisma models but are safe to import in both
// server components and client components.

/**
 * The seven structured sections produced by the AI analysis.
 * Each value is a markdown string ready for rendering.
 *
 * Section names match the exact headings required in lib/prompt.ts
 * and parsed by lib/parser.ts.
 */
export interface AnalysisResult {
  changeSummary: string;
  affectedModules: string;
  databaseImpact: string;
  backendApiImpact: string;
  frontendUiImpact: string;
  developmentTasks: string; // markdown checklist items
  testCasesAndRisks: string; // markdown checklist items
}

/**
 * A project that provides system context for change-request analysis.
 * Mirrors the Prisma Project model.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  modules: string | null;
  dbTables: string | null;
  apiEndpoints: string | null;
  techStack: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A saved impact analysis for a change request.
 * Mirrors the Prisma Analysis model.
 */
export interface Analysis {
  id: string;
  projectId: string;
  changeRequest: string;
  result: AnalysisResult;
  rawMarkdown: string;
  createdAt: Date;
}

/**
 * Project with its analyses included — used on the project dashboard.
 */
export interface ProjectWithAnalyses extends Project {
  analyses: Analysis[];
}

/**
 * Lightweight analysis row used in list views — avoids sending full
 * result JSON to the browser when only metadata is needed.
 */
export interface AnalysisSummary {
  id: string;
  projectId: string;
  changeRequest: string;
  createdAt: Date;
}
