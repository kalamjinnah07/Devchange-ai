# DevChange AI — MVP Implementation Plan (v2)

## Top-Level Overview

**Goal:** Build a solo, hackathon-ready AI-powered development assistant that converts a free-text software change request into a structured impact analysis and actionable implementation plan.

**Scope:** A Next.js 14 full-stack web application. Users create a project by describing their system (freetext + optional structured fields), submit a change request, and receive a streamed 7-section impact analysis powered by IBM watsonx.ai. All projects and analyses are persisted in PostgreSQL. Deployed to Vercel.

**Approach:** Next.js 14 App Router, TypeScript, Tailwind CSS + shadcn/ui, Prisma ORM, Neon.tech PostgreSQL, IBM watsonx.ai via a provider-abstracted AI client, Vercel AI SDK for streaming. IBM Bob 2.0 drives the entire development process.

**AI Provider Decision:** IBM watsonx.ai is the primary provider. The AI client is wrapped in a provider-abstracted interface (`lib/ai.ts`) so the underlying model can be swapped without touching the API route or prompt logic. No fallback provider is implemented in the MVP.

**Streaming Decision:** Plain `fetch`-based SSE implementation against the watsonx.ai `/ml/v1/text/generation_stream` endpoint. No dependency on Vercel AI SDK `StreamingTextResponse`. The `AIProvider` abstraction is preserved so the streaming strategy can be replaced per provider.

**Non-goals (MVP exclusions):** Real codebase parsing, authentication/multi-tenancy, CI/CD integration, issue tracker integration, code generation, billing, OpenAI fallback implementation.

---

## Problem Statement

Developers and tech leads frequently receive vague change requests ("Add GST to invoices") and must manually trace impact across the codebase, database, APIs, and UI before estimation can begin. This analysis is slow, error-prone, and relies on tribal knowledge. DevChange AI automates this first-pass impact analysis using an LLM grounded in a project's documented context.

---

## Target Users

- Solo developers or small teams receiving feature requests or change tickets
- Tech leads performing pre-sprint impact triage
- Junior developers who lack full system knowledge

---

## Core User Workflow

1. User creates a **Project** with a freetext system description and optionally fills in structured fields (modules, DB tables, API endpoints, tech stack).
2. User submits a **Change Request** in natural language.
3. The system builds a rich prompt from all context fields and streams a structured **Impact Analysis** back in real time.
4. User views the 7-section report, copies it as markdown, or runs a new analysis.

---

## MVP Features

| # | Feature | Priority |
|---|---------|----------|
| 1 | Create/manage a Project with hybrid context input | Must Have |
| 2 | Submit a change request against a project | Must Have |
| 3 | AI-generated structured impact analysis — 7 sections — streamed | Must Have |
| 4 | Streaming output with live typing effect | Must Have |
| 5 | Analysis history — list past analyses per project | Must Have |
| 6 | Copy-to-clipboard / markdown export of the report | Should Have |
| 7 | Multiple projects | Should Have |
| 8 | Re-run / refine analysis with follow-up prompt | Nice to Have |
| 9 | Tag/label individual sections as "accepted" | Nice to Have |

---

## Recommended Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 — App Router | Full-stack, single repo, API routes, RSC |
| Language | TypeScript | Type safety throughout |
| Styling | Tailwind CSS + shadcn/ui | Production-quality UI in hours |
| ORM | Prisma | Type-safe DB access, migrations |
| Database | PostgreSQL via Neon.tech | Free tier, serverless-compatible |
| AI Primary | IBM watsonx.ai — `ibm/granite-3-3-8b-instruct` default | Current multitenant model; instruction-following; 131k context |
| AI Client Wrapper | `lib/ai.ts` — provider interface | Isolates watsonx fetch call; swap-ready |
| Streaming | Plain `fetch` + `ReadableStream` SSE | No Vercel AI SDK dependency; direct watsonx SSE pipe |
| Deployment | Vercel | Zero-config, env vars, free tier |
| Dev Assistant | IBM Bob 2.0 | Planning, scaffolding, code gen, review |

