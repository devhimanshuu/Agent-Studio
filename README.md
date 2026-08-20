# Agent Studio — Visual Agent Canvas & Multi-Agent Orchestration Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://agent-studio-v1.vercel.app/)
[![MCP](https://img.shields.io/badge/MCP-Protocol_Client_%26_Server-8A2BE2?style=for-the-badge&logoColor=white)](https://modelcontextprotocol.io)
[![Database](https://img.shields.io/badge/Database-Neon_Postgres-02E693?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Mode-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-Vitest_Passing-brightgreen?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev)
[![React Flow](https://img.shields.io/badge/Canvas-XYFlow_React-FF0072?style=for-the-badge&logo=react&logoColor=white)](https://reactflow.dev)

> 🔗 **Live Application**: [https://agent-studio-v1.vercel.app](https://agent-studio-v1.vercel.app)  
> 💻 **GitHub Repository**: [https://github.com/devhimanshuu/Agent-Studio](https://github.com/devhimanshuu/Agent-Studio)  

---

> **Enterprise-grade Visual AI Agent & Multi-Agent Orchestration Platform** where users can build complex agent graphs on an interactive node canvas, orchestrate multi-step workflows, manage schema-validated AI skills with immutable versioning, connect and discover **Model Context Protocol (MCP)** tools, execute under strict tool permissions and Human-in-the-Loop (HITL) approval guardrails, and stream live execution telemetry via Server-Sent Events (SSE).

---

## ✨ What is Agent Studio?

Agent Studio is a production-grade **Visual AI Agent Platform** (combining the visual architecture of LangGraph Studio, the enterprise control of LangSmith, and the modularity of the OpenAI Agents SDK) built on Next.js 15 and React Flow. 

Users can visually design **Multi-Agent Graphs**, orchestrate **Chained Workflows**, connect to **Model Context Protocol (MCP)** servers from a public directory of 500+ servers, configure **Reusable Skills**, version them like software, chain them into **Skill Chains**, build **Server Compositions**, track **Usage Analytics & Costs**, monitor **Health Dashboards**, and run everything on an autonomous **Graph Interpreter Runtime (v2)** with real-time SSE streaming, permission validation, circuit-breaker LLM routing, and HITL approval gates.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AGENT STUDIO LIFECYCLE                                │
│                                                                                         │
│  [ Visual Canvas Builder ] ──► [ Graph Validation & Diff ] ──► [ Immutable Versioning ] │
│             │                                                                │          │
│             ▼                                                                ▼          │
│  [ Multi-Step Workflows ]  ──► [ Live SSE Execution Engine ] ◄── [ Skills & MCP Tool Hub ]│
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
- **Zero-Login Interactive Playground**: Visitors can explore, step through, and test real multi-agent execution graphs directly on the public landing page with live streaming node animations and trace telemetry.### 🔌 9. Model Context Protocol (MCP) Ecosystem

- **MCP Client Hub (`/dashboard/tools?tab=mcp`)**: Connect remote **SSE / Streamable HTTP** endpoints and local **stdio** MCP servers, auto-discover their `tools/list` definitions, validate schemas, and register them as first-class tools inside the LangGraph runtime (permission-gated via `allowedTools`, HITL approval for WRITE tools, 15s timeouts, and circuit breakers).

- **1-Click Ecosystem Presets**: GitHub, Postgres, SQLite, Web Fetch, Brave Search, and Filesystem — with connect modals for endpoint URLs and auth tokens.

- **Live Tool Testing**: Inspect discovered JSON schemas and execute real payloads straight from the hub.

- **Agent Studio as an MCP Server**: External agents (Cursor, Claude Desktop, Antigravity) connect to `/api/mcp/sse` (Streamable HTTP + SSE) and get every published workflow as a callable `run_skill_*` tool. Auth via Clerk session or `MCP_ACCESS_TOKEN` bearer token.

### 🌐 14. OpenAPI & REST API Integration (`/dashboard/tools?tab=openapi`)

- **Public OpenAPI Directory**: Browse and 1-click import from **2,500+ APIs** powered by the [APIs.guru](https://apis.guru) registry — covers Google, Azure, AWS, Stripe, GitHub, Twilio, Slack, Spotify, Cloudflare, and more.
- **1-Click Tool Pack Presets**: Pre-configured REST API tool packs (Forex Rates, Weather, Wikipedia, NASA, Exchange Rates, GitHub Metadata, OpenAI, StackExchange) ready to install in one click.
- **Custom OpenAPI Spec Import**: Paste any Swagger/OpenAPI URL (JSON or YAML) to auto-parse, introspect endpoints, and mount them as callable agent tools.
- **Endpoint Introspection**: Before importing, preview every endpoint (path, method, parameters, summary) from the raw specification.
- **Per-Endpoint Configuration**: Enable/disable individual endpoints, set Human-in-the-Loop (HITL) approval gates on write operations, and configure custom headers.
- **REST Tool Execution**: Imported OpenAPI endpoints become first-class tools in the execution engine, synced into both the Engine and Graph registries before every run.
- **Auth Support**: Configure Bearer tokens, API keys, Basic auth, or custom headers per integration.
- **Status Monitoring**: Live connection status per integration with error tracking and last-error display.

### 🌐 15. Public MCP Directory & Discovery

- **500+ MCP Servers**: Browse servers from Glama.ai, mcp.so, and awesome-mcp-servers registry.
- **40+ Categories**: Databases, Browser Automation, Search, Dev Tools, Cloud, AI, Security, and more.
- **Language Filtering**: Filter by TypeScript, Python, Go, Rust, C#, Java, C/C++, Ruby.
- **Server Detail Modal**: Health ping, GitHub release info, README preview, auth requirements.
- **Favorites & Bookmarks**: Star servers for quick access (localStorage persistence).
- **Recently Mounted Badge**: Detect servers already in your configuration.
- **Quality Scoring**: Auto-grade servers A+ to F on schema quality, latency, uptime, docs, maintenance, community.
- **License Detection**: MIT, Apache-2.0, GPL, etc. displayed on cards.

### 🧩 16. MCP Server Composition & Chaining

- **Visual Composition Builder**: Chain multiple MCP servers into reusable workflows.
- **Node Types**: INPUT, MCP_SERVER, TRANSFORM, CONDITION, OUTPUT.
- **Pre-built Compositions**: Research Pipeline, ETL Pipeline, PR Review Pipeline.
- **Edge System**: Connect nodes with labels (Yes/No for conditions).

### 🤖 17. Agent Registry & Discovery

- **Registered Agents**: Discover AI agents with capabilities, trust scores, and latency estimates.
- **Agent Registration**: Register your own agents as discoverable MCP endpoints.
- **Trust Scoring**: Based on verification, usage, and community feedback.
- **Capability Matching**: Find agents by their specific tool capabilities.

### 📊 18. Advanced MCP Features

- **MCP Client Manager**: Track which AI clients (Claude Desktop, Cursor, VS Code) connect to which servers.
- **Tool Versioning**: Track MCP server versions, auto-update, rollback on failure.
- **Dependency Graph**: Visualize server relationships (requires, enhances, conflicts).
- **Usage Analytics**: Track tool usage, latency, cost per call with budget alerts.
- **Server Templates**: Pre-built stacks (Supabase, Cloudflare, AI Research, Stripe, Jira, Data Science).
- **Skill Chains**: Chain multiple skills into reusable multi-step workflows.
- **Health Dashboard**: Persistent monitoring with alerts, SLA tracking, uptime graphs.
- **Community Reviews**: Rate and review MCP servers with pros/cons and use cases.

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
│   ├── modules/openapi/        → OpenAPI Parser, Presets, Spec Validator
│   └── services/               → ExecutionService, SkillService, ApprovalService, VersionService, OpenApiService
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
│   │   │   ├── settings/              # Provider status & telemetry settings
│   │   │   └── mcp/                   # MCP Ecosystem APIs
│   │   │       ├── servers/           # MCP server CRUD, connect, disconnect, discover, health, test
│   │   │       ├── presets/           # MCP preset configurations
│   │   │       ├── directory/         # Public MCP directory (Glama, mcp.so, awesome-mcp)
│   │   │       │   ├── route.ts       # Directory listing with 40+ categories, language filter
│   │   │       │   ├── github/        # GitHub proxy for releases & README
│   │   │       │   └── health/        # SSE endpoint health ping
│   │   │       ├── skills-feed/       # Skills Marketplace feed from Glama/awesome-mcp
│   │   │       ├── quality/           # Auto-quality scoring (A+ to F grades)
│   │   │       ├── compositions/      # Server composition builder (chain MCP servers)
│   │   │       ├── agents/            # Agent registry (discover & register AI agents)
│   │   │       ├── clients/           # MCP client manager (track Cursor, Claude, VS Code)
│   │   │       ├── versions/          # Tool versioning & rollback tracking
│   │   │       ├── analytics/         # Usage analytics & cost tracking with budgets
│   │   │       ├── templates/         # MCP server templates (full-stack presets)
│   │   │       ├── skill-chains/      # Agent skill chains (multi-step workflows)
│   │   │       ├── health-dashboard/  # Persistent health monitoring with alerts & SLA
│   │   │       ├── reviews/           # Community server reviews (rate & review)
│   │   │       ├── dependencies/      # Dependency graph (requires/enhances/conflicts)
│   │   │       ├── sse/               # MCP SSE server endpoint
│   │   │       └── messages/          # MCP message endpoint
│   │   ├── openapi/               # OpenAPI & REST Integration APIs
│   │   │   ├── parse/             # Spec URL → Parsed OpenAPI endpoints
│   │   │   ├── directory/         # Public API directory (APIs.guru 2,500+ APIs)
│   │   │   └── integrations/      # OpenAPI integration CRUD, sync, test
│   │   ├── dashboard/
│   │   │   ├── canvas/                # Visual Graph Builder ([id], /new, /[id]/snapshot)
│   │   │   ├── workflows/             # Multi-step Workflow Pipelines (/new, /[id]/edit)
│   │   │   ├── skills/                # Skills Registry, Editor ([id]/edit), Versions ([id]/versions)
│   │   │   ├── executions/            # Execution History & Trace Detail ([id])
│   │   │   ├── review/                # Human-in-the-Loop Review Queue
│   │   │   ├── history/               # Platform Observability & Success Metrics
│   │   │   ├── compare/               # Side-by-side Skill & Graph Diffing
│   │   │   ├── audit/                 # Security Audit Trail
│   │   │   ├── tools/                 # Tool Registry Browser + MCP Server Hub + OpenAPI Hub
│   │   │   │   ├── mcp/               # MCP Dashboard components
│   │   │   │   │   ├── McpServerHub.tsx        # Main MCP management hub
│   │   │   │   │   ├── McpDirectoryBrowser.tsx # Public directory with 500+ servers
│   │   │   │   │   └── ...                    # Modal, card, and inspector components
│   │   │   │   └── openapi/            # OpenAPI & REST Integration components
│   │   │   │       ├── OpenApiHub.tsx          # Main OpenAPI management hub
│   │   │   │       ├── OpenApiDirectoryBrowser.tsx # Public directory with 2,500+ APIs
│   │   │   │       ├── OpenApiImportModal.tsx  # Spec URL import & parsing
│   │   │   │       └── OpenApiEndpointTesterModal.tsx # Live endpoint testing
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
│   │   ├── mcp/                       # MCP protocol, client service, presets
│   │   ├── openapi/                   # OpenAPI parser, presets, spec validation
│   │   └── tools/                     # Tool Registry + 8 Builtin Tool Implementations
│   ├── providers/llm/                 # LLMProvider, GroqProvider, OpenRouterProvider, LLMRouter
│   ├── repositories/                  # Prisma data repositories (+ Dependency Inversion interfaces)
│   ├── services/                      # SkillService, ExecutionService, ApprovalService, VersionService, OpenApiService
│   ├── types/                         # TypeScript interfaces
│   │   ├── mcp.ts                     # MCP server, tool, health types
│   │   ├── mcp-directory.ts           # Public MCP server, GitHub, health types
│   │   ├── agent-studio-registry.ts   # Skills, quality, compositions, agents types
│   │   └── mcp-advanced.ts            # Clients, versioning, analytics, templates, reviews types
│   ├── lib/
│   │   ├── config/                    # Environment validation (Zod)
│   │   ├── logger/                    # Structured logging (Pino)
│   │   └── api/                       # API handlers, middleware
│   └── validators/                    # Zod schemas for graphs, skills, executions, and requests
├── scripts/
│   └── check-published.ts             # Published skills verification script
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
| `MCP_ACCESS_TOKEN` | ⬜ | Bearer token external MCP clients (Cursor / Claude Desktop) use to connect to `/api/mcp/sse` |

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

| Method                 | Endpoint                          | Description                                                          |
| ------------------------| -----------------------------------| ----------------------------------------------------------------------|
| `GET / POST`           | `/api/skills`                     | List skills (with search/filter/sort) or create a new skill          |
| `GET / PATCH / DELETE` | `/api/skills/:id`                 | Retrieve, update draft, or delete a skill                            |
| `POST`                 | `/api/skills/:id/publish`         | Publish current draft as an immutable version                        |
| `POST`                 | `/api/skills/:id/duplicate`       | Duplicate an existing skill                                          |
| `POST`                 | `/api/skills/:id/archive`         | Archive a skill                                                      |
| `GET / POST`           | `/api/executions`                 | List executions or trigger a new agent execution                     |
| `GET`                  | `/api/executions/:id/detail`      | Get complete trace, planner steps, and tool logs                     |
| `GET`                  | `/api/executions/:id/stream`      | **SSE Stream**: Real-time live execution progress & node events      |
| `POST`                 | `/api/executions/:id/replay`      | Replay execution with identical or modified inputs                   |
| `POST`                 | `/api/executions/:id/cancel`      | Cancel an ongoing or paused execution                                |
| `POST`                 | `/api/executions/:id/resume`      | Resume execution after human approval                                |
| `POST`                 | `/api/canvas/preview`             | Initialize a live canvas preview execution                           |
| `GET`                  | `/api/canvas/preview/:id/stream`  | **SSE Stream**: Live stream node-by-node canvas preview trace        |
| `GET / POST`           | `/api/approvals`                  | List pending approvals or submit an idempotent response              |
| `GET`                  | `/api/audit`                      | Fetch searchable audit history with JSON export                      |
| `GET`                  | `/api/tools`                      | List registered tools and live health status                         |
| `GET / POST`           | `/api/mcp/servers`                | List the user's MCP servers or connect a new one                     |
| `GET / PATCH / DELETE` | `/api/mcp/servers/:id`            | Retrieve, update, or delete an MCP server                            |
| `POST`                 | `/api/mcp/servers/:id/connect`    | Connect + discover tools from an MCP server                          |
| `POST`                 | `/api/mcp/servers/:id/disconnect` | Disconnect an MCP server                                             |
| `POST`                 | `/api/mcp/servers/:id/discover`   | Re-run `tools/list` and refresh the cached tool definitions          |
| `GET`                  | `/api/mcp/servers/:id/health`     | Live latency probe + circuit status                                  |
| `POST`                 | `/api/mcp/servers/:id/test`       | Live-execute a discovered MCP tool with a test payload               |
| `GET`                  | `/api/mcp/directory`              | Public MCP directory (500+ servers from Glama, mcp.so, awesome-mcp)  |
| `GET`                  | `/api/mcp/directory/github`       | GitHub proxy for releases & README preview                           |
| `POST`                 | `/api/mcp/directory/health`       | SSE endpoint health ping                                             |
| `GET`                  | `/api/mcp/skills-feed`            | Skills Marketplace feed (auto-derived from Glama/awesome-mcp)        |
| `POST`                 | `/api/mcp/quality`                | Auto-quality scoring (A+ to F on 6 dimensions)                       |
| `GET / POST`           | `/api/mcp/compositions`           | Server composition builder (chain MCP servers)                        |
| `GET / POST`           | `/api/mcp/agents`                 | Agent registry (discover & register AI agents)                        |
| `GET`                  | `/api/mcp/clients`                | MCP client manager (track Cursor, Claude, VS Code connections)       |
| `GET`                  | `/api/mcp/versions`               | Tool versioning & rollback tracking                                   |
| `GET`                  | `/api/mcp/analytics`              | Usage analytics & cost tracking with budgets                          |
| `GET`                  | `/api/mcp/templates`              | MCP server templates (full-stack preset configurations)              |
| `GET / POST`           | `/api/mcp/skill-chains`           | Agent skill chains (multi-step reusable workflows)                   |
| `GET`                  | `/api/mcp/health-dashboard`       | Persistent health monitoring with alerts & SLA tracking              |
| `GET / POST`           | `/api/mcp/reviews`                | Community server reviews (rate & review servers)                     |
| `GET`                  | `/api/mcp/dependencies`           | Dependency graph (requires/enhances/conflicts visualization)         |
| `GET / POST`           | `/api/mcp/sse`                    | **MCP Server**: external agents connect here (Streamable HTTP / SSE) |
| `POST`                 | `/api/mcp/messages`               | **MCP Server**: message endpoint for open sessions                   |
| `GET`                  | `/api/openapi/parse`             | Parse an OpenAPI spec URL and return introspected endpoints          |
| `GET`                  | `/api/openapi/directory`         | Browse 2,500+ public APIs from APIs.guru registry                    |
| `GET / POST`           | `/api/openapi/integrations`      | List user's OpenAPI integrations or create a new one                 |
| `GET / PATCH / DELETE` | `/api/openapi/integrations/:id`  | Retrieve, update, or delete an OpenAPI integration                   |
| `POST`                 | `/api/openapi/integrations/:id/test` | Test an endpoint from an OpenAPI integration                     |
| `GET`                  | `/api/settings/providers`         | Query LLM provider health and active model rosters                   |

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
- MCP protocol parsing (`tools/list` mapping, JSON-RPC), tool schema adaptation (JSON Schema → Zod), circuit breakers, and remote MCP tools executing inside the LangGraph engine with HITL approval locks
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

### ✅ Completed
- [x] Public MCP Directory (500+ servers from Glama, mcp.so, awesome-mcp)
- [x] Server Detail Modal with health ping, GitHub info, README preview
- [x] Favorites/Bookmarks with localStorage persistence
- [x] Recently Mounted badge detection
- [x] Popularity sorting (stars, A-Z)
- [x] Language filtering (TypeScript, Python, Go, Rust, C#, Java)
- [x] Quality scoring (A+ to F grades on 6 dimensions)
- [x] License detection and display
- [x] Skills Marketplace feed (auto-derived from Glama/awesome-mcp)
- [x] Server Composition Builder (chain MCP servers into workflows)
- [x] Agent Registry (discover & register AI agents)
- [x] MCP Client Manager (track Cursor, Claude, VS Code connections)
- [x] Tool Versioning & Rollback tracking
- [x] Usage Analytics & Cost Tracking with budgets
- [x] MCP Server Templates (full-stack preset configurations)
- [x] Agent Skill Chains (multi-step reusable workflows)
- [x] Persistent Health Dashboard with alerts & SLA tracking
- [x] Community Server Reviews (rate & review servers)
- [x] Dependency Graph visualization (requires/enhances/conflicts)
- [x] OpenAPI & REST API Integration (1-click import from 2,500+ APIs via APIs.guru)
- [x] OpenAPI Spec Parsing & Endpoint Introspection
- [x] 1-Click Free Tool Packs (Forex, Weather, Wikipedia, NASA, Exchange Rates, OpenAI)
- [x] Custom OpenAPI Spec Import (paste any Swagger/OpenAPI URL)
- [x] Per-Endpoint HITL Approval Gates for OpenAPI tools
- [x] OpenAPI Tool Sync into Execution Engine (MCP + REST unified tool registry)

### 🚧 In Progress
- [ ] Multi-tenant organization workspaces with role-based access control (RBAC)
- [ ] Community Skill & Graph Template Marketplace UI
- [ ] Webhook notifications & Slack / Discord review queue integrations
- [ ] GitHub raw search for OpenAPI specs as a second directory source

### 📋 Planned
- [ ] Vector database integrations (Pinecone, Qdrant, pgvector) for custom RAG knowledge bases
- [ ] Real-time cost estimation and token usage analytics per agent node
- [ ] MCP Server auto-discovery on local network
- [ ] Agent reputation system with trust scores
- [ ] Cross-agent communication protocol
