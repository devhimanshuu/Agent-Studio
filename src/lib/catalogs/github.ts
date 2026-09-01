/**
 * GitHub API fetcher with retry and token support.
 */

import { fetchWithRetry } from "@/lib/fetch-utils";

/**
 * Fetch from GitHub API with retry and token support.
 */
export async function fetchGitHub<T>(
  path: string,
  fallback: T
): Promise<T> {
  try {
    const res = await fetchWithRetry(`https://api.github.com${path}`, {
      timeoutMs: 8000,
      retries: 2,
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}
