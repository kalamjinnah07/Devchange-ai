/**
 * components/AnalysisReport.tsx
 *
 * Server component — renders a full 7-section analysis report.
 * Each section is presented as a card with a heading, icon, and markdown content.
 * Development Tasks and Test Cases render markdown checklist items as
 * visual checkbox rows.
 *
 * This is a server component — no "use client" needed.
 * The copy-to-markdown button is isolated in CopyButton (client component below).
 */

"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/types";

// ── Section configuration ─────────────────────────────────────────────────────

interface SectionConfig {
  key: keyof AnalysisResult;
  heading: string;
  icon: React.ReactNode;
  /** If true, render content as a checklist */
  checklist?: boolean;
}

const SECTIONS: SectionConfig[] = [
  {
    key: "changeSummary",
    heading: "Change Summary",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "affectedModules",
    heading: "Affected Modules",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    key: "databaseImpact",
    heading: "Database Impact",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  {
    key: "backendApiImpact",
    heading: "Backend / API Impact",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "frontendUiImpact",
    heading: "Frontend / UI Impact",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "developmentTasks",
    heading: "Development Tasks",
    checklist: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "testCasesAndRisks",
    heading: "Test Cases & Risks",
    checklist: true,
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

// ── Markdown helpers ──────────────────────────────────────────────────────────

/**
 * Parse a markdown string into an array of rendered lines.
 * Handles:
 *   - Checklist items:  - [ ] text  or  - [x] text
 *   - Bullet points:    - text  or  * text
 *   - Bold:             **text**
 *   - Inline code:      `code`
 *   - Plain text lines
 */
function renderMarkdownLine(line: string, index: number): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Inline formatting: bold and code
  function formatInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  // Checklist: - [ ] or - [x]
  const checklistMatch = trimmed.match(/^- \[([ xX])\] (.+)$/);
  if (checklistMatch) {
    const checked = checklistMatch[1].toLowerCase() === "x";
    return (
      <div key={index} className="flex items-start gap-2.5 py-1">
        <div
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            checked
              ? "border-blue-500 bg-blue-500"
              : "border-gray-300 bg-white"
          }`}
          aria-hidden
        >
          {checked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={`text-sm leading-snug ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
          {formatInline(checklistMatch[2])}
        </span>
      </div>
    );
  }

  // Bullet point: - or *
  if (/^[-*] /.test(trimmed)) {
    return (
      <div key={index} className="flex items-start gap-2 py-0.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden />
        <span className="text-sm text-gray-700 leading-relaxed">
          {formatInline(trimmed.slice(2))}
        </span>
      </div>
    );
  }

  // Sub-heading (### or ##) inside a section
  if (/^#{2,3} /.test(trimmed)) {
    return (
      <p key={index} className="mt-2 mb-1 text-sm font-semibold text-gray-800">
        {formatInline(trimmed.replace(/^#{2,3} /, ""))}
      </p>
    );
  }

  // Plain text
  return (
    <p key={index} className="text-sm text-gray-700 leading-relaxed">
      {formatInline(trimmed)}
    </p>
  );
}

function renderMarkdown(content: string): React.ReactNode {
  if (!content.trim()) {
    return (
      <p className="text-sm italic text-gray-400">No changes required.</p>
    );
  }
  return (
    <div className="space-y-0.5">
      {content
        .split("\n")
        .map((line, i) => renderMarkdownLine(line, i))
        .filter(Boolean)}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  config,
  content,
  defaultOpen,
}: {
  config: SectionConfig;
  content: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-blue-600">{config.icon}</span>
          <span className="text-sm font-semibold text-gray-900">
            {config.heading}
          </span>
          {!content.trim() && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              No changes
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {renderMarkdown(content)}
        </div>
      )}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ rawMarkdown }: { rawMarkdown: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in some contexts — silent fail
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy as Markdown
        </>
      )}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface AnalysisReportProps {
  result: AnalysisResult;
  rawMarkdown: string;
  changeRequest: string;
  createdAt: string; // ISO string
}

export function AnalysisReport({
  result,
  rawMarkdown,
  changeRequest,
  createdAt,
}: AnalysisReportProps) {
  const date = new Date(createdAt).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* ── Change request banner ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">
          Change Request
        </p>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {changeRequest}
        </p>
        <p className="mt-2 text-xs text-gray-400">{date}</p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-end">
        <CopyButton rawMarkdown={rawMarkdown} />
      </div>

      {/* ── Section cards ── */}
      <div className="space-y-3">
        {SECTIONS.map((section, i) => (
          <SectionCard
            key={section.key}
            config={section}
            content={result[section.key]}
            defaultOpen={i === 0} // first section open by default
          />
        ))}
      </div>
    </div>
  );
}
