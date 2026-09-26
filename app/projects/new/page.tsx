import type { Metadata } from "next";
import Link from "next/link";
import { ProjectForm } from "@/components/ProjectForm";

export const metadata: Metadata = {
  title: "New Project",
};

export default function NewProjectPage() {
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
          <li className="text-gray-900 font-medium">New Project</li>
        </ol>
      </nav>

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create a Project</h1>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Describe your system so DevChange AI can ground its analysis in your
          actual architecture. The more context you provide, the more specific
          the impact analysis will be.
        </p>
      </div>

      {/* ── Form card ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <ProjectForm />
      </div>
    </div>
  );
}
