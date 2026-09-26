/**
 * lib/parser.ts — Markdown response parser for DevChange AI
 *
 * Splits the raw LLM response into the structured AnalysisResult type
 * by splitting on the known ## section headings.
 *
 * Design decisions:
 * - Uses a single regex split so the whole response is processed in one pass.
 * - Falls back gracefully: if parsing fails, the full markdown lands in
 *   changeSummary so no content is lost.
 * - Trims each section's content so leading/trailing whitespace doesn't
 *   accumulate in the database.
 */

import type { AnalysisResult } from "@/types";
import { SECTION_HEADINGS } from "@/lib/prompt";

// Map from exact heading string → AnalysisResult key
const HEADING_TO_KEY: Record<
  (typeof SECTION_HEADINGS)[number],
  keyof AnalysisResult
> = {
  "Change Summary": "changeSummary",
  "Affected Modules": "affectedModules",
  "Database Impact": "databaseImpact",
  "Backend/API Impact": "backendApiImpact",
  "Frontend/UI Impact": "frontendUiImpact",
  "Development Tasks": "developmentTasks",
  "Test Cases and Risks": "testCasesAndRisks",
};

/** An empty result used as the fallback base. */
function emptyResult(): AnalysisResult {
  return {
    changeSummary: "",
    affectedModules: "",
    databaseImpact: "",
    backendApiImpact: "",
    frontendUiImpact: "",
    developmentTasks: "",
    testCasesAndRisks: "",
  };
}

/**
 * Parse a raw markdown string produced by the LLM into a structured
 * AnalysisResult. Missing sections default to an empty string.
 *
 * @param markdown - The complete LLM response text
 * @returns Structured AnalysisResult with one field per section
 */
export function parseAnalysis(markdown: string): AnalysisResult {
  const result = emptyResult();

  if (!markdown.trim()) {
    return result;
  }

  // Build a regex that matches any of the known ## headings.
  // The capture group lets us know which heading we matched.
  const headingPattern = SECTION_HEADINGS.map((h) =>
    // Escape special regex chars in the heading (e.g. "/" in "Backend/API Impact")
    h.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")
  ).join("|");

  // Split on lines starting with "## <known heading>"
  // The regex uses a lookahead so the heading line itself is kept as a separator token.
  const splitRegex = new RegExp(
    `(?=^## (?:${headingPattern})(?:\\s*$|\\s+\\S))`,
    "m"
  );

  const chunks = markdown.split(splitRegex);

  let parsedAny = false;

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // Extract the heading from the first line
    const firstLine = trimmed.split("\n")[0].replace(/^##\s+/, "").trim();

    const key =
      HEADING_TO_KEY[firstLine as (typeof SECTION_HEADINGS)[number]];

    if (!key) continue; // preamble or unrecognised heading — skip

    // Content is everything after the heading line
    const content = trimmed.split("\n").slice(1).join("\n").trim();
    result[key] = content;
    parsedAny = true;
  }

  // Fallback: if nothing parsed cleanly, preserve full text in changeSummary
  if (!parsedAny) {
    result.changeSummary = markdown.trim();
  }

  return result;
}
