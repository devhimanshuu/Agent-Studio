# Agent Studio — Dynamic User-Defined Skills Agent Platform

> Enterprise-grade AI Agent Platform where users can create, schema-validate, version, publish, and manage reusable AI Skills under strict tool permissions and Human-in-the-Loop (HITL) write approval guardrails.

---

## 🌟 Architecture & Key Technical Decisions

### 1. Clean & Layered Architecture (Dependency Inversion)
Agent Studio is structured following strict Clean Architecture principles:

- **Presentation Layer** (`src/app/`, `src/components/`, `src/stores/`): Next.js 15 App Router, RSC, TailwindCSS, TanStack Query v5, Zustand, React Hook Form + Zod.
- **Application Layer** (`src/services/`): Pure TypeScript application services (`SkillService`, `ExecutionService`, `ApprovalService`, `VersionService`) that orchestrate domain logic using constructor dependency injection.
- **Domain Layer** (`src/types/`, `src/validators/`): Strongly typed domain entities, Zod schema validators, tool schemas, and idempotency rules.
- **Infrastructure Layer** (`src/repositories/`, `src/lib/`, `src/providers/`, `prisma/`): Prisma ORM data access, PostgreSQL models, Pino structured logger, environment config, and the pluggable LLM provider layer.
- **Auth**: Clerk (middleware-protected routes + per-request verification inside API handlers).

> **Why this matters for commercial SaaS**: Decoupling domain logic from Next.js HTTP adapters keeps service code 100% unit-testable and allows the execution engine to be swapped or moved (e.g. a Python/FastAPI backend) without touching UI or domain contracts.

### 2. LLM Provider Abstraction with Automatic Failover
Business logic never talks to a concrete vendor. Every AI call goes through the `LLMProvider` interface:

```
LLMProvider (interface)
   ├── GroqProvider       → one instance per model
   ├── OpenRouterProvider → one instance per model
   └── LLMRouter          → ordered failover across all configured models
```

- **`LLMRouter`** tries each model in order (Groq free models first, then OpenRouter agentic free models). When a model fails for **any** reason — rate limit (429), 5xx, timeout, network error, model decommissioned (404), bad key (401/403) — it is parked in a circuit-breaker cooldown and the **next model is used automatically**.
- Cooldowns adapt to the failure: 429 → 60s, 5xx/network → 30s, 404 → 10min, auth errors → parks the whole vendor for 5min. A successful call clears the model's cooldown.
- `getLLMProvider()` returns a router built only from vendors you have keys for. Tool/function calling is supported end-to-end (`LLMTool` → `tools` + `tool_choice: auto`), ready for the execution engine.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS, TanStack Query v5, Zustand, React Hook Form + Zod, Lucide React
- **Backend**: Next.js Route Handlers (stateless controllers delegating to application services), Clerk authentication
- **Database & ORM**: PostgreSQL, Prisma ORM (`User`, `Skill`, `SkillVersion`, `Execution`, `ExecutionStep`, `ToolCall`, `ApprovalRequest`, `AuditLog`, `ToolDefinition`)
- **AI Providers** (future-ready, no execution yet): Groq + OpenRouter via a shared OpenAI-compatible HTTP client (no SDK dependency), with automatic model failover
- **Logging & Config**: Pino structured JSON logging, Zod environment validation (`src/lib/config/env.ts`)
- **Testing**: Vitest (unit), with the `@/` path alias pointing at `src/`

---

## 📁 Repository Structure

```
├── prisma/
│   └── schema.prisma          # Prisma PostgreSQL schema
├── src/
│   ├── app/                   # App Router pages & API handlers
│   │   ├── dashboard/         # Dashboard (real metrics) + /skills module
│   │   │   └── skills/        # Skill Management module (see below)
│   │   ├── api/
│   │   │   ├── skills/        # Skills REST API (CRUD + publish/archive/duplicate)
│   │   │   ├── approvals/     # Approval stub routes (Phase 4)
│   │   │   ├── executions/    # Execution stub routes (Phase 4)
│   │   │   └── health/        # Liveness probe
│   │   ├── page.tsx           # Public landing page
│   │   ├── not-found.tsx / global-error.tsx
│   │   └── layout.tsx         # Root layout (ClerkProvider, Header, Sidebar, Toaster)
│   ├── components/
│   │   ├── skills/            # SkillForm (RHF+Zod), StatusBadge
│   │   ├── feedback/          # Toaster, ConfirmDialog, EmptyState, LoadingSkeleton, ErrorBoundary
│   │   ├── layout/            # Header, Sidebar (collapsible), ThemeToggle
│   │   └── providers/         # QueryProvider, ThemeProvider
│   ├── lib/
│   │   ├── api/               # Shared route handlers (auth/error responses) + skills API client
│   │   ├── config/env.ts      # Zod-validated environment
│   │   ├── logger/            # Pino instance
│   │   └── prisma.ts          # Prisma client singleton
│   ├── middleware.ts / proxy.ts  # Clerk route protection
│   ├── providers/llm/         # LLMProvider, Groq/OpenRouter providers, LLMRouter, model rosters
│   ├── repositories/          # Prisma repositories (+ interfaces)
│   ├── services/              # Application services (+ interfaces)
│   ├── stores/                # Zustand stores (toast)
│   ├── types/                 # Shared domain types
│   └── validators/            # Zod payload validators
├── tests/unit/                # Vitest unit suites
├── .env.example
└── vitest.config.ts
```

