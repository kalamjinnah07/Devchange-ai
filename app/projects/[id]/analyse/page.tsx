import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AnalysePageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: AnalysePageProps): Promise<Metadata> {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  if (!project) return { title: "Project Not Found" };
  return { title: `Analyse — ${project.name}` };
}

/**
 * app/projects/[id]/analyse/page.tsx
 *
 * Placeholder page for Sub-Task 4 (Analysis Flow UI).
 * Confirms the route exists and the "Analyse a Change" button works.
 */
export default async function AnalysePage({ params }: AnalysePageProps) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Breadcrumb */}
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
              className="hover:text-gray-700 transition-colors"
            >
              {project.name}
            </Link>
          </li>
          <li aria-hidden className="text-gray-300">/</li>
          <li className="text-gray-900 font-medium">Analyse a Change</li>
        </ol>
      </nav>

      {/* Coming soon placeholder */}
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
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <p className="text-base font-semibold text-gray-800">
          Analysis UI coming in Sub-Task 4
        </p>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
          The AI pipeline is ready. The streaming UI will be built next.
        </p>
        <Link
          href={`/projects/${project.id}`}
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ← Back to Project
        </Link>
      </div>
    </div>
  );
}
