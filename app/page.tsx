import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProjectCard } from "@/components/ProjectCard";

export const metadata: Metadata = {
  title: "Projects",
};

// Always fetch fresh data — no caching at the page level
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch all projects with their analysis counts directly from the DB.
  // This is a server component — no client-side fetch needed.
  let projects: Awaited<ReturnType<typeof loadProjects>> = [];
  let loadError: string | null = null;

  try {
    projects = await loadProjects();
  } catch {
    loadError = "Could not load projects. Check your database connection.";
  }

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Select a project to run an impact analysis, or create a new one.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Link>
      </div>

      {/* ── Load error ── */}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* ── Project grid ── */}
      {!loadError && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              id={p.id}
              name={p.name}
              description={p.description}
              techStack={p.techStack}
              analysisCount={p._count.analyses}
              createdAt={p.createdAt.toISOString()}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loadError && projects.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-800">No projects yet</p>
          <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
            Describe your system once, then analyse any change request in seconds.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create your first project
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Data helpers ──────────────────────────────────────────────────────────────

async function loadProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { analyses: true } },
    },
  });
}
