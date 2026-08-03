# Contributing to Agent Studio

Thanks for contributing! This project is a production-grade AI Agent Platform that will evolve into a commercial SaaS product. The conventions below exist to keep the codebase **testable, secure, and swappable** — please follow them on every change.

---

## 🚀 Getting Started

```bash
# 1. Install dependencies (runs `prisma generate` automatically via postinstall)
npm install

# 2. Configure environment
cp .env.example .env   # DATABASE_URL + Clerk keys are required; GROQ/OPENROUTER keys optional

# 3. Sync the schema
npx prisma db push

# 4. Run the dev server
npm run dev
```

**Validation commands (run all three before opening a PR):**

```bash
npx tsc --noEmit        # typecheck — must be 0 errors
npm test                # vitest unit suites — must be all green
NODE_ENV=production npm run build   # production build must compile
```

> If your `.env` sets `NODE_ENV`, always build with `NODE_ENV=production` — a `development` value in the environment breaks Next's production build.

---

## 🧱 Project Structure (Layered Architecture)

New code goes in the layer it belongs to. **Never** put domain logic in a layer that doesn't own it.

```
src/
├── app/                  # PRESENTATION — Next.js App Router pages + API handlers (thin)
│   ├── dashboard/        #   Dashboard, skills module, executions module UI
│   └── api/              #   REST route handlers — stateless HTTP adapters only
├── components/           # PRESENTATION — React components (UI + layout + feedback)
├── stores/               # PRESENTATION — Zustand stores (e.g. toast)
├── services/             # APPLICATION — domain orchestration, constructor DI
│   └── interfaces/       #   ISkillService, IExecutionService, IApprovalService, IVersionService
├── repositories/         # INFRASTRUCTURE — Prisma data access
│   └── interfaces/       #   ISkillRepository, IExecutionRepository, IAuditLogRepository…
├── validators/           # DOMAIN — Zod schemas (validation lives here, not in routes/services)
├── types/                # DOMAIN — shared TypeScript entities (skill, execution, approval…)
├── modules/execution/    # DOMAIN — the graph-first agent runtime
│   ├── state/            #   typed AgentState + LangGraph annotation
│   ├── graph/            #   LangGraph nodes + graph wiring
│   ├── planner/          #   PlannerService + plan schema + node
│   ├── executor/         #   ExecutionEngine, retry, timeout, cancellation, validation
│   ├── llm/              #   provider selector (config-driven, testable)
│   └── tool-registry/    #   ToolRegistry + PermissionChecker (no tools yet)
├── providers/llm/        # INFRASTRUCTURE — LLMProvider interface + Groq/OpenRouter + LLMRouter
├── lib/                  # INFRASTRUCTURE — api handlers, logger, env config, prisma singleton
└── middleware.ts         # Clerk route protection (keep this filename — Clerk 6.x does not detect Next 15.5's proxy.ts rename)
tests/unit/               # Vitest suites — mirror the src layout (validators/, services/, modules/, providers/)
prisma/schema.prisma      # INFRASTRUCTURE — the single source of truth for the DB
```

**Data flow rule:** `Route Handler → Service (validates + orchestrates) → Repository → Prisma`. Handlers parse HTTP + auth and call one service method; services contain the business logic; repositories are the only code that touches Prisma.

---

## 📐 Coding Conventions

### 1. Clean Architecture & Dependency Inversion

- **Application services depend on interfaces, not concrete classes.** Each service declares its dependencies in a constructor typed with repository/service interfaces (`IExecutionRepository`, `ISkillRepository`…).
- **Every service and repository exposes an interface** in `src/services/interfaces/` / `src/repositories/interfaces/` — even if there's only one implementation today. This is what makes the execution engine and DB swappable later.
- **Wire dependencies at the composition root** — route handlers instantiate repos and services at module top and call them; services must not `new` their own dependencies (tests inject fakes instead):

```ts
// ✅ Good — route handler as composition root
const skillRepo = new SkillRepository();
const auditRepo = new AuditLogRepository();
const skillService = new SkillService(skillRepo, auditRepo);
```

