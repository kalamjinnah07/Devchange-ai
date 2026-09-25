# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**DevChange AI** — an AI-powered development impact analysis tool built for the IBM Bob 2.0 Hackathon.

Users describe their software system, submit a change request (e.g. "Add GST to the invoice module"), and receive a structured 7-section impact analysis streamed in real time from IBM watsonx.ai.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Type-check without emitting (run before every commit)
npm run typecheck

# Lint
npm run lint

# Prisma: generate client after schema changes
npm run db:generate

# Prisma: create and apply a migration (development)
npm run db:migrate

# Prisma: push schema to DB without migration file (prototyping only)
npm run db:push

# Prisma: open database browser
npm run db:studio
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values before running:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon.tech or local) |
| `WATSONX_API_KEY` | IBM Cloud API key |
| `WATSONX_PROJECT_ID` | watsonx.ai project ID |
| `WATSONX_URL` | watsonx.ai base URL, e.g. `https://us-south.ml.cloud.ibm.com` |
| `WATSONX_MODEL_ID` | Model ID — default `ibm/granite-3-3-8b-instruct` |

## Architecture

```
devchange-ai/
├── app/
│   ├── layout.tsx                        # Root layout, header, footer
│   ├── page.tsx                          # Home — project list
│   ├── globals.css                       # Tailwind directives + CSS vars
│   ├── projects/
│   │   ├── new/page.tsx                  # Create project form
│   │   └── [id]/
│   │       ├── page.tsx                  # Project dashboard + analysis list
│   │       ├── analyse/page.tsx          # New change request + live stream
│   │       └── analysis/[analysisId]/page.tsx  # Saved report view
│   └── api/
│       ├── analyse/route.ts              # POST — streams watsonx, saves to DB
│       └── projects/route.ts             # POST — create project
├── components/
│   ├── ProjectCard.tsx
│   ├── ProjectForm.tsx
│   ├── AnalysisForm.tsx
│   ├── AnalysisReport.tsx                # 7-section accordion
│   ├── AnalysisListItem.tsx
│   └── StreamingReport.tsx
├── lib/
│   ├── ai.ts                             # AIProvider interface + WatsonxProvider
│   ├── prompt.ts                         # buildPrompt()
│   ├── parser.ts                         # parseAnalysis()
│   └── db.ts                             # Prisma client singleton
├── prisma/
│   ├── schema.prisma                     # Project + Analysis models
│   └── seed.ts                           # Demo: Invoice Management System
├── types/
│   └── index.ts                          # Shared TypeScript types
└── .env.local                            # Not committed — see .env.local.example
```

## Key Design Decisions

- **AI provider:** IBM watsonx.ai via plain `fetch` — no Vercel AI SDK dependency.
- **Streaming:** `WatsonxProvider` returns `response.body` (`ReadableStream<Uint8Array>`). The API route pipes it through a `TransformStream` that accumulates text, then saves the Analysis and injects the `analysisId` in a final SSE chunk.
- **IAM auth:** `WATSONX_API_KEY` is exchanged for a Bearer token at `https://iam.cloud.ibm.com/identity/token`. Token cached in module memory with a 50-min TTL.
- **Model:** Configurable via `WATSONX_MODEL_ID`. Default is `ibm/granite-3-3-8b-instruct` (current multitenant-available Granite instruct model, 131k context window).
- **Database:** Prisma + PostgreSQL (Neon.tech). `lib/db.ts` uses a global singleton to avoid multiple connections during hot reloads.

## Database Schema

Two models: `Project` and `Analysis`.

- **Project** stores system context: required `name` + `description`, optional `modules`, `dbTables`, `apiEndpoints`, `techStack`.
- **Analysis** stores a change request, the parsed `result` (7-section JSON), and the `rawMarkdown` from the LLM.

Run migrations after schema changes:
```bash
npx prisma migrate dev --name <description>
```
