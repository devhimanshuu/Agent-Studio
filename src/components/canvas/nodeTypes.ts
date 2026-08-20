import { GraphNodeType } from "@/types/graph";
import {
  CircleDot,
  Target,
  Bot,
  GitFork,
  Wrench,
  ShieldCheck,
  Repeat,
  Split,
  Flag,
  Boxes,
  ServerCog,
  Plug,
  Puzzle,
  Globe,
  Shuffle,
  Timer,
  Layers,
  Variable,
  FileOutput,
  type LucideIcon,
} from "lucide-react";

export interface CanvasNodeTypeMeta {
  type: GraphNodeType;
  label: string;
  tag: string;
  icon: LucideIcon;
  description: string;
  /** Tailwind classes for the node accent (border + text + glow). */
  accent: string;
  badgeClass: string;
  /** Default config injected when a node of this type is dropped. */
  defaults: Partial<Record<string, unknown>>;
}

export const CANVAS_NODE_TYPES: CanvasNodeTypeMeta[] = [
  {
    type: "start",
    label: "START",
    tag: "ENTRY",
    icon: CircleDot,
    description: "Graph entry point — receives the user input.",
    accent: "border-emerald-500/70 text-emerald-600 dark:text-emerald-500",
    badgeClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40",
    defaults: {},
  },
  {
    type: "end",
    label: "END",
    tag: "EXIT",
    icon: Flag,
    description: "Terminal node — assembles the final output.",
    accent: "border-rose-500/70 text-rose-600 dark:text-rose-500",
    badgeClass: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/40",
    defaults: {},
  },
  {
    type: "agent",
    label: "AGENT",
    tag: "LLM",
    icon: Bot,
    description: "LLM agent node — runs a prompt over the accumulated context.",
    accent: "border-indigo-500/70 text-indigo-600 dark:text-indigo-400",
    badgeClass: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/40",
    defaults: {
      prompt:
        "You are a specialized agent in a multi-agent workflow. Analyze the provided context thoroughly and produce a detailed, structured response.",
      allowedTools: [],
    },
  },
  {
    type: "supervisor",
    label: "SUPERVISOR",
    tag: "ROUTER·LLM",
    icon: GitFork,
    description: "Orchestrator agent — the LLM picks the next node by edge label.",
    accent: "border-violet-500/70 text-violet-600 dark:text-violet-400",
    badgeClass: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/40",
    defaults: {
      prompt:
        "You are the supervisor of a multi-agent system. Decide which specialist should handle the current task next.",
    },
  },
  {
    type: "tool",
    label: "TOOL",
    tag: "DETERMINISTIC",
    icon: Wrench,
    description: "Sandboxed tool invocation (search, calculator, extraction…).",
    accent: "border-cyan-500/70 text-cyan-600 dark:text-cyan-400",
    badgeClass: "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/40",
    defaults: {
      toolName: "calculator",
      action: "add",
      inputTemplate: {},
    },
  },
  {
    type: "router",
    label: "ROUTER",
    tag: "CONDITION",
    icon: Split,
    description: "Deterministic or AI branch — picks an outgoing edge by condition.",
    accent: "border-amber-500/70 text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/40",
    defaults: {
      routerMode: "deterministic",
      condition: 'results.classifier.decision == "high"',
    },
  },
  {
    type: "approval",
    label: "APPROVAL",
    tag: "HITL",
    icon: ShieldCheck,
    description: "Human-in-the-loop gate — pauses the run until approved.",
    accent: "border-orange-500/70 text-orange-600 dark:text-orange-400",
    badgeClass: "bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/40",
    defaults: {
      action: "approve_graph_action",
      approvalReason: "A human review checkpoint in the agent workflow.",
    },
  },
  {
    type: "loop",
    label: "LOOP",
    tag: "COUNTER",
    icon: Repeat,
    description: "Repeats its body edge up to N iterations, then exits.",
    accent: "border-fuchsia-500/70 text-fuchsia-600 dark:text-fuchsia-400",
    badgeClass: "bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/40",
    defaults: {
      maxIterations: 3,
    },
  },
  {
    type: "parallel",
    label: "PARALLEL",
    tag: "MAP·REDUCE",
    icon: Target,
    description: "Map over an array or fan out branches concurrently.",
    accent: "border-teal-500/70 text-teal-600 dark:text-teal-400",
    badgeClass: "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/40",
    defaults: {
      parallelMode: "map",
      mapField: "input.items",
    },
  },
  {
    type: "subgraph",
    label: "SUBGRAPH",
    tag: "MACRO",
    icon: Boxes,
    description: "Nested agent graph — a reusable macro with typed inputs and outputs.",
    accent: "border-slate-500/70 text-slate-600 dark:text-slate-300",
    badgeClass: "bg-slate-100 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-500/40",
    defaults: {
      inputMapping: {},
      outputMapping: {},
    },
  },
  // ─── MCP & Ecosystem Nodes ───
  {
    type: "mcp_server",
    label: "MCP SERVER",
    tag: "CONNECTOR",
    icon: ServerCog,
    description: "Connect to an MCP server (GitHub, Postgres, Slack, Brave Search, etc.).",
    accent: "border-violet-500/70 text-violet-600 dark:text-violet-400",
    badgeClass: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/40",
    defaults: {
      mcpServerId: "github",
      mcpTransport: "SSE",
    },
  },
  {
    type: "mcp_tool",
    label: "MCP TOOL",
    tag: "REMOTE CALL",
    icon: Plug,
    description: "Call a specific tool from a connected MCP server.",
    accent: "border-fuchsia-500/70 text-fuchsia-600 dark:text-fuchsia-400",
    badgeClass: "bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/40",
    defaults: {
      mcpToolName: "search_repositories",
      mcpToolServer: "github",
      mcpToolParams: {},
    },
  },
  {
    type: "skill",
    label: "SKILL",
    tag: "MARKETPLACE",
    icon: Puzzle,
    description: "Execute an installed agent skill from the marketplace (19K+ available).",
    accent: "border-sky-500/70 text-sky-600 dark:text-sky-400",
    badgeClass: "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/40",
    defaults: {
      skillId: "",
      skillInput: {},
    },
  },
  {
    type: "http",
    label: "HTTP REQUEST",
    tag: "API CALL",
    icon: Globe,
    description: "Make an HTTP request to any REST/GraphQL API endpoint.",
    accent: "border-cyan-500/70 text-cyan-600 dark:text-cyan-400",
    badgeClass: "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/40",
    defaults: {
      httpMethod: "GET",
      httpUrl: "https://api.example.com/endpoint",
      httpHeaders: {},
      httpBody: {},
      httpResponseType: "json",
    },
  },
  {
    type: "transform",
    label: "TRANSFORM",
    tag: "DATA OPS",
    icon: Shuffle,
    description: "Transform data: map, filter, merge, flatten, sort, dedupe, pick, omit.",
    accent: "border-emerald-500/70 text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40",
    defaults: {
      transformOp: "map",
      transformExpr: "item.name",
    },
  },
  {
    type: "delay",
    label: "DELAY",
    tag: "WAIT",
    icon: Timer,
    description: "Pause execution for a specified duration (ms or template).",
    accent: "border-slate-500/70 text-slate-600 dark:text-slate-400",
    badgeClass: "bg-slate-100 dark:bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-500/40",
    defaults: {
      delayMs: 1000,
    },
  },
  {
    type: "aggregate",
    label: "AGGREGATE",
    tag: "COMBINE",
    icon: Layers,
    description: "Combine results from multiple incoming branches (concat, merge, count, first, all).",
    accent: "border-amber-500/70 text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/40",
    defaults: {
      aggregateMode: "concat",
    },
  },
  {
    type: "variable",
    label: "VARIABLE",
    tag: "STATE",
    icon: Variable,
    description: "Get or set a workflow variable in the execution state.",
    accent: "border-indigo-500/70 text-indigo-600 dark:text-indigo-400",
    badgeClass: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/40",
    defaults: {
      varName: "myVar",
      varOp: "get",
    },
  },
  {
    type: "output",
    label: "OUTPUT",
    tag: "FORMAT",
    icon: FileOutput,
    description: "Format and return the final output with field mappings.",
    accent: "border-teal-500/70 text-teal-600 dark:text-teal-400",
    badgeClass: "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/40",
    defaults: {
      outputTemplate: "{{ results }}",
      outputFields: {},
    },
  },
];

export const CANVAS_NODE_TYPE_MAP: Record<GraphNodeType, CanvasNodeTypeMeta> = Object.fromEntries(
  CANVAS_NODE_TYPES.map((meta) => [meta.type, meta])
) as Record<GraphNodeType, CanvasNodeTypeMeta>;
