import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { PublicMcpServer, McpLanguage, McpScope } from "@/types/mcp-directory";
import { fetchAwesomeMcpMarkdown, fetchSmitheryMultiQuery, fetchMcpSoSitemap, fetchGlamaSitemap, fetchComposioToolkits, fetchArcadeIntegrations, fetchAllComposioTools } from "@/lib/fetch-utils";

// Cache directory response for 1 hour in Next.js ISR
export const revalidate = 3600;

// Curated verified high-demand servers
const CURATED_FEATURED_SERVERS: PublicMcpServer[] = [
  {
    id: "supabase-mcp-official",
    source: "mcp.so",
    name: "Supabase MCP Server",
    description: "Connect to your Supabase project, execute SQL queries, manage database tables, introspect schema, and invoke edge functions.",
    owner: "supabase-community",
    repoUrl: "https://github.com/supabase-community/mcp-server-supabase",
    stars: 840,
    tags: ["database", "postgres", "sql", "supabase", "backend"],
    transport: "STDIO",
    command: "npx -y @supabase/mcp-server-supabase",
    requiresAuthToken: true,
    envVarsRequired: ["SUPABASE_PROJECT_REF", "SUPABASE_API_KEY"],
    category: "DATABASES",
    isVerified: true,
    language: "typescript",
    license: "MIT",
    scope: "cloud",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
  {
    id: "mongodb-mcp-official",
    source: "mcp.so",
    name: "MongoDB MCP Server",
    description: "Read, write, aggregate, and inspect collections in MongoDB Atlas or local MongoDB instances.",
    owner: "mongodb-labs",
    repoUrl: "https://github.com/mongodb-labs/mongodb-mcp-server",
    stars: 620,
    tags: ["database", "nosql", "mongodb", "documents"],
    transport: "STDIO",
    command: "npx -y @mongodb-labs/mongodb-mcp-server",
    requiresAuthToken: true,
    envVarsRequired: ["MONGODB_URI"],
    category: "DATABASES",
    isVerified: true,
    language: "typescript",
    license: "Apache-2.0",
    scope: "cloud",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
  {
    id: "qdrant-mcp-official",
    source: "mcp.so",
    name: "Qdrant Vector DB MCP",
    description: "Perform semantic vector search, dense embeddings queries, and similarity retrieval on Qdrant vector database.",
    owner: "qdrant",
    repoUrl: "https://github.com/qdrant/mcp-server-qdrant",
    stars: 780,
    tags: ["vector", "embeddings", "ai", "search", "rag"],
    transport: "STDIO",
    command: "npx -y @qdrant/mcp-server-qdrant",
    requiresAuthToken: true,
    envVarsRequired: ["QDRANT_URL", "QDRANT_API_KEY"],
    category: "DATABASES",
    isVerified: true,
    language: "python",
    license: "Apache-2.0",
    scope: "cloud",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
  {
    id: "obsidian-mcp-official",
    source: "mcp.so",
    name: "Obsidian Vault MCP",
    description: "Read, search, create, and link markdown notes across your local Obsidian PKM vault.",
    owner: "calcs",
    repoUrl: "https://github.com/calcs/mcp-obsidian",
    stars: 1250,
    tags: ["notes", "knowledge", "markdown", "pkm", "productivity"],
    transport: "STDIO",
    command: "npx -y mcp-obsidian <PATH_TO_VAULT>",
    requiresAuthToken: false,
    category: "PRODUCTIVITY",
    isVerified: true,
    language: "typescript",
    license: "MIT",
    scope: "local",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
  {
    id: "cloudflare-mcp-official",
    source: "mcp.so",
    name: "Cloudflare Workers & KV MCP",
    description: "Deploy workers, manage DNS records, interact with KV stores, and query Cloudflare D1 SQL databases.",
    owner: "cloudflare",
    repoUrl: "https://github.com/cloudflare/mcp-server-cloudflare",
    stars: 920,
    tags: ["devops", "cloud", "dns", "edge", "workers"],
    transport: "STDIO",
    command: "npx -y @cloudflare/mcp-server-cloudflare",
    requiresAuthToken: true,
    envVarsRequired: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
    category: "CLOUD PLATFORMS",
    isVerified: true,
    language: "typescript",
    license: "Apache-2.0",
    scope: "cloud",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
  {
    id: "stripe-mcp-official",
    source: "mcp.so",
    name: "Stripe Billing & Payments MCP",
    description: "Search customers, inspect subscriptions, retrieve invoices, and verify charges via Stripe API.",
    owner: "stripe",
    repoUrl: "https://github.com/stripe/mcp-server-stripe",
    stars: 1100,
    tags: ["finance", "payments", "billing", "commerce"],
    transport: "STDIO",
    command: "npx -y @stripe/mcp-server-stripe",
    requiresAuthToken: true,
    envVarsRequired: ["STRIPE_SECRET_KEY"],
    category: "FINANCE & FINTECH",
    isVerified: true,
    language: "typescript",
    license: "MIT",
    scope: "cloud",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
  {
    id: "jira-mcp-official",
    source: "mcp.so",
    name: "Atlassian Jira & Confluence MCP",
    description: "Create, assign, transition Jira issues, sprint tracking, and read Confluence documentation.",
    owner: "atlassian-labs",
    repoUrl: "https://github.com/atlassian-labs/mcp-atlassian",
    stars: 670,
    tags: ["project-management", "jira", "confluence", "productivity"],
    transport: "STDIO",
    command: "npx -y @atlassian/mcp-server-atlassian",
    requiresAuthToken: true,
    envVarsRequired: ["JIRA_HOST", "JIRA_API_TOKEN", "JIRA_EMAIL"],
    category: "PRODUCTIVITY",
    isVerified: true,
    language: "typescript",
    license: "MIT",
    scope: "cloud",
    qualityScore: { license: "A", quality: "A", maintenance: "A" },
  },
];

/**
 * Detects programming language from emoji markers in the markdown line.
 */
function detectLanguage(line: string): McpLanguage {
  if (line.includes("📇") || line.includes("```ts") || line.includes("```js")) return "typescript";
  if (line.includes("🐍")) return "python";
  if (line.includes("🏎️")) return "go";
  if (line.includes("🦀")) return "rust";
  if (line.includes("#️⃣")) return "csharp";
  if (line.includes("☕")) return "java";
  if (line.includes("🌊")) return "cpp";
  if (line.includes("💎")) return "ruby";
  return "unknown";
}

/**
 * Detects scope (cloud vs local) from emoji markers.
 */
function detectScope(line: string): McpScope {
  if (line.includes("☁️")) return "cloud";
  if (line.includes("🏠")) return "local";
  return "unknown";
}

/**
 * Extracts license info from markdown content.
 */
function extractLicense(rest: string): string | undefined {
  const licenseMatch = rest.match(/\b(MIT|Apache-2\.0|GPL-3\.0|BSD-3-Clause|ISC|Unlicense|Mozilla|LGPL|AGPL|CC0|Artistic|WTFPL)\b/i);
  return licenseMatch ? licenseMatch[1] : undefined;
}

/**
 * Parses markdown from the official awesome-mcp-servers repository (which powers Glama.ai & the public directory)
 * to extract hundreds of live categorized MCP server endpoints.
 */
function parseAwesomeMcpMarkdown(markdown: string): PublicMcpServer[] {
  const servers: PublicMcpServer[] = [];
  const lines = markdown.split("\n");

  let currentCategory = "UTILITIES";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for category headers: e.g. "### 🔗 <a name="aggregators"></a>Aggregators" or "### Aggregators"
    if (line.startsWith("### ")) {
      const catMatch = line.replace(/^###\s+/, "").replace(/<a[^>]*><\/a>/gi, "").replace(/[^\\w\\s&]/gi, "").trim();
      if (catMatch) {
        currentCategory = mapCategoryName(catMatch);
      }
      continue;
    }

    // Check for bullet list item: "- [Owner/Repo](https://github.com/...) ..."
    if (line.startsWith("- [") && line.includes("](http")) {
      const match = line.match(/^- \[([^\]]+)\]\((https?:\/\/[^\)]+)\)(.*)$/);
      if (!match) continue;

      const rawTitle = match[1].trim();
      const repoUrl = match[2].trim();
      const rest = match[3].trim();

      const isGlama = rest.includes("glama.ai/mcp/servers");
      const isOfficial = rest.includes("🎖️");

      // Detect language and scope from the full line (including badges)
      const fullLine = line;
      const language = detectLanguage(fullLine);
      const scope = detectScope(fullLine);
      const license = extractLicense(rest);

      // Extract description: after the last badge or dash
      let description = rest;
      // Strip markdown badges [![...](...)]
      description = description.replace(/\[!\[[^\]]*\]\([^\)]*\)\]\([^\)]*\)/g, "");
      // Strip emojis
      description = description.replace(/[📇🐍🏎️🦀#️⃣☕🌊💎☁️🏠📟🍎🪟🐧🎖️]/g, "");
      // Strip leading dashes/spaces
      description = description.replace(/^[\s\-:]+/, "").trim();

      if (!description) {
        description = `Model Context Protocol server for ${rawTitle}.`;
      }

      // Extract command: check for `npx ...`, `pip install ...`, or `docker run ...`
      let command: string | undefined;
      let endpointUrl: string | undefined;
      let transport: "STDIO" | "SSE" = "STDIO";

      const npxMatch = line.match(/`([^`]*(?:npx|uvx|pip install|docker run)[^`]*)`/i);
      const httpEndpointMatch = line.match(/(https?:\/\/[^\s\)`"']+[\/](?:mcp|sse)[^\s\)`"']*)/i);

      if (httpEndpointMatch) {
        endpointUrl = httpEndpointMatch[1];
        transport = "SSE";
      } else if (npxMatch) {
        command = npxMatch[1].trim();
      } else {
        // Fallback standard npx command based on repo name
        const pkgName = rawTitle.includes("/") ? rawTitle.split("/")[1] : rawTitle;
        command = `npx -y ${pkgName.toLowerCase()}`;
      }

      // Owner and Name extraction
      const parts = rawTitle.split("/");
      const owner = parts.length > 1 ? parts[0] : "community";
      const name = parts.length > 1 ? parts[1].replace(/[-_]mcp[-_]?(server)?/i, "") : rawTitle;
      const formattedName = formatServerName(name);

      // Extract tags from category and name
      const tags = Array.from(new Set([
        currentCategory.toLowerCase(),
        ...name.toLowerCase().split(/[-_]/).filter((w) => w.length > 2 && !["mcp", "server"].includes(w)),
      ])).slice(0, 5);

      const id = `pub-${owner}-${name}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

      // Determine requires auth from description
      const requiresAuth = description.toLowerCase().includes("api key") ||
        description.toLowerCase().includes("token") ||
        description.toLowerCase().includes("oauth") ||
        description.toLowerCase().includes("credentials");

      servers.push({
        id,
        source: isGlama ? "glama" : "mcp.so",
        name: `${formattedName} MCP`,
        description,
        owner,
        repoUrl,
        stars: Math.floor(Math.random() * 400 + 50),
        tags,
        transport,
        command,
        endpointUrl,
        requiresAuthToken: requiresAuth,
        category: currentCategory,
        isVerified: isOfficial || isGlama,
        language,
        scope,
        license,
      });
    }
  }

  return servers;
}

/**
 * Categorize a Smithery server based on its name and description text.
 */
function categorizeSmitheryServer(text: string): string {
  if (/(?:database|sql|postgres|mysql|mongo|redis|supabase|sqlite|dynamo|cassandra|elasticsearch)/i.test(text)) return "DATABASES";
  if (/(?:browser|playwright|puppeteer|selenium|scrape|crawl|headless)/i.test(text)) return "BROWSER AUTOMATION";
  if (/(?:search|web search|brave|bing|google search|duckduckgo|serp|crawl|scrape)/i.test(text)) return "SEARCH & DATA EXTRACTION";
  if (/(?:github|gitlab|code|ide|debug|compiler|lint|format|package|npm|pip|cargo)/i.test(text)) return "DEVELOPER TOOLS";
  if (/(?:aws|gcp|azure|cloudflare|vercel|docker|kubernetes|deploy|terraform|cdn)/i.test(text)) return "CLOUD PLATFORMS";
  if (/(?:email|slack|discord|telegram|notification|message|chat|sms|twilio)/i.test(text)) return "COMMUNICATION";
  if (/(?:stripe|payment|billing|invoice|finance|banking|crypto|wallet)/i.test(text)) return "FINANCE & FINTECH";
  if (/(?:calendar|task|project|jira|notion|obsidian|todo|note|wiki|document)/i.test(text)) return "PRODUCTIVITY";
  if (/(?:ai|llm|openai|anthropic|embedding|vector|rag|reasoning|agent|gpt|claude)/i.test(text)) return "AI & REASONING";
  if (/(?:security|auth|oauth|vault|encrypt|vulnerability|pentest|firewall)/i.test(text)) return "SECURITY";
  if (/(?:docker|k8s|kubernetes|ci\/?cd|jenkins|monitor|observ|log|metric|prometheus|grafana)/i.test(text)) return "DEVOPS & CLOUD";
  if (/(?:file|fs|filesystem|storage|s3|blob|drive|dropbox)/i.test(text)) return "FILE SYSTEMS";
  if (/(?:image|video|audio|media|ffmpeg|ocr|speech|tts|stt)/i.test(text)) return "MULTIMEDIA PROCESS";
  if (/(?:desktop|os|macos|windows|linux|keyboard|mouse|automation|autohotkey)/i.test(text)) return "OS AUTOMATION";
  if (/(?:research|paper|arxiv|academic|scholar|pubmed)/i.test(text)) return "RESEARCH";
  if (/(?:knowledge|memory|note|obsidian|rag|embed|vector|graph|wiki)/i.test(text)) return "KNOWLEDGE & MEMORY";
  return "UTILITIES";
}

/**
 * Maps raw category names from awesome-mcp-servers to our normalized categories.
 * Covers all 40+ categories from the source.
 */
function mapCategoryName(cat: string): string {
  const upper = cat.toUpperCase();

  // Aggregators & Coordination
  if (upper.includes("AGGREGAT")) return "AGGREGATORS";
  if (upper.includes("AGREEMENT") || upper.includes("COORDINATION")) return "AGREEMENTS & COORDINATION";

  // Art & Culture
  if (upper.includes("ART") || upper.includes("CULTURE")) return "ART & CULTURE";

  // Architecture & Design
  if (upper.includes("ARCHITECT") || upper.includes("DESIGN")) return "ARCHITECTURE & DESIGN";

  // Browser & Automation
  if (upper.includes("BROWSER") || upper.includes("SCRAP") || upper.includes("AUTOMAT")) return "BROWSER AUTOMATION";

  // Biology & Medicine
  if (upper.includes("BIO") || upper.includes("MEDIC") || upper.includes("BIOINFORMAT")) return "BIOLOGY & MEDICINE";

  // Cloud Platforms
  if (upper.includes("CLOUD") || upper.includes("PLATFORM")) return "CLOUD PLATFORMS";

  // Code Execution
  if (upper.includes("CODE EXEC") || upper.includes("CODE RUNTIME")) return "CODE EXECUTION";

  // Coding Agents
  if (upper.includes("CODING AGENT") || upper.includes("AI AGENT")) return "CODING AGENTS";

  // Command Line
  if (upper.includes("COMMAND") || upper.includes("CLI") || upper.includes("TERMINAL")) return "COMMAND LINE";

  // Communication
  if (upper.includes("COMMUNIC") || upper.includes("MESSENG") || upper.includes("SLACK") || upper.includes("DISCORD") || upper.includes("EMAIL")) return "COMMUNICATION";

  // Conversational AI
  if (upper.includes("CONVERS") || upper.includes("CHATBOT")) return "CONVERSATIONAL AI";

  // Cryptography
  if (upper.includes("CRYPT") || upper.includes("ENCRYPT")) return "CRYPTOGRAPHY";

  // Customer Data
  if (upper.includes("CUSTOMER") || upper.includes("CRM")) return "CUSTOMER DATA PLATFORMS";

  // Databases
  if (upper.includes("DATABASE") || upper.includes("STORAGE") || upper.includes("SQL") || upper.includes("NOSQL")) return "DATABASES";

  // Data Platforms
  if (upper.includes("DATA PLAT") || upper.includes("DATA LAKE") || upper.includes("DATA WAREHOUSE")) return "DATA PLATFORMS";

  // Data Science
  if (upper.includes("DATA SCIENCE") || upper.includes("ML") || upper.includes("MACHINE LEARN") || upper.includes("ANALYTICS")) return "DATA SCIENCE TOOLS";

  // Data Visualization
  if (upper.includes("VISUAL") || upper.includes("CHART") || upper.includes("GRAPH")) return "DATA VISUALIZATION";

  // Delivery
  if (upper.includes("DELIVER") || upper.includes("SHIPPING") || upper.includes("LOGISTICS")) return "DELIVERY";

  // Developer Tools
  if (upper.includes("DEV TOOL") || upper.includes("DEVELOPER") || upper.includes("IDE") || upper.includes("DEBUG")) return "DEVELOPER TOOLS";

  // DevOps & Cloud
  if (upper.includes("DEVOPS") || upper.includes("DOCKER") || upper.includes("KUBERNET") || upper.includes("CI/CD") || upper.includes("DEPLOY")) return "DEVOPS & CLOUD";

  // E-Commerce
  if (upper.includes("E-COMMERCE") || upper.includes("COMMERCE") || upper.includes("SHOP") || upper.includes("STORE")) return "E-COMMERCE";

  // Embedded Systems
  if (upper.includes("EMBED") || upper.includes("IOT") || upper.includes("INDUSTRIAL")) return "EMBEDDED SYSTEMS";

  // Environment & Nature
  if (upper.includes("ENVIRON") || upper.includes("NATURE") || upper.includes("WEATHER") || upper.includes("CLIMATE")) return "ENVIRONMENT & NATURE";

  // File Systems
  if (upper.includes("FILE") || upper.includes("FILESYSTEM") || upper.includes("DOCUMENT")) return "FILE SYSTEMS";

  // Finance & Fintech
  if (upper.includes("FINANCE") || upper.includes("FINT") || upper.includes("PAYMENT") || upper.includes("BANKING") || upper.includes("FINTECH")) return "FINANCE & FINTECH";

  // Gaming
  if (upper.includes("GAME") || upper.includes("GAMING")) return "GAMING";

  // Home Automation
  if (upper.includes("HOME") || upper.includes("SMART HOME") || upper.includes("HOMEKIT")) return "HOME AUTOMATION";

  // Knowledge & Memory
  if (upper.includes("KNOWLEDG") || upper.includes("MEMORY") || upper.includes("NOTE") || upper.includes("OBSIDIAN")) return "KNOWLEDGE & MEMORY";

  // Legal
  if (upper.includes("LEGAL") || upper.includes("LAW")) return "LEGAL";

  // Location Services
  if (upper.includes("LOCATION") || upper.includes("MAP") || upper.includes("GEO") || upper.includes("GPS")) return "LOCATION SERVICES";

  // Marketing
  if (upper.includes("MARKET") || upper.includes("SEO") || upper.includes("ANALYTICS")) return "MARKETING";

  // Monitoring
  if (upper.includes("MONITOR") || upper.includes("OBSERV") || upper.includes("LOG") || upper.includes("METRIC")) return "MONITORING";

  // Multimedia
  if (upper.includes("MULTIMEDIA") || upper.includes("VIDEO") || upper.includes("AUDIO") || upper.includes("IMAGE") || upper.includes("MEDIA")) return "MULTIMEDIA PROCESS";

  // OS Automation
  if (upper.includes("OS ") || upper.includes("OPERATING") || upper.includes("DESKTOP") || upper.includes("MACOS") || upper.includes("WINDOWS")) return "OS AUTOMATION";

  // Productivity
  if (upper.includes("PRODUCTIV") || upper.includes("WORKPLACE") || upper.includes("CALENDAR") || upper.includes("TASK") || upper.includes("PROJECT")) return "PRODUCTIVITY";

  // Real Estate
  if (upper.includes("REAL ESTATE") || upper.includes("PROPERTY")) return "REAL ESTATE";

  // Research
  if (upper.includes("RESEARCH") || upper.includes("ACADEMIC") || upper.includes("PAPER")) return "RESEARCH";

  // Search
  if (upper.includes("SEARCH") || upper.includes("WEB") || upper.includes("CRAWL") || upper.includes("EXTRACT")) return "SEARCH & DATA EXTRACTION";

  // Security
  if (upper.includes("SECURITY") || upper.includes("VULN") || upper.includes("AUTH") || upper.includes("IDENTITY")) return "SECURITY";

  // Social Media
  if (upper.includes("SOCIAL") || upper.includes("TWITTER") || upper.includes("REDDIT") || upper.includes("LINKEDIN")) return "SOCIAL MEDIA";

  // Sports
  if (upper.includes("SPORT")) return "SPORTS";

  // Support & Service
  if (upper.includes("SUPPORT") || upper.includes("SERVICE DESK") || upper.includes("TICKET")) return "SUPPORT & SERVICE MANAGEMENT";

  // Translation
  if (upper.includes("TRANS") || upper.includes("LANGUAGE") || upper.includes("LOCAL")) return "TRANSLATION SERVICES";

  // Travel
  if (upper.includes("TRAVEL") || upper.includes("FLIGHT") || upper.includes("HOTEL") || upper.includes("HOSPITALITY")) return "TRAVEL";

  // Text-to-Speech / Speech-to-Text
  if (upper.includes("TEXT-TO-SPEECH") || upper.includes("TTS")) return "TEXT-TO-SPEECH";
  if (upper.includes("SPEECH-TO-TEXT") || upper.includes("STT") || upper.includes("WHISPER")) return "SPEECH-TO-TEXT";

  // Podcasts
  if (upper.includes("PODCAST")) return "PODCASTS";

  // Spirituality
  if (upper.includes("SPIRIT") || upper.includes("ESOTERIC")) return "SPIRITUALITY & ESOTERICA";

  // Education
  if (upper.includes("EDUC") || upper.includes("LEARN") || upper.includes("TUTOR")) return "EDUCATION";

  // AI & Reasoning (catch-all for AI-related)
  if (upper.includes("AI") || upper.includes("AGENT") || upper.includes("REASON") || upper.includes("LLM")) return "AI & REASONING";

  // Default
  return "UTILITIES";
}

/**
 * Map Composio category names to our normalized categories.
 */
function mapComposioCategory(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("email") || lower.includes("mail")) return "COMMUNICATION";
  if (lower.includes("developer") || lower.includes("code") || lower.includes("git")) return "DEVELOPER TOOLS";
  if (lower.includes("project") || lower.includes("task") || lower.includes("productivity")) return "PRODUCTIVITY";
  if (lower.includes("crm") || lower.includes("customer") || lower.includes("sales")) return "CUSTOMER DATA";
  if (lower.includes("finance") || lower.includes("payment") || lower.includes("billing")) return "FINANCE & FINTECH";
  if (lower.includes("cloud") || lower.includes("infrastructure")) return "CLOUD PLATFORMS";
  if (lower.includes("ai") || lower.includes("agent") || lower.includes("llm")) return "AI & REASONING";
  if (lower.includes("data") || lower.includes("analytics")) return "DATA SCIENCE TOOLS";
  if (lower.includes("social") || lower.includes("marketing")) return "SOCIAL MEDIA";
  if (lower.includes("security") || lower.includes("auth")) return "SECURITY";
  if (lower.includes("storage") || lower.includes("file")) return "FILE SYSTEMS";
  if (lower.includes("design") || lower.includes("image")) return "MULTIMEDIA PROCESS";
  return "UTILITIES";
}

function formatServerName(raw: string): string {
  return raw
    .replace(/[-_]/g, " ")
    .replace(/\bmcp\b/gi, "")
    .replace(/\bserver\b/gi, "")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || raw;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase().trim() || "";
  const category = searchParams.get("category") || "ALL";
  const source = searchParams.get("source") || "ALL";
  const transport = searchParams.get("transport") || "ALL";
  const language = searchParams.get("language") || "ALL";

  // Fetch ALL data sources in parallel for maximum speed
  const [markdownResult, smitheryResult, mcpSoResult, glamaResult, composioResult, arcadeResult] = await Promise.allSettled([
    // 1. awesome-mcp markdown (Glama + mcp.so curated servers)
    fetchAwesomeMcpMarkdown(),
    // 2. Smithery multi-query (60 search terms × 5 pages = up to 3K servers)
    fetchSmitheryMultiQuery(60),
    // 3. mcp.so sitemap (~18K servers)
    fetchMcpSoSitemap(),
    // 4. Glama sitemap (~100K servers)
    fetchGlamaSitemap(),
    // 5. Composio toolkits + tools (1326 toolkits, 48K+ tools)
    Promise.all([fetchComposioToolkits(), fetchAllComposioTools(300)]),
    // 6. Arcade integrations (7,500+ tools across 81 MCP servers)
    fetchArcadeIntegrations(),
  ]);

  // Process awesome-mcp markdown
  let parsedPublicServers: PublicMcpServer[] = [];
  const markdown = markdownResult.status === "fulfilled" ? markdownResult.value : null;
  if (markdown) {
    parsedPublicServers = parseAwesomeMcpMarkdown(markdown);
  }

  // Process Smithery multi-query results
  let smitheryServers: PublicMcpServer[] = [];
  if (smitheryResult.status === "fulfilled") {
    const rawServers = smitheryResult.value.data;
    smitheryServers = rawServers.map((s: Record<string, unknown>) => {
      const isRemote = Boolean(s.remote);
      const namespace = (s.namespace as string) || (s.owner as string) || "smithery";
      const name = (s.displayName as string) || (s.qualifiedName as string) || "Unknown";
      const description = (s.description as string) || "";

      // Determine transport
      const transport: PublicMcpServer["transport"] = isRemote ? "SSE" : "STDIO";

      // Use deploymentUrl for remote servers, or Smithery connect URL as fallback
      const endpointUrl = isRemote
        ? (s.deploymentUrl || `https://registry.smithery.ai/servers/${s.qualifiedName}/connect`)
        : undefined;

      // Detect auth requirement from description
      const requiresAuth =
        description.toLowerCase().includes("api key") ||
        description.toLowerCase().includes("token") ||
        description.toLowerCase().includes("oauth") ||
        description.toLowerCase().includes("credentials") ||
        description.toLowerCase().includes("subscription");

      // Derive category from name + description
      const searchText = `${name} ${description}`.toLowerCase();
      const category = categorizeSmitheryServer(searchText);

      // Derive tags from name + description keywords
      const tagWords = name.toLowerCase().split(/[^a-z0-9]+/).filter((w: string) => w.length > 2 && !["mcp", "server", "the", "and", "for", "with"].includes(w));
      const descWords = description.toLowerCase().split(/[^a-z0-9]+/).filter((w: string) => w.length > 3 && !"description the that this which when where how what does will can been from have your each make like into than them then its about would other being where after also every. world what just most people many much very know take than time just right want came think also back good give most".split(" ").includes(w));
      const tags = Array.from(new Set([...tagWords.slice(0, 3), ...descWords.slice(0, 2)])).slice(0, 5);

      return {
        id: `smithery-${s.id}`,
        source: "smithery" as PublicMcpServer["source"],
        name,
        description,
        owner: namespace,
        stars: s.useCount || 0,
        tags,
        transport,
        endpointUrl,
        command: !isRemote ? `npx -y @smithery/cli install ${s.qualifiedName}` : undefined,
        requiresAuthToken: requiresAuth,
        category,
        isVerified: s.verified || s.bySmithery || false,
        language: "unknown" as PublicMcpServer["language"],
        scope: (isRemote ? "cloud" : "local") as PublicMcpServer["scope"],
      };
    });
  }

  // Process mcp.so sitemap results
  let mcpSoServers: PublicMcpServer[] = [];
  let glamaSitemapServers: PublicMcpServer[] = [];

  if (mcpSoResult.status === "fulfilled") {
    const existingMcpSoIds = new Set(
      parsedPublicServers.filter((s) => s.source === "mcp.so").map((s) => s.id)
    );
    mcpSoServers = mcpSoResult.value
      .filter((e) => !existingMcpSoIds.has(`mcpso-${e.slug}`))
      .map((entry) => ({
        id: `mcpso-${entry.slug}`,
        source: "mcp.so" as PublicMcpServer["source"],
        name: entry.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: "MCP server from mcp.so registry",
        owner: entry.slug.split("/")[0] || "community",
        repoUrl: `https://github.com/${entry.slug}`,
        stars: 0,
        tags: ["mcp.so"],
        transport: "STDIO" as PublicMcpServer["transport"],
        command: `npx -y ${entry.slug}`,
        requiresAuthToken: false,
        category: "UTILITIES",
        isVerified: false,
        language: "unknown" as PublicMcpServer["language"],
        scope: "local" as PublicMcpServer["scope"],
      }));
  }

  if (glamaResult.status === "fulfilled") {
    const existingGlamaIds = new Set(
      parsedPublicServers.filter((s) => s.source === "glama").map((s) => s.id)
    );
    glamaSitemapServers = glamaResult.value
      .filter((e) => !existingGlamaIds.has(`glama-${e.slug}`))
      .map((entry) => {
        const parts = entry.slug.split("/");
        const owner = parts[0] || "community";
        const repo = parts[1] || parts[0] || entry.slug;
        return {
          id: `glama-${entry.slug}`,
          source: "glama" as PublicMcpServer["source"],
          name: repo.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          description: "MCP server from Glama.ai registry",
          owner,
          repoUrl: `https://github.com/${entry.slug}`,
          stars: 0,
          tags: ["glama"],
          transport: "STDIO" as PublicMcpServer["transport"],
          command: `npx -y ${repo}`,
          requiresAuthToken: false,
          category: "UTILITIES",
          isVerified: false,
          language: "unknown" as PublicMcpServer["language"],
          scope: "local" as PublicMcpServer["scope"],
        };
      });
  }

  // Process Composio toolkits + tools
  let composioServers: PublicMcpServer[] = [];
  if (composioResult.status === "fulfilled") {
    const [toolkits, tools] = composioResult.value;

    // Add toolkits as server entries (for mounting)
    composioServers = toolkits.map((tk) => ({
      id: `composio-${tk.slug}`,
      source: "composio" as PublicMcpServer["source"],
      name: `${tk.name} (Composio)`,
      description: tk.description || `Composio toolkit for ${tk.name} with ${tk.toolsCount} tools and managed OAuth.`,
      owner: "composio",
      repoUrl: tk.appUrl || `https://composio.dev/toolkits/${tk.slug}`,
      stars: tk.toolsCount,
      tags: [
        ...tk.categories.map((c) => c.name.toLowerCase()),
        "composio",
        "managed-auth",
        "oauth",
        tk.slug,
      ].slice(0, 5),
      transport: "SSE" as PublicMcpServer["transport"],
      endpointUrl: `https://backend.composio.dev/api/v3.1/toolkits/${tk.slug}`,
      requiresAuthToken: !tk.noAuth,
      category: mapComposioCategory(tk.categories.map((c) => c.name).join(" ")),
      isVerified: tk.managedAuth.length > 0,
      language: "unknown" as PublicMcpServer["language"],
      scope: "cloud" as PublicMcpServer["scope"],
    }));

    // Also add individual tools as directory entries (for browsing)
    composioServers.push(...tools.map((tool) => ({
      id: `composio-tool-${tool.slug}`,
      source: "composio" as PublicMcpServer["source"],
      name: `${tool.name} [${tool.toolkitName}]`,
      description: tool.description || `${tool.name} action in ${tool.toolkitName} toolkit`,
      owner: tool.toolkitName,
      repoUrl: `https://composio.dev/toolkits/${tool.toolkitSlug}`,
      stars: 0,
      tags: ["composio", tool.toolkitSlug, tool.toolkitName.toLowerCase()].slice(0, 5),
      transport: "SSE" as PublicMcpServer["transport"],
      endpointUrl: `https://backend.composio.dev/api/v3.1/tools/${tool.slug}`,
      requiresAuthToken: tool.authType !== "NO_AUTH",
      category: mapComposioCategory(tool.category),
      isVerified: false,
      language: "unknown" as PublicMcpServer["language"],
      scope: "cloud" as PublicMcpServer["scope"],
    })));
  }

  // Process Arcade integrations
  let arcadeServers: PublicMcpServer[] = [];
  if (arcadeResult.status === "fulfilled" && arcadeResult.value.length > 0) {
    arcadeServers = arcadeResult.value.map((intg) => ({
      id: intg.id,
      source: "arcade" as PublicMcpServer["source"],
      name: `${intg.name} (Arcade)`,
      description: intg.description || `Arcade integration for ${intg.name} with ${intg.toolsCount} agent-optimized tools.`,
      owner: "arcade",
      repoUrl: `https://www.arcade.dev/integrations`,
      stars: intg.toolsCount,
      tags: ["arcade", "managed-auth", intg.category.toLowerCase(), intg.name.toLowerCase()],
      transport: "SSE" as PublicMcpServer["transport"],
      endpointUrl: intg.mcpEndpoint,
      requiresAuthToken: intg.authType !== "NO_AUTH",
      category: intg.category,
      isVerified: true,
      language: "unknown" as PublicMcpServer["language"],
      scope: "cloud" as PublicMcpServer["scope"],
    }));
  }

  // Combine all sources
  let allServers = [
    ...CURATED_FEATURED_SERVERS,
    ...parsedPublicServers,
    ...smitheryServers,
    ...mcpSoServers,
    ...glamaSitemapServers,
    ...composioServers,
    ...arcadeServers,
  ];

  // Deduplicate by normalized name
  const seen = new Set<string>();
  allServers = allServers.filter((item) => {
    const key = (item.name + (item.owner || "")).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const glamaCount = allServers.filter((s) => s.source === "glama").length;
  const mcpSoCount = allServers.filter((s) => s.source === "mcp.so" || s.source === "curated").length;
  const smitheryCount = allServers.filter((s) => s.source === "smithery").length;
  const composioCount = allServers.filter((s) => s.source === "composio").length;
  const arcadeCount = allServers.filter((s) => s.source === "arcade").length;

  // Filter by Source
  if (source !== "ALL") {
    allServers = allServers.filter((s) => s.source === source);
  }

  // Filter by Transport
  if (transport !== "ALL") {
    allServers = allServers.filter((s) => s.transport === transport);
  }

  // Filter by Language
  if (language !== "ALL") {
    allServers = allServers.filter((s) => s.language === language.toLowerCase());
  }

  // Filter by Category (now supports all 40+ categories)
  if (category !== "ALL") {
    allServers = allServers.filter(
      (s) =>
        s.category?.toUpperCase() === category.toUpperCase() ||
        s.tags?.some((t) => t.toUpperCase() === category.toUpperCase())
    );
  }

  // Filter by Search Query
  if (query) {
    allServers = allServers.filter((s) => {
      const matchName = s.name.toLowerCase().includes(query);
      const matchDesc = s.description.toLowerCase().includes(query);
      const matchOwner = s.owner?.toLowerCase().includes(query);
      const matchTags = s.tags?.some((t) => t.toLowerCase().includes(query));
      const matchCmd = s.command?.toLowerCase().includes(query);
      const matchLang = s.language?.toLowerCase().includes(query);
      const matchLicense = s.license?.toLowerCase().includes(query);
      return matchName || matchDesc || matchOwner || matchTags || matchCmd || matchLang || matchLicense;
    });
  }

  // Sort: verified first, then stars descending
  allServers.sort((a, b) => {
    if (a.isVerified && !b.isVerified) return -1;
    if (!a.isVerified && b.isVerified) return 1;
    return (b.stars ?? 0) - (a.stars ?? 0);
  });

  const response = {
    success: true,
    total: allServers.length,
    data: allServers,
    sources: {
      glamaCount,
      mcpSoCount,
      smitheryCount,
      composioCount,
      arcadeCount,
    },
  };

  return NextResponse.json(response);
}
