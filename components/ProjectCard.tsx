/**
 * components/ProjectCard.tsx
 *
 * Displays a single project as a clickable card on the home page.
 * Shows name, description excerpt, optional tech stack, analysis count,
 * and relative creation date.
 */

import Link from "next/link";

interface ProjectCardProps {
  id: string;
  name: string;
  description: string;
  techStack: string | null;
  analysisCount: number;
  createdAt: string; // ISO string — serialised from server component
}

/** Format a UTC ISO date string as a human-readable relative label. */
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

export function ProjectCard({
  id,
  name,
  description,
  techStack,
  analysisCount,
  createdAt,
}: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Name */}
      <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">
        {name}
      </h2>

      {/* Description */}
      <p className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed">
        {description}
      </p>

      {/* Tech stack pill */}
      {techStack && (
        <p className="mt-3 text-xs text-gray-400 truncate">
          <span className="font-medium text-gray-500">Stack: </span>
          {techStack}
        </p>
      )}

      {/* Footer row */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
          {analysisCount === 0
            ? "No analyses yet"
            : analysisCount === 1
              ? "1 analysis"
              : `${analysisCount} analyses`}
        </span>
        <span className="text-xs text-gray-400">{relativeDate(createdAt)}</span>
      </div>
    </Link>
  );
}