- **No business logic inside route handlers.** A handler should be: auth → parse → validate → call one service method → respond. If a handler grows `if` chains about domain rules, the logic belongs in a service.

### 2. Validators-First (Zod at the edge)

- **All external input is validated with Zod** in `src/validators/` — the schema is the contract. Field rules (min lengths, enums, JSON-object checks) live in the schema, never scattered through services.
- Use `.parse()` for payloads you want to throw on (the route maps Zod issues to a 400 `VALIDATION_ERROR`), and `.safeParse()` for query strings where a user-supplied `?status=` should never 500:

```ts
const validated = createSkillSchema.parse({ ...body, userId });   // throws ZodError
const parsed = skillListQuerySchema.safeParse({ status, search }); // returns result
```

- **Pass validated, typed data into services** — services should not re-validate what the validator already guaranteed.

### 3. Error Handling

- Reuse the shared handlers in `src/lib/api/handlers.ts`: `unauthorized()`, `forbidden()`, `notFound()`, `badRequest()`, `serverError()`.
- **Response envelope** (every endpoint): `{ success: true, data }` or `{ success: false, error, code, fields? }`.
- **Error code mapping:**
  - Zod issues → `badRequest(error)` → `400 VALIDATION_ERROR` (with `fields`)
  - Domain errors (e.g. `ExecutionError` from `src/modules/execution/executor/errors.ts`) → `400`
  - "Resource doesn't exist **or isn't yours**" → `403 FORBIDDEN` first, then `404` — never leak which IDs exist
  - Anything else → `serverError(error)` → `500 INTERNAL_ERROR`. **Never return `error.message` in a 500** — log the real error server-side, return a generic message.
- **Ownership is non-negotiable:** resolve `auth()` in every handler and scope every repository query to `userId` (`findByIdForUser`, `cancelExecutionForUser`…). Users can never read or mutate another user's rows.

### 4. Logging

- Use the shared Pino logger (`import { logger } from "@/lib/logger"`) — **no `console.log`.**
- Structured logging: `logger.info({ contextFields }, "Message")`. Put the context object first, keep messages short and sentence-case.

```ts
logger.info({ skillId, userId, versionId }, "Publishing skill version");
logger.error({ err: error, executionId }, "Execution failed");
```

- **Log mutations.** Skills and executions write both a structured log line *and* an audit row via `auditRepo.log({ userId, executionId, action, details })`. Actions are `UPPER_SNAKE_CASE` (`SKILL_CREATED`, `SKILL_PUBLISHED`, `EXECUTION_STARTED`…).

### 5. LLM Provider Abstraction

- **Business logic never calls Groq, OpenRouter, or any vendor directly.** Every AI call goes through the `LLMProvider` interface (`generate`, `stream`, `structuredOutput`, `complete`).
- New vendors = a new provider class + a model roster entry in `src/providers/llm/modelLists.ts` + nothing else. The `LLMRouter` handles failover (cooldowns: 429 → 60s, 5xx/network → 30s, 404 → 10min, auth → 5min vendor park).
- The execution runtime selects providers via `src/modules/execution/llm/providerSelector.ts` (config-driven, unit-testable). Prefer `getLLMProvider()`/the selector over constructing providers ad hoc.

### 6. The Agent Runtime Is Graph-First

- The execution runtime (`src/modules/execution/`) is built around a **LangGraph `StateGraph`** — the LLM is one node's dependency, not the center of the system.
- **Nodes are independent and pure:** they read/write the typed `AgentState` (via reducers for `toolCalls`/`errors`/`results`) and receive their dependencies through LangGraph's `config.configurable.runtime`. Do not import services/repos directly into node files.
- New capabilities = new node + edge in `buildExecutionGraph.ts`, new field on `AgentState` — no changes to the engine or services.

### 7. Database (Prisma)

- `prisma/schema.prisma` is the single source of truth. After editing it, run `npx prisma generate` (and `npx prisma db push` locally to sync).
- **Multi-step writes must be atomic** — wrap dependent queries in `prisma.$transaction` (e.g. skill creation + draft pointer, publish + clearing the draft pointer). Non-atomic write bugs are a recurring review finding.
- Never expose raw Prisma types through the service layer — map to DTOs in `src/types/`.

