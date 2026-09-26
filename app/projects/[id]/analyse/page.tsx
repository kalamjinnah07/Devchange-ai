import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AnalysisForm } from "@/components/AnalysisForm";

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

export default async function AnalysePage({ params }: AnalysePageProps) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, description: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
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
              className="hover:text-gray-700 transition-colors"
            >
              {project.name}
            </Link>
          </li>
          <li aria-hidden className="text-gray-300">/</li>
          <li className="text-gray-900 font-medium">Analyse a Change</li>
        </ol>
      </nav>

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analyse a Change</h1>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Describe the change you want to make to{" "}
          <span className="font-medium text-gray-700">{project.name}</span>.
          DevChange AI will analyse the impact across modules, database, API,
          and frontend.
        </p>
      </div>

      {/* ── Form card ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <AnalysisForm
          projectId={project.id}
          projectName={project.name}
        />
      </div>

      {/* ── Tips ── */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Tips for better analysis</p>
        <ul className="space-y-1.5">
          {[
            "Be specific — mention module names, table names, or endpoints if you know them.",
            "Include business context — why is this change needed?",
            'Mention constraints — e.g. "must be backward-compatible" or "zero downtime".',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs text-gray-500">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
