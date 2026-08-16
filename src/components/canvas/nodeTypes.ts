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
    accent: "border-emerald-400/70 text-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    defaults: {},
  },
  {
    type: "end",
    label: "END",
    tag: "EXIT",
    icon: Flag,
    description: "Terminal node — assembles the final output.",
    accent: "border-rose-400/70 text-rose-500",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/40",
    defaults: {},
  },
  {
    type: "agent",
    label: "AGENT",
    tag: "LLM",
    icon: Bot,
    description: "LLM agent node — runs a prompt over the accumulated context.",
    accent: "border-indigo-400/70 text-indigo-400",
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/40",
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
    accent: "border-violet-400/70 text-violet-400",
    badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/40",
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
    accent: "border-cyan-400/70 text-cyan-400",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40",
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
    accent: "border-amber-400/70 text-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/40",
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
    accent: "border-orange-400/70 text-orange-400",
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/40",
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
    accent: "border-fuchsia-400/70 text-fuchsia-400",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40",
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
    accent: "border-teal-400/70 text-teal-400",
    badgeClass: "bg-teal-500/15 text-teal-400 border-teal-500/40",
    defaults: {
      parallelMode: "map",
      mapField: "input.items",
    },
  },
];

export const CANVAS_NODE_TYPE_MAP: Record<GraphNodeType, CanvasNodeTypeMeta> = Object.fromEntries(
  CANVAS_NODE_TYPES.map((meta) => [meta.type, meta])
) as Record<GraphNodeType, CanvasNodeTypeMeta>;