---

## Application Architecture

```
devchange-ai/
├── app/
│   ├── layout.tsx                        # Root layout, fonts, providers
│   ├── page.tsx                          # Home — project list
│   ├── projects/
│   │   ├── new/
│   │   │   └── page.tsx                  # Create project form
│   │   └── [id]/
│   │       ├── page.tsx                  # Project dashboard + analysis list
│   │       ├── analyse/
│   │       │   └── page.tsx              # New change request + live stream
│   │       └── analysis/
│   │           └── [analysisId]/
│   │               └── page.tsx          # Saved analysis report view
│   └── api/
│       ├── analyse/
│       │   └── route.ts                  # POST — streams AI, saves to DB
│       └── projects/
│           └── route.ts                  # POST — create project
├── components/
│   ├── ProjectCard.tsx                   # Project summary card
│   ├── ProjectForm.tsx                   # Create/edit project form
│   ├── AnalysisForm.tsx                  # Change request textarea + submit
│   ├── AnalysisReport.tsx                # 7-section accordion report
│   ├── AnalysisListItem.tsx              # Row in analysis history list
│   └── StreamingReport.tsx               # Live stream renderer
├── lib/
│   ├── ai.ts                             # AI provider interface + watsonx client
│   ├── prompt.ts                         # buildPrompt() — assembles full prompt
│   ├── parser.ts                         # parseAnalysis() — splits markdown → 7 sections
│   └── db.ts                             # Prisma client singleton
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                           # Demo: Invoice Management System
├── types/
│   └── index.ts                          # Shared TypeScript types
├── .env.local                            # WATSONX_API_KEY, DATABASE_URL, etc.
└── CLAUDE.md                             # Build commands + architecture summary
```

---

## Database / Data Model

### `Project`

| Column | Type | Notes |
|--------|------|-------|
| id | String — cuid PK | |
| name | String — max 120 | e.g. "Invoice Management System" |
| description | String — text | One-paragraph system overview |
| modules | String? — text | Optional: comma-separated or freetext |
| dbTables | String? — text | Optional: DB table names / schema notes |
| apiEndpoints | String? — text | Optional: key REST/GraphQL endpoints |
| techStack | String? — text | Optional: languages, frameworks, infra |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| analyses | Analysis[] | Relation |

### `Analysis`

| Column | Type | Notes |
|--------|------|-------|
| id | String — cuid PK | |
| projectId | String FK | → Project |
| changeRequest | String — text | Original user input |
| result | Json | Parsed 7-section object |
| rawMarkdown | String — text | Full LLM response |
| createdAt | DateTime | |

### `result` JSON shape

```ts
interface AnalysisResult {
  affectedModules:   string;   // markdown content
  databaseChanges:   string;
  backendAPIChanges: string;
  frontendUIChanges: string;
  dependenciesRisks: string;
  developmentTasks:  string;
  testCases:         string;
}
```

---

## Hybrid Project Context — Input Design

The Create Project form has two zones:

**Zone 1 — Required**
- `name` — text input
- `description` — large textarea: "Describe your system in plain language"

**Zone 2 — Optional Structured Fields** (collapsible "Add details" expander)
- `modules` — textarea: "e.g. InvoiceModule, PaymentModule, UserModule"
- `dbTables` — textarea: "e.g. invoices, invoice_items, customers, products"
- `apiEndpoints` — textarea: "e.g. GET /api/invoices, POST /api/invoices/:id/pay"
- `techStack` — textarea: "e.g. Node.js, React, PostgreSQL, Redis"

All optional fields are passed into the prompt only when non-empty. The prompt builder gracefully omits empty sections.

---

## AI Provider Abstraction — `lib/ai.ts`

```
interface AIProvider {
  stream(prompt: string): Promise<ReadableStream<Uint8Array>>
}

class WatsonxProvider implements AIProvider { ... }

// To swap provider: replace this one export line — zero other changes needed
export const aiProvider: AIProvider = new WatsonxProvider()
```

