/**
 * lib/prompt.ts — Prompt builder for DevChange AI
 *
 * Assembles the full plain-text prompt sent to the LLM.
 * Optional project context fields are included only when non-empty,
 * keeping the prompt lean when the user hasn't filled every field.
 */

import type { Project } from "@/types";

// The exact section headings the LLM must emit, in order.
// These must stay in sync with lib/parser.ts SECTION_KEYS.
export const SECTION_HEADINGS = [
  "Change Summary",
  "Affected Modules",
  "Database Impact",
  "Backend/API Impact",
  "Frontend/UI Impact",
  "Development Tasks",
  "Test Cases and Risks",
] as const;

/**
 * Build the complete prompt string for the given project + change request.
 *
 * The prompt has three parts:
 *  1. Role instruction (fixed system context)
 *  2. Project context (hybrid: required description + optional structured fields)
 *  3. Output requirements (7 exact section headings + checklist rules)
 */
export function buildPrompt(
  project: Project,
  changeRequest: string
): string {
  const lines: string[] = [];

  // ── 1. Role instruction ──────────────────────────────────────────────────
  lines.push(
    "You are a senior software architect. Your job is to analyse the impact of a",
    "requested software change and produce a structured, specific, actionable report.",
    "Always ground your analysis in the system context provided.",
    'If a section has no impact, write "No changes required."',
    "Use markdown bullet points for lists. Be concise but thorough.",
    ""
  );

  // ── 2. Project context ───────────────────────────────────────────────────
  lines.push("## System Context", "");
  lines.push(`**Project:** ${project.name}`, "");
  lines.push("**Description:**", project.description, "");

  if (project.modules?.trim()) {
    lines.push("**Modules:**", project.modules.trim(), "");
  }

  if (project.dbTables?.trim()) {
    lines.push("**Database Tables:**", project.dbTables.trim(), "");
  }

  if (project.apiEndpoints?.trim()) {
    lines.push("**API Endpoints:**", project.apiEndpoints.trim(), "");
  }

  if (project.techStack?.trim()) {
    lines.push("**Technology Stack:**", project.techStack.trim(), "");
  }

  // ── 3. Change request ────────────────────────────────────────────────────
  lines.push("## Change Request", "");
  lines.push(changeRequest.trim(), "");

  // ── 4. Output instructions ───────────────────────────────────────────────
  lines.push("## Required Output", "");
  lines.push(
    "Produce exactly 7 sections using these exact markdown headings (## level):",
    ""
  );

  for (const heading of SECTION_HEADINGS) {
    lines.push(`## ${heading}`);
  }

  lines.push(
    "",
    'Under "Development Tasks" use a markdown checklist (- [ ] item).',
    'Under "Test Cases and Risks" use a markdown checklist (- [ ] item).',
    "Do not include any text before the first ## heading.",
    "Do not add extra headings or sections beyond the 7 listed above."
  );

  return lines.join("\n");
}
