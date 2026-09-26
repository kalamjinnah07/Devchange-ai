/**
 * app/api/analyse/route.ts
 *
 * POST /api/analyse — Stream an AI impact analysis for a change request.
 *
 * Request body:
 *   { projectId: string, changeRequest: string }
 *
 * Response (success):
 *   Content-Type: text/event-stream
 *   Stream of SSE data lines from watsonx.ai, followed by a final line:
 *     data: {"type":"done","analysisId":"<cuid>"}
 *
 * Response (error before streaming starts):
 *   400  { error: string }   — validation failure
 *   404  { error: string }   — project not found
 *   502  { error: string }   — upstream AI error
 *   500  { error: string }   — unexpected server error
 *
 * Streaming flow:
 *   1. Validate input
 *   2. Load project from DB
 *   3. Build prompt (lib/prompt.ts)
 *   4. Call aiProvider.stream() → ReadableStream<Uint8Array> from watsonx
 *   5. Pipe through a TransformStream that:
 *        a) Passes each raw chunk straight to the browser (zero-copy forwarding)
 *        b) Accumulates text decoded from the SSE chunks
 *   6. On stream close (flush):
 *        - parseAnalysis(accumulated text)
 *        - Save Analysis record to DB
 *        - Write a final SSE line: data: {"type":"done","analysisId":"..."}
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { aiProvider } from "@/lib/ai";
import { buildPrompt } from "@/lib/prompt";
import { parseAnalysis } from "@/lib/parser";

// ── Validation schema ─────────────────────────────────────────────────────────

const AnalyseSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  changeRequest: z
    .string()
    .min(1, "changeRequest is required")
    .max(2000, "changeRequest must be 2000 characters or fewer")
    .transform((v) => v.trim()),
});

// ── SSE helpers ───────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

/** Encode a plain string as a UTF-8 Uint8Array for the stream. */
function encodeChunk(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Build the final SSE done event that carries the analysisId. */
function doneLine(analysisId: string): Uint8Array {
  return encodeChunk(
    `data: ${JSON.stringify({ type: "done", analysisId })}\n\n`
  );
}

/** Build a SSE error event for errors that occur mid-stream. */
function errorLine(message: string): Uint8Array {
  return encodeChunk(
    `data: ${JSON.stringify({ type: "error", message })}\n\n`
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Parse & validate input ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const parsed = AnalyseSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const { projectId, changeRequest } = parsed.data;

  // ── 2. Load project ──────────────────────────────────────────────────────
  let project;
  try {
    project = await prisma.project.findUnique({ where: { id: projectId } });
  } catch (err) {
    console.error("[POST /api/analyse] DB error loading project:", err);
    return NextResponse.json(
      { error: "Database error while loading project" },
      { status: 500 }
    );
  }

  if (!project) {
    return NextResponse.json(
      { error: `Project not found: ${projectId}` },
      { status: 404 }
    );
  }

  // ── 3. Build prompt ──────────────────────────────────────────────────────
  const prompt = buildPrompt(project, changeRequest);

  // ── 4. Call AI provider ──────────────────────────────────────────────────
  let watsonxStream: ReadableStream<Uint8Array>;
  try {
    watsonxStream = await aiProvider.stream(prompt);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown AI provider error";
    console.error("[POST /api/analyse] AI provider error:", err);
    return NextResponse.json(
      { error: `AI service error: ${message}` },
      { status: 502 }
    );
  }

  // ── 5 & 6. Transform + forward + accumulate + save ───────────────────────
  //
  // The TransformStream is the core of the streaming pipeline:
  //
  //   watsonxStream  →  TransformStream  →  browser
  //
  // transform(chunk): forward chunk as-is → accumulate decoded text
  // flush():          parse → save to DB → write final done/error SSE line
  //
  // We accumulate the *decoded text* from each SSE chunk. watsonx returns
  // SSE lines shaped like:
  //   data: {"results":[{"generated_text":"...","stop_reason":null,...}]}
  //
  // We extract generated_text from each chunk for accumulation, but forward
  // the raw bytes so the browser receives the original watsonx SSE format.
  // The frontend reads the raw SSE and uses generated_text from each chunk
  // to build up the streaming display.

  const decoder = new TextDecoder();
  let accumulated = "";

  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // Forward raw bytes to browser immediately (zero-copy pass-through)
      controller.enqueue(chunk);

      // Decode and accumulate generated_text for later parsing
      const text = decoder.decode(chunk, { stream: true });

      // Each SSE chunk may contain one or more "data: {...}" lines.
      // Extract generated_text from each.
      const lines = text.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr) as {
            results?: Array<{ generated_text?: string }>;
          };
          const token = parsed.results?.[0]?.generated_text ?? "";
          accumulated += token;
        } catch {
          // Non-JSON data line — skip silently
        }
      }
    },

    async flush(controller) {
      // Flush any remaining bytes in the decoder
      const remainder = decoder.decode(undefined, { stream: false });
      if (remainder) accumulated += remainder;

      // Parse the accumulated text into structured sections
      const result = parseAnalysis(accumulated);

      try {
        // Save the completed analysis to the database.
        // Cast result to satisfy Prisma's Json field type — AnalysisResult
        // is a plain object that is valid JSON, but TypeScript needs the hint.
        const analysis = await prisma.analysis.create({
          data: {
            projectId: project.id,
            changeRequest,
            result: result as object,
            rawMarkdown: accumulated,
          },
        });

        // Signal completion with the analysisId
        controller.enqueue(doneLine(analysis.id));
      } catch (err) {
        console.error("[POST /api/analyse] DB error saving analysis:", err);
        controller.enqueue(
          errorLine("Analysis generated but could not be saved. Please retry.")
        );
      }
    },
  });

  const outputStream = watsonxStream.pipeThrough(transform);

  return new Response(outputStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Allow the Next.js edge/node runtime to stream without buffering
      "X-Accel-Buffering": "no",
    },
  });
}