**watsonx.ai integration — verified against IBM docs:**

| Detail | Value |
|--------|-------|
| Streaming endpoint | `POST https://{region}.ml.cloud.ibm.com/ml/v1/text/generation_stream?version=2024-05-01` |
| Auth | IAM API key → POST `https://iam.cloud.ibm.com/identity/token` → `access_token` Bearer token |
| Default model | `ibm/granite-3-3-8b-instruct` — current multitenant-available Granite instruct model; 131,072 token context window; not deprecated |
| Configurable via | `WATSONX_MODEL_ID` env var — overrides default at runtime with no code change |
| Request body fields | `model_id`, `input` (assembled prompt string), `project_id`, `parameters` |
| Parameters | `max_new_tokens: 2000`, `temperature: 0.3`, `repetition_penalty: 1.1` |
| SSE response format | `data: {...}\n\n` chunks; stream ends when watsonx closes the connection |

**Streaming implementation strategy:**
- `WatsonxProvider.stream()` calls `fetch()` against the generation_stream endpoint
- Returns the raw `response.body` (`ReadableStream<Uint8Array>`) directly
- The API route in `app/api/analyse/route.ts` pipes this stream to the browser as a plain `text/event-stream` `Response`
- A `TransformStream` in the route accumulates the full text, triggers `parseAnalysis()` and DB save on close
- No Vercel AI SDK, no third-party streaming wrapper

**IAM token handling:**
- `WatsonxProvider` exchanges `WATSONX_API_KEY` for a Bearer token via `https://iam.cloud.ibm.com/identity/token` on each request
- Token cached in-memory with a 50-minute TTL (IAM tokens expire at 60 minutes)
- Cache is module-level; safe for Vercel serverless function lifecycle

**Env vars required:**
```
WATSONX_API_KEY=          # IBM Cloud API key
WATSONX_PROJECT_ID=       # watsonx.ai project ID
WATSONX_REGION=us-south   # or eu-de, jp-tok, etc.
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct   # default; override to swap models
DATABASE_URL=             # Neon.tech PostgreSQL connection string
```

---

## Prompt Design

### System Prompt (fixed, injected as role=system)

```
You are a senior software architect. Your job is to analyse the impact of a
requested software change and produce a structured, specific, actionable report.
Always ground your analysis in the system context provided.
If a section has no impact, write "No changes required."
Use markdown bullet points for lists. Be concise but thorough.
```

### User Prompt (assembled by `lib/prompt.ts`)

```
## System Context

**Project:** {name}

**Description:**
{description}

{if modules}
**Modules:**
{modules}
{/if}

{if dbTables}
**Database Tables:**
{dbTables}
{/if}

{if apiEndpoints}
**API Endpoints:**
{apiEndpoints}
{/if}

{if techStack}
**Technology Stack:**
{techStack}
{/if}

## Change Request

{changeRequest}

## Required Output

Produce exactly 7 sections using these exact markdown headings:

## Affected Modules
## Database Changes
## Backend / API Changes
## Frontend / UI Changes
## Dependencies & Risks
## Development Tasks
## Test Cases

Under "Development Tasks" use a markdown checklist (- [ ] item).
Under "Test Cases" use a markdown checklist (- [ ] item).
```

### Section Parser — `lib/parser.ts`

Splits raw LLM markdown on `## ` headings using a regex:
```
/^## (Affected Modules|Database Changes|Backend \/ API Changes|Frontend \/ UI Changes|Dependencies & Risks|Development Tasks|Test Cases)/gm
```
Returns the `AnalysisResult` object. Falls back to storing the full response in `affectedModules` if parsing fails.

---

## API Design

### `POST /api/analyse`

**Request:**
```json
{
  "projectId": "clxxxxxx",
  "changeRequest": "Add GST calculation to the invoice module."
}
```

