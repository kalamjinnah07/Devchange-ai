/**
 * app/api/projects/route.ts
 *
 * POST /api/projects — Create a new project.
 *
 * Request body:
 *   { name, description, modules?, dbTables?, apiEndpoints?, techStack? }
 *
 * Responses:
 *   201  { project }
 *   400  { error: string }
 *   500  { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

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
