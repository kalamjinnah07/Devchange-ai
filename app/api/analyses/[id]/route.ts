/**
 * app/api/analyses/[id]/route.ts
 *
 * GET /api/analyses/[id] — Load a single saved analysis by ID.
 *
 * Responses:
 *   200  { analysis }   — full analysis with result JSON and rawMarkdown
 *   404  { error }      — not found
 *   500  { error }      — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: `Analysis not found: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error(`[GET /api/analyses/${id}] Database error:`, err);
    return NextResponse.json(
      { error: "Failed to load analysis." },
      { status: 500 }
    );
  }
}