**Streaming Behaviour:**
1. Validate `projectId` and `changeRequest` (400 if missing)
2. Load `Project` from DB (404 if not found)
3. Call `buildPrompt(project, changeRequest)` → `lib/prompt.ts`
4. Call `aiProvider.stream(prompt)` → returns `ReadableStream<Uint8Array>` from watsonx
5. Pipe stream through a `TransformStream` that: (a) passes each chunk to the browser as-is, and (b) accumulates the full text
6. On stream close: call `parseAnalysis(rawMarkdown)`, save `Analysis` to DB, inject `analysisId` in a final `data:` SSE line
7. Return `new Response(transformedStream, { headers: { 'Content-Type': 'text/event-stream' } })`

**Response:** `text/event-stream` — plain SSE, no Vercel AI SDK format dependency

**Error responses:**
- `400` — missing fields
- `404` — project not found
- `502` — watsonx API failure (with user-visible message)

### `POST /api/projects`

**Request:**
```json
{
  "name": "Invoice Management System",
  "description": "...",
  "modules": "...",
  "dbTables": "...",
  "apiEndpoints": "...",
  "techStack": "..."
}
```

**Response:** `201` with created `Project` object. Client redirects to `/projects/[id]`.

---

## Required Screens

### 1. Home — Project List `/`
- App name + tagline header
- Grid of `ProjectCard` components (name, description snippet, analysis count, date)
- "New Project" CTA button
- Empty state with illustration + call-to-action copy

### 2. Create Project `/projects/new`
- `ProjectForm` component
  - Required: Name, Description textarea
  - "Add structured details ▼" collapsible expander
    - Modules textarea
    - Database Tables textarea
    - API Endpoints textarea
    - Technology Stack textarea
- Submit → POST /api/projects → redirect to `/projects/[id]`

### 3. Project Dashboard `/projects/[id]`
- Project name, description, structured fields (collapsed summary)
- "New Analysis" prominent button
- Analysis history: list of `AnalysisListItem` rows — change request text, date, chevron
- Click row → `/projects/[id]/analysis/[analysisId]`
- Empty state: "No analyses yet. Run your first one."

### 4. New Analysis `/projects/[id]/analyse`
- Change request textarea (large, placeholder: "e.g. Add GST calculation to the invoice module.")
- Submit button ("Analyse Impact →")
- On submit: button disables, streaming output renders below in `StreamingReport`
- `StreamingReport`: shows raw markdown with a blinking cursor during stream
- On completion: auto-redirects to `/projects/[id]/analysis/[analysisId]`

### 5. Analysis Report `/projects/[id]/analysis/[analysisId]`
- Breadcrumb: Project → Analysis
- Change request displayed in a highlighted card at top
- 7 `Accordion` sections, each with a distinct icon:
  - 🧩 Affected Modules
  - 🗄️ Database Changes
  - 🔌 Backend / API Changes
  - 🖥️ Frontend / UI Changes
  - ⚠️ Dependencies & Risks
  - ✅ Development Tasks (checklist items rendered as `<Checkbox>`)
  - 🧪 Test Cases (checklist items rendered as `<Checkbox>`)
- "Copy as Markdown" button
- "Run New Analysis" link

---

## Example User Journey — GST Invoice

**User creates project:**
- Name: `Invoice Management System`
- Description: `A web application for creating and managing invoices for a small business. Built with Node.js and React.`
- Modules: `InvoiceModule, PaymentModule, CustomerModule, ProductModule`
- DB Tables: `invoices, invoice_items, customers, products, payments`
- API Endpoints: `GET /api/invoices, POST /api/invoices, GET /api/invoices/:id, PUT /api/invoices/:id, POST /api/invoices/:id/pay`
- Tech Stack: `Node.js, Express, React, PostgreSQL, Redis`

**User enters change request:**
> "Add GST calculation to the invoice module."

**Generated Analysis (streamed live):**

**Affected Modules**
> InvoiceModule (primary), ProductModule (GST category data), PaymentModule (total recalculation), InvoiceCreate / InvoiceDetail / InvoiceList components.

