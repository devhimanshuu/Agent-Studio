# Agent Studio — Dynamic User-Defined Skills Agent Platform

> Enterprise-grade AI Agent Platform where users can create, schema-validate, version, test, and execute reusable AI Skills under strict tool permissions and Human-in-the-Loop (HITL) write approval guardrails.

---

## 🌟 Architecture & Key Technical Decisions

### 1. Clean & Layered Architecture (Dependency Inversion)
Agent Studio is structured following strict Clean Architecture principles:
- **Presentation Layer** (`src/app/`, `src/components/`, `src/features/`): Next.js 15 App Router, RSC, TailwindCSS, shadcn/ui, TanStack Query v5, Zustand, React Hook Form + Zod.
- **Application Layer** (`src/services/`): Pure TypeScript application services (`SkillService`, `ExecutionService`, `ApprovalService`, `VersionService`) that orchestrate domain logic using constructor dependency injection.
- **Domain Layer** (`src/types/`, `src/validators/`): Strongly typed domain entities, Zod schema validators, tool schemas, and idempotency rules.
- **Infrastructure Layer** (`src/repositories/`, `src/lib/`, `prisma/`): Prisma ORM data access, PostgreSQL models, Pino structured logger, environment config.

> **Why this matters for commercial SaaS & FastAPI migration**: Decoupling the domain logic from Next.js HTTP adapters ensures 100% unit-testable service code and allows future migration of the backend execution engine to Python/FastAPI without modifying UI or domain contracts.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui, TanStack Query v5, Zustand, Lucide React, Next-Themes
- **Backend**: Next.js Route Handlers (stateless controllers delegating to application services), LangGraph JS, OpenAI SDK
- **Database & ORM**: PostgreSQL, Prisma ORM (with multi-tenant `User`, `Skill`, `SkillVersion`, `Execution`, `ExecutionStep`, `ToolCall`, `ApprovalRequest`, `AuditLog`, `ToolDefinition` models)
- **Logging & Config**: Pino structured JSON logging, Zod environment validation (`src/lib/config/env.ts`)
- **Testing**: Vitest unit testing, Playwright E2E ready

---

## 📁 Repository Structure

```
d:/Agent_Studio/
├── prisma/
│   └── schema.prisma         # Prisma multi-tenant PostgreSQL schema
├── src/
│   ├── app/                  # Next.js 15 App Router pages & API handlers
│   │   ├── dashboard/        # Dashboard layout shell & metrics
│   │   ├── skills/           # Skills Studio view shell
│   │   ├── executions/       # Execution tracing view shell
│   │   ├── versions/         # Version diff & comparison view shell
│   │   ├── approvals/        # Human-in-the-Loop write approval view shell
│   │   └── api/              # Decoupled REST API route handlers
│   ├── components/           # UI components, header, sidebar, feedback
│   ├── features/             # Feature-first modular code
│   ├── services/             # Application Services (Dependency Inversion)
│   ├── repositories/         # Prisma Repositories (Data Access)
│   ├── validators/           # Zod payload & schema validators
│   ├── types/                # Shared TypeScript domain definitions
│   └── lib/                  # Pino logger, Zod env config, Prisma client
├── tests/                    # Vitest unit & integration tests
├── .env.example
├── tsconfig.json
├── tailwind.config.ts
└── vitest.config.ts
```

---

## 🚀 Quickstart & Setup Instructions

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 2. Install Dependencies & Generate Database Client
```bash
npm install
npx prisma generate
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application dashboard shell.

### 4. Run Unit Tests
```bash
npm run test
```

---

## 📊 Completed Scope (Phase 1 Foundation)

- [x] Feature-first & Layered Clean Architecture folder structure
- [x] Next.js 15 App Router base setup with TypeScript & TailwindCSS
- [x] Prisma PostgreSQL database models (`User`, `Skill`, `SkillVersion`, `Execution`, `ExecutionStep`, `ToolCall`, `ApprovalRequest`, `AuditLog`, `ToolDefinition`)
- [x] Dependency Inversion with repository & service interfaces (`ISkillService`, `IExecutionService`, `IApprovalService`, `IVersionService`)
- [x] Pino structured logger instance (`src/lib/logger`)
- [x] Zod environment variable validation (`src/lib/config/env.ts`)
- [x] Global providers (TanStack Query, ThemeProvider dark/light mode)
- [x] Responsive Dashboard Shell, Navigation Sidebar, Header with status indicators
- [x] Empty states, Error boundaries, and Loading skeletons
- [x] API route handlers with zero embedded business logic
- [x] Vitest configuration & unit test suites

---

## 🔒 Intentionally Excluded Scope for Phase 1

- Live AI graph execution loop (LangGraph node runners are prototyped in architecture interfaces and will be executed in Phase 2).
- Live execution of bounded tool implementations (`calculator`, `docSearch`, `recordLookup`, `taskCreator`).
- Production deployment to Neon & Vercel (Ready via standard Prisma + Vercel integration).
