import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { AgentSkill, SkillCategory, SkillsFeedResponse } from "@/types/agent-studio-registry";
import {
  fetchAwesomeMcpPaginated,
  getCachedAwesomeMcpServers,
  fetchSmitheryPaginated,
  fetchAllComposioTools,
  fetchComposioToolkits,
  AwesomeMcpServer,
  ComposioTool,
  ComposioToolkit,
} from "@/lib/fetch-utils";

export const revalidate = 300;

/**
 * Maps raw server/skill categories to our normalized SkillCategory type.
 */
function mapSkillCategory(raw: string): SkillCategory {
  const upper = (raw || "").toUpperCase();
  if (upper.includes("RESEARCH") || upper.includes("ACADEMIC") || upper.includes("WRITING")) return "RESEARCH";
  if (upper.includes("CODE") || upper.includes("DEV") || upper.includes("PROGRAM") || upper.includes("GIT")) return "CODING";
  if (upper.includes("DATA") || upper.includes("ANALYT") || upper.includes("STAT") || upper.includes("DATABASE") || upper.includes("SQL") || upper.includes("SPREADSHEET")) return "DATA";
  if (upper.includes("CREAT") || upper.includes("DESIGN") || upper.includes("ART") || upper.includes("MEDIA") || upper.includes("IMAGE") || upper.includes("VIDEO")) return "CREATIVE";
  if (upper.includes("PRODUCT") || upper.includes("TASK") || upper.includes("WORK") || upper.includes("UTILITY")) return "PRODUCTIVITY";
  if (upper.includes("COMMUN") || upper.includes("CHAT") || upper.includes("EMAIL") || upper.includes("SLACK") || upper.includes("DISCORD")) return "COMMUNICATION";
  if (upper.includes("AUTOM") || upper.includes("WORKFLOW") || upper.includes("PIPE") || upper.includes("INTEGRATION")) return "AUTOMATION";
  if (upper.includes("ANAL") || upper.includes("AI") || upper.includes("ML") || upper.includes("AGENT")) return "ANALYSIS";
  if (upper.includes("KNOWLEDG") || upper.includes("DOCS") || upper.includes("RAG") || upper.includes("SEARCH")) return "KNOWLEDGE";
  return "PRODUCTIVITY";
}

/**
 * Transforms an AwesomeMcpServer into an executable AgentSkill
 */
function serverToSkill(server: AwesomeMcpServer): AgentSkill {
  const cleanName = server.name.replace(/\s+MCP$/i, "");
  return {
    id: `${server.source}-${server.id}`,
    name: `${cleanName} Automation`,
    description: server.description || `Integrate and automate tasks using ${server.name}`,
    category: mapSkillCategory(server.category),
    author: server.owner || "community",
    source: server.source,
    sourceUrl: server.repoUrl,
    requiredServers: [server.name],
    requiredTools: [],
    tags: Array.from(new Set([server.source, ...(server.tags || [])])).slice(0, 5),
    // Real metrics only — fabricated stars/installs/ratings were previously
    // hardcoded per "verified" flag, which misinformed purchase decisions.
    ...(typeof server.stars === "number" ? { stars: server.stars } : {}),
    difficulty: server.requiresAuthToken ? "INTERMEDIATE" : "BEGINNER",
    estimatedTime: "3 min",
    steps: [
      {
        order: 1,
        action: "prepare",
        description: `Prepare ${server.name} integration context`,
      },
      {
        order: 2,
        action: "discover",
        description: `Auto-discover tools and schemas available on ${cleanName}`,
      },
      {
        order: 3,
        action: "execute",
        description: `Execute ${cleanName} capabilities in autonomous agent loop`,
      },
    ],
  };
}

/**
 * Convert a Composio toolkit into an AgentSkill.
 */