**Database Changes**
> - Add `gst_rate DECIMAL(5,2) DEFAULT 0` to `products`
> - Add `gst_amount DECIMAL(10,2)`, `gst_inclusive BOOLEAN DEFAULT false` to `invoice_items`
> - Add `total_gst DECIMAL(10,2) DEFAULT 0` to `invoices`
> - Migration required; existing rows default to 0% GST.

**Backend / API Changes**
> - `POST /api/invoices` — accept `gstRate` per line item, compute `gstAmount`
> - `GET /api/invoices/:id` — return full GST breakdown in response
> - Add `validateGstRate()` — must be one of 0, 5, 12, 18, 28
> - Update invoice total calculation: subtotal + totalGst = grandTotal

**Frontend / UI Changes**
> - InvoiceCreate: add GST rate dropdown per line item; show GST amount column
> - InvoiceDetail: add GST summary section (subtotal / GST / grand total)
> - InvoiceList: optionally add "GST Total" column

**Dependencies & Risks**
> - Risk: Existing invoices have null GST — migration must set safe defaults
> - Risk: GST rates vary by product category — confirm if per-category rates needed
> - Risk: PDF/export templates may need updating if invoice layout changes
> - Dependency: ProductModule must expose GST category per product

**Development Tasks**
> - [ ] Write and test DB migration script
> - [ ] Implement `calculateGst(lineItems)` utility function
> - [ ] Update invoice service layer with GST logic
> - [ ] Update API request validation schema
> - [ ] Update InvoiceCreate form component
> - [ ] Update InvoiceDetail view component
> - [ ] Update invoice PDF/print template if applicable
> - [ ] Update API integration tests

**Test Cases**
> - [ ] Invoice with 18% GST produces correct line-item and total amounts
> - [ ] Invoice with 0% GST-exempt items shows zero GST correctly
> - [ ] Existing invoices load without errors after migration
> - [ ] API rejects invalid GST rate with 400 error
> - [ ] Mixed GST rates on same invoice totals correctly

---

## How IBM Bob 2.0 Is Used Throughout Development

| Phase | Bob Usage |
|-------|----------|
| Planning | Generated this plan; refined architecture decisions |
| Scaffolding | Scaffold Next.js project, Prisma schema, Tailwind config |
| AI Integration | Write `lib/ai.ts` watsonx provider and streaming route |
| Prompt Engineering | Iteratively improve the system + user prompt for structured output |
| Component Building | Generate each React component from the spec above |
| Parser | Write and test `lib/parser.ts` section splitter |
| Styling | Apply Tailwind + shadcn/ui styling across all screens |
| Seed Data | Generate realistic seed data for demo project |
| Error Handling | Add error boundaries and toast notifications |
| Demo Prep | Draft hackathon submission write-up and demo script |

---

## Development Phases (Priority Order)

### Phase 1 — Foundation
- [ ] Initialise Next.js 14 + TypeScript + Tailwind + shadcn/ui
- [ ] Set up Prisma with Neon.tech PostgreSQL
- [ ] Define and migrate Project + Analysis schema (with hybrid context fields)
- [ ] Create `lib/db.ts` Prisma client singleton
- [ ] Define shared types in `types/index.ts`

### Phase 2 — Core AI Pipeline
- [ ] Create `lib/ai.ts` — `AIProvider` interface + `WatsonxProvider` implementation
- [ ] Create `lib/prompt.ts` — `buildPrompt()` with hybrid context assembly
- [ ] Create `lib/parser.ts` — `parseAnalysis()` markdown → AnalysisResult
- [ ] Create `app/api/analyse/route.ts` — streaming POST, save on completion
- [ ] Create `app/api/projects/route.ts` — create project POST

### Phase 3 — Project Management UI
- [ ] `app/page.tsx` — project list + empty state
- [ ] `components/ProjectCard.tsx`
- [ ] `app/projects/new/page.tsx` + `components/ProjectForm.tsx`
- [ ] `app/projects/[id]/page.tsx` — dashboard + analysis history
- [ ] `components/AnalysisListItem.tsx`

