import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AnalysisListItem } from "@/components/AnalysisListItem";

// Always render fresh — project data changes after each analysis
export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const project = await loadProject(params.id);
  if (!project) return { title: "Project Not Found" };
  return { title: project.name };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await loadProject(params.id);

  if (!project) {
    notFound();
  }

  const hasAnalyses = project.analyses.length > 0;

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
          <li className="text-gray-900 font-medium truncate max-w-xs">
            {project.name}
          </li>
        </ol>
      </nav>

      {/* ── Project header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {project.name}
          </h1>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-2xl">
            {project.description}
          </p>
        </div>
        <Link
          href={`/projects/${project.id}/analyse`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          Analyse a Change
        </Link>
      </div>

      {/* ── Context summary cards ── */}
      {(project.modules ||
        project.dbTables ||
        project.apiEndpoints ||
        project.techStack) && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            System Context
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {project.techStack && (
              <ContextField label="Technology Stack" value={project.techStack} />
            )}
            {project.modules && (
              <ContextField label="Modules" value={project.modules} />
            )}
            {project.dbTables && (
              <ContextField label="Database Tables" value={project.dbTables} />
            )}
            {project.apiEndpoints && (
              <ContextField label="API Endpoints" value={project.apiEndpoints} />
            )}
          </dl>
        </div>
      )}

      {/* ── Analysis history ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Analysis History
          </h2>
          {hasAnalyses && (
            <span className="text-xs text-gray-400">
              {project.analyses.length}{" "}
              {project.analyses.length === 1 ? "analysis" : "analyses"}
            </span>
          )}
        </div>

        {hasAnalyses ? (
          <ul className="space-y-2">
            {project.analyses.map((a) => (
              <li key={a.id}>
                <AnalysisListItem
                  id={a.id}
                  projectId={project.id}
                  changeRequest={a.changeRequest}
                  createdAt={a.createdAt.toISOString()}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">
              No analyses yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Run your first change-request analysis to see results here.
            </p>
            <Link
              href={`/projects/${project.id}/analyse`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Analyse a Change
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-1">{label}</dt>
      <dd className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
        {value}
      </dd>
    </div>
  );
}

// ── Data helpers ──────────────────────────────────────────────────────────────

async function loadProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          projectId: true,
          changeRequest: true,
          createdAt: true,
        },
      },
    },
  });
}