function composioToolkitToSkill(tk: ComposioToolkit): AgentSkill {
  return {
    id: `composio-tk-${tk.slug}`,
    name: `${tk.name} Toolkit`,
    description: tk.description || `Composio toolkit for ${tk.name} with ${tk.toolsCount} tools and managed OAuth.`,
    category: mapComposioSkillCategory(tk.categories.map((c) => c.name).join(" ")),
    author: "composio",
    source: "composio" as const,
    sourceUrl: tk.appUrl || `https://composio.dev/toolkits/${tk.slug}`,
    requiredServers: [`${tk.name} (Composio)`],
    requiredTools: [],
    tags: [...tk.categories.map((c) => c.name.toLowerCase()), "composio", "managed-auth", tk.slug].slice(0, 5),
    difficulty: tk.noAuth ? "BEGINNER" : "INTERMEDIATE",
    estimatedTime: "2 min",
    steps: [
      { order: 1, action: "connect", description: `Connect to ${tk.name} via Composio managed OAuth` },
      { order: 2, action: "discover", description: `Auto-discover ${tk.toolsCount} tools available in ${tk.name}` },
      { order: 3, action: "execute", description: `Execute ${tk.name} tools in your agent workflow` },
    ],
  };
}

/**
 * Convert a Composio individual tool into an AgentSkill.
 */
function composioToolToSkill(tool: ComposioTool): AgentSkill {
  const cleanName = tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const inputProps = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties as Record<string, unknown>) : [];
  return {
    id: `composio-tool-${tool.slug}`,
    name: cleanName,
    description: tool.description || `${cleanName} — action in ${tool.toolkitName} toolkit`,
    category: mapComposioSkillCategory(tool.category),
    author: tool.toolkitName,
    source: "composio" as const,
    sourceUrl: `https://composio.dev/toolkits/${tool.toolkitSlug}`,
    requiredServers: [`${tool.toolkitName} (Composio)`],
    requiredTools: [tool.slug],
    tags: ["composio", tool.toolkitSlug, tool.toolkitName.toLowerCase(), ...inputProps.slice(0, 2)].slice(0, 5),
    difficulty: inputProps.length > 4 ? "ADVANCED" : inputProps.length > 2 ? "INTERMEDIATE" : "BEGINNER",
    estimatedTime: "1 min",
    steps: [
      { order: 1, action: "configure", description: `Configure ${tool.toolkitName} authentication` },
      { order: 2, action: "execute", description: `Execute ${cleanName} with parameters: ${inputProps.join(", ")}` },
    ],
  };
}

/**
 * Map Composio category names to our SkillCategory type.
 */
function mapComposioSkillCategory(cat: string): SkillCategory {
  const lower = cat.toLowerCase();
  if (lower.includes("email") || lower.includes("mail") || lower.includes("slack") || lower.includes("discord") || lower.includes("chat")) return "COMMUNICATION";
  if (lower.includes("code") || lower.includes("git") || lower.includes("developer") || lower.includes("ide")) return "CODING";
  if (lower.includes("data") || lower.includes("analytics") || lower.includes("database") || lower.includes("sql")) return "DATA";
  if (lower.includes("research") || lower.includes("academic") || lower.includes("paper")) return "RESEARCH";
  if (lower.includes("ai") || lower.includes("agent") || lower.includes("llm") || lower.includes("ml")) return "ANALYSIS";
  if (lower.includes("product") || lower.includes("task") || lower.includes("project")) return "PRODUCTIVITY";
  if (lower.includes("design") || lower.includes("image") || lower.includes("video") || lower.includes("media")) return "CREATIVE";
  if (lower.includes("autom") || lower.includes("workflow") || lower.includes("integration")) return "AUTOMATION";
  if (lower.includes("knowledg") || lower.includes("note") || lower.includes("doc")) return "KNOWLEDGE";
  return "PRODUCTIVITY";
}