### 8. Environment Configuration

- New env vars are added to **both** `.env.example` and `src/lib/config/env.ts` (Zod-validated). Access via `env` from `@/lib/config/env` — never `process.env` directly in business code.

### 9. Frontend Conventions

- **Server components by default**; use `"use client"` only where interactivity is required. Data fetching in RSC uses `auth()` + repositories directly.
- **Forms:** React Hook Form + `zodResolver` + schemas from `src/validators/`. Client-side JSON editors must validate JSON before submitting (invalid editors block submission).
- **Server state:** TanStack Query for mutations/list refetching; **client state:** Zustand (toasts). No prop-drilling for global state.
- **Styling:** TailwindCSS + the existing design language (dark theme, terminal/pixel accents, status badges). Reuse `src/components/feedback/` (`EmptyState`, `LoadingSkeleton`, `ConfirmDialog`, `ErrorBoundary`) — don't rebuild them.
- Every data-heavy page has loading/empty/error states.

### 10. TypeScript & Code Style

- Strict mode. **No `any`** — type the edge (`unknown` + narrowing, generics, or an explicit cast with a comment). Implicit-`any` errors fail CI.
- `@/` alias for all imports from `src/` (`@/services/…`, `@/validators/…`). Prefer relative imports only inside a file's own folder.
- Async/await, no `.then()` chains; `Promise.all` for independent parallel calls.
- Match surrounding formatting — 2-space indent, double quotes, semicolons (Prettier defaults).

### 11. Testing

- **Vitest**, suites under `tests/unit/` mirroring `src/` layout (`tests/unit/validators/`, `tests/unit/services/`, `tests/unit/modules/`, `tests/unit/providers/`).
- **Every service/domain unit gets a test.** Required coverage patterns: validation rules, publish/archive/duplicate flows, unauthorized access, failover/retry logic, graph state reducers.
- Tests inject **fakes** (see `tests/unit/modules/helpers/stubLLM.ts`, `fakeExecutionRepo.ts`) through constructor DI — never mock Prisma in unit tests.

---

## 🔀 Git Workflow

- Branch per feature: `feat/<module>-<description>` or `fix/<description>`.
- Keep PRs focused — one logical change per PR. Small, reviewable diffs land faster.
- Commit messages: conventional style, imperative mood (`feat: add skill version history`, `fix: clear draft pointer on publish`).

---

## ✅ PR Checklist

Before opening a PR, verify every item:

- [ ] **Typecheck**: `npx tsc --noEmit` exits with 0 errors
- [ ] **Tests**: `npm test` is fully green, and new logic has new tests (services, validators, modules)
- [ ] **Build**: `NODE_ENV=production npm run build` compiles
- [ ] **Architecture**: business logic lives in services/modules — route handlers are thin (auth → validate → call → respond)
- [ ] **DI**: services depend on interfaces, wired via constructors at the composition root; no `new`-ing dependencies inside services
- [ ] **Validators-first**: all external input validated with Zod schemas from `src/validators/` before entering services
- [ ] **Errors**: shared handlers used; no internal error messages leaked in 500s; domain errors → 400; ownership scoping (`forbidden` before `notFound`)
- [ ] **Auth & ownership**: handler resolves `auth()`; every query/repo call is scoped to `userId`
- [ ] **Logging**: structured `logger` calls (no `console.log`); mutations write audit entries with `UPPER_SNAKE_CASE` actions
- [ ] **Atomicity**: multi-step DB writes use `prisma.$transaction`
- [ ] **LLM**: no direct vendor calls — everything through `LLMProvider`/router
- [ ] **Env**: new vars added to `.env.example` and `src/lib/config/env.ts`
- [ ] **No `any`**: strict typing maintained; no unused imports/variables/dead code
- [ ] **Reuse**: existing feedback/layout components used rather than reimplemented
- [ ] **Self-review**: re-read your diff — comments explain *why*, not *what*

---