---

## 🚀 Quickstart & Setup

### 1. Environment Configuration
```bash
cp .env.example .env
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | ✅ | Clerk auth (login/dashboard) |
| `GROQ_API_KEY` | ⬜ | Enables the Groq failover models |
| `OPENROUTER_API_KEY` | ⬜ | Enables the OpenRouter failover models |
| `NEXT_PUBLIC_APP_URL` | ⬜ | Used in OpenRouter attribution headers |

> **Build note**: if your `.env` sets `NODE_ENV`, run production builds with `NODE_ENV=production npm run build` — a `development` value in the environment breaks Next's production build.

### 2. Install, Generate Prisma Client & Sync Schema
```bash
npm install          # runs `prisma generate` automatically via postinstall
npx prisma db push   # sync the schema to your database
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). Signed-in users are redirected straight to `/dashboard`; the landing page is for signed-out visitors.

---

## 🧩 Skill Management Module (`/dashboard/skills`)

The complete Skill lifecycle: **create → edit draft → validate → publish → version → archive**.

| Route | Purpose |
|---|---|
| `/dashboard/skills` | Registry: search, filter by status, sort, duplicate / archive / delete, empty & loading states |
| `/dashboard/skills/new` | Create a skill (React Hook Form + Zod) |
| `/dashboard/skills/[id]` | Skill detail: draft preview, publish, versions link, quick actions |
| `/dashboard/skills/[id]/edit` | Edit the current draft — **editing a published skill auto-creates a new draft version** |
| `/dashboard/skills/[id]/versions` | Version history (version number, status, created/published date, notes) |

### Skill Form fields
Name · Purpose · Instructions · Input Schema (JSON) · Output Schema (JSON) · Examples (input/output pairs) · Allowed Tools (≥1 required) · Actions Requiring Approval · Max Execution Steps (> 0) · Notes

### Validation rules (Zod — `src/validators/skillSchema.ts`)
- Name (≥2 chars), Purpose (≥5 chars), Instructions (≥5 chars) required
- `maxExecutionSteps` must be an integer > 0 (≤ 100)
- At least one Allowed Tool
- Input/Output Schema must be valid JSON objects
- Examples must be valid `{ input, output, description? }` structures

### Versioning model
- **Published versions are immutable.** Editing a published skill rotates a new DRAFT version cloned from the latest version (`versionNumber + 1`).
- Publishing is guarded: only DRAFT versions can be published, archived skills cannot be published, and publishing clears the draft pointer so the same version can never be re-published.
- Skills can be `DRAFT` → `PUBLISHED` → `ARCHIVED`. Published skills cannot be deleted (archive instead).

---

## 🔌 REST API

