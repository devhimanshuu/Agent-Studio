# AGENT_USAGE.md — Agent Work Log & Verification

This document records how AI coding agents were used to build Agent Studio, what was generated vs. manually reviewed, and how everything was verified.

## Tools & Coding Agents Used

- **Agent System**: Freebuff (Buffy) — AI coding assistant running on DeepSeek models
- **IDE / Environment**: Agent Studio Workspace (Next.js 15 + TypeScript monorepo)

---

## Development Phases & Delegated Work

### Phase 1 — Foundation
- **Prompts**: "Design a production-ready AI Agent Platform following Clean Architecture, Next.js 15, TypeScript, Prisma PostgreSQL, Pino logging, and SOLID principles."
- **Delivered**: Layered `src/` architecture with `@/` aliases, Prisma schema (User, Skill, SkillVersion, Execution, ExecutionStep, ToolCall, ApprovalRequest, AuditLog, ToolDefinition), Zod-validated env, Pino logger, Clerk auth, dashboard shell.

### Phase 2 — Platform UX
- **Delivered**: Landing page with terminal/pixel design language, collapsible sidebar, circular user avatar, custom 404/error pages, scroll-reveal animations.

### Phase 3 — Skill Management Module
- **Prompts**: "Build the complete Skill Management module — CRUD, validation, versioning, search, REST API, professional SaaS UI."
- **Delivered**: Full skill lifecycle (create/edit/validate/publish/archive/duplicate), immutable published versions with auto draft-rotation, version history, search/filter/sort, Zod-first validation, audit logging, LLM provider abstraction with auto-failover (all Groq free models + curated OpenRouter free models).

### Phase 4 — Agent Runtime (Graph-First)
- **Prompts**: "Instead of making the runtime LLM-first, make it graph-first. The LLM is just one node in the graph."
- **Delivered**: LangGraph execution engine with independent nodes (planner, permission, tool selection, tool execution, approval, finish), strongly typed agent state, planner that emits schema-validated plans, LLM provider abstraction (GroqProvider/OpenRouterProvider/LLMRouter), execution persistence (steps, logs, tool calls, planner output, provider, duration), execution trace UI.

### Phase 5 — Tool Registry & Tool Execution Framework
- **Prompts**: "Build a scalable Tool Registry that allows any future tool to be plugged in with minimal code changes."
- **Delivered**: Self-registering tool interface (id/name/description/category/inputSchema/outputSchema/requiresApproval/execute/validate/healthCheck), registry (registerTool/getTool/getAvailableTools/validateTool/executeTool), four tools (calculator, document_search, record_lookup, mock_task_creator), permission validation, tool call persistence, tool dashboard with categories, health, usage counts.

### Phase 6 — Human Approval Engine
- **Prompts**: "Build a reusable Approval Framework that integrates with the Agent Runtime and controls all write actions safely."
- **Delivered**: Pause/resume engine, approve/reject/cancel, single-use idempotency keys (atomic — a key can never respond twice), retry support, cancellation persistence, step-limit enforcement, approval history, review queue UI with review cards (requested action, skill, tool, arguments, planner reason).

### Phase 7 — Observability, History, Audit, Comparison, Replay
- **Prompts**: "Implement complete execution history, observability, audit logs, version comparison, and replay."
- **Delivered**: Execution history with search/filter/sort, full trace detail pages, visual node timeline, audit log with JSON export, version comparison (highlighted additions/removals across instructions/schemas/tools/steps), replay (creates a new linked execution, never mutates history), observability widgets (total, success/failure rate, avg duration, most-used skills/tools).

### Phase 8 — Production Readiness (V1.0)
- **Prompts**: "Prepare Agent Studio for production deployment — code quality, performance, accessibility, error/loading states, seed data, documentation, CI, security."
- **Delivered**: ESLint 9 flat config + TypeScript strict checking, Husky + lint-staged, Playwright smoke tests, seed script (`npm run db:seed`), Settings page, dashboard metrics upgrade, security headers + rate limiting, `.env.example`, complete README, whole-UI skeleton loading system (15 dashboard routes), skip-link + focus-visible + reduced-motion accessibility pass.