function smitheryItemToSkill(s: Record<string, unknown>): AgentSkill {
  const qualityScore = typeof s.qualityScore === "number" ? s.qualityScore : 0.8;
  const categories = Array.isArray(s.categories) ? (s.categories as string[]) : [];
  const servers = Array.isArray(s.servers) ? (s.servers as string[]) : [];
  return {
    id: `smithery-${String(s.id ?? "")}`,
    name: String(s.displayName || s.slug || "Smithery Skill"),
    description: String(s.description || ""),
    category: mapSkillCategory(categories[0] || ""),
    author: String(s.namespace || "smithery"),
    source: "smithery" as const,
    sourceUrl: s.gitUrl ? String(s.gitUrl) : undefined,
    requiredServers: servers,
    requiredTools: [],
    tags: ["smithery", ...categories, ...servers].slice(0, 5),
    // Real Smithery metrics when present; undefined (not zero/fabricated)
    // otherwise so the UI hides the badge entirely.
    ...(typeof s.externalStars === "number" && s.externalStars > 0 ? { stars: s.externalStars } : {}),
    ...(typeof s.totalActivations === "number" && s.totalActivations > 0 ? { installs: s.totalActivations } : {}),
    ...(typeof s.qualityScore === "number"
      ? { rating: Math.min(5, Math.max(1, Math.round(s.qualityScore * 5))) }
      : {}),
    difficulty: (qualityScore > 0.9 ? "ADVANCED" : qualityScore > 0.7 ? "INTERMEDIATE" : "BEGINNER") as AgentSkill["difficulty"],
    estimatedTime: "5 min",
    steps: [
      { order: 1, action: "execute", description: `Execute ${String(s.displayName || s.slug || "skill")} capabilities` },
      { order: 2, action: "process", description: "Process results and generate output" },
      { order: 3, action: "deliver", description: "Deliver final response to user" },
    ],
  };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase().trim() || "";
  const category = searchParams.get("category") || "ALL";
  const difficulty = searchParams.get("difficulty") || "ALL";
  const source = searchParams.get("source") || "ALL"; // "ALL" | "glama" | "mcp.so" | "smithery" | "composio"
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "50", 10) || 50));

  // 0. Dedicated Composio Flow (toolkits + tools)
  if (source === "composio") {
    const [toolkits, tools] = await Promise.all([
      fetchComposioToolkits(),
      fetchAllComposioTools(500),
    ]);

    // Convert Composio toolkits to skills
    let composioSkills: AgentSkill[] = toolkits.map((tk) => composioToolkitToSkill(tk));

    // Also add individual tools as skills (for the most popular ones)
    const toolSkills = tools.slice(0, 200).map((t) => composioToolToSkill(t));
    composioSkills = [...composioSkills, ...toolSkills];

    // Apply search filter
    if (query) {
      composioSkills = composioSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (category !== "ALL") {
      composioSkills = composioSkills.filter((s) => s.category === category);
    }

    // Apply difficulty filter
    if (difficulty !== "ALL") {
      composioSkills = composioSkills.filter((s) => s.difficulty === difficulty);
    }

    // Paginate
    const totalCount = composioSkills.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const items = composioSkills.slice(startIndex, startIndex + pageSize);

    const categoryCounts = new Map<SkillCategory, number>();
    for (const s of items) {
      categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1);
    }

    return NextResponse.json({
      success: true,
      total: items.length,
      data: items,
      categories: Array.from(categoryCounts.entries()).map(([id, count]) => ({ id, count })),
      pagination: { page, pageSize, totalPages, totalCount, hasMore: page < totalPages },
    });
  }

  // 1. Dedicated Glama or MCP.SO Paginated Flow
  if (source === "glama" || source === "mcp.so") {
    const paginated = await fetchAwesomeMcpPaginated<AgentSkill>({
      source,
      page,
      pageSize,
      query,
      category: category !== "ALL" ? category : undefined,
      mapItem: serverToSkill,
    });

    let items = paginated.items;
    if (difficulty !== "ALL") {
      items = items.filter((s) => s.difficulty === difficulty);
    }

    const categoryCounts = new Map<SkillCategory, number>();
    for (const s of items) {
      categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1);
    }

    const response: SkillsFeedResponse = {
      success: true,
      total: items.length,
      data: items,
      categories: Array.from(categoryCounts.entries()).map(([id, count]) => ({ id, count })),
      pagination: {
        page: paginated.page,
        pageSize: paginated.pageSize,
        totalPages: paginated.totalPages,
        totalCount: paginated.totalCount,
        hasMore: paginated.hasMore,
      },
    };

    return NextResponse.json(response);
  }

  // 2. Dedicated Smithery.ai Paginated Flow
  if (source === "smithery") {
    const smitheryResult = await fetchSmitheryPaginated<AgentSkill>({
      endpoint: "skills",
      page,
      pageSize,
      query,
      mapItem: smitheryItemToSkill,
    });

    let items = smitheryResult.items;
    if (category !== "ALL") {
      items = items.filter((s) => s.category === category);
    }
    if (difficulty !== "ALL") {
      items = items.filter((s) => s.difficulty === difficulty);
    }

    const categoryCounts = new Map<SkillCategory, number>();
    for (const s of items) {
      categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1);
    }

    const response: SkillsFeedResponse = {
      success: true,
      total: items.length,
      data: items,
      categories: Array.from(categoryCounts.entries()).map(([id, count]) => ({ id, count })),
      pagination: {
        page: smitheryResult.page,
        pageSize: smitheryResult.pageSize,
        totalPages: smitheryResult.totalPages,
        totalCount: smitheryResult.totalCount,
        hasMore: smitheryResult.hasMore,
      },
    };

    return NextResponse.json(response);
  }

  // 3. Combined Flow ("ALL" Sources) with unified 50-item page slicing & caching
  const allStaticServers = await getCachedAwesomeMcpServers();
  let staticSkills = allStaticServers.map(serverToSkill);

  // Apply filters to static skills
  if (category !== "ALL") {
    staticSkills = staticSkills.filter((s) => s.category === category);
  }
  if (difficulty !== "ALL") {
    staticSkills = staticSkills.filter((s) => s.difficulty === difficulty);
  }
  if (query) {
    staticSkills = staticSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query)) ||
        s.author.toLowerCase().includes(query)
    );
  }

  // Fetch Smithery page for current page
  const smitheryResult = await fetchSmitheryPaginated<AgentSkill>({
    endpoint: "skills",
    page,
    pageSize,
    query,
    mapItem: smitheryItemToSkill,
  });

  let smitheryItems = smitheryResult.items;
  if (category !== "ALL") {
    smitheryItems = smitheryItems.filter((s) => s.category === category);
  }
  if (difficulty !== "ALL") {
    smitheryItems = smitheryItems.filter((s) => s.difficulty === difficulty);
  }

  // Slice static skills for this page
  const staticStartIndex = (page - 1) * pageSize;
  const staticSlice = staticSkills.slice(staticStartIndex, staticStartIndex + pageSize);

  // Combine static slice and smithery items, ensuring exactly up to pageSize items
  let pageItems: AgentSkill[] = [];
  if (staticSlice.length > 0) {
    pageItems = [...staticSlice];
    // Fill remainder with smithery items if needed
    if (pageItems.length < pageSize && smitheryItems.length > 0) {
      const needed = pageSize - pageItems.length;
      pageItems = [...pageItems, ...smitheryItems.slice(0, needed)];
    }
  } else {
    pageItems = smitheryItems;
  }

  // Deduplicate
  const seen = new Set<string>();
  const dedupedItems = pageItems.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  const totalCalculated = staticSkills.length + smitheryResult.totalCount;
  const totalPages = Math.ceil(totalCalculated / pageSize) || 1;
  const hasMore = page < totalPages;

  const categoryCounts = new Map<SkillCategory, number>();
  for (const s of dedupedItems) {
    categoryCounts.set(s.category, (categoryCounts.get(s.category) || 0) + 1);
  }

  const response: SkillsFeedResponse = {
    success: true,
    total: dedupedItems.length,
    data: dedupedItems,
    categories: Array.from(categoryCounts.entries()).map(([id, count]) => ({ id, count })),
    pagination: {
      page,
      pageSize,
      totalPages,
      totalCount: totalCalculated,
      hasMore,
    },
  };

  return NextResponse.json(response);
}
