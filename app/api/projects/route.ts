/**
 * app/api/projects/route.ts
 *
 * GET  /api/projects — List all projects (with analysis count).
 * POST /api/projects — Create a new project.
 *
 * GET responses:
 *   200  { projects: ProjectWithCount[] }
 *   500  { error: string }
 *
 * POST request body:
 *   { name, description, modules?, dbTables?, apiEndpoints?, techStack? }
 *
 * POST responses:
 *   201  { project }
 *   400  { error: string }
 *   500  { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// ── GET /api/projects ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { analyses: true } },
      },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/projects] Database error:", err);
    return NextResponse.json(
      { error: "Failed to load projects." },
      { status: 500 }
    );
  }
}

// ── Validation schema ─────────────────────────────────────────────────────────

const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(120, "Project name must be 120 characters or fewer")
    .transform((v) => v.trim()),
  description: z
    .string()
    .min(1, "Project description is required")
    .transform((v) => v.trim()),
  modules: z.string().optional().transform((v) => v?.trim() || null),
  dbTables: z.string().optional().transform((v) => v?.trim() || null),
  apiEndpoints: z.string().optional().transform((v) => v?.trim() || null),
  techStack: z.string().optional().transform((v) => v?.trim() || null),
});

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  // Validate
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join("; ");
    return NextResponse.json({ error: messages }, { status: 400 });
  }

  const { name, description, modules, dbTables, apiEndpoints, techStack } =
    parsed.data;

  // Persist
  try {
    const project = await prisma.project.create({
      data: { name, description, modules, dbTables, apiEndpoints, techStack },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects] Database error:", err);
    return NextResponse.json(
      { error: "Failed to create project. Please try again." },
      { status: 500 }
    );
  }
}
