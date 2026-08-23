import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unauthorized } from "@/lib/api/handlers";
import { fetchWithRetry, fetchAllSmithery, fetchSmitheryPaginated } from "@/lib/fetch-utils";

export const revalidate = 300;

const SMITHERY_API = "https://registry.smithery.ai";

/**
 * Fetch a single page of Smithery items (servers or skills)
 */
async function _smitheryPage<T>(
  endpoint: string,
  page: number,
  pageSize: number
): Promise<{ data: T[]; totalCount: number }> {
  const res = await fetchWithRetry(
    `${SMITHERY_API}/${endpoint}?page=${page}&pageSize=${pageSize}`,
    { timeoutMs: 15000, retries: 3 }
  );
  if (!res.ok) return { data: [], totalCount: 0 };
  const json = await res.json();
  return {
    data: json.servers || json.skills || [],
    totalCount: json.pagination?.totalCount || 0,
  };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "list";

  try {
    // Detail endpoint
    if (action === "detail") {
      const qualifiedName = searchParams.get("qualifiedName");
      if (!qualifiedName) {
        return NextResponse.json(
          { success: false, error: "qualifiedName required" },
          { status: 400 }
        );
      }
      const res = await fetchWithRetry(
        `${SMITHERY_API}/servers/${qualifiedName}`,
        { timeoutMs: 15000, retries: 2 }
      );
      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: "Server not found" },
          { status: 404 }
        );
      }
      const detail = await res.json();
      return NextResponse.json({ success: true, data: detail });
    }

    // List / fetchAll endpoint
    const q = searchParams.get("q") || "";
    const fetchType = searchParams.get("type") || "servers";
    const fetchAll = searchParams.get("fetchAll") === "true";

    if (fetchAll) {
      const { items, totalCount } = await fetchAllSmithery(
        fetchType as "servers" | "skills",
        (item) => item
      );
      return NextResponse.json({
        success: true,
        data: items,
        pagination: {
          currentPage: 1,
          pageSize: items.length,
          totalPages: 1,
          totalCount,
        },
      });
    }

    // Paginated request with auto-caching and next-page prefetch
    const page = parseInt(searchParams.get("page") || "1", 10) || 1;
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10) || 50;
    const result = await fetchSmitheryPaginated<Record<string, unknown>>({
      endpoint: fetchType as "servers" | "skills",
      page,
      pageSize,
      query: q,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        currentPage: page,
        pageSize,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        fromCache: result.fromCache,
      },
    });
  } catch (error) {
    console.error("[Smithery API Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch from Smithery",
      },
      { status: 502 }
    );
  }
}
