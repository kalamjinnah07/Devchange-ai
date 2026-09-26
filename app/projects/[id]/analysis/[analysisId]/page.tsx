import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AnalysisReport } from "@/components/AnalysisReport";
import type { AnalysisResult } from "@/types";

export const dynamic = "force-dynamic";

interface AnalysisPageProps {
  params: { id: string; analysisId: string };
}

export async function generateMetadata({
  params,
}: AnalysisPageProps): Promise<Metadata> {
  const data = await loadAnalysis(params.id, params.analysisId);
  if (!data) return { title: "Analysis Not Found" };
  // Truncate long change requests for the tab title
  const cr = data.analysis.changeRequest;
  const title = cr.slice(0, 60);
  return { title: title.length < cr.length ? `${title}…` : title };
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const data = await loadAnalysis(params.id, params.analysisId);

  if (!data) {
    notFound();
  }

  const { project, analysis } = data;

  // Prisma stores result as JsonValue — double-cast through unknown to our type
  const result = analysis.result as unknown as AnalysisResult;

  return (
    <div className="space-y-8">
      {/* ── Breadcrumb ── */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-gray-500">
          <li>
            <Link href="/" className="hover:text-gray-700 transition-colors">
              Projects
            </Link>
          </li>
          <li aria-hidden className="text-gray-300">/</li>
          <li>
            <Link
              href={`/projects/${project.id}`}
              className="hover:text-gray-700 transition-colors truncate max-w-[120px] inline-block"
            >
              {project.name}
            </Link>
          </li>
          <li aria-hidden className="text-gray-300">/</li>
          <li className="text-gray-900 font-medium truncate max-w-[180px]">
            Analysis Report
          </li>
        </ol>
      </nav>

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Analysis Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            {project.name}
          </p>
        </div>
        <Link
          href={`/projects/${project.id}/analyse`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          New Analysis
        </Link>
      </div>

      {/* ── Report ── */}
      <AnalysisReport
        result={result}
        rawMarkdown={analysis.rawMarkdown}
        changeRequest={analysis.changeRequest}
        createdAt={analysis.createdAt.toISOString()}
      />
    </div>
  );
}

// ── Data helpers ──────────────────────────────────────────────────────────────

async function loadAnalysis(projectId: string, analysisId: string) {
  // Load both project and analysis, confirm the analysis belongs to the project
  const [project, analysis] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    }),
    prisma.analysis.findUnique({
      where: { id: analysisId },
    }),
  ]);

  if (!project || !analysis || analysis.projectId !== projectId) {
    return null;
  }

  return { project, analysis };
}