---

## Where AI Generated Code vs. Manual Review

| Area | AI-Generated | Manually Reviewed / Rewritten |
|---|---|---|
| Folder structure, configs, Prisma schema | ✅ Generated | ✅ Reviewed for correctness |
| Service/Repository interfaces (DI) | ✅ Generated | ✅ Reviewed for type safety |
| Skill CRUD + versioning logic | ✅ Generated | ✅ Edge cases (draft rotation, publish guards) manually hardened |
| LangGraph nodes + agent state | ✅ Generated | ✅ Execution flow manually traced |
| LLM Router failover/cooldowns | ✅ Generated | ✅ Cooldown values tuned for real API behavior |
| Tool Registry + 4 tools | ✅ Generated | ✅ Input validation + permission paths reviewed |
| Approval Engine + idempotency | ✅ Generated | ✅ Atomic duplicate-prevention verified with tests |
| Observability/history/compare/replay | ✅ Generated | ✅ Replay immutability manually verified |
| UI components & landing page | ✅ Generated | ✅ Design-language consistency reviewed |
| Tests (184 unit + e2e) | ✅ Generated | ✅ All verified passing |

## Rejected AI Suggestions

- **Prettier as a project dependency** — requested by the user to be removed completely; formatting is enforced by ESLint alone.
- **Direct vendor SDK calls** in business logic — rejected; all LLM access goes through the `LLMProvider` interface.
- **Business logic inside route handlers** — rejected; routes are stateless controllers delegating to services.
- **LLM-first runtime design** — rejected in favor of graph-first (LLM is one node, not the system).
- **Executing unapproved write tools** — rejected; all writes pause at the approval node.

## Verification Process

- **Typecheck**: `npm run typecheck` (tsc --noEmit) — 0 errors
- **Lint**: `npm run lint` (ESLint flat config) — 0 errors
- **Unit tests**: `npm test` (Vitest) — 184/184 passing
- **E2E**: `npm run test:e2e` (Playwright smoke: landing, health, 404)
- **Build**: `NODE_ENV=production npm run build` — 24/24 pages compiled
- **Manual checks**: browser testing of landing page animations, dashboard flows, sidebar behavior, loading skeletons, review queue interactions

## Known Limitations

- Tool executions are mock/sandboxed (no real external side effects yet).
- Rate limiter is in-memory (single-instance; swap for Redis/Upstash when scaling horizontally).
- LLM model rosters rotate on free tiers — the router's 404 cooldown handles decommissioned models gracefully.

---

## 🧠 Key Engineering Trade-offs & Candidate Reflections

1. **Graph-First vs. Unconstrained LLM Loop**:
   - *Decision*: I chose a LangGraph graph-first execution model where the LLM is restricted to the `PlannerNode`.
   - *Rationale*: Unconstrained autonomous agent loops can run into infinite tool-call cycles and unpredictable API costs. A graph enforces deterministic node transitions (`planner → permission → tool_selection ⇄ tool_execution → approval? → finish`).

2. **Atomic Idempotency for HITL Approvals**:
   - *Decision*: Single-use idempotency tokens (`appr-<executionId>-step-<stepNumber>`) enforced via atomic database Compare-And-Swap (CAS) transitions.
   - *Rationale*: Guarantees that write operations (like `mock_task_creator`) can never be double-executed, even under concurrent HTTP retries or accidental double-clicks.

3. **Multi-Vendor Failover Router**:
   - *Decision*: Built `LLMRouter` with adaptive circuit-breaker cooldowns across 12 models.
   - *Rationale*: External AI APIs fail (429 rate limits, 5xx server drops). Failover ensures zero downtime for end-users.

4. **Immutable Version Control & Draft Rotation**:
   - *Decision*: Published skill versions are immutable (`v1`, `v2`). Editing a published skill auto-rotates a fresh draft.
   - *Rationale*: Protects active production agent executions from breaking when a user edits prompt instructions or tool permissions.

