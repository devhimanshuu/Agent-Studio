import {
  Bot, Users, GitBranch, CheckSquare, Repeat, GitFork, Boxes,
  Search, Sparkles, FileText, Rss, FileCheck, HardDrive, Code2,
  BrainCircuit, FileSpreadsheet, Database, Mic, Volume2,
  Clock, Radio, Webhook, Network,
} from "lucide-react";

export interface CanvasNodeCategory {
  category: string;
  color: string;
  nodes: Array<{
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
    desc: string;
    cls: string;
  }>;
}

export const canvasNodeCategories: CanvasNodeCategory[] = [
  {
    category: "LOGIC & MULTI-AGENT CONTROL",
    color: "indigo",
    nodes: [
      { name: "AGENT", icon: Bot, badge: "REASONING", desc: "Specialist agent with prompt and tool access", cls: "text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30" },
      { name: "SUPERVISOR", icon: Users, badge: "ORCHESTRATOR", desc: "Coordinates specialist agents and delegator loops", cls: "text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/30" },
      { name: "ROUTER", icon: GitBranch, badge: "CONDITIONAL", desc: "Deterministic rules or AI semantic branch evaluation", cls: "text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30" },
      { name: "APPROVAL", icon: CheckSquare, badge: "HITL GATE", desc: "Human-in-the-loop write locks with single-use tokens", cls: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30" },
      { name: "LOOP", icon: Repeat, badge: "ITERATION", desc: "Bounded iterative loop with max cycle safety budget", cls: "text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/30" },
      { name: "PARALLEL", icon: GitFork, badge: "MAP·REDUCE", desc: "Concurrent branch execution and array fan-out", cls: "text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30" },
      { name: "SUBGRAPH", icon: Boxes, badge: "NESTED MACRO", desc: "Reusable component graph nested up to 8 levels deep", cls: "text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-950/30" },
    ],
  },
  {
    category: "OPEN SEARCH & WEB SCRAPING (100% FREE)",
    color: "emerald",
    nodes: [
      { name: "SEARXNG SEARCH", icon: Search, badge: "ZERO-KEY", desc: "Open metasearch across Google, Bing, Reddit & DDG", cls: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30" },
      { name: "CRAWL4AI SCRAPER", icon: Sparkles, badge: "AI CRAWLER", desc: "Fast clean markdown scraper with boilerplate stripping", cls: "text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-950/30" },
      { name: "JINA WEB READER", icon: FileText, badge: "MARKDOWN", desc: "Converts any web URL to LLM-ready markdown instantly", cls: "text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-950/30" },
      { name: "RSS / ATOM FEED", icon: Rss, badge: "INGESTION", desc: "Autonomous polling and XML item extraction stream", cls: "text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-950/30" },
    ],
  },
  {
    category: "DOCUMENT INTEL & PDF GENERATION",
    color: "sky",
    nodes: [
      { name: "IBM DOCLING", icon: FileCheck, badge: "PDF & OCR", desc: "Parses complex research PDFs, tables & DOCX into markdown", cls: "text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/30" },
      { name: "GOTENBERG PDF", icon: HardDrive, badge: "STATISTIC EXPORT", desc: "Converts HTML/Markdown to executive publication PDFs", cls: "text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/30" },
      { name: "DATA MAPPER", icon: Code2, badge: "TRANSFORM", desc: "Visual JSON transformation and jq field mapping engine", cls: "text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/30" },
    ],
  },
  {
    category: "DATABASES, VECTOR MEMORY & SPEECH AI",
    color: "purple",
    nodes: [
      { name: "QDRANT VECTOR RAG", icon: BrainCircuit, badge: "EMBEDDINGS", desc: "Vector similarity search and persistent long-term memory", cls: "text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/30" },
      { name: "NOCODB RECORDS", icon: FileSpreadsheet, badge: "AIRTABLE·DB", desc: "Relational database CRUD on open-source NocoDB tables", cls: "text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/30" },
      { name: "POCKETBASE STORE", icon: Database, badge: "KV·STATE", desc: "Lightweight SQLite state, auth and checkpoint persistence", cls: "text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30" },
      { name: "FASTER-WHISPER", icon: Mic, badge: "VOICE STT", desc: "High-speed local speech-to-text audio transcriber", cls: "text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-500/40 bg-pink-50 dark:bg-pink-950/30" },
      { name: "PIPER TTS", icon: Volume2, badge: "LOCAL VOICE", desc: "Synthesizes low-latency natural agent spoken responses", cls: "text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30" },
    ],
  },
  {
    category: "TRIGGERS, DISPATCH & INTEGRATION",
    color: "amber",
    nodes: [
      { name: "CRON TRIGGER", icon: Clock, badge: "SCHEDULE", desc: "Periodic automated execution (e.g. 0 9 * * *)", cls: "text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/30" },
      { name: "INBOUND WEBHOOK", icon: Radio, badge: "REST INGRESS", desc: "Trigger graphs via external HTTP POST webhooks", cls: "text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/30" },
      { name: "DISPATCH NOTIFIER", icon: Webhook, badge: "ALERTS", desc: "Broadcasts output directly to Discord, Slack & Telegram", cls: "text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30" },
      { name: "HTTP / MCP TOOL", icon: Network, badge: "REST & MCP", desc: "Connect any OpenAPI endpoint or Model Context Protocol tool", cls: "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30" },
    ],
  },
];
