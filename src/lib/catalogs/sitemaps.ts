/**
 * Sitemap-based catalog fetchers for mcp.so and Glama.
 */

import { fetchWithRetry, sleep } from "@/lib/fetch-utils";
import { logger } from "@/lib/logger";

const SITEMAP_CACHE_TTL = 3600_000;

function parseSitemapUrls(xml: string): { url: string; lastmod: string }[] {
  const urls: { url: string; lastmod: string }[] = [];
  const urlBlocks = xml.split("<url>").slice(1);
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
    if (locMatch) {
      urls.push({
        url: locMatch[1],
        lastmod: lastmodMatch?.[1] || "",
      });
    }
  }
  return urls;
}

function extractMcpSoSlug(url: string): string {
  const match = url.match(/mcp\.so\/servers\/([^/?#]+)/);
  return match?.[1] || "";
}

function extractGlamaSlug(url: string): string {
  const match = url.match(/glama\.ai\/mcp\/servers\/([^/?#]+\/[^/?#]+)/);
  return match?.[1] || url.match(/glama\.ai\/mcp\/servers\/([^/?#]+)/)?.[1] || "";
}

// ────────────── mcp.so Sitemap ──────────────

let mcpSoSitemapCache: { servers: { slug: string; url: string; lastmod: string }[]; fetchedAt: number } | null = null;

/**
 * Fetch ALL mcp.so servers via their sitemap.
 */
export async function fetchMcpSoSitemap(): Promise<
  { slug: string; url: string; lastmod: string }[]
> {
  if (mcpSoSitemapCache && Date.now() - mcpSoSitemapCache.fetchedAt < SITEMAP_CACHE_TTL) {
    return mcpSoSitemapCache.servers;
  }

  try {
    const indexXml = await fetchWithRetry("https://mcp.so/sitemap.xml", {
      timeoutMs: 10000,
      retries: 2,
    });
    if (!indexXml.ok) return mcpSoSitemapCache?.servers || [];
    const indexText = await indexXml.text();

    const serverPages: string[] = [];
    const pageMatches = indexText.matchAll(/section=servers&amp;page=(\d+)/g);
    for (const m of pageMatches) {
      serverPages.push(m[1]);
    }
    if (serverPages.length === 0 && indexText.includes("section=servers")) {
      serverPages.push("1");
    }

    const BATCH_SIZE = 5;
    const allUrls: { url: string; lastmod: string }[] = [];

    for (let i = 0; i < serverPages.length; i += BATCH_SIZE) {
      const batch = serverPages.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (page) => {
          try {
            const res = await fetchWithRetry(
              `https://mcp.so/sitemap.xml?section=servers&page=${page}`,
              { timeoutMs: 10000, retries: 2 }
            );
            if (!res.ok) return [];
            const xml = await res.text();
            return parseSitemapUrls(xml);
          } catch {
            return [];
          }
        })
      );
      for (const urls of results) allUrls.push(...urls);
      if (i + BATCH_SIZE < serverPages.length) await sleep(100);
    }

    const seen = new Set<string>();
    const servers = allUrls
      .map((u) => ({ slug: extractMcpSoSlug(u.url), url: u.url, lastmod: u.lastmod }))
      .filter((s) => {
        if (!s.slug || seen.has(s.slug)) return false;
        seen.add(s.slug);
        return true;
      });

    mcpSoSitemapCache = { servers, fetchedAt: Date.now() };
    logger.info({ count: servers.length, pages: serverPages.length }, "mcp.so sitemap fetched");
    return servers;
  } catch (err) {
    logger.error({ err }, "mcp.so sitemap failed");
    return mcpSoSitemapCache?.servers || [];
  }
}

// ────────────── Glama Sitemap ──────────────

let glamaSitemapCache: { servers: { slug: string; url: string; lastmod: string }[]; fetchedAt: number } | null = null;

/**
 * Fetch ALL Glama MCP servers via their sitemaps.
 */
export async function fetchGlamaSitemap(): Promise<
  { slug: string; url: string; lastmod: string }[]
> {
  if (glamaSitemapCache && Date.now() - glamaSitemapCache.fetchedAt < SITEMAP_CACHE_TTL) {
    return glamaSitemapCache.servers;
  }

  try {
    const indexXml = await fetchWithRetry("https://glama.ai/sitemap.xml", {
      timeoutMs: 10000,
      retries: 2,
    });
    if (!indexXml.ok) return glamaSitemapCache?.servers || [];
    const indexText = await indexXml.text();

    const sitemapFiles: string[] = [];
    const fileMatches = indexText.matchAll(/<loc>([^<]*(?:mcp-servers|mcp-remote-servers)\/[^<]*\.xml)<\/loc>/g);
    for (const m of fileMatches) {
      sitemapFiles.push(m[1]);
    }

    const BATCH_SIZE = 5;
    const allUrls: { url: string; lastmod: string }[] = [];

    for (let i = 0; i < sitemapFiles.length; i += BATCH_SIZE) {
      const batch = sitemapFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (sitemapUrl) => {
          try {
            const res = await fetchWithRetry(sitemapUrl, {
              timeoutMs: 15000,
              retries: 2,
            });
            if (!res.ok) return [];
            const xml = await res.text();
            return parseSitemapUrls(xml);
          } catch {
            return [];
          }
        })
      );
      for (const urls of results) allUrls.push(...urls);
      if (i + BATCH_SIZE < sitemapFiles.length) await sleep(100);
    }

    const seen = new Set<string>();
    const servers = allUrls
      .map((u) => ({ slug: extractGlamaSlug(u.url), url: u.url, lastmod: u.lastmod }))
      .filter((s) => {
        if (!s.slug || seen.has(s.slug)) return false;
        seen.add(s.slug);
        return true;
      });

    glamaSitemapCache = { servers, fetchedAt: Date.now() };
    logger.info({ count: servers.length, sitemaps: sitemapFiles.length }, "Glama sitemap fetched");
    return servers;
  } catch (err) {
    logger.error({ err }, "Glama sitemap failed");
    return glamaSitemapCache?.servers || [];
  }
}