All endpoints require a Clerk session (`Authorization` is handled by Clerk's auth cookies). Responses use a consistent envelope:

```jsonc
// Success
{ "success": true, "data": { /* payload */ } }
// Error
{ "success": false, "error": "message", "code": "VALIDATION_ERROR", "fields": { "allowedTools": ["At least one allowed tool is required"] } }
```

| Method | Endpoint | Description | Errors |
|---|---|---|---|
| `GET` | `/api/skills?search=&status=&sortBy=&sortOrder=` | List own skills (`{ items, total }`) | 401, 400 |
| `POST` | `/api/skills` | Create a skill (first draft v1) | 401, 400 |
| `GET` | `/api/skills/:id` | Get one skill with all versions | 401, 404 |
| `PATCH` | `/api/skills/:id` | Update the current draft (rotates a new draft if published) | 401, 400, 403 |
| `DELETE` | `/api/skills/:id` | Delete a draft skill (published → 400) | 401, 400, 403, 404 |
| `POST` | `/api/skills/:id/publish` | Publish a draft version `{ versionId }` | 401, 400, 403 |
| `POST` | `/api/skills/:id/archive` | Archive a skill | 401, 403 |
| `POST` | `/api/skills/:id/duplicate` | Duplicate as a new DRAFT copy `"(Copy)"` | 401, 403 |

### Example — create a skill
```bash
curl -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sentiment Analyzer",
    "purpose": "Classify customer feedback as positive, neutral, or negative.",
    "instructions": "Read the input text and return a sentiment label with a confidence score.",
    "inputSchema": { "type": "object", "properties": { "text": { "type": "string" } } },
    "outputSchema": { "type": "object", "properties": { "label": { "type": "string" } } },
    "allowedTools": ["calculator"],
    "maxExecutionSteps": 10
  }'
```

### Error codes
`UNAUTHENTICATED` (401) · `FORBIDDEN` (403 — includes 404-safety: don't leak whether a skill exists) · `NOT_FOUND` (404) · `VALIDATION_ERROR` (400 + `fields`) · `BAD_REQUEST` (400) · `INTERNAL_ERROR` (500 — details are logged, never returned)

### Ownership & security
- Every handler resolves `auth()` and scopes all queries to `userId` — users can never read or mutate another user's skills.
- Business logic lives in services/repositories, never in the route handlers.
- Mutations write audit log entries (`SKILL_CREATED`, `SKILL_UPDATED`, `SKILL_PUBLISHED`, `SKILL_ARCHIVED`, `SKILL_DELETED`, `SKILL_DUPLICATED`).

---

## 🧪 Testing

Vitest with `globals: true`, Node environment, and the `@/` alias resolved to `src/` (`vitest.config.ts`).

```bash
npm test            # run once (vitest run)
npm run test:watch  # watch mode
```

**4 suites · 40 tests:**

| Suite | Tests | Coverage |
|---|---|---|
| `tests/unit/validators/skillSchema.test.ts` | 16 | Zod rules: required fields, allowed-tools minimum, max-steps bounds, JSON schema validity, examples structure, unknown-key stripping |
| `tests/unit/services/skillService.test.ts` | 12 | Create / update / publish / archive / delete / duplicate, draft rotation on published skills, unauthorized access, audit logging |
| `tests/unit/providers/llmRouter.test.ts` | 10 | Failover order, cross-vendor switching, cooldown circuit-breaking + recovery, auth parking, `onSwitch` events, all-fail & all-cooldown paths |
| `tests/unit/config/env.test.ts` | 2 | Env defaults |

---

## 📊 Completed Scope

**Phase 1 — Foundation**
- [x] Clean Architecture folder structure with dependency inversion (service/repository interfaces)
- [x] Next.js 15 App Router + TypeScript + TailwindCSS
- [x] Prisma PostgreSQL models + Pino logger + Zod env validation
- [x] Dashboard shell, sidebar, header, feedback components, dark theme
- [x] Clerk authentication + route protection

**Phase 2 — Platform UX**
- [x] Signed-in users auto-redirected to `/dashboard`; header/sidebar polish (collapsible sidebar, circular user avatar)
- [x] Landing page with terminal/pixel design language and scroll-reveal animations
- [x] Production build fixes (custom `not-found`/`global-error` pages)

**Phase 3 — Skill Management**
- [x] Full Skill CRUD + search / status filter / sort / duplicate / archive / delete
- [x] Draft → Published → Archived workflow with **immutable published versions** and automatic draft rotation
- [x] Version history page
- [x] REST API with Clerk auth, Zod validation, typed responses, audit logging
- [x] Professional SaaS UI: toasts, confirm dialogs, status badges, empty/loading states, responsive layout
- [x] **LLM provider abstraction + automatic model failover** (all Groq free models + curated OpenRouter free models)
- [x] Live dashboard metrics (real counts from the DB)

---

## 🔒 Intentionally Excluded (next phases)

- Live AI execution loop / agent runtime (LangGraph-style graph execution) — the `LLMProvider` + `LLMRouter` layer is ready for it
- Real tool execution (`calculator`, `docSearch`, `recordLookup`, `taskCreator`)
- Approval workflow (HITL) — schema, services, and stub routes exist
- Production deployment to Neon & Vercel (ready via standard Prisma + Vercel integration)
