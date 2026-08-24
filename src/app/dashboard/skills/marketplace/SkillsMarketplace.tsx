"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  X,
  Loader2,
  Star,
  Download,
  Clock,
  Zap,
  Code,
  Database,
  Brain,
  BookOpen,
  Globe,
  Wrench,
  MessageSquare,
  BarChart3,
  Plus,
  Check,
  ExternalLink,
  Shield,
  Sparkles,
  LayoutGrid,
  List,
  Trash2,
  Play,
} from "lucide-react";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { ItemIcon } from "@/components/common/ItemIcon";
import { Pagination } from "@/components/common/Pagination";
import { AgentSkill, SkillCategory } from "@/types/agent-studio-registry";
import { SkillDTO } from "@/types/skill";
import { toast } from "@/stores/toastStore";
import { LiveSandbox } from "@/components/mcp/LiveSandbox";

/** Persistent map of marketplace skill IDs → database Skill IDs */
const INSTALLED_MAP_KEY = "skill-installed-map";

function loadInstalledMap(): Map<string, string> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(INSTALLED_MAP_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveInstalledMap(map: Map<string, string>) {
  try {
    localStorage.setItem(INSTALLED_MAP_KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {}
}

/**
 * Build human-readable step-by-step instructions from the marketplace skill's steps.
 */
function buildInstructions(skill: AgentSkill): string {
  const lines = [
    `Skill: ${skill.name}`,
    `Source: ${skill.source}`,
    `Category: ${skill.category} | Difficulty: ${skill.difficulty}`,
    "",
    "## Instructions",
    skill.description,
    "",
    "## Workflow Steps",
  ];
  const dummyTools = new Set(["smithery-cli", "execute_command", "connect", "composio_connect", "composio_auth"]);
  for (const step of skill.steps) {
    const hasValidTool = step.requiredTool && !dummyTools.has(step.requiredTool.trim().toLowerCase());
    lines.push(`${step.order}. ${step.description}${hasValidTool ? ` (tool: ${step.requiredTool})` : ""}`);
  }
  return lines.join("\n");
}

/**
 * Build the allowedTools list. We combine:
 *  - requiredTools from the marketplace skill metadata (excluding dummy placeholders)
 *  - mcp_<serverId>_* wildcard-style entries for each mounted server
 * The permission checker will match these at execution time.
 */
function buildAllowedTools(skill: AgentSkill, mountedServerIds: string[]): string[] {
  const tools = new Set<string>();
  const dummyTools = new Set(["smithery-cli", "execute_command", "connect", "composio_connect", "composio_auth"]);

  // Add explicitly required tools from the skill definition
  if (skill.requiredTools?.length) {
    for (const t of skill.requiredTools) {
      if (t && t.trim() && !dummyTools.has(t.trim().toLowerCase())) {
        tools.add(t.trim());
      }
    }
  }

  // Add MCP tool entries for each mounted server
  for (const serverId of mountedServerIds) {
    // Generic MCP tool entries — the agent will discover actual tools at runtime
    tools.add(`mcp_${serverId}_*`);
  }

  // Also add wildcard "*" so skill runtime can invoke any mounted tool for this skill
  tools.add("*");

  // Fallback: if we still have no tools, add standard built-ins
  if (tools.size === 0) {
    tools.add("code_execution");
  }

  return Array.from(tools).slice(0, 20);
}

const CATEGORIES: { id: SkillCategory | "ALL"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ALL", label: "ALL", icon: Sparkles },
  { id: "RESEARCH", label: "RESEARCH", icon: BookOpen },
  { id: "CODING", label: "CODING", icon: Code },
  { id: "DATA", label: "DATA", icon: Database },
  { id: "ANALYSIS", label: "ANALYSIS", icon: BarChart3 },
  { id: "COMMUNICATION", label: "COMMUNICATION", icon: MessageSquare },
  { id: "AUTOMATION", label: "AUTOMATION", icon: Zap },
  { id: "KNOWLEDGE", label: "KNOWLEDGE", icon: Brain },
  { id: "PRODUCTIVITY", label: "PRODUCTIVITY", icon: Wrench },
  { id: "CREATIVE", label: "CREATIVE", icon: Globe },
];

const DIFFICULTIES = [
  { id: "ALL", label: "ALL LEVELS" },
  { id: "BEGINNER", label: "BEGINNER" },
  { id: "INTERMEDIATE", label: "INTERMEDIATE" },
  { id: "ADVANCED", label: "ADVANCED" },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  INTERMEDIATE: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  ADVANCED: "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  RESEARCH: "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  CODING: "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  DATA: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  ANALYSIS: "border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
  COMMUNICATION: "border-pink-300 dark:border-pink-500/40 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300",
  AUTOMATION: "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  KNOWLEDGE: "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  PRODUCTIVITY: "border-slate-300 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300",
  CREATIVE: "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
};

const SOURCES = [
  { id: "ALL", label: "ALL SOURCES" },
  { id: "glama", label: "GLAMA.AI" },
  { id: "mcp.so", label: "MCP.SO" },
  { id: "smithery", label: "SMITHERY.AI" },
  { id: "composio", label: "COMPOSIO" },
];

const SOURCE_COLORS: Record<string, string> = {
  glama: "border-cyan-400 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300",
  "mcp.so": "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  smithery: "border-amber-400 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  composio: "border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  "awesome-mcp": "border-purple-400 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  community: "border-slate-400 dark:border-slate-500/40 bg-slate-50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300",
};

export function SkillsMarketplace() {
  const queryClient = useQueryClient();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [installedDbSkills, setInstalledDbSkills] = useState<SkillDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<string>("ALL");
  const [category, setCategory] = useState<SkillCategory | "ALL">("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [detailSkill, setDetailSkill] = useState<AgentSkill | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    try {
      return (localStorage.getItem("skill-view-mode") as "grid" | "list") || "grid";
    } catch {
      return "grid";
    }
  });

  const handleToggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("skill-view-mode", mode);
    } catch {}
  };

  // Map of marketplaceSkillId → databaseSkillId
  const [installedMap, setInstalledMap] = useState<Map<string, string>>(loadInstalledMap);

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Scroll to top of grid on page change
  useEffect(() => {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentPage]);

  const fetchPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));
      if (source !== "ALL") params.set("source", source);
      if (search.trim()) params.set("q", search.trim());
      if (category !== "ALL") params.set("category", category);
      if (difficulty !== "ALL") params.set("difficulty", difficulty);

      const res = await fetch(`/api/mcp/skills-feed?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setSkills(json.data);
        setTotalCount(json.pagination?.totalCount || json.total || json.data.length);
        setCurrentPage(targetPage);
      } else {
        throw new Error("Failed to load skills");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading skills");
    } finally {
      setLoading(false);
    }
  }, [category, difficulty, search, source]);

  // Fetch page 1 on filter changes
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1), 300);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  // Check if a skill is installed across ID, name, notes, and DB records
  const isSkillInstalled = useCallback(
    (skill: AgentSkill) => {
      const cleanId = skill.id ? skill.id.replace(/[.,;:]$/, "") : "";
      const cleanName = skill.name?.toLowerCase().trim() || "";
      if (
        installedMap.has(skill.id) ||
        (cleanId && installedMap.has(cleanId)) ||
        (cleanName && installedMap.has(cleanName))
      ) {
        return true;
      }
      return installedDbSkills.some(
        (db) =>
          db.status !== "ARCHIVED" &&
          (db.id === skill.id ||
            db.id === cleanId ||
            (cleanName && db.name.toLowerCase().trim() === cleanName) ||
            (cleanId && (db.currentDraft?.notes || db.publishedVersion?.notes || "").includes(`ID: ${cleanId}`)) ||
            (skill.id && (db.currentDraft?.notes || db.publishedVersion?.notes || "").includes(`ID: ${skill.id}`)))
      );
    },
    [installedMap, installedDbSkills]
  );

  // Client-side installed filter with global database hydration
  const filteredSkills = useMemo(() => {
    if (!showInstalledOnly) return skills;

    const installedList: AgentSkill[] = [];
    const seenIds = new Set<string>();

    for (const s of skills) {
      if (isSkillInstalled(s)) {
        installedList.push(s);
        seenIds.add(s.id);
        if (s.name) seenIds.add(s.name.toLowerCase().trim());
        const dbId =
          installedMap.get(s.id) ||
          (s.id ? installedMap.get(s.id.replace(/[.,;:]$/, "")) : undefined) ||
          (s.name ? installedMap.get(s.name.toLowerCase().trim()) : undefined);
        if (dbId) seenIds.add(dbId);
      }
    }

    for (const dbSkill of installedDbSkills) {
      if (dbSkill.status === "ARCHIVED") continue;
      const draft = dbSkill.currentDraft || dbSkill.publishedVersion;
      const notes = draft?.notes || "";
      const match = notes.match(/ID:\s*([^\s\n\r]+)/);
      const rawMarketplaceId = match ? match[1].replace(/[.,;:]$/, "") : dbSkill.id;
      const marketplaceId = rawMarketplaceId || dbSkill.id;
      const cleanDbName = dbSkill.name ? dbSkill.name.toLowerCase().trim() : "";

      if (
        seenIds.has(marketplaceId) ||
        seenIds.has(dbSkill.id) ||
        (cleanDbName && seenIds.has(cleanDbName))
      ) {
        continue;
      }
      seenIds.add(marketplaceId);
      seenIds.add(dbSkill.id);
      if (cleanDbName) seenIds.add(cleanDbName);

      const sourceMatch = notes.match(/Installed from ([^\s]+) marketplace/);
      const source = (sourceMatch ? sourceMatch[1] : "community") as AgentSkill["source"];

      installedList.push({
        id: marketplaceId,
        name: dbSkill.name,
        description: dbSkill.purpose || draft?.instructions?.slice(0, 150) || "Installed agent skill",
        category: "PRODUCTIVITY",
        author: "You",
        source,
        stars: 1,
        installs: 1,
        rating: 5.0,
        difficulty: "BEGINNER",
        estimatedTime: "2 min",
        steps: [
          { order: 1, action: "execute", description: dbSkill.purpose || "Execute skill workflow" },
        ],
        tags: ["installed", source],
        requiredServers: [],
        requiredTools: draft?.allowedTools || ["*"],
      });
    }

    return installedList.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesQuery =
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }
      if (source !== "ALL" && s.source !== source) return false;
      if (category !== "ALL" && s.category !== category) return false;
      if (difficulty !== "ALL" && s.difficulty !== difficulty) return false;
      return true;
    });
  }, [skills, showInstalledOnly, isSkillInstalled, installedMap, installedDbSkills, search, source, category, difficulty]);

  const [installing, setInstalling] = useState<string | null>(null);
  // Set when an install mounted a STDIO server that requires explicit
  // connect (never auto-executes marketplace commands).
  const needsManualConnect = useRef(false);

  /**
   * Mount required MCP servers and return the IDs of servers that were
   * mounted or already connected.
   */
  const mountRequiredServers = useCallback(async (skill: AgentSkill): Promise<string[]> => {
    const mountedServerIds: string[] = [];
    needsManualConnect.current = false;
    if (!skill.requiredServers || skill.requiredServers.length === 0) return mountedServerIds;

    // Fetch existing servers once
    const existingRes = await fetch("/api/mcp/servers").then((r) => r.json());
    const existingServers = existingRes.data || [];

    const serverNamesToMount =
      skill.requiredServers && skill.requiredServers.length > 0
        ? skill.requiredServers
        : [
            skill.name.replace(/ (Automation|Toolkit|Skill)$/i, ""),
            ...(skill.tags || []).slice(0, 2),
          ].filter(Boolean);

    for (const serverName of serverNamesToMount) {
      // Check if a matching server is already connected
      const cleanServerName = serverName.toLowerCase().replace(/ \((composio|arcade)\)/gi, "");
      const alreadyConnected = existingServers.find((s: { name: string; status: string; id: string }) =>
        s.name.toLowerCase().includes(cleanServerName) &&
        (s.status === "CONNECTED" || s.status === "READY")
      );

      if (alreadyConnected) {
        mountedServerIds.push(alreadyConnected.id);
        continue;
      }

      // ── Composio auto-mount ──
      if (skill.source === "composio") {
        const slug = cleanServerName.replace(/ /g, "-");
        try {
          const sessionRes = await fetch("/api/mcp/composio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toolkits: [slug] }),
          }).then((r) => r.json());

          if (sessionRes.success && sessionRes.data?.mcpUrl) {
            const serverRes = await fetch("/api/mcp/servers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `${serverName} [Composio]`,
                transport: "SSE",
                endpointUrl: sessionRes.data.mcpUrl,
                headers: sessionRes.data.mcpHeaders || {},
                connectOnCreate: true,
              }),
            }).then((r) => r.json());

            if (serverRes.success && serverRes.data?.id) {
              mountedServerIds.push(serverRes.data.id);
            }
          }
        } catch (err) {
          console.warn("[Marketplace] Failed to auto-mount Composio server:", err);
        }
      } else if (skill.source === "arcade") {
        // ── Arcade auto-mount ──
        const slug = cleanServerName.replace(/ /g, "-");
        try {
          const sessionRes = await fetch("/api/mcp/arcade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ integration: slug }),
          }).then((r) => r.json());

          if (sessionRes.success && sessionRes.data?.mcpUrl) {
            const serverRes = await fetch("/api/mcp/servers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `${serverName} [Arcade]`,
                transport: "SSE",
                endpointUrl: sessionRes.data.mcpUrl,
                headers: sessionRes.data.mcpHeaders || {},
                connectOnCreate: true,
              }),
            }).then((r) => r.json());

            if (serverRes.success && serverRes.data?.id) {
              mountedServerIds.push(serverRes.data.id);
            }
          }
        } catch (err) {
          console.warn("[Marketplace] Failed to auto-mount Arcade server:", err);
        }
      } else {
        // ── Smithery, Glama, MCP.SO, Awesome-MCP: search directory for a matching server ──
        try {
          const dirRes = await fetch(`/api/mcp/directory?q=${encodeURIComponent(cleanServerName)}&source=ALL`).then((r) => r.json());
          const match = ((dirRes.data || []) as Array<{ name: string; id: string; endpointUrl?: string; command?: string }>).find((s) =>
            s.name.toLowerCase().includes(cleanServerName) ||
            cleanServerName.includes(s.name.toLowerCase().replace(/ mcp$/i, ""))
          );

          if (match) {
            const transport = match.endpointUrl ? "SSE" : "STDIO";
            const command = match.command || (transport === "STDIO" ? `npx -y ${match.id.replace(/^pub-/, "")}` : undefined);
            const body: Record<string, unknown> = {
              name: match.name,
              transport,
              // SECURITY: a STDIO server means Agent Studio will SPAWN the
              // configured command. Auto-running `npx -y <package>` from
              // marketplace metadata executed unreviewed third-party code at
              // install time. Remote (SSE) servers still auto-connect; STDIO
              // entries are created disconnected for explicit user consent.
              connectOnCreate: transport === "SSE",
            };
            if (transport === "SSE" && match.endpointUrl) body.endpointUrl = match.endpointUrl;
            if (transport === "STDIO" && command) body.command = command;

            const serverRes = await fetch("/api/mcp/servers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).then((r) => r.json());

            if (serverRes.success && serverRes.data?.id) {
              mountedServerIds.push(serverRes.data.id);
              if (transport === "STDIO") {
                needsManualConnect.current = true;
              }
            }
          }
        } catch (err) {
          console.warn("[Marketplace] Failed to auto-mount server:", err);
        }
      }
    }

    return mountedServerIds;
  }, []);

  /**
   * Full install: mount MCP servers → create Skill in DB → update state.
   */
  const refreshInstalledSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        const items = (json.data.items as SkillDTO[]).filter((item) => item.status !== "ARCHIVED");
        setInstalledDbSkills(items);
        const map = new Map<string, string>();
        for (const item of items) {
          const notes = item.currentDraft?.notes || item.publishedVersion?.notes || "";
          const match = notes.match(/ID:\s*([^\s\n\r]+)/);
          if (match) {
            const rawId = match[1];
            const cleanId = rawId.replace(/[.,;:]$/, "");
            map.set(rawId, item.id);
            map.set(cleanId, item.id);
          }
          if (item.name) {
            map.set(item.name.toLowerCase().trim(), item.id);
          }
          map.set(item.id, item.id);
        }
        setInstalledMap(map);
        saveInstalledMap(map);
      }
    } catch {}
  }, []);

  // Sync installedMap and installedDbSkills from DB on mount
  useEffect(() => {
    refreshInstalledSkills();
  }, [refreshInstalledSkills]);

  const handleInstall = useCallback(async (skill: AgentSkill) => {
    const marketplaceId = skill.id;

    // Already installed — do nothing (uninstall is a separate action)
    if (installedMap.has(marketplaceId)) return;

    try {
      setInstalling(marketplaceId);

      // 1. Mount required MCP servers
      const mountedServerIds = await mountRequiredServers(skill);

      // 2. Create a real Skill record in the database via POST /api/skills
      const allowedTools = buildAllowedTools(skill, mountedServerIds);
      const safeName = (skill.name?.trim() || "Marketplace Skill").slice(0, 100);
      const validName = safeName.length >= 2 ? safeName : `${safeName} Tool`;
      const rawPurpose = skill.description?.trim() || `Marketplace skill: ${validName}`;
      const safePurpose = (rawPurpose.length >= 5 ? rawPurpose : `Marketplace skill: ${validName}`).slice(0, 1000);
      const safeInstructions = buildInstructions(skill).slice(0, 20000);

      const createRes = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: validName,
          purpose: safePurpose,
          instructions: safeInstructions,
          allowedTools,
          maxExecutionSteps: Math.max(10, (skill.steps?.length || 1) * 3),
          // Structured linkage: marketplaceId drives installed-state
          // reconciliation; MountedServers lets uninstall clean up the MCP
          // servers auto-mounted for this skill (previously orphaned rows +
          // live connections were left behind).
          notes: `Installed from ${skill.source} marketplace. ID: ${marketplaceId}${
            mountedServerIds.length > 0 ? `. MountedServers: ${mountedServerIds.join(",")}` : ""
          }`,
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to create skill (HTTP ${createRes.status})`);
      }

      const createJson = await createRes.json();
      if (!createJson.success || !createJson.data?.id) {
        throw new Error("Failed to create skill record");
      }

      const dbSkillId = createJson.data.id as string;

      // 3. Persist the marketplace→DB mapping
      setInstalledMap((prev) => {
        const next = new Map(prev);
        next.set(marketplaceId, dbSkillId);
        saveInstalledMap(next);
        return next;
      });

      // 4. Invalidate skills query and re-sync installed skills
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      await refreshInstalledSkills();

      if (needsManualConnect.current) {
        toast.info(
          "Action needed: connect local server",
          "A local (STDIO) MCP server was added but NOT started — review its command in the MCP Hub and click Connect."
        );
      } else {
        toast.success("Skill installed", `${validName} is now available in Skills Studio`);
      }
    } catch (err) {
      console.error("[Marketplace] Install failed:", err);
      toast.error("Install failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setInstalling(null);
    }
  }, [installedMap, mountRequiredServers, queryClient, refreshInstalledSkills]);

  /**
   * Uninstall: delete/archive the Skill from DB, clean up the MCP servers that were
   * auto-mounted for it, and remove from installed map.
   */
  const handleUninstall = useCallback(async (skill: AgentSkill) => {
    const marketplaceId = skill.id;
    const cleanId = marketplaceId ? marketplaceId.replace(/[.,;:]$/, "") : "";
    const cleanName = skill.name?.toLowerCase().trim() || "";

    // 1. Resolve the database skill ID
    let dbSkillId =
      installedMap.get(marketplaceId) ||
      (cleanId ? installedMap.get(cleanId) : undefined) ||
      (cleanName ? installedMap.get(cleanName) : undefined);

    if (!dbSkillId) {
      const match = installedDbSkills.find(
        (s) =>
          s.id === marketplaceId ||
          s.id === cleanId ||
          (cleanName && s.name.toLowerCase().trim() === cleanName) ||
          (cleanId && (s.currentDraft?.notes || s.publishedVersion?.notes || "").includes(`ID: ${cleanId}`)) ||
          (marketplaceId && (s.currentDraft?.notes || s.publishedVersion?.notes || "").includes(`ID: ${marketplaceId}`))
      );
      if (match) {
        dbSkillId = match.id;
      }
    }

    try {
      setInstalling(marketplaceId);

      if (dbSkillId) {
        // Resolve the DB skill row to find mounted server IDs
        const skillRes = await fetch(`/api/skills/${dbSkillId}`).then((r) => (r.ok ? r.json() : null));
        const notes: string = skillRes?.data?.currentDraft?.notes || skillRes?.data?.publishedVersion?.notes || "";
        const mountedMatch = notes.match(/MountedServers:\s*([^\s\n\r]+)/);
        const mountedIds = mountedMatch
          ? mountedMatch[1]
              .split(",")
              .map((s) => s.trim().replace(/[.,;:]$/, ""))
              .filter(Boolean)
          : [];

        // 1. Clean up auto-mounted MCP servers (404-tolerant)
        for (const serverId of mountedIds) {
          await fetch(`/api/mcp/servers/${serverId}`, { method: "DELETE" }).catch(() => {});
        }

        // 2. Delete the skill from the database; if published or restricted, archive it
        const delRes = await fetch(`/api/skills/${dbSkillId}`, { method: "DELETE" });
        if (!delRes.ok && delRes.status !== 404) {
          const archiveRes = await fetch(`/api/skills/${dbSkillId}/archive`, { method: "POST" });
          if (!archiveRes.ok && archiveRes.status !== 404) {
            const errBody = await delRes.json().catch(() => ({}));
            throw new Error(errBody.error || `Failed to uninstall skill (HTTP ${delRes.status})`);
          }
        }
      }

      // 3. Remove from installedMap and localStorage
      setInstalledMap((prev) => {
        const next = new Map(prev);
        next.delete(marketplaceId);
        if (cleanId) next.delete(cleanId);
        if (cleanName) next.delete(cleanName);
        if (dbSkillId) next.delete(dbSkillId);
        saveInstalledMap(next);
        return next;
      });

      // 4. Invalidate skills queries & refresh installed skills list
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      await refreshInstalledSkills();

      toast.success(
        "Skill uninstalled",
        `${skill.name} has been removed from your workspace`
      );
    } catch (err) {
      console.error("[Marketplace] Uninstall failed:", err);
      toast.error("Uninstall failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setInstalling(null);
    }
  }, [installedMap, installedDbSkills, queryClient, refreshInstalledSkills]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            SKILLS MARKETPLACE
          </h2>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            Discover and install pre-configured agent skills from Glama, MCP.SO &amp; Smithery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-500 px-2 py-1 rounded border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40">
            {skills.length} OF {totalCount > 0 ? totalCount.toLocaleString() : skills.length} SKILLS LOADED
          </span>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-slate-100 dark:bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => handleToggleViewMode("grid")}
              className={clsx(
                "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                viewMode === "grid"
                  ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode("list")}
              className={clsx(
                "p-1.5 rounded text-xs font-mono transition-all cursor-pointer",
                viewMode === "list"
                  ? "bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
              title="Row List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills (e.g. research, database, github, slack)..."
            className="w-full pl-9 pr-8 py-2 text-xs font-mono rounded border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Source Pills + Installed Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[9px] font-mono text-slate-500 font-semibold">SOURCE:</span>
          {SOURCES.map((src) => {
            const active = source === src.id;
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => setSource(src.id)}
                className={clsx(
                  "px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                  active
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
                )}
              >
                {src.label}
              </button>              )
            ;
          })}
          <div className="w-px h-4 bg-slate-200 dark:bg-indigo-900/50 mx-0.5" />
          <button
            type="button"
            onClick={() => setShowInstalledOnly((p) => !p)}
            className={clsx(
              "inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
              showInstalledOnly
                ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-emerald-400"
            )}
          >
            <Check className="h-3 w-3" />
            INSTALLED
            {installedMap.size > 0 && (
              <span className="opacity-75 font-normal">({installedMap.size})</span>
            )}
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={clsx(
                  "inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                  active
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-600 dark:text-slate-400 hover:border-indigo-400"
                )}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Difficulty Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-slate-500 font-semibold">LEVEL:</span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={clsx(
                "px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                difficulty === d.id
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 dark:border-indigo-900/50 bg-white/70 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="ml-2 text-xs font-mono text-slate-500">Loading skills...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-xs font-mono text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Skills Grid / Row List */}
      {!loading && !error && (
        <>
          {viewMode === "grid" ? (
            /* ────────────── Grid / Card View ────────────── */
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSkills.map((skill) => {
                const isInstalled = isSkillInstalled(skill);
                const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.PRODUCTIVITY;
                const diffColor = DIFFICULTY_COLORS[skill.difficulty] || DIFFICULTY_COLORS.BEGINNER;
                const srcColor = SOURCE_COLORS[skill.source] || SOURCE_COLORS.glama;

                return (
                  <div
                    key={skill.id}
                    onClick={() => setDetailSkill(skill)}
                    className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-lg transition-all p-4 flex flex-col justify-between space-y-3 cursor-pointer"
                  >
                    {/* Top */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <ItemIcon
                            name={skill.name}
                            category={skill.category}
                            tags={skill.tags}
                            owner={skill.author}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {skill.name}
                            </h3>
                            <p className="text-[9px] font-mono text-slate-500">
                              by <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.author}</span>
                            </p>
                          </div>
                        </div>
                        {isInstalled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shrink-0">
                            <Check className="h-2.5 w-2.5" /> INSTALLED
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {skill.description}
                      </p>

                      {/* Tags & Source */}
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", srcColor)}>
                          {skill.source === "smithery" ? "SMITHERY" : skill.source === "glama" ? "GLAMA" : skill.source === "mcp.so" ? "MCP.SO" : skill.source}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", catColor)}>
                          {skill.category}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", diffColor)}>
                          {skill.difficulty}
                        </span>
                        {skill.tags.slice(0, 2).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-slate-100 dark:bg-black/50 text-slate-500 border border-slate-200 dark:border-indigo-950">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-2 border-t border-slate-100 dark:border-indigo-950/60">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          {typeof skill.rating === "number" && (<><Star className="h-3 w-3 fill-amber-400" /> {skill.rating}</>)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          {typeof skill.installs === "number" && (<><Download className="h-3 w-3" /> {skill.installs.toLocaleString()}</>)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {skill.estimatedTime}
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-400">{skill.steps.length} steps</span>
                    </div>

                    {/* Install / Uninstall Buttons */}
                    {isInstalled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUninstall(skill);
                        }}
                        disabled={installing === skill.id}
                        className={clsx(
                          "w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                          installing === skill.id ? "opacity-60 cursor-wait" : "",
                          "border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60"
                        )}
                      >
                        {installing === skill.id ? <><Loader2 className="h-3 w-3 animate-spin" /> REMOVING...</> : <><Trash2 className="h-3 w-3" /> UNINSTALL</>}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstall(skill);
                        }}
                        disabled={installing === skill.id}
                        className={clsx(
                          "w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer",
                          installing === skill.id ? "opacity-60 cursor-wait" : "",
                          "border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
                        )}
                      >
                        {installing === skill.id ? <><Loader2 className="h-3 w-3 animate-spin" /> INSTALLING...</> : <><Plus className="h-3 w-3" /> INSTALL SKILL</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ────────────── Row / List View ────────────── */
            <div ref={gridRef} className="space-y-2.5">
              {filteredSkills.map((skill) => {
                const isInstalled = isSkillInstalled(skill);
                const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.PRODUCTIVITY;
                const diffColor = DIFFICULTY_COLORS[skill.difficulty] || DIFFICULTY_COLORS.BEGINNER;
                const srcColor = SOURCE_COLORS[skill.source] || SOURCE_COLORS.glama;

                return (
                  <div
                    key={skill.id}
                    onClick={() => setDetailSkill(skill)}
                    className="group rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/60 dark:hover:border-indigo-500/50 hover:shadow-md transition-all p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 cursor-pointer"
                  >
                    {/* Left: Info, Badges, Description */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ItemIcon
                          name={skill.name}
                          category={skill.category}
                          tags={skill.tags}
                          owner={skill.author}
                          size="xs"
                        />
                        <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {skill.name}
                        </h3>
                        <span className="text-[9px] font-mono text-slate-500">
                          by <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.author}</span>
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", srcColor)}>
                          {skill.source === "smithery" ? "SMITHERY" : skill.source === "glama" ? "GLAMA" : skill.source === "mcp.so" ? "MCP.SO" : skill.source}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", catColor)}>
                          {skill.category}
                        </span>
                        <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border", diffColor)}>
                          {skill.difficulty}
                        </span>
                        {isInstalled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 shrink-0">
                            <Check className="h-2.5 w-2.5" /> INSTALLED
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400 line-clamp-1 leading-relaxed">
                        {skill.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 text-[8px] font-mono text-slate-400">
                        {skill.tags.slice(0, 3).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/50 text-slate-500 border border-slate-200 dark:border-indigo-950">
                            #{t}
                          </span>
                        ))}
                        <span>•</span>
                        <span>{skill.steps.length} workflow steps</span>
                      </div>
                    </div>

                    {/* Right: Stats & Action */}
                    <div className="flex items-center justify-between md:justify-end gap-3.5 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-indigo-950/60">
                      <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          {typeof skill.rating === "number" && (<><Star className="h-3 w-3 fill-amber-400" /> {skill.rating}</>)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          {typeof skill.installs === "number" && (<><Download className="h-3 w-3" /> {skill.installs.toLocaleString()}</>)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {skill.estimatedTime}
                        </span>
                      </div>

                      {isInstalled ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUninstall(skill);
                          }}
                          disabled={installing === skill.id}
                          className={clsx(
                            "inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 min-w-[90px]",
                            installing === skill.id ? "opacity-60 cursor-wait" : "",
                            "border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60"
                          )}
                        >
                          {installing === skill.id ? <><Loader2 className="h-3 w-3 animate-spin" /> ...</> : <><Trash2 className="h-3 w-3" /> REMOVE</>}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstall(skill);
                          }}
                          disabled={installing === skill.id}
                          className={clsx(
                            "inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 min-w-[90px]",
                            installing === skill.id ? "opacity-60 cursor-wait" : "",
                            "border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
                          )}
                        >
                          {installing === skill.id ? <><Loader2 className="h-3 w-3 animate-spin" /> ...</> : <><Plus className="h-3 w-3" /> INSTALL</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!showInstalledOnly && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => {
                setCurrentPage(p);
                fetchPage(p);
              }}
              loading={loading}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && filteredSkills.length === 0 && (
        <div className="text-center py-12">
          <Sparkles className="h-8 w-8 text-indigo-400 mx-auto" />
          <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-3">NO SKILLS FOUND</p>
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            {showInstalledOnly ? "No installed skills match this filter." : `No skills matching "${search}" in this category.`}
          </p>
        </div>
      )}

      {/* Skill Detail Modal */}
      {detailSkill && (
        <SkillDetailModal
          skill={detailSkill}
          isInstalled={isSkillInstalled(detailSkill)}
          onInstall={() => isSkillInstalled(detailSkill) ? handleUninstall(detailSkill) : handleInstall(detailSkill)}
          onClose={() => setDetailSkill(null)}
        />
      )}
    </div>
  );
}

/* ────────────── Skill Detail Modal ────────────── */

function SkillDetailModal({
  skill,
  isInstalled,
  onInstall,
  onClose,
}: {
  skill: AgentSkill;
  isInstalled: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.PRODUCTIVITY;
  const diffColor = DIFFICULTY_COLORS[skill.difficulty] || DIFFICULTY_COLORS.BEGINNER;
  const [sandboxOpen, setSandboxOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl shadow-indigo-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-indigo-950 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <ItemIcon
              name={skill.name}
              category={skill.category}
              tags={skill.tags}
              owner={skill.author}
              size="lg"
            />
            <div className="min-w-0">
              <h3 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                {skill.name}
              </h3>
              <p className="text-[10px] font-mono text-slate-500">
                by <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.author}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-indigo-950/60 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Description */}
          <div className="space-y-1.5">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold">DESCRIPTION</div>
            <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 leading-relaxed">
              {skill.description}
            </p>
          </div>

          {/* Tags & Stats */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border", SOURCE_COLORS[skill.source] || SOURCE_COLORS.glama)}>
              {skill.source === "smithery" ? "SMITHERY.AI" : skill.source === "glama" ? "GLAMA.AI" : skill.source === "mcp.so" ? "MCP.SO" : skill.source}
            </span>
            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border", catColor)}>
              {skill.category}
            </span>
            <span className={clsx("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border", diffColor)}>
              {skill.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
              {typeof skill.rating === "number" && (<><Star className="h-3 w-3 fill-amber-400" /> {skill.rating}</>)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400">
              {typeof skill.installs === "number" && (<><Download className="h-3 w-3" /> {skill.installs.toLocaleString()} installs</>)}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold border border-slate-200 dark:border-indigo-900/50 bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-400">
              <Clock className="h-3 w-3" /> {skill.estimatedTime}
            </span>
          </div>

          {/* Required Servers */}
          {skill.requiredServers.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> REQUIRED MCP SERVERS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skill.requiredServers.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> SKILL STEPS ({skill.steps.length})
            </div>
            <div className="space-y-2">
              {skill.steps.map((step) => (
                <div
                  key={step.order}
                  className="flex items-start gap-3 p-2.5 rounded border border-slate-200 dark:border-indigo-900/40 bg-slate-50/60 dark:bg-black/40"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-mono font-bold shrink-0">
                    {step.order}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {step.description}
                    </p>
                    {step.requiredTool && (
                      <p className="text-[8px] font-mono text-slate-500 mt-0.5">
                        Tool: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{step.requiredTool}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
            <span className="uppercase">Source:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{skill.source}</span>
            {skill.sourceUrl && (
              <a href={skill.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
                View <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-indigo-950 bg-slate-50/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm rounded-b-xl">
          <button
            type="button"
            onClick={() => setSandboxOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60"
          >
            <Play className="h-3 w-3" /> TEST RUN
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-300 dark:border-indigo-900/50 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:border-slate-400 transition-all cursor-pointer"
          >
            CLOSE
          </button>
          {isInstalled ? (
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60"
            >
              <Trash2 className="h-3 w-3" /> UNINSTALL
            </button>
          ) : (
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded border text-[10px] font-mono font-semibold uppercase tracking-wider transition-all cursor-pointer border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 active:scale-95"
            >
              <Plus className="h-3 w-3" /> INSTALL SKILL
            </button>
          )}
        </div>
      </div>

      {/* Live Sandbox Drawer */}
      <LiveSandbox
        skillName={skill.name}
        skillDescription={skill.description}
        steps={skill.steps}
        requiredServers={skill.requiredServers}
        isOpen={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
      />
    </div>
  );
}