### Phase 4 — Analysis Flow UI
- [ ] `app/projects/[id]/analyse/page.tsx` — change request form
- [ ] `components/AnalysisForm.tsx`
- [ ] `components/StreamingReport.tsx` — live stream renderer
- [ ] `app/projects/[id]/analysis/[analysisId]/page.tsx` — report view
- [ ] `components/AnalysisReport.tsx` — 7-section accordion
- [ ] Copy Markdown button

### Phase 5 — Demo Readiness & Polish
- [ ] `prisma/seed.ts` — Invoice Management System demo project + pre-run analysis
- [ ] Responsive layout (1280px primary, mobile acceptable)
- [ ] Error handling: 502 from watsonx, empty fields, DB errors
- [ ] Loading states and streaming skeleton
- [ ] `README.md` — setup, env vars, demo script
- [ ] `CLAUDE.md` — updated with final architecture

### Phase 6 — Stretch Goals
- [ ] Re-run / refine analysis with follow-up prompt
- [ ] Export as PDF
- [ ] Section-level accept/reject tagging
- [ ] Dark mode toggle

---

## What Should Be Excluded from the MVP

| Excluded Feature | Reason |
|-----------------|--------|
| Real codebase parsing / AST analysis | Language parsers + file upload pipeline — weeks of work |
| User authentication / multi-tenancy | OAuth complexity with zero demo value |
| GitHub / Jira integration | External auth, webhooks — not needed to prove core value |
| OpenAI fallback implementation | Provider abstraction is enough; don't wire two providers |
| Code generation from the analysis | Scope creep — the analysis IS the product |
| Vector DB / RAG over codebase | Infrastructure overhead not needed for demo |
| Billing / usage limits | Not needed for hackathon |
| Mobile-optimised layout | Web 1280px demo is sufficient |

---

## Final Recommended MVP Scope

**Deliver in 48 hours:**

1. Next.js web app — project creation with hybrid context (freetext + optional structured fields)
2. Change request form — single textarea, one button
3. Live-streamed 7-section impact analysis powered by IBM watsonx.ai
4. Persistent PostgreSQL storage of all projects and analyses
5. Clean report view with 7 accordion sections, copy-to-markdown
6. Pre-seeded demo project (Invoice Management System) with a sample analysis ready

**Demo story:**
> "I described my system in two paragraphs and filled in my module and table names. I typed one sentence. In under 15 seconds I had a structured impact analysis — affected modules, DB migrations, API changes, UI work, risks, tasks, and test cases — that would take a senior developer two hours to produce manually."

**Success criterion:** A judge watches a 90-second live demo, immediately understands the value, and sees a polished real-time analysis appear on screen.

---

## Sub-Tasks for Implementation

### Sub-Task 1 — Project Scaffolding & Database [x] complete

**Intent:** Create the Next.js project, configure all tooling, define the database schema with hybrid context fields, and run the initial migration. The foundation must be solid before any feature code.

**Expected Outcomes:**
- `npm run dev` starts without errors at `localhost:3000`
- Prisma schema defines `Project` (with all hybrid fields) and `Analysis` models
- Migration applied to Neon.tech PostgreSQL
- shadcn/ui and Tailwind render a test component
- Shared TypeScript types defined in `types/index.ts`

**Todo List:**
1. `npx create-next-app@latest devchange-ai` — TypeScript, Tailwind, App Router, src-dir=no
2. Install: `prisma @prisma/client zod` + shadcn/ui — no Vercel AI SDK, no watsonx SDK; all watsonx calls use native `fetch`
3. `npx shadcn@latest init` — configure components.json
4. `npx prisma init` — configure `DATABASE_URL` in `.env.local`
5. Write `prisma/schema.prisma` with `Project` (name, description, modules?, dbTables?, apiEndpoints?, techStack?) and `Analysis` (projectId, changeRequest, result Json, rawMarkdown) models
6. `npx prisma migrate dev --name init`
7. Create `lib/db.ts` Prisma singleton
8. Create `types/index.ts` with `Project`, `Analysis`, `AnalysisResult` types
9. Update `CLAUDE.md` with build/lint/dev commands

