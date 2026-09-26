"use client";

/**
 * components/StreamingReport.tsx
 *
 * Displays the raw analysis text as it streams token-by-token from the API.
 * Shows a blinking cursor while generation is in progress.
 * Renders the accumulated text as plain preformatted markdown so the user
 * can follow along; the final structured report is shown on the saved page.
 */

interface StreamingReportProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingReport({ text, isStreaming }: StreamingReportProps) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      {/* Status bar */}
      <div className="mb-3 flex items-center gap-2">
        {isStreaming ? (
          <>
            <span className="flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <span className="text-xs font-medium text-blue-700">
              Analysing with IBM watsonx.ai…
            </span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 text-green-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            <span className="text-xs font-medium text-green-700">
              Analysis complete — saving report…
            </span>
          </>
        )}
      </div>

      {/* Streaming text */}
      <div className="font-mono text-xs leading-relaxed text-gray-700 whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto">
        {text}
        {isStreaming && (
          <span
            className="inline-block w-2 h-3.5 bg-blue-500 ml-0.5 align-text-bottom animate-pulse"
            aria-hidden
          />
        )}
        {!text && isStreaming && (
          <span className="text-gray-400 not-italic">
            Waiting for first token…
          </span>
        )}
      </div>
    </div>
  );
}
