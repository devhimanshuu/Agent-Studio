# Agent Studio — Visual Agent Canvas & Multi-Agent Orchestration Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://agent-studio-v1.vercel.app/)
[![Database](https://img.shields.io/badge/Database-Neon_Postgres-02E693?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-Vitest_Passing-brightgreen?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)
[![React Flow](https://img.shields.io/badge/Canvas-XYFlow_React-FF0072?style=for-the-badge&logo=react&logoColor=white)](https://reactflow.dev)

> 🔗 **Live Application**: [https://agent-studio-v1.vercel.app](https://agent-studio-v1.vercel.app)  
> 💻 **GitHub Repository**: [https://github.com/devhimanshuu/Agent-Studio](https://github.com/devhimanshuu/Agent-Studio)  

---

> **Enterprise-grade Visual AI Agent & Multi-Agent Orchestration Platform** where users can build complex agent graphs on an interactive node canvas, orchestrate multi-step workflows, manage schema-validated AI skills with immutable versioning, execute under strict tool permissions and Human-in-the-Loop (HITL) approval guardrails, and stream live execution telemetry via Server-Sent Events (SSE).

---

## ✨ What is Agent Studio?

Agent Studio is a production-grade **Visual AI Agent Platform** (combining the visual architecture of LangGraph Studio, the enterprise control of LangSmith, and the modularity of the OpenAI Agents SDK) built on Next.js 15 and React Flow. 

Users can visually design **Multi-Agent Graphs**, orchestrate **Chained Workflows**, and configure **Reusable Skills**, versioning them like software and running them on an autonomous **Graph Interpreter Runtime (v2)** with real-time SSE streaming, permission validation, circuit-breaker LLM routing, and HITL approval gates.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AGENT STUDIO LIFECYCLE                                │
│                                                                                         │
│  [ Visual Canvas Builder ] ──► [ Graph Validation & Diff ] ──► [ Immutable Versioning ] │
│             │                                                                │          │
│             ▼                                                                ▼          │
│  [ Multi-Step Workflows ]  ──► [ Live SSE Execution Engine ] ◄── [ Skills & Tool Registry]│
│             │                               │                                           │
│             ▼                               ▼                                           │
│  [ Human Review (HITL) ]   ──► [ History, Trace & Metrics ] ──► [ Audit Logs & Replay ] │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features & Capabilities

### 🎨 1. Visual Agent Graph Builder & Canvas (`/dashboard/canvas`)
- **Interactive Drag-and-Drop Canvas**: Build complex agent graphs visually powered by `@xyflow/react`.
- **10 Distinct Node Types**:
  - `start` / `end`: Input entry and final payload emission terminals.
  - `agent`: Autonomous LLM node with role-specific system prompts and scoped tool allowances.
  - `supervisor`: Orchestrator node that directs tasks and chooses specialized specialist routes.
  - `tool`: Explicit tool execution step with parameterized template mappings (`{{ results.<nodeId>.<path> }}`).
  - `router`: Deterministic conditional branching or AI-driven routing based on dynamic state evaluation.
  - `approval`: Human-in-the-Loop gate with optional auto-approval conditions and escalation timeouts.
  - `loop`: Bounded iteration node with configurable `maxIterations` for retry or refinement loops.
  - `parallel`: Map-reduce node for parallel fan-out over collection items (`input.lineItems`).
  - `subgraph` (Macro): Encapsulated nested agent graph with boundary input/output variable mappings.
- **Hierarchical Auto-Layout**: Dagre-powered algorithmic auto-layout with a single click.
- **Real-Time Graph Validation**: Immediate visual feedback for cycles, disconnected islands, unreachable terminals, unconfigured tools, and invalid router expressions.
- **Visual Graph Diff**: Compare modified graphs side-by-side highlighting added, removed, and modified nodes/edges.
- **Interactive Pre-built Templates**:
  - *Supervisor → Researcher → Coder → Critic* (Full Multi-Agent Loop)
  - *Map-Reduce Invoice Screening* (Parallel Fan-Out · Loop)
  - *HITL-Gated Disbursement* (Approval Gate · Conditional)
- **Instant Snapshots & Replay**: Save visual canvas state and inspect past execution snapshots.

### ⚡ 2. Graph Interpreter Runtime (v2 Engine)
- **Deterministic State Machine**: Executes visual agent graphs node-by-node with strongly typed transitions, execution contexts, and step-level persistence.
- **Safe Expression Evaluator (`expression.ts`)**: Evaluates JSONPath queries, logical comparisons (`==`, `!=`, `>`, `<`, `contains`, `in`), and nested property access safely without `eval()`.
- **Real-Time EventBus Telemetry**: Emits granular lifecycle events (`step_start`, `step_complete`, `tool_call`, `paused_for_approval`, `stream_chunk`) streamed directly to clients over SSE.
- **Live Canvas Execution Preview**: Test and debug agent graphs directly inside the studio canvas with live node highlights and step logs.

### ⛓️ 3. Multi-Step Workflows Pipeline (`/dashboard/workflows`)
- **Chained Workflow Orchestration**: Build bounded, sequential business pipelines combining document retrieval, AI extraction, deterministic conditions, and mock actions.
- **Curated Production Workflow Templates**:
  - *Customer Refund Automation* (Finance / HITL-Gated)
  - *Invoice Compliance & Risk Screening* (Compliance / Automated Audit)
  - *Support Ticket Intent Triage & Escalation* (Support / Knowledge Search)
- **Visual Step Chain**: Interactive horizontal stepper showing data flow, required tools, and approval checkpoints.

### 📦 4. Dynamic User-Defined Skills & Versioning (`/dashboard/skills`)
- **Schema-Validated AI Capabilities**: Define skills with Zod-validated input/output schemas, max execution step limits, and structured examples.
- **Immutable Versioning**: Published versions are frozen and immutable (`DRAFT → PUBLISHED → ARCHIVED`).
- **Automatic Draft Rotation**: Editing a published skill automatically branches into a new incremental draft.
- **Side-by-Side Version Diff (`/dashboard/compare`)**: Compare prompt instructions, schemas, tool permissions, and parameters between any two versions.

### 🛡️ 5. Human-in-the-Loop (HITL) Review Queue (`/dashboard/review`)
- **Safe Write-Action Guardrails**: Write-level tools (e.g. task creation, disbursements) pause execution into `PAUSED_FOR_APPROVAL`.
- **Single-Use Idempotency**: Atomic response handling prevents duplicate approvals or replay races.
- **Granular Controls**: Review detailed arguments, planner reasoning, and approve, reject, or cancel requests.

### 🔍 6. Observability, Execution History & Audit (`/dashboard/history` & `/dashboard/audit`)
- **Step-by-Step Execution Traces (`/dashboard/executions/[id]`)**: Detailed trace timeline with planner output, tool inputs/outputs, model metrics, execution duration, and structured logs.
- **One-Click Replay & Retry**: Re-execute past runs or retry failed steps with identical or updated parameters.
- **Enterprise Audit Trail**: Immutable audit logs capturing all skill mutations, approvals, and executions with full JSON export.

### 🌐 7. Resilient LLM Router with Automatic Failover
- **Vendor-Agnostic Routing**: Unified `LLMProvider` abstraction routing across Groq and OpenRouter models.
- **Circuit-Breaker Failover**: Automatically recovers from rate limits (429), 5xx server errors, decommissioned models (404), or auth errors without failing user runs.
- **Adaptive Cooldowns**: Temporarily parks failing models and automatically reinstates them once healthy.

### 🎮 8. Interactive Live Canvas Landing Page
- **Zero-Login Interactive Playground**: Visitors can explore, step through, and test real multi-agent execution graphs directly on the public landing page with live streaming node animations and trace telemetry.

---

## 🏗️ Clean & Layered Architecture

```
Agent Studio
├── Presentation Layer (Next.js 15 App Router, React 19, TailwindCSS, XYFlow, Zustand, TanStack Query)
│   ├── /dashboard/canvas       → Visual Graph Builder, Node Palette, Auto Layout, Snapshot & Diff
│   ├── /dashboard/workflows    → Multi-Step Workflow Pipeline & Template Steppers
│   ├── /dashboard/skills       → Schema-driven Skill CRUD, Version History & Compare
│   ├── /dashboard/executions   → Execution Trace Timeline, Replay Engine & Metrics
│   ├── /dashboard/review       → HITL Approval Queue with Idempotency Gates
│   └── /api/                   → REST & SSE Streaming Handlers
│
├── Application & Domain Layer (Clean Architecture Services & Modules)
│   ├── modules/graph/          → Graph Interpreter, Safe Expression Evaluator, EventBus
│   ├── modules/execution/      → Graph Nodes, Planner, Execution Engine, Agent State
│   ├── modules/approval/       → HITL Approval Engine & Policy Rules
│   ├── modules/tools/          → Tool Registry & Builtin Tool Implementations
│   └── services/               → ExecutionService, SkillService, ApprovalService, VersionService
│
└── Infrastructure Layer (Prisma ORM, Neon PostgreSQL, Clerk Auth, Pino, LLM Router)
    ├── providers/llm/          → GroqProvider, OpenRouterProvider, Resilient LLMRouter
    ├── repositories/           → Prisma Repositories with Dependency Inversion Interfaces
    └── lib/                    → Structured Logging (Pino), Rate Limiter, Env Validation (Zod)
```

---

## 🧰 Tool Registry

Every tool implements the unified `ITool` contract (`id`, `name`, `description`, `category`, `inputSchema`, `outputSchema`, `requiresApproval`, `execute()`, `validate()`, `healthCheck()`) and self-registers into the runtime catalog:

| Tool ID | Category | Type | Requires Approval | Description |
|---|---|---|:---:|---|
| `calculator` | `COMPUTE` | READ | — | Safe mathematical expression evaluation |
| `document_search` | `SEARCH` | READ | — | Keyword and semantic search across knowledge base docs |
| `record_lookup` | `DATA` | READ | — | Structured CRM / entity record retrieval |
| `ai_extraction` | `AI` | READ | — | LLM-powered structured parameter extraction from unstructured text |
| `ai_classification` | `AI` | READ | — | Intent and risk category classification |
| `deterministic_condition` | `LOGIC` | READ | — | Precise threshold and rule verification against business criteria |
| `final_report` | `SYNTHESIS` | READ | — | Executive summary and structured audit report compilation |
| `mock_task_creator` | `TASK` | WRITE | ✅ | Action dispatcher (creates external tasks / disbursements with HITL signoff) |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Components & Route Handlers), [React 19](https://react.dev/)
- **Visual Graph & Canvas**: [@xyflow/react (React Flow)](https://reactflow.dev/), [Dagre](https://github.com/dagrejs/dagre) (hierarchical graph layout)
- **Language & Validation**: [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode), [Zod](https://zod.dev/)
- **Styling & UI**: [TailwindCSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), Custom Glassmorphic Dark/Light Design System
- **State Management**: [TanStack Query v5](https://tanstack.com/query), [Zustand](https://zustand-demo.pmnd.rs/), [React Hook Form](https://react-hook-form.com/)
- **Database & ORM**: [Neon PostgreSQL](https://neon.tech/), [Prisma ORM](https://www.prisma.io/)
- **Authentication**: [Clerk](https://clerk.com/)
- **AI & LLM Routing**: [Groq SDK](https://groq.com/), [OpenRouter API](https://openrouter.ai/) with custom circuit-breaker failover router
- **Streaming & Real-Time**: Server-Sent Events (SSE) via native Web Streams API
- **Observability & Logging**: [Pino](https://getpino.io/) structured JSON logger
- **Testing**: [Vitest](https://vitest.dev/) (Unit & Integration Suites), [Playwright](https://playwright.dev/) (E2E Smoke)

---

## 📁 Repository Structure

```
├── prisma/
│   ├── schema.prisma                  # PostgreSQL schema (Skills, Versions, Executions, Approvals, Audit)
│   └── seed.ts                        # Idempotent demo workspace seed script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── skills/                # CRUD, publish, archive, duplicate endpoints
│   │   │   ├── executions/            # Execution start, replay, cancel, resume, SSE stream
│   │   │   ├── canvas/preview/        # Live canvas preview & SSE streaming endpoint
│   │   │   ├── approvals/             # Review queue & idempotent approval responses
│   │   │   ├── audit/                 # Audit trail querying & JSON export
│   │   │   ├── tools/                 # Tool catalog & health status
│   │   │   └── settings/              # Provider status & telemetry settings
│   │   ├── dashboard/
│   │   │   ├── canvas/                # Visual Graph Builder ([id], /new, /[id]/snapshot)
│   │   │   ├── workflows/             # Multi-step Workflow Pipelines (/new, /[id]/edit)
│   │   │   ├── skills/                # Skills Registry, Editor ([id]/edit), Versions ([id]/versions)
│   │   │   ├── executions/            # Execution History & Trace Detail ([id])
│   │   │   ├── review/                # Human-in-the-Loop Review Queue
│   │   │   ├── history/               # Platform Observability & Success Metrics
│   │   │   ├── compare/               # Side-by-side Skill & Graph Diffing
│   │   │   ├── audit/                 # Security Audit Trail
│   │   │   ├── tools/                 # Tool Registry Browser
│   │   │   └── settings/              # Appearance & AI Provider Health
│   │   ├── page.tsx                   # Landing page with interactive Live Agent Canvas Demo
│   │   └── layout.tsx                 # Root layout with Clerk, Theme, and Sidebar providers
│   ├── components/
│   │   ├── canvas/                    # AgentGraphCanvas, CanvasNodes, NodeInspector, AutoLayout, Diff
│   │   ├── workflows/                 # WorkflowForm, WorkflowCard, WorkflowStepChain, Templates
│   │   ├── landing/                   # LiveAgentCanvasDemo playground
│   │   ├── skills/                    # SkillForm, StatusBadge, VersionList
│   │   ├── executions/                # ExecutionTimeline, ExecutionStatusBadge
│   │   ├── feedback/                  # Toaster, ConfirmDialog, Skeleton Library, ErrorBoundary
│   │   └── layout/                    # Header, Collapsible Sidebar, Navigation
│   ├── modules/
│   │   ├── graph/                     # GraphInterpreter, Expression Evaluator, EventBus, PreviewStore
│   │   ├── execution/                 # Graph nodes, Planner, Executor, State definitions
│   │   ├── approval/                  # ApprovalEngine, Idempotency validators
│   │   ├── history/                   # ExecutionHistoryService
│   │   └── tools/                     # Tool Registry + 8 Builtin Tool Implementations
│   ├── providers/llm/                 # LLMProvider, GroqProvider, OpenRouterProvider, LLMRouter
│   ├── repositories/                  # Prisma data repositories (+ Dependency Inversion interfaces)
│   ├── services/                      # SkillService, ExecutionService, ApprovalService, VersionService
│   ├── types/                         # TypeScript interfaces (graph.ts, skill.ts, execution.ts, etc.)
│   └── validators/                    # Zod schemas for graphs, skills, executions, and requests
├── tests/
│   └── unit/                          # Vitest unit suites (Graph Interpreter, Validation, Services, Tools)
└── docs/
    └── API.md                         # Detailed API contract documentation
```

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- **Node.js**: >= 18.18.0
- **PostgreSQL Database**: (e.g. [Neon](https://neon.tech/))
- **Clerk Account**: for authentication credentials

### 2. Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|---|:---:|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk public API key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key |
| `GROQ_API_KEY` | ⬜ | Groq API key for ultra-fast open LLM execution |
| `OPENROUTER_API_KEY` | ⬜ | OpenRouter API key for redundant multi-model fallback |
| `NEXT_PUBLIC_APP_URL` | ⬜ | App URL for OpenRouter attribution headers |

### 3. Install & Initialize Database

```bash
npm install          # Automatically runs `prisma generate` via postinstall
npx prisma db push   # Synchronizes Prisma schema with your database
```

### 4. Optional: Seed Demo Workspace

Populate demo skills, multi-agent graphs, historical execution traces, and audit logs:

```bash
# Optional: bind demo records to your specific Clerk User ID
SEED_USER_ID=<your-clerk-user-id> npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔌 API & Streaming Endpoints

All endpoints require Clerk session authentication. Responses follow a standardized JSON envelope:

```jsonc
// Standard Response Envelope
{
  "success": true,
  "data": { /* Result Payload */ }
}
```

### Core API Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET / POST` | `/api/skills` | List skills (with search/filter/sort) or create a new skill |
| `GET / PATCH / DELETE` | `/api/skills/:id` | Retrieve, update draft, or delete a skill |
| `POST` | `/api/skills/:id/publish` | Publish current draft as an immutable version |
| `POST` | `/api/skills/:id/duplicate` | Duplicate an existing skill |
| `POST` | `/api/skills/:id/archive` | Archive a skill |
| `GET / POST` | `/api/executions` | List executions or trigger a new agent execution |
| `GET` | `/api/executions/:id/detail` | Get complete trace, planner steps, and tool logs |
| `GET` | `/api/executions/:id/stream` | **SSE Stream**: Real-time live execution progress & node events |
| `POST` | `/api/executions/:id/replay` | Replay execution with identical or modified inputs |
| `POST` | `/api/executions/:id/cancel` | Cancel an ongoing or paused execution |
| `POST` | `/api/executions/:id/resume` | Resume execution after human approval |
| `POST` | `/api/canvas/preview` | Initialize a live canvas preview execution |
| `GET` | `/api/canvas/preview/:id/stream`| **SSE Stream**: Live stream node-by-node canvas preview trace |
| `GET / POST` | `/api/approvals` | List pending approvals or submit an idempotent response |
| `GET` | `/api/audit` | Fetch searchable audit history with JSON export |
| `GET` | `/api/tools` | List registered tools and live health status |
| `GET` | `/api/settings/providers` | Query LLM provider health and active model rosters |

For full request/response schemas and examples, see [`docs/API.md`](docs/API.md).

---

## 🧪 Testing & Code Quality

```bash
# Run unit & integration tests
npm test

# Run Playwright E2E smoke tests
npm run test:e2e

# Run linter and type checks
npm run lint
npm run typecheck
```

**Unit test coverage includes:**
- Visual graph schema validation, cycle detection, unreachable node checks, and graph diffing
- Graph Interpreter (v2) execution transitions, expression evaluator, loops, parallel fan-out, and macro subgraphs
- Skill CRUD, schema validation, draft auto-rotation, and immutable version comparisons
- Tool registry self-registration, permission gates, and execution failure handling
- Approval engine idempotency, duplicate response prevention, race condition handling, and timeouts
- LLM Router circuit-breaker failover, error categorizations, and cooldown recovery
- Execution resume, retry logic, step boundaries, and structured audit logs

---

## 🚀 Deployment (Vercel + Neon)

1. **Database**: Provision a [Neon](https://neon.tech) PostgreSQL instance and grab the connection URL.
2. **Authentication**: Set up an application in [Clerk](https://clerk.com) and configure authorized redirect URLs.
3. **Deploy to Vercel**:
   - Push repository to GitHub and import the project into Vercel.
   - Add environment variables (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`).
   - `prisma generate` will run automatically during the build step.
   - Run `npx prisma db push` to apply schemas.

---

## 🔮 Roadmap

- [ ] Custom Tool Builder with OpenAPI / Swagger schema import
- [ ] Multi-tenant organization workspaces with role-based access control (RBAC)
- [ ] Community Skill & Graph Template Marketplace
- [ ] Webhook notifications & Slack / Discord review queue integrations
- [ ] Vector database integrations (Pinecone, Qdrant, pgvector) for custom RAG knowledge bases
- [ ] Cost estimation and token usage analytics per agent node
