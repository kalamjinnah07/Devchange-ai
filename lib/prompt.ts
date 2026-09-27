/**
 * lib/prompt.ts — Prompt builder for DevChange AI
 *
 * Builds a structured prompt for software change impact analysis.
 */

import type { Project } from "@/types";

// These headings must stay in sync with lib/parser.ts
export const SECTION_HEADINGS = [
  "Change Summary",
  "Affected Modules",
  "Database Impact",
  "Backend/API Impact",
  "Frontend/UI Impact",
  "Development Tasks",
  "Test Cases and Risks",
] as const;

export function buildPrompt(
  project: Project,
  changeRequest: string
): string {
  const lines: string[] = [];

  // ── 1. Role ──────────────────────────────────────────────────────────────
  lines.push(
    "You are a senior software architect performing a software change impact analysis.",
    "Analyze the requested change using ONLY the provided system context.",
    "Be specific, practical, and concise.",
    "Your most important requirement is to complete ALL 7 sections.",
    "Never stop generation after a heading.",
    "Every heading MUST have useful content.",
    ""
  );

  // ── 2. System Context ───────────────────────────────────────────────────
  lines.push("## System Context", "");
  lines.push(`Project: ${project.name}`, "");
  lines.push("Description:", project.description, "");

  if (project.modules?.trim()) {
    lines.push("Modules:", project.modules.trim(), "");
  }

  if (project.dbTables?.trim()) {
    lines.push("Database Tables:", project.dbTables.trim(), "");
  }

  if (project.apiEndpoints?.trim()) {
    lines.push("API Endpoints:", project.apiEndpoints.trim(), "");
  }

  if (project.techStack?.trim()) {
    lines.push("Technology Stack:", project.techStack.trim(), "");
  }

  // ── 3. Change Request ───────────────────────────────────────────────────
  lines.push("## Change Request", "");
  lines.push(changeRequest.trim(), "");

  // ── 4. Required Output ──────────────────────────────────────────────────
  lines.push(
    "## Required Output",
    "",
    "Return EXACTLY the following 7 sections and nothing else:",
    "",
    "## Change Summary",
    "Summarize the requested change and its overall purpose in 2-3 sentences.",
    "",
    "## Affected Modules",
    "List the modules affected and briefly explain why.",
    "",
    "## Database Impact",
    "Identify required database/schema/model changes. If none are needed, explicitly say why.",
    "",
    "## Backend/API Impact",
    "Identify affected APIs, server-side logic, validation, calculations, integrations, or PDF generation. If none are needed, explain why.",
    "",
    "## Frontend/UI Impact",
    "Identify affected screens, forms, fields, buttons, tables, displays, loading states, or validation. If none are needed, explain why.",
    "",
    "## Development Tasks",
    "Provide 4-8 concrete implementation tasks.",
    "",
    "## Test Cases and Risks",
    "Provide 4-8 concrete test cases and important implementation risks.",
    ""
  );

  // ── 5. Strict formatting rules ─────────────────────────────────────────
  lines.push(
    "STRICT RULES:",
    "1. Output all 7 sections in exactly the order shown above.",
    "2. Use exactly these ## headings. Do not rename them.",
    "3. Do not stop after any heading.",
    "4. Do not leave any section empty.",
    "5. Keep each section concise so the complete response fits within the output limit.",
    "6. Use bullet points for Affected Modules, Database Impact, Backend/API Impact, and Frontend/UI Impact.",
    "7. Use markdown checklists (- [ ] item) for Development Tasks.",
    "8. Use markdown checklists (- [ ] item) for Test Cases and Risks.",
    "9. Do not add an introduction, conclusion, or extra headings.",
    "10. If a section truly has no impact, write one short explanation such as: No changes required because this change does not affect this layer.",
    ""
  );

  return lines.join("\n");
}