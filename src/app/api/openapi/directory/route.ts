import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized, serverError } from "@/lib/api/handlers";

interface ApiDirectoryEntry {
  id: string;
  provider: string;
  name: string;
  description: string;
  fullDescription?: string;
  specUrl: string;
  specYamlUrl?: string;
  openapiVer: string;
  categories: string[];
  logoUrl?: string;
  version: string;
  updatedAt?: string;
  externalDocsUrl?: string;
  license?: string;
  contactEmail?: string;
  contactUrl?: string;
  originUrl?: string;
}

interface DirectoryCache {
  items: ApiDirectoryEntry[];
  providers: string[];
  categories: string[];
  metrics: {
    numAPIs: number;
    numEndpoints: number;
    numSpecs: number;
  };
  lastFetchedAt: number;
}

let cache: DirectoryCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchFullDirectory(): Promise<DirectoryCache> {
  const [listRes, metricsRes] = await Promise.all([
    fetch("https://api.apis.guru/v2/list.json", {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    }),
    fetch("https://api.apis.guru/v2/metrics.json", {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    }).catch(() => null),
  ]);

  if (!listRes.ok) {
    throw new Error(`Failed to fetch APIs.guru directory (${listRes.status})`);
  }

  const rawList = (await listRes.json()) as Record<string, any>;
  const rawMetrics = metricsRes && metricsRes.ok ? await metricsRes.json().catch(() => null) : null;

  const items: ApiDirectoryEntry[] = [];
  const providerSet = new Set<string>();
  const categorySet = new Set<string>();

  for (const [key, apiObj] of Object.entries(rawList)) {
    if (!apiObj || typeof apiObj !== "object") continue;

    // Extract provider from key (e.g. "googleapis.com:calendar" -> "googleapis.com")
    const provider = key.includes(":") ? key.split(":")[0] : key.split("/")[0] || "Other";
    providerSet.add(provider);

    const preferredVerKey = apiObj.preferred;
    const versionData = preferredVerKey ? apiObj.versions?.[preferredVerKey] : Object.values(apiObj.versions || {})[0];
    if (!versionData) continue;

    const info = versionData.info || {};
    const title = info.title || key;
    const description = info.description || "";
    const specUrl = versionData.swaggerUrl || versionData.swaggerYamlUrl;
    const specYamlUrl = versionData.swaggerYamlUrl;
    const openapiVer = versionData.openapiVer || (versionData.swaggerUrl?.includes("/swagger.") ? "2.0" : "3.0.0");
    const categories = Array.isArray(info["x-apisguru-categories"])
      ? info["x-apisguru-categories"]
      : [];
    const logoUrl = info["x-logo"]?.url;
    const version = info.version || "1.0.0";
    const updatedAt = versionData.updated;
    const externalDocsUrl = info.externalDocs?.url || versionData.externalDocs?.url;
    const license = info.license?.name || info.license?.url;
    const contactEmail = info.contact?.email;
    const contactUrl = info.contact?.url;
    const originUrl = info["x-origin"]?.[0]?.url || versionData["x-apisguru-direct"]?.url;

    for (const cat of categories) {
      if (cat) categorySet.add(cat);
    }

    if (specUrl) {
      items.push({
        id: key,
        provider,
        name: title,
        description: description.length > 250 ? `${description.slice(0, 247)}...` : description,
        fullDescription: description,
        specUrl,
        specYamlUrl,
        openapiVer,
        categories,
        logoUrl,
        version,
        updatedAt,
        externalDocsUrl,
        license,
        contactEmail,
        contactUrl,
        originUrl,
      });
    }
  }

  return {
    items,
    providers: Array.from(providerSet).sort(),
    categories: Array.from(categorySet).sort(),
    metrics: {
      numAPIs: rawMetrics?.numAPIs || items.length,
      numEndpoints: rawMetrics?.numEndpoints || rawMetrics?.numOperations || items.length * 8,
      numSpecs: rawMetrics?.numSpecs || items.length,
    },
    lastFetchedAt: Date.now(),
  };
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();
  const category = (url.searchParams.get("category") || "").toLowerCase().trim();
  const provider = (url.searchParams.get("provider") || "").toLowerCase().trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") || "24")), 100);

  try {
    const now = Date.now();
    if (!cache || now - cache.lastFetchedAt > CACHE_TTL_MS) {
      cache = await fetchFullDirectory();
    }

    let results = cache.items;

    // Filter by Search Query
    if (q) {
      results = results.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.provider.toLowerCase().includes(q) ||
          item.categories.some((c) => c.toLowerCase().includes(q))
      );
    }

    // Filter by Category
    if (category && category !== "all") {
      results = results.filter((item) =>
        item.categories.some((c) => c.toLowerCase() === category)
      );
    }

    // Filter by Provider
    if (provider && provider !== "all") {
      results = results.filter((item) =>
        item.provider.toLowerCase().includes(provider)
      );
    }

    const total = results.length;
    const startIndex = (page - 1) * limit;
    const pagedItems = results.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < total;

    return NextResponse.json({
      success: true,
      data: {
        total,
        page,
        limit,
        hasMore,
        items: pagedItems,
        categories: cache.categories,
        topProviders: [
          "googleapis.com",
          "azure.com",
          "amazonaws.com",
          "github.com",
          "stripe.com",
          "twilio.com",
          "cloudflare.com",
          "slack.com",
          "spotify.com",
          "box.com",
          "datadoghq.com",
        ],
        metrics: cache.metrics,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
