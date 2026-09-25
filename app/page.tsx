import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Projects",
};

/**
 * Home page — project list.
 * Full implementation is in Sub-Task 3.
 * This placeholder confirms routing and layout are working.
 */
export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Select a project to run an impact analysis, or create a new one.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          + New Project
        </Link>
      </div>

      {/* Empty state — projects will be listed here in Sub-Task 3 */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-8 py-16 text-center">
        <p className="text-lg font-medium text-gray-700">No projects yet</p>
        <p className="mt-2 text-sm text-gray-500">
          Create your first project to start analysing change requests.
        </p>
        <Link
          href="/projects/new"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Project
        </Link>
      </div>
    </div>
  );
}
