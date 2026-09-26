/**
 * components/AnalysisListItem.tsx
 *
 * A single row in the analysis history list on the project dashboard.
 * Displays a truncated change request and relative creation date.
 */

import Link from "next/link";

interface AnalysisListItemProps {
  id: string;
  projectId: string;
  changeRequest: string;
  createdAt: string; // ISO string
}

function relativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AnalysisListItem({
  id,
  projectId,
  changeRequest,
  createdAt,
}: AnalysisListItemProps) {
  return (
    <Link
      href={`/projects/${projectId}/analysis/${id}`}
      className="group flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm transition-all hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Change request text */}
      <span className="flex-1 truncate text-gray-700 group-hover:text-blue-800">
        {changeRequest}
      </span>

      {/* Date + chevron */}
      <span className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
        {relativeDate(createdAt)}
        <svg
          className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
