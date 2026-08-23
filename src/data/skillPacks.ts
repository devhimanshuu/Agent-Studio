import { SkillPack, PackCategory } from "@/types/skillPacks";

/**
 * Curated 1-Click Skill Packs & Solution Stacks.
 *
 * Each pack defines:
 *  - MCP servers to mount (with directory search queries)
 *  - Visual workflow skills to create (with graph definitions)
 *  - Pre-built instructions, tool patterns, and steps
 */
export const SKILL_PACKS: SkillPack[] = [
  // ═══════════════════════════════════════════
  //  DEVOPS STACK
  // ═══════════════════════════════════════════
  {
    id: "devops-stack",
    name: "DevOps Stack",
    tagline: "CI/CD, monitoring & incident response — one click",
    description:
      "Full DevOps toolkit: GitHub for source control, Docker for containerization, Kubernetes for orchestration, Sentry for error tracking, and Slack for team alerts. Includes pre-built workflows for deployment pipelines, incident response, and release management.",
    category: "devops",
    icon: "Container",
    color: "indigo",
    difficulty: "INTERMEDIATE",
    estimatedSetupTime: "3 min",
    popularity: 100,
    isNew: false,
    servers: [
      {
        name: "GitHub",
        searchQuery: "github",
        directorySource: "glama",
        description: "Repository management, PRs, issues, CI/CD status",
        category: "SCM",
      },
      {
        name: "Docker",
        searchQuery: "docker",
        directorySource: "glama",
        description: "Container management, image builds, compose stacks",
        category: "INFRASTRUCTURE",
      },
      {
        name: "Kubernetes",
        searchQuery: "kubernetes",
        directorySource: "smithery",
        description: "Pod management, deployments, scaling, logs",
        category: "INFRASTRUCTURE",
      },
      {
        name: "Sentry",
        searchQuery: "sentry",
        directorySource: "glama",
        description: "Error tracking, performance monitoring, release health",
        category: "MONITORING",
      },
      {
        name: "Slack",
        searchQuery: "slack",
        directorySource: "composio",
        composioSlug: "slack",
        description: "Team messaging, channel management, alerts",
        category: "MESSAGING",
      },
    ],
    skills: [
      {
        name: "Deployment Pipeline",
        purpose: "Automated deployment pipeline that monitors GitHub PRs, builds Docker images, deploys to Kubernetes, and notifies Slack",
        instructions: `# Deployment Pipeline

## Overview
Automated CI/CD pipeline that monitors GitHub for new PRs and releases, builds Docker images, deploys to Kubernetes, and sends team notifications via Slack.

## Workflow Steps
1. **PR Monitor** — Watch for new PRs and push events on configured GitHub repositories
2. **Build Trigger** — Automatically trigger Docker image builds when code is pushed
3. **Container Registry** — Push built images to the container registry
4. **K8s Deploy** — Deploy the new image to the Kubernetes cluster with rolling updates
5. **Health Check** — Verify deployment health and pod readiness
6. **Team Notification** — Send deployment status, logs, and links to Slack channel
7. **Rollback** — If health checks fail, automatically rollback and alert the team`,
        allowedToolPatterns: ["github_*", "docker_*", "kubernetes_*", "slack_*"],
        requiredServerIndices: [0, 1, 2, 4],
        steps: [
          { order: 1, action: "monitor-github", description: "Watch GitHub for new PRs and push events", nodeType: "agent" },
          { order: 2, action: "build-docker", description: "Build Docker image from source", nodeType: "tool" },
          { order: 3, action: "deploy-k8s", description: "Deploy to Kubernetes with rolling update strategy", nodeType: "tool" },
          { order: 4, action: "health-check", description: "Verify deployment health and pod readiness", nodeType: "router" },
          { order: 5, action: "notify-slack", description: "Send deployment status to Slack channel", nodeType: "tool" },
          { order: 6, action: "rollback", description: "Rollback if health checks fail", nodeType: "agent" },
        ],
      },
      {
        name: "Incident Response",
        purpose: "Automated incident detection, triage, escalation and resolution tracking from Sentry errors to Slack alerts",
        instructions: `# Incident Response Automation

## Overview
Automated incident response that detects errors in Sentry, triages them by severity, creates Slack threads for coordination, and tracks resolution status.

## Workflow Steps
1. **Error Detection** — Monitor Sentry for new error events and performance regressions
2. **Severity Triage** — Classify errors by impact (critical/high/medium/low) using error context
3. **Incident Creation** — Create a structured incident report with reproduction steps
4. **Team Alert** — Post to #incidents channel with severity badge and assigned team
5. **Investigation** — Gather relevant logs, stack traces, and recent deployments
6. **Resolution Tracking** — Track fix status and postmortem generation`,
        allowedToolPatterns: ["sentry_*", "github_*", "slack_*"],
        requiredServerIndices: [0, 3, 4],
        steps: [
          { order: 1, action: "detect-errors", description: "Monitor Sentry for new error events", nodeType: "agent" },
          { order: 2, action: "triage-severity", description: "Classify error by impact level", nodeType: "router" },
          { order: 3, action: "create-incident", description: "Generate structured incident report", nodeType: "agent" },
          { order: 4, action: "alert-team", description: "Post incident to Slack #incidents", nodeType: "tool" },
          { order: 5, action: "gather-context", description: "Collect logs, stack traces, deployment info", nodeType: "tool" },
          { order: 6, action: "track-resolution", description: "Track fix status and generate postmortem", nodeType: "agent" },
        ],
      },
      {
        name: "Release Management",
        purpose: "Coordinate releases across repositories with changelog generation, tagging, and multi-channel notifications",
        instructions: `# Release Management

## Overview
Automated release coordination: generates changelogs from commits, creates GitHub releases with tags, builds and deploys Docker images, and broadcasts release notes.

## Workflow Steps
1. **Changelog Generation** — Analyze commits since last tag and generate categorized changelog
2. **GitHub Release** — Create GitHub release with tag, changelog, and assets
3. **Docker Build** — Build and push Docker image with version tag
4. **Deploy** — Update Kubernetes deployment with new version
5. **Broadcast** — Send release notes to Slack with download links`,
        allowedToolPatterns: ["github_*", "docker_*", "kubernetes_*", "slack_*"],
        requiredServerIndices: [0, 1, 2, 4],
        steps: [
          { order: 1, action: "generate-changelog", description: "Analyze commits and build categorized changelog", nodeType: "agent" },
          { order: 2, action: "create-release", description: "Create GitHub release with tag and changelog", nodeType: "tool" },
          { order: 3, action: "build-image", description: "Build and push Docker image with version tag", nodeType: "tool" },
          { order: 4, action: "deploy-k8s", description: "Update Kubernetes deployment with new version", nodeType: "tool" },
          { order: 5, action: "broadcast", description: "Send release notes to Slack channel", nodeType: "tool" },
        ],
      },
    ],
    serverCount: 5,
    skillCount: 3,
  },

  // ═══════════════════════════════════════════
  //  DATA & ANALYTICS SUITE
  // ═══════════════════════════════════════════
  {
    id: "data-analytics-suite",
    name: "Data & Analytics Suite",
    tagline: "Postgres + Snowflake + BigQuery + Python — end-to-end data pipelines",
    description:
      "Complete data infrastructure: Postgres for OLTP, Snowflake for analytics warehousing, BigQuery for large-scale queries, and Python code execution for transformations and ML. Includes ETL pipelines, data quality checks, and reporting workflows.",
    category: "data_analytics",
    icon: "Database",
    color: "emerald",
    difficulty: "ADVANCED",
    estimatedSetupTime: "5 min",
    popularity: 85,
    isNew: false,
    servers: [
      {
        name: "PostgreSQL",
        searchQuery: "postgresql",
        directorySource: "smithery",
        description: "OLTP database queries, schema inspection, migrations",
        category: "DATABASE",
      },
      {
        name: "Snowflake",
        searchQuery: "snowflake",
        directorySource: "smithery",
        description: "Cloud data warehouse queries and analytics",
        category: "DATABASE",
      },
      {
        name: "BigQuery",
        searchQuery: "bigquery",
        directorySource: "smithery",
        description: "Google Cloud large-scale data analysis",
        category: "DATABASE",
      },
      {
        name: "Python Execution",
        searchQuery: "python",
        directorySource: "smithery",
        description: "Python code execution for data transformations and ML",
        category: "AI",
      },
    ],
    skills: [
      {
        name: "ETL Pipeline",
        purpose: "Extract, transform, and load data across Postgres, Snowflake, and BigQuery with quality validation",
        instructions: `# ETL Pipeline

## Overview
Automated data pipeline that extracts from Postgres, transforms via Python, loads to Snowflake/BigQuery, and validates data quality at each stage.

## Workflow Steps
1. **Extract** — Pull data from Postgres with incremental loading (watermark-based)
2. **Validate Source** — Check data quality, nulls, duplicates at source
3. **Transform** — Apply Python transformations: cleaning, aggregation, enrichment
4. **Quality Gate** — Validate transformed data meets schema and quality rules
5. **Load** — Write to Snowflake (analytics) and BigQuery (ML feature store)
6. **Reconcile** — Verify row counts and checksums match between source and targets
7. **Report** — Generate data quality report and send to team`,
        allowedToolPatterns: ["postgresql_*", "snowflake_*", "bigquery_*", "python_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "extract-postgres", description: "Extract data from Postgres with incremental loading", nodeType: "tool" },
          { order: 2, action: "validate-source", description: "Check data quality at source", nodeType: "router" },
          { order: 3, action: "transform-python", description: "Apply Python data transformations", nodeType: "tool" },
          { order: 4, action: "quality-gate", description: "Validate transformed data against rules", nodeType: "router" },
          { order: 5, action: "load-warehouse", description: "Load to Snowflake and BigQuery", nodeType: "tool" },
          { order: 6, action: "reconcile", description: "Verify row counts and checksums", nodeType: "tool" },
        ],
      },
      {
        name: "Data Quality Monitor",
        purpose: "Continuous data quality monitoring with anomaly detection and automated alerting",
        instructions: `# Data Quality Monitor

## Overview
Monitors data quality across all connected databases with anomaly detection, schema drift detection, and automated alerting on quality degradation.

## Workflow Steps
1. **Schema Snapshot** — Capture current schema from each database
2. **Quality Metrics** — Compute freshness, completeness, uniqueness, validity scores
3. **Anomaly Detection** — Compare against historical baselines and detect drift
4. **Alert** — Notify team if quality drops below thresholds
5. **Auto-Fix** — Attempt common fixes (fill nulls, dedup, type coercion)`,
        allowedToolPatterns: ["postgresql_*", "snowflake_*", "bigquery_*", "python_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "schema-snapshot", description: "Capture database schemas", nodeType: "tool" },
          { order: 2, action: "compute-metrics", description: "Calculate quality scores per table", nodeType: "tool" },
          { order: 3, action: "detect-anomalies", description: "Compare against baselines for drift", nodeType: "agent" },
          { order: 4, action: "alert-degradation", description: "Send alerts for quality drops", nodeType: "router" },
          { order: 5, action: "auto-fix", description: "Apply common data fixes", nodeType: "tool" },
        ],
      },
      {
        name: "Cross-DB Analytics",
        purpose: "Run analytical queries that join data across Postgres, Snowflake, and BigQuery for unified reporting",
        instructions: `# Cross-Database Analytics

## Overview
Unified analytics that joins operational data (Postgres) with warehouse data (Snowflake) and ML features (BigQuery) for comprehensive business insights.

## Workflow Steps
1. **Query Postgres** — Pull operational metrics and recent transaction data
2. **Query Snowflake** — Pull historical analytics and aggregated metrics
3. **Query BigQuery** — Pull ML predictions and feature data
4. **Merge & Analyze** — Python-based merge and statistical analysis
5. **Generate Report** — Create structured analytics report with charts`,
        allowedToolPatterns: ["postgresql_*", "snowflake_*", "bigquery_*", "python_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "query-postgres", description: "Pull operational metrics from Postgres", nodeType: "tool" },
          { order: 2, action: "query-snowflake", description: "Pull analytics from Snowflake", nodeType: "tool" },
          { order: 3, action: "query-bigquery", description: "Pull ML features from BigQuery", nodeType: "tool" },
          { order: 4, action: "merge-analyze", description: "Join datasets and run analysis in Python", nodeType: "tool" },
          { order: 5, action: "generate-report", description: "Create structured analytics report", nodeType: "agent" },
        ],
      },
    ],
    serverCount: 4,
    skillCount: 3,
  },

  // ═══════════════════════════════════════════
  //  GROWTH & MARKETING PACK
  // ═══════════════════════════════════════════
  {
    id: "growth-marketing-pack",
    name: "Growth & Marketing Pack",
    tagline: "Stripe + Notion + Twitter/X + Email — full growth stack",
    description:
      "Growth engine: Stripe for payments and subscription analytics, Notion for content management, Twitter/X for social media automation, and email automation for drip campaigns. Includes customer lifecycle, content scheduling, and campaign tracking workflows.",
    category: "growth_marketing",
    icon: "TrendingUp",
    color: "pink",
    difficulty: "INTERMEDIATE",
    estimatedSetupTime: "4 min",
    popularity: 78,
    isNew: true,
    servers: [
      {
        name: "Stripe",
        searchQuery: "stripe",
        directorySource: "glama",
        description: "Payment processing, subscription management, invoicing",
        category: "CRM",
      },
      {
        name: "Notion",
        searchQuery: "notion",
        directorySource: "composio",
        composioSlug: "notion",
        description: "Content management, documentation, knowledge base",
        category: "COLLABORATION",
      },
      {
        name: "Twitter/X",
        searchQuery: "twitter",
        directorySource: "composio",
        composioSlug: "twitter",
        description: "Social media posting, analytics, engagement tracking",
        category: "MARKETING",
      },
      {
        name: "Email Automation",
        searchQuery: "email",
        directorySource: "smithery",
        description: "Email campaign management and drip sequences",
        category: "MARKETING",
      },
    ],
    skills: [
      {
        name: "Customer Lifecycle Automation",
        purpose: "Track customer journey from Stripe subscription events through onboarding to retention with Notion docs and email sequences",
        instructions: `# Customer Lifecycle Automation

## Overview
Automates the full customer lifecycle: monitors Stripe for new subscriptions and churn events, creates onboarding docs in Notion, triggers email sequences, and tracks retention metrics.

## Workflow Steps
1. **Stripe Monitor** — Watch for subscription events (new, renewal, cancellation, payment failure)
2. **Customer Profile** — Build/update customer profile with subscription tier and usage
3. **Lifecycle Router** — Route to appropriate workflow based on event type
4. **Onboarding** — For new subscribers: create Notion workspace and email welcome sequence
5. **Retention** — For at-risk: send win-back emails and Notion check-in docs
6. **Analytics** — Track MRR, churn rate, LTV, and campaign effectiveness`,
        allowedToolPatterns: ["stripe_*", "notion_*", "email_*"],
        requiredServerIndices: [0, 1, 3],
        steps: [
          { order: 1, action: "monitor-stripe", description: "Watch Stripe subscription events", nodeType: "agent" },
          { order: 2, action: "build-profile", description: "Build customer profile with subscription data", nodeType: "tool" },
          { order: 3, action: "route-lifecycle", description: "Route based on subscription event type", nodeType: "router" },
          { order: 4, action: "onboard-customer", description: "Create Notion workspace and email welcome", nodeType: "tool" },
          { order: 5, action: "retention-outreach", description: "Send win-back emails for at-risk customers", nodeType: "tool" },
          { order: 6, action: "track-analytics", description: "Track MRR, churn, and campaign metrics", nodeType: "agent" },
        ],
      },
      {
        name: "Content Scheduler",
        purpose: "Plan, schedule, and cross-post content across Notion drafts, Twitter/X, and email newsletters",
        instructions: `# Content Scheduler

## Overview
End-to-end content management: draft in Notion, schedule social posts on Twitter/X, and prepare email newsletters from the same source content.

## Workflow Steps
1. **Content Calendar** — Pull upcoming content plan from Notion database
2. **Draft Social Posts** — Transform long-form content into Twitter/X thread formats
3. **Schedule Posts** — Queue social posts at optimal times based on analytics
4. **Newsletter Prep** — Aggregate week's best content into email newsletter draft
5. **Performance Review** — Track engagement metrics and adjust strategy`,
        allowedToolPatterns: ["notion_*", "twitter_*", "email_*"],
        requiredServerIndices: [1, 2, 3],
        steps: [
          { order: 1, action: "pull-calendar", description: "Pull content plan from Notion database", nodeType: "tool" },
          { order: 2, action: "draft-social", description: "Transform content into Twitter/X thread format", nodeType: "agent" },
          { order: 3, action: "schedule-posts", description: "Queue posts at optimal times", nodeType: "tool" },
          { order: 4, action: "prep-newsletter", description: "Aggregate content into email newsletter", nodeType: "agent" },
          { order: 5, action: "review-performance", description: "Track engagement and adjust strategy", nodeType: "agent" },
        ],
      },
      {
        name: "Revenue Intelligence",
        purpose: "Analyze Stripe payment data, identify upsell opportunities, and trigger personalized outreach",
        instructions: `# Revenue Intelligence

## Overview
Analyzes Stripe payment patterns to identify upsell opportunities, segment customers by value, and trigger personalized Notion docs and emails for account expansion.

## Workflow Steps
1. **Pull Revenue Data** — Fetch subscription and invoice data from Stripe
2. **Segment Customers** — Classify by tier, usage, and growth trajectory
3. **Identify Upsells** — Find customers hitting plan limits or showing upgrade signals
4. **Personalize Outreach** — Generate custom Notion proposal docs per prospect
5. **Email Campaign** — Send personalized upgrade emails with case studies`,
        allowedToolPatterns: ["stripe_*", "notion_*", "email_*"],
        requiredServerIndices: [0, 1, 3],
        steps: [
          { order: 1, action: "pull-revenue", description: "Fetch Stripe subscription and invoice data", nodeType: "tool" },
          { order: 2, action: "segment-customers", description: "Classify customers by value and trajectory", nodeType: "agent" },
          { order: 3, action: "identify-upsells", description: "Find upgrade signals and plan limit hits", nodeType: "router" },
          { order: 4, action: "personalize-outreach", description: "Generate custom Notion proposal docs", nodeType: "tool" },
          { order: 5, action: "send-email", description: "Send personalized upgrade emails", nodeType: "tool" },
        ],
      },
    ],
    serverCount: 4,
    skillCount: 3,
  },

  // ═══════════════════════════════════════════
  //  AI & ML OPS PACK
  // ═══════════════════════════════════════════
  {
    id: "ai-mlops-pack",
    name: "AI & MLOps Pack",
    tagline: "Model training, deployment, and monitoring pipeline",
    description:
      "End-to-end ML operations: HuggingFace for model hub, Weights & Biases for experiment tracking, Pinecone for vector search, and OpenAI for LLM inference. Includes training pipelines, model deployment, and production monitoring.",
    category: "ai_ml",
    icon: "Brain",
    color: "violet",
    difficulty: "ADVANCED",
    estimatedSetupTime: "5 min",
    popularity: 72,
    isNew: true,
    servers: [
      {
        name: "HuggingFace",
        searchQuery: "huggingface",
        directorySource: "smithery",
        description: "Model hub access, tokenizers, model deployment",
        category: "AI",
      },
      {
        name: "Pinecone",
        searchQuery: "pinecone",
        directorySource: "smithery",
        description: "Vector database for embeddings and similarity search",
        category: "DATABASE",
      },
      {
        name: "OpenAI",
        searchQuery: "openai",
        directorySource: "smithery",
        description: "GPT inference, embeddings, fine-tuning API",
        category: "AI",
      },
      {
        name: "Python Execution",
        searchQuery: "python",
        directorySource: "smithery",
        description: "Python code execution for data processing and ML",
        category: "AI",
      },
    ],
    skills: [
      {
        name: "RAG Pipeline",
        purpose: "Retrieval-Augmented Generation pipeline with document ingestion, embedding, vector storage, and LLM inference",
        instructions: `# RAG Pipeline

## Overview
Complete RAG pipeline: ingest documents, compute embeddings via OpenAI, store in Pinecone, and generate context-aware answers using retrieved documents.

## Workflow Steps
1. **Document Ingest** — Parse and chunk documents from various sources
2. **Embed** — Generate embeddings using OpenAI embedding models
3. **Index** — Store embeddings in Pinecone with metadata
4. **Query** — Receive user query and compute query embedding
5. **Retrieve** — Find top-k similar documents from Pinecone
6. **Generate** — Use OpenAI LLM with retrieved context to generate answer
7. **Cite** — Format response with source citations`,
        allowedToolPatterns: ["huggingface_*", "pinecone_*", "openai_*", "python_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "ingest-docs", description: "Parse and chunk documents", nodeType: "tool" },
          { order: 2, action: "compute-embeddings", description: "Generate OpenAI embeddings for chunks", nodeType: "tool" },
          { order: 3, action: "index-vectors", description: "Store embeddings in Pinecone with metadata", nodeType: "tool" },
          { order: 4, action: "query-embed", description: "Compute query embedding", nodeType: "tool" },
          { order: 5, action: "retrieve-context", description: "Find top-k similar documents", nodeType: "tool" },
          { order: 6, action: "generate-answer", description: "Generate answer with LLM and context", nodeType: "agent" },
          { order: 7, action: "format-citations", description: "Format response with source citations", nodeType: "transform" },
        ],
      },
      {
        name: "Model Eval Pipeline",
        purpose: "Automated model evaluation: run test suites, compute metrics, compare against baselines, and generate reports",
        instructions: `# Model Evaluation Pipeline

## Overview
Automated evaluation pipeline that runs model test suites, computes quality metrics, compares against previous baselines, and generates evaluation reports.

## Workflow Steps
1. **Load Model** — Pull model from HuggingFace hub
2. **Run Eval Suite** — Execute standardized evaluation benchmarks
3. **Compute Metrics** — Calculate accuracy, latency, token efficiency
4. **Compare Baseline** — Compare against previous best model metrics
5. **Generate Report** — Create detailed evaluation report with charts`,
        allowedToolPatterns: ["huggingface_*", "python_*", "openai_*"],
        requiredServerIndices: [0, 2, 3],
        steps: [
          { order: 1, action: "load-model", description: "Pull model from HuggingFace hub", nodeType: "tool" },
          { order: 2, action: "run-eval", description: "Execute evaluation benchmarks", nodeType: "tool" },
          { order: 3, action: "compute-metrics", description: "Calculate quality metrics", nodeType: "tool" },
          { order: 4, action: "compare-baseline", description: "Compare against previous best", nodeType: "router" },
          { order: 5, action: "generate-report", description: "Create evaluation report", nodeType: "agent" },
        ],
      },
    ],
    serverCount: 4,
    skillCount: 2,
  },

  // ═══════════════════════════════════════════
  //  SECURITY & COMPLIANCE PACK
  // ═══════════════════════════════════════════
  {
    id: "security-compliance-pack",
    name: "Security & Compliance",
    tagline: "Vulnerability scanning, audit trails & policy enforcement",
    description:
      "Security-first stack: GitHub for code scanning, Snyk for dependency vulnerabilities, Cloudflare for WAF/DNS, and PagerDuty for incident escalation. Includes automated security audits, dependency updates, and compliance reporting.",
    category: "security",
    icon: "Shield",
    color: "red",
    difficulty: "ADVANCED",
    estimatedSetupTime: "4 min",
    popularity: 65,
    isNew: false,
    servers: [
      {
        name: "GitHub",
        searchQuery: "github",
        directorySource: "glama",
        description: "Code scanning, secret detection, Dependabot alerts",
        category: "SCM",
      },
      {
        name: "Cloudflare",
        searchQuery: "cloudflare",
        directorySource: "smithery",
        description: "WAF rules, DNS management, DDoS protection, analytics",
        category: "CLOUD",
      },
      {
        name: "PagerDuty",
        searchQuery: "pagerduty",
        directorySource: "smithery",
        description: "Incident escalation, on-call scheduling, status pages",
        category: "MONITORING",
      },
      {
        name: "Slack",
        searchQuery: "slack",
        directorySource: "composio",
        composioSlug: "slack",
        description: "Security alerts and compliance notifications",
        category: "MESSAGING",
      },
    ],
    skills: [
      {
        name: "Security Audit Pipeline",
        purpose: "Automated security scanning: code analysis, dependency vulnerabilities, infrastructure misconfigurations, and compliance reporting",
        instructions: `# Security Audit Pipeline

## Overview
Automated security audit: scans code for vulnerabilities via GitHub, checks dependencies, audits Cloudflare config, and generates compliance-ready reports.

## Workflow Steps
1. **Code Scan** — Run GitHub code scanning for vulnerabilities and secrets
2. **Dependency Check** — Analyze dependency tree for known CVEs
3. **Infra Audit** — Review Cloudflare WAF rules, DNS, and SSL configuration
4. **Risk Assessment** — Classify findings by severity and exploitability
5. **Compliance Report** — Generate SOC2/GDPR-ready compliance report
6. **Team Alert** — Notify critical findings to Slack and PagerDuty`,
        allowedToolPatterns: ["github_*", "cloudflare_*", "pagerduty_*", "slack_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "code-scan", description: "Run GitHub code scanning", nodeType: "tool" },
          { order: 2, action: "dep-check", description: "Analyze dependency vulnerabilities", nodeType: "tool" },
          { order: 3, action: "infra-audit", description: "Review Cloudflare configuration", nodeType: "tool" },
          { order: 4, action: "risk-assess", description: "Classify findings by severity", nodeType: "agent" },
          { order: 5, action: "compliance-report", description: "Generate compliance report", nodeType: "agent" },
          { order: 6, action: "team-alert", description: "Alert critical findings", nodeType: "tool" },
        ],
      },
      {
        name: "Dependency Auto-Fix",
        purpose: "Monitor dependencies for vulnerabilities and automatically create fix PRs with changelog updates",
        instructions: `# Dependency Auto-Fix

## Overview
Automated dependency management: monitors for vulnerable dependencies, generates fix PRs with updated lockfiles, runs CI checks, and merges safe updates.

## Workflow Steps
1. **Scan Dependencies** — Check all dependency trees for known vulnerabilities
2. **Generate Fix** — Create fix branch with updated dependencies
3. **CI Check** — Run tests and build to verify compatibility
4. **Create PR** — Open PR with vulnerability details and changelog
5. **Auto-Merge** — If all checks pass and patch-level update, auto-merge`,
        allowedToolPatterns: ["github_*", "slack_*"],
        requiredServerIndices: [0, 3],
        steps: [
          { order: 1, action: "scan-deps", description: "Check dependencies for vulnerabilities", nodeType: "tool" },
          { order: 2, action: "generate-fix", description: "Create fix branch with updates", nodeType: "tool" },
          { order: 3, action: "run-ci", description: "Run tests and build checks", nodeType: "tool" },
          { order: 4, action: "create-pr", description: "Open PR with vulnerability details", nodeType: "tool" },
          { order: 5, action: "auto-merge", description: "Auto-merge safe patch updates", nodeType: "router" },
        ],
      },
    ],
    serverCount: 4,
    skillCount: 2,
  },

  // ═══════════════════════════════════════════
  //  PRODUCTIVITY SUITE
  // ═══════════════════════════════════════════
  {
    id: "productivity-suite",
    name: "Productivity Suite",
    tagline: "Calendar + Tasks + Notes + Communication — unified workflow",
    description:
      "All-in-one productivity: Google Calendar for scheduling, Todoist/Linear for task management, Notion for documentation, and Slack/Email for communication. Includes daily standup automation, meeting prep, and project tracking.",
    category: "productivity",
    icon: "Zap",
    color: "amber",
    difficulty: "BEGINNER",
    estimatedSetupTime: "2 min",
    popularity: 90,
    isNew: false,
    servers: [
      {
        name: "Google Calendar",
        searchQuery: "google calendar",
        directorySource: "composio",
        composioSlug: "googlecalendar",
        description: "Calendar events, meeting scheduling, availability",
        category: "COLLABORATION",
      },
      {
        name: "Notion",
        searchQuery: "notion",
        directorySource: "composio",
        composioSlug: "notion",
        description: "Documentation, knowledge base, project tracking",
        category: "COLLABORATION",
      },
      {
        name: "Slack",
        searchQuery: "slack",
        directorySource: "composio",
        composioSlug: "slack",
        description: "Team communication and channel management",
        category: "MESSAGING",
      },
      {
        name: "Linear",
        searchQuery: "linear",
        directorySource: "glama",
        description: "Project management, issue tracking, sprint planning",
        category: "COLLABORATION",
      },
    ],
    skills: [
      {
        name: "Daily Standup Bot",
        purpose: "Automated daily standup: collects team updates from Linear, formats report, posts to Slack, and syncs to Notion",
        instructions: `# Daily Standup Bot

## Overview
Automated standup: pulls yesterday's completed work and today's plan from Linear, gathers team member updates, formats a structured report, posts to Slack, and archives in Notion.

## Workflow Steps
1. **Pull Linear Data** — Fetch completed and in-progress issues per team member
2. **Calendar Check** — Review today's calendar for meetings that affect availability
3. **Format Report** — Create structured standup with What/Done/Blockers/Today format
4. **Post to Slack** — Send formatted standup to #standup channel
5. **Archive to Notion** — Save standup to Notion daily log database`,
        allowedToolPatterns: ["googlecalendar_*", "notion_*", "slack_*", "linear_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "pull-linear", description: "Fetch issues from Linear", nodeType: "tool" },
          { order: 2, action: "check-calendar", description: "Review today's meetings", nodeType: "tool" },
          { order: 3, action: "format-report", description: "Create structured standup", nodeType: "agent" },
          { order: 4, action: "post-slack", description: "Post to Slack #standup", nodeType: "tool" },
          { order: 5, action: "archive-notion", description: "Save to Notion daily log", nodeType: "tool" },
        ],
      },
      {
        name: "Meeting Prep Assistant",
        purpose: "Auto-prep for upcoming meetings: gather context from Notion, pull relevant Linear issues, and create briefing doc",
        instructions: `# Meeting Prep Assistant

## Overview
Prepares meeting briefs automatically: identifies upcoming meetings, gathers relevant Notion docs and Linear issues, and creates a structured briefing document.

## Workflow Steps
1. **Scan Calendar** — Find next 2-4 hours of meetings
2. **Gather Context** — Pull relevant Notion docs based on meeting topic
3. **Issue Search** — Find related Linear issues for each meeting
4. **Create Brief** — Generate structured briefing with talking points
5. **Send Alert** — Post briefing to Slack DM or meeting channel`,
        allowedToolPatterns: ["googlecalendar_*", "notion_*", "slack_*", "linear_*"],
        requiredServerIndices: [0, 1, 2, 3],
        steps: [
          { order: 1, action: "scan-calendar", description: "Find upcoming meetings", nodeType: "tool" },
          { order: 2, action: "gather-context", description: "Pull relevant Notion docs", nodeType: "tool" },
          { order: 3, action: "search-issues", description: "Find related Linear issues", nodeType: "tool" },
          { order: 4, action: "create-brief", description: "Generate briefing document", nodeType: "agent" },
          { order: 5, action: "send-alert", description: "Post briefing to Slack", nodeType: "tool" },
        ],
      },
    ],
    serverCount: 4,
    skillCount: 2,
  },
];

// ────────────── Helpers ──────────────

export const PACK_CATEGORIES: {
  id: PackCategory | "all";
  label: string;
  icon: string;
  color: string;
}[] = [
  { id: "all", label: "All Packs", icon: "Layers", color: "slate" },
  { id: "devops", label: "DevOps", icon: "Container", color: "indigo" },
  { id: "data_analytics", label: "Data & Analytics", icon: "Database", color: "emerald" },
  { id: "growth_marketing", label: "Growth & Marketing", icon: "TrendingUp", color: "pink" },
  { id: "ai_ml", label: "AI & MLOps", icon: "Brain", color: "violet" },
  { id: "security", label: "Security", icon: "Shield", color: "red" },
  { id: "productivity", label: "Productivity", icon: "Zap", color: "amber" },
];

export function getPackById(id: string): SkillPack | undefined {
  return SKILL_PACKS.find((p) => p.id === id);
}

export function getPacksByCategory(category: PackCategory | "all"): SkillPack[] {
  if (category === "all") return SKILL_PACKS;
  return SKILL_PACKS.filter((p) => p.category === category);
}
