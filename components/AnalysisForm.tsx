"use client";

/**
 * components/AnalysisForm.tsx
 *
 * Client component — the change-request form with live SSE streaming.
 *
 * Flow:
 *   1. User types a change request and submits.
 *   2. POST /api/analyse with { projectId, changeRequest }.
 *   3. Reads response.body as a ReadableStream, decoding SSE lines.
 *   4. Each watsonx chunk: data: {"results":[{"generated_text":"..."}]}
 *      → accumulates generated_text into displayText (shown in StreamingReport).
 *   5. Final chunk: data: {"type":"done","analysisId":"..."}
 *      → router.push to the saved analysis report page.
 *   6. Error chunk: data: {"type":"error","message":"..."}
 *      → shows inline error, stops streaming.
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { StreamingReport } from "./StreamingReport";

interface AnalysisFormProps {
  projectId: string;
  projectName: string;
}

const MAX_CHARS = 2000;

export function AnalysisForm({ projectId, projectName }: AnalysisFormProps) {
  const router = useRouter();

  const [changeRequest, setChangeRequest] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Streaming state
  const [phase, setPhase] = useState<"idle" | "streaming" | "saving">("idle");
  const [streamText, setStreamText] = useState("");

  // Abort controller so the user can cancel an in-flight request
  const abortRef = useRef<AbortController | null>(null);

  const isSubmitting = phase !== "idle";
  const charsLeft = MAX_CHARS - changeRequest.length;

  function handleCancel() {
    abortRef.current?.abort();
    setPhase("idle");
    setStreamText("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const request = changeRequest.trim();
    if (!request) {
      setError("Please describe the change you want to analyse.");
      return;
    }

    setError(null);
    setStreamText("");
    setPhase("streaming");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, changeRequest: request }),
        signal: controller.signal,
      });

      // Pre-stream error (400/404/502/500)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          data.error ?? `Server error (HTTP ${res.status}). Please retry.`
        );
      }

      if (!res.body) {
        throw new Error("No response stream received from the server.");
      }

      // ── Read SSE stream ──────────────────────────────────────────────────
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from the buffer
        const lines = buffer.split("\n");
        // Keep last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            continue; // skip non-JSON lines
          }

          const msg = parsed as Record<string, unknown>;

          // Done event — navigate to the saved report
          if (msg.type === "done" && typeof msg.analysisId === "string") {
            setPhase("saving");
            router.push(
              `/projects/${projectId}/analysis/${msg.analysisId}`
            );
            return;
          }

          // Error event mid-stream
          if (msg.type === "error" && typeof msg.message === "string") {
            throw new Error(msg.message);
          }

          // Normal watsonx token chunk
          const token =
            (
              msg as {
                results?: Array<{ generated_text?: string }>;
              }
            ).results?.[0]?.generated_text ?? "";

          if (token) {
            setStreamText((prev) => prev + token);
          }
        }
      }

      // Stream ended without a done event — treat as an error
      throw new Error(
        "Stream ended unexpectedly. The analysis may not have been saved."
      );
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        // User cancelled — already handled by handleCancel
        return;
      }
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      setPhase("idle");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Form ── */}
      {phase === "idle" && (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="changeRequest"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Change Request
              <span className="text-red-500 ml-1" aria-hidden>*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Describe the change in plain language. Be specific about the
              feature or fix — the more detail you give, the more precise the
              analysis.
            </p>
            <textarea
              id="changeRequest"
              name="changeRequest"
              rows={5}
              value={changeRequest}
              onChange={(e) => {
                setChangeRequest(e.target.value.slice(0, MAX_CHARS));
                setError(null);
              }}
              placeholder={`e.g. Add GST calculation to the invoice module.\n\nEach invoice line item should have a configurable GST rate (0%, 10%, etc.), the invoice total should show GST-exclusive and GST-inclusive amounts, and the existing PDF export should be updated to include the GST breakdown.`}
              aria-required
              aria-describedby={error ? "cr-error" : "cr-hint"}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                error
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span
                id="cr-hint"
                className={`text-xs ${charsLeft < 100 ? "text-amber-600 font-medium" : "text-gray-400"}`}
              >
                {charsLeft} characters remaining
              </span>
              {error && (
                <span
                  id="cr-error"
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {error}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!changeRequest.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              Analyse Impact
            </button>
          </div>
        </form>
      )}

      {/* ── Streaming display ── */}
      {(phase === "streaming" || phase === "saving") && (
        <div className="space-y-4">
          <StreamingReport
            text={streamText}
            isStreaming={phase === "streaming"}
          />

          {phase === "streaming" && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Cancel
            </button>
          )}

          {phase === "saving" && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg
                className="h-4 w-4 animate-spin text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Saving analysis for {projectName}…
            </div>
          )}
        </div>
      )}

      {/* ── Post-submit error (shown after streaming fails) ── */}
      {phase === "idle" && error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}