**Relevant Context:** `prisma/schema.prisma`, `lib/db.ts`, `types/index.ts` — all to be created.

---

### Sub-Task 2 — AI Pipeline (watsonx + Prompt + Parser) [x] complete

**Intent:** Build the complete intelligence layer: the provider-abstracted AI client targeting IBM watsonx.ai via plain fetch-based SSE, the hybrid prompt builder, the streaming API route, and the section parser. This is the core differentiator.

**Expected Outcomes:**
- `POST /api/analyse` accepts `{ projectId, changeRequest }`, streams raw SSE to the browser, saves `Analysis` to DB on completion, injects `analysisId` in the final SSE chunk
- `lib/ai.ts` exposes `AIProvider` interface + `WatsonxProvider`; swapping provider requires changing one export line; no Vercel AI SDK dependency
- `WatsonxProvider` exchanges `WATSONX_API_KEY` for an IAM Bearer token (cached 50 min), then calls `/ml/v1/text/generation_stream` with native `fetch()`
- `lib/prompt.ts` `buildPrompt()` correctly omits empty optional fields from the assembled prompt
- `lib/parser.ts` `parseAnalysis()` correctly splits markdown into 7 keyed sections with fallback for malformed output
- `.env.local.example` documents all five required env vars with `WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct` as the verified default

**Todo List:**
1. Create `lib/ai.ts`:
   - Define `AIProvider` interface: `stream(prompt: string): Promise<ReadableStream<Uint8Array>>`
   - Implement `WatsonxProvider`: IAM token exchange via POST `https://iam.cloud.ibm.com/identity/token`, in-memory token cache with 50-min TTL, `fetch()` POST to `https://{WATSONX_REGION}.ml.cloud.ibm.com/ml/v1/text/generation_stream?version=2024-05-01` with body `{ model_id, input, project_id, parameters: { max_new_tokens: 2000, temperature: 0.3, repetition_penalty: 1.1 } }`, return `response.body`
   - Export `aiProvider` singleton
2. Create `lib/prompt.ts` — implement `buildPrompt(project: Project, changeRequest: string): string` assembling system role instruction + project name/description + conditionally included structured fields + 7-section output instructions
3. Create `lib/parser.ts` — implement `parseAnalysis(markdown: string): AnalysisResult` using regex split on `## ` headings matching the 7 exact section names; include fallback storing full text in `affectedModules` on parse failure
4. Create `app/api/analyse/route.ts`:
   - Validate input, load project from DB
   - Call `buildPrompt`, then `aiProvider.stream(prompt)`
   - Pipe the `ReadableStream` through a `TransformStream` that accumulates text and, on close, calls `parseAnalysis` + saves `Analysis` to DB + appends a final `data: {"analysisId":"..."}` SSE line
   - Return `new Response(transformedStream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`
5. Create `app/api/projects/route.ts` — validate + create project, return 201
6. Add `.env.local.example` with all five env vars; set `WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct` as the documented default

**Relevant Context:** `lib/ai.ts`, `lib/prompt.ts`, `lib/parser.ts`, `app/api/analyse/route.ts`, `app/api/projects/route.ts` — all to be created.

---

### Sub-Task 3 — Project Management UI [x] complete

**Intent:** Build the project list, create-project form, and project dashboard so users can manage projects and navigate to analysis history. The create form must implement the hybrid context input (required freetext + optional structured fields in an expander).

**Expected Outcomes:**
- Home page (`/`) lists all projects as cards; shows empty state with CTA when none exist
- Create Project form (`/projects/new`) has the two-zone hybrid layout; submits to `POST /api/projects`; redirects to project dashboard on success
- Project dashboard (`/projects/[id]`) shows project details + list of past analyses with change request text, date, and link

