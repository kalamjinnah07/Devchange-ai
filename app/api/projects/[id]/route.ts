/**
 * app/api/projects/[id]/route.ts
 *
 * GET /api/projects/[id] — Load a single project with its analysis summaries.
 *
 * Responses:
 *   200  { project }   — project with analyses array (id, changeRequest, createdAt)
 *   404  { error }     — project not found
 *   500  { error }     — database error
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            projectId: true,
            changeRequest: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: `Project not found: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error(`[GET /api/projects/${id}] Database error:`, err);
    return NextResponse.json(
      { error: "Failed to load project." },
      { status: 500 }
    );
  }
}
