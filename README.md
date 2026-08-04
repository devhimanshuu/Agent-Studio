# Agent Studio — Dynamic User-Defined Skills Agent Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://agent-studio-v1.vercel.app/)
[![Database](https://img.shields.io/badge/Database-Neon_Postgres-02E693?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-184_Passing-brightgreen?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)

> 🔗 **Live Application**: [https://agent-studio-v1.vercel.app](https://agent-studio-v1.vercel.app)  
> 💻 **GitHub Repository**: [https://github.com/devhimanshuu/Agent-Studio](https://github.com/devhimanshuu/Agent-Studio)  

---

> Enterprise-grade AI Agent Platform where users can create, schema-validate, version, publish, and execute reusable AI Skills — under strict tool permissions and Human-in-the-Loop (HITL) write-approval guardrails, with full observability.

---

## ✨ What is Agent Studio?

Agent Studio is a production-grade **AI Agent Platform** (think LangGraph Studio / OpenAI Agents SDK / LangSmith) built with Next.js 15. Users define **Skills** (schema-validated AI capabilities), version them like software, and execute them on a **graph-first LangGraph runtime** where the LLM is just one node — every tool call is permission-checked, every write action requires explicit human approval, and every run is fully traced.

**The complete lifecycle is covered end-to-end:**

```
Create Skill → Draft → Validate → Publish (immutable) → Execute (graph runtime)
     ↑                                              ↓
  Edit (auto new draft)                    Human Review (HITL pause)
     ↑                                              ↓
  Version / Compare / Replay           Execution History / Audit / Metrics
```

---

## 🏗️ Architecture

### Clean & Layered Architecture (Dependency Inversion)

- **Presentation Layer** (`src/app/`, `src/components/`, `src/stores/`): Next.js 15 App Router, RSC, TailwindCSS, TanStack Query v5, Zustand, React Hook Form + Zod.
- **Application Layer** (`src/services/`): Pure TypeScript application services (`SkillService`, `ExecutionService`, `ApprovalService`, `VersionService`) with constructor dependency injection.
- **Domain Layer** (`src/types/`, `src/validators/`): Strongly typed entities, Zod validators, tool schemas, idempotency rules.
- **Infrastructure Layer** (`src/repositories/`, `src/lib/`, `src/providers/`, `prisma/`): Prisma data access, Pino structured logging, Zod-validated env, and the pluggable LLM provider layer.
- **Auth**: Clerk (middleware-protected routes + per-request verification inside API handlers).

> **Why this matters for a commercial SaaS**: services are 100% unit-testable without HTTP; the execution engine can be swapped or moved without touching UI or domain contracts.

### Graph-First Agent Runtime

The LLM is a **dependency of one node**, not the center of the system. Skills execute through a deterministic LangGraph:

```
planner → permission → tool_selection ⇄ tool_execution → approval? → finish
```

Each node is independent (`src/modules/execution/graph/`), writes to a strongly typed agent state, and is persisted step-by-step for replay and audit.

### LLM Provider Abstraction with Automatic Failover

Business logic never talks to a concrete vendor — every AI call goes through the `LLMProvider` interface:

```
LLMProvider (interface)
   ├── GroqProvider       → one instance per model
   ├── OpenRouterProvider → one instance per model
   └── LLMRouter          → ordered failover across all configured models
```

- **`LLMRouter`** tries each model in order (all Groq free models, then curated OpenRouter agentic free models). When a model fails for **any** reason — rate limit (429), 5xx, timeout, network error, model decommissioned (404), bad key (401/403) — it is parked in a circuit-breaker cooldown and the **next model is used automatically**.
- Adaptive cooldowns: 429 → 60s, 5xx/network → 30s, 404 → 10min, auth errors → parks the whole vendor for 5min. A successful call clears the cooldown.
- `getLLMProvider()` builds a router only from vendors you have keys for.

### Tool Registry

Every tool implements one interface (`id`, `name`, `description`, `category`, `inputSchema`, `outputSchema`, `requiresApproval`, `execute()`, `validate()`, `healthCheck()`) and self-registers. The runtime executes tools **only** through the registry — the Agent Runtime never knows implementation details.

| Tool | Category | Type | Requires Approval |
|---|---|---|---|
| `calculator` | COMPUTE | READ | — |
| `document_search` | SEARCH | READ | — |
| `record_lookup` | DATA | READ | — |
| `mock_task_creator` | TASK | WRITE | ✅ |

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS, TanStack Query v5, Zustand, React Hook Form + Zod, Lucide React
- **Backend**: Next.js Route Handlers (stateless controllers delegating to services), Clerk authentication
- **Database & ORM**: PostgreSQL, Prisma ORM
- **AI**: LangGraph JS execution engine; Groq + OpenRouter LLM providers with automatic failover
- **Logging & Config**: Pino structured JSON logging, Zod environment validation
- **Testing**: Vitest (unit, 184 tests), Playwright (E2E smoke)

---

## 📁 Repository Structure

```
├── prisma/
│   ├── schema.prisma          # PostgreSQL schema
│   └── seed.ts                # Demo data (npm run db:seed)
├── e2e/                       # Playwright smoke tests
├── src/
│   ├── app/
│   │   ├── api/               # REST handlers (skills, executions, approvals, audit, tools, settings)
│   │   ├── dashboard/         # Dashboard + skills / executions / history / audit / compare / review / tools / settings
│   │   ├── page.tsx           # Public landing page
│   │   ├── not-found.tsx / global-error.tsx
│   │   └── layout.tsx         # Root layout (Clerk, Header, Sidebar, Toaster, skip-link)
│   ├── components/
│   │   ├── skills/            # SkillForm (RHF+Zod), StatusBadge
│   │   ├── executions/        # Timeline, status badges
│   │   ├── feedback/          # Toaster, ConfirmDialog, EmptyState, Skeleton library, ErrorBoundary
│   │   ├── layout/            # Header, collapsible Sidebar
│   │   └── providers/         # QueryProvider, ThemeProvider
│   ├── modules/               # Domain modules (clean architecture)
│   │   ├── execution/         # Graph nodes, planner, executor, state
│   │   ├── approval/          # Approval engine, policy, history
│   │   ├── history/           # Execution history service
│   │   ├── tools/             # Tool registry + calculator / document-search / record-lookup / mock-task
│   │   └── ...
│   ├── lib/                   # api helpers, rate limiter, config, logger, prisma
│   ├── providers/llm/         # LLMProvider, Groq/OpenRouter, LLMRouter, model rosters
│   ├── repositories/          # Prisma repositories (+ interfaces)
│   ├── services/              # Application services (+ interfaces)
│   ├── stores/                # Zustand stores (toast)
│   ├── types/                 # Shared domain types
│   └── validators/            # Zod payload validators
├── tests/unit/                # Vitest unit suites
└── .env.example
```

---

## 🚀 Quickstart & Setup

### 1. Environment Configuration

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | ✅ | Clerk auth |
| `GROQ_API_KEY` | ⬜ | Enables Groq failover models |
| `OPENROUTER_API_KEY` | ⬜ | Enables OpenRouter failover models |
| `NEXT_PUBLIC_APP_URL` | ⬜ | App origin (OpenRouter attribution) |

### 2. Install, Generate Prisma Client & Sync Schema

```bash
npm install          # runs `prisma generate` automatically via postinstall
npx prisma db push   # sync the schema to your database
```

### 3. Optional — Seed demo data

```bash
# To see the demo workspace under YOUR logged-in Clerk id:
SEED_USER_ID=<your-clerk-user-id> npm run db:seed
```

Creates 1 demo user, 4 tool definitions, 4 skills with versions, 4 executions (completed / failed / paused-for-review / replayed), a pending approval request, and 14 audit entries. Idempotent — safe to re-run.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Signed-in users are redirected straight to `/dashboard`.

---

## 🧩 Modules & Pages

### Skill Management (`/dashboard/skills`)

The complete Skill lifecycle: **create → edit draft → validate → publish → version → archive → duplicate**.

| Route | Purpose |
|---|---|
| `/dashboard/skills` | Registry: search, filter by status, sort, duplicate / archive / delete, empty & loading states |
| `/dashboard/skills/new` | Create a skill (React Hook Form + Zod) |
| `/dashboard/skills/[id]` | Skill detail: draft preview, publish, versions link, quick actions |
| `/dashboard/skills/[id]/edit` | Edit the current draft — **editing a published skill auto-creates a new draft version** |
| `/dashboard/skills/[id]/versions` | Version history (version number, status, dates, notes) |

**Validation (Zod):** Name/Purpose/Instructions required · `maxExecutionSteps` integer > 0 · ≥1 Allowed Tool · valid JSON input/output schemas · structured examples.

**Versioning:** published versions are immutable; publishing is guarded (DRAFT-only, archive blocks publish, draft pointer cleared on publish); `DRAFT → PUBLISHED → ARCHIVED`.

### Execution & Observability

| Route | Purpose |
|---|---|
| `/dashboard/executions` | Execution history: search, filter, sort, replay |
| `/dashboard/executions/[id]` | Full trace: timeline, planner output, tool calls, logs, approvals |
| `/dashboard/history` | Observability: metrics, success/failure rates, most-used skills |
| `/dashboard/audit` | Audit log with search + JSON export |
| `/dashboard/compare` | Side-by-side version diff (instructions, schemas, tools, steps) |

### Human Review (`/dashboard/review`)

Write actions pause execution at `PAUSED_FOR_APPROVAL` and surface a review card (requested action, skill, tool, arguments, planner reason). Approve / reject / cancel with **single-use idempotency keys** — a key can never respond twice, and rejected/cancelled requests terminate the run.

### Tool Registry (`/dashboard/tools`)

Browse all registered tools by category with health, approval requirements, and usage counts.

### Settings (`/dashboard/settings`)

Appearance (dark/light), Clerk profile, and **AI provider status** — booleans + model rosters only; API keys never leave the server.

---

## 🔌 REST API

All endpoints require a Clerk session. Responses use a consistent envelope:

```jsonc
// Success
{ "success": true, "data": { /* payload */ } }
// Error
{ "success": false, "error": "message", "code": "VALIDATION_ERROR", "fields": { "allowedTools": ["At least one allowed tool is required"] } }
```

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/skills` | List (search/filter/sort) / create skill |
| `GET/PATCH/DELETE` | `/api/skills/:id` | Get / update draft (auto-rotates on published) / delete draft |
| `POST` | `/api/skills/:id/publish` · `/archive` · `/duplicate` | Lifecycle actions |
| `GET/POST` | `/api/executions` | List with filters / start execution |
| `POST` | `/api/executions/:id/cancel` · `/replay` · `/resume` | Execution control |
| `GET` | `/api/executions/:id/detail` · `/export` · `/api/executions/metrics` | Trace, JSON export, observability |
| `GET/POST` | `/api/approvals` | Review queue / respond (approve·reject·cancel) |
| `GET` | `/api/audit` · `/api/tools` · `/api/settings/providers` | Audit log, tool registry, provider status |

**Error codes:** `UNAUTHENTICATED` (401) · `FORBIDDEN` (403, never leaks resource existence) · `NOT_FOUND` (404) · `VALIDATION_ERROR` (400 + `fields`) · `BAD_REQUEST` (400) · `RATE_LIMITED` (429 + `Retry-After`) · `INTERNAL_ERROR` (500, details logged, never returned).

**Security:** every handler resolves `auth()` and scopes all queries to `userId`; business logic lives in services/repositories, never in route handlers; execution start/replay/resume + approval responses are rate-limited; mutations write audit entries.

See [`docs/API.md`](docs/API.md) for full request/response schemas.

---

## 🧪 Testing

```bash
npm test            # Vitest unit tests (184 tests)
npm run test:e2e    # Playwright smoke tests
npm run lint        # ESLint (flat config)
npm run typecheck   # tsc --noEmit
```

**Unit suites cover:** skill CRUD + validation + versioning, execution engine + planner, LLM failover router, tool registry (calculator, document search, record lookup, task creator), permission validation, approval flow (pause/resume/reject/cancel, duplicate prevention, retry, step limit), execution history + replay + observability, audit logging, version comparison.

---

## 🚀 Deployment (Vercel + Neon)

1. **Database**: create a [Neon](https://neon.tech) Postgres project; copy the connection string into `DATABASE_URL`.
2. **Auth**: create a Clerk app; copy publishable + secret keys.
3. **LLM**: optional `GROQ_API_KEY` / `OPENROUTER_API_KEY`.
4. **Vercel**: import the repo → add the env vars → deploy. `prisma generate` runs via `postinstall`; run `npx prisma db push` (or migrations) against the Neon DB.

---

## 📊 Completed Scope

- ✅ Skill CRUD, search/filter/sort, duplicate/archive/delete, immutable versioning + draft rotation, version compare
- ✅ Graph-first LangGraph runtime: planner, permission, tool selection, tool execution, approval, finish nodes
- ✅ Typed agent state, structured logs, database persistence (steps, tool calls, logs, planner output, provider, duration)
- ✅ LLM provider abstraction + automatic failover across all Groq free + curated OpenRouter free models
- ✅ Tool Registry: calculator, document search, record lookup, mock task creator (self-registering, permission-gated)
- ✅ Human Approval Engine: pause/resume, approve/reject/cancel, single-use idempotency, retry, cancellation, step limits
- ✅ Execution history, detail traces, visual timeline, audit logs, JSON export, observability metrics, replay
- ✅ Whole-UI skeleton loading system (15 dashboard routes), landing page with pixel/grid animations
- ✅ Settings page (theme, profile, provider status), dashboard metrics (6 cards + recent activity)
- ✅ Seed script, Husky + lint-staged, `.env.example`, README
- ✅ Security: rate limiting, security headers, ownership-scoped APIs, Zod-first validation, audit trail
- ✅ Accessibility: skip-link, focus-visible, reduced-motion, semantic landmarks, ARIA labels

---

## 🔮 Roadmap

- Real (non-mock) write tools and third-party integrations
- Multi-agent orchestration and team workspaces
- Marketplace for sharing published skills
- Billing / usage analytics
- Notifications (email / Slack) for review queue events