**Todo List:**
1. Create `app/page.tsx` — server component, fetch all projects, render `ProjectCard` grid + "New Project" button + empty state
2. Create `components/ProjectCard.tsx` — card with name, description snippet, analysis count, relative date
3. Create `app/projects/new/page.tsx` — page shell + `ProjectForm` client component
4. Create `components/ProjectForm.tsx` — required fields zone + collapsible "Add structured details" expander with 4 optional textareas; client-side submit to `POST /api/projects`; redirect on success
5. Create `app/projects/[id]/page.tsx` — server component; load project + analyses; render project summary + `AnalysisListItem` list + "New Analysis" button
6. Create `components/AnalysisListItem.tsx` — row showing change request (truncated), date, chevron link

**Relevant Context:** `app/page.tsx`, `app/projects/new/`, `app/projects/[id]/page.tsx`, `components/` — to be created.

---

### Sub-Task 4 — Analysis Flow UI [ ] pending

**Intent:** Build the change-request form with live streaming output, and the saved analysis report with 7 accordion sections. This is the centrepiece of the demo.

**Expected Outcomes:**
- New Analysis page (`/projects/[id]/analyse`) accepts a change request, streams analysis live via `StreamingReport`, then auto-redirects to the saved report
- Analysis Report page (`/projects/[id]/analysis/[analysisId]`) shows the full 7-section accordion with section icons, markdown-rendered content, and a Copy Markdown button

**Todo List:**
1. Create `app/projects/[id]/analyse/page.tsx` — page shell with `AnalysisForm`
2. Create `components/AnalysisForm.tsx` — textarea for change request, submit button; on submit: `fetch('/api/analyse', ...)`, read `response.body` as SSE via `ReadableStream` reader, accumulate text into `StreamingReport`; detect final `data: {"analysisId":"..."}` chunk to extract ID and push router to report page
3. Create `components/StreamingReport.tsx` — displays raw accumulated markdown text with animated blinking cursor while streaming
4. Create `app/projects/[id]/analysis/[analysisId]/page.tsx` — server component; load `Analysis` from DB; render `AnalysisReport`
5. Create `components/AnalysisReport.tsx` — shadcn `Accordion` with 7 items; each item has icon + label + parsed markdown content rendered via a markdown renderer (react-markdown or similar); checklist items in Development Tasks and Test Cases rendered as visual checkboxes
6. Add "Copy as Markdown" button using `navigator.clipboard.writeText(rawMarkdown)`

**Relevant Context:** `app/projects/[id]/analyse/`, `app/projects/[id]/analysis/[analysisId]/`, `components/AnalysisReport.tsx` — to be created.

---

### Sub-Task 5 — Demo Seed Data, Polish & Deployment [ ] pending

**Intent:** Make the app fully demo-ready: seed a compelling realistic project, add graceful error handling, confirm the Vercel deployment works, and leave clean documentation.

**Expected Outcomes:**
- `npx prisma db seed` populates the Invoice Management System project with a pre-run GST analysis
- All API errors surface as user-visible messages (no silent failures)
- UI is clean and responsive at 1280px viewport
- App deploys and runs on Vercel with env vars configured
- `README.md` has full setup + demo walkthrough
- `CLAUDE.md` has final architecture summary

**Todo List:**
1. Create `prisma/seed.ts` — seed the Invoice Management System project with all context fields filled; seed one pre-run GST analysis with realistic `result` JSON and `rawMarkdown`
2. Add `"prisma": { "seed": "ts-node prisma/seed.ts" }` to `package.json`
3. Add error state handling to `AnalysisForm` — catch fetch errors, display toast/alert
4. Add 502 error response in `app/api/analyse/route.ts` with user-friendly message
5. Verify responsive layout at 1280px; fix any overflow or spacing issues
6. Configure Vercel project: link repo, add all env vars from `.env.local.example`
7. Run `vercel --prod` and verify the live demo URL works end-to-end
8. Update `README.md` — local setup steps, env vars, Vercel deploy instructions, demo script
9. Update `CLAUDE.md` — final architecture summary, all build/dev/seed commands
