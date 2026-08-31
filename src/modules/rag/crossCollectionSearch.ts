/**
 * Cross-Collection Federated Search Engine
 *
 * Enables unified search across multiple RAG collections with:
 * - Federated retrieval: query multiple collections in parallel
 * - Collection-aware ranking with configurable per-collection boosts
 * - Diversity-aware merging (MMR - Maximal Marginal Relevance)
 * - Source collection attribution and provenance tracking
 * - Collection relevance scoring and analytics
 */

import { PgVectorStore, SemanticSearchResult } from "./pgvectorStore";

// ─── Types ───

export interface CollectionConfig {
  /** Collection name */
  name: string;
  /** Display label for UI */
  label?: string;
  /** Boost factor for this collection (1.0 = normal, 2.0 = double weight) */
  boost: number;
  /** Whether to include this collection in federated search */
  enabled: boolean;
  /** Optional metadata filter to apply when searching this collection */
  metadataFilter?: Record<string, unknown>;
}

export interface CrossCollectionSearchOptions {
  /** Search query */
  query: string;
  /** Collections to search (empty = all available) */
  collections?: string[];
  /** Per-collection boost overrides */
  collectionBoosts?: Record<string, number>;
  /** Max results per collection (default: 10) */
  perCollectionLimit?: number;
  /** Max total results (default: 20) */
  totalLimit?: number;
  /** Minimum similarity score (default: 0.2) */
  minScore?: number;
  /** User ID for tenancy isolation */
  userId?: string;
  /** Apply diversity re-ranking (MMR) */
  useDiversityRanking?: boolean;
  /** Lambda parameter for MMR (0=max diversity, 1=max relevance, default: 0.7) */
  mmrLambda?: number;
  /** Enable hybrid search per collection */
  useHybridSearch?: boolean;
  /** Enable re-ranking across all collections */
  useReranking?: boolean;
  /** Factor to lower minScore for per-collection search (default: 0.5). The per-collection threshold = minScore * this factor, then post-filtered at minScore. */
  perCollectionScoreFactor?: number;
}

export interface CrossCollectionResult {
  /** Merged and ranked results */
  results: FederatedSearchResult[];
  /** Analytics about the search */
  analytics: SearchAnalytics;
  /** Query executed */
  query: string;
  /** Total time spent (ms) */
  durationMs: number;
}

export interface FederatedSearchResult extends SemanticSearchResult {
  /** The collection this result came from */
  sourceCollection: string;
  /** Collection-specific boost applied */
  collectionBoost: number;
  /** Final fused score after cross-collection ranking */
  fusedScore: number;
  /** Rank position across all collections */
  globalRank: number;
  /** Collection-local rank */
  localRank: number;
}

export interface SearchAnalytics {
  /** Number of collections queried */
  collectionsQueried: number;
  /** Number of collections that returned results */
  collectionsWithResults: number;
  /** Per-collection result counts */
  perCollectionCounts: Record<string, number>;
  /** Per-collection average scores */
  perCollectionAvgScores: Record<string, number>;
  /** Score distribution across collections */
  scoreDistribution: Record<string, { min: number; max: number; avg: number }>;
  /** Diversity score (0=monoculture, 1=perfectly diverse) */
  diversityScore: number;
}

// ─── Cross-Collection Search Engine ───

export class CrossCollectionSearchEngine {
  private vectorStore: PgVectorStore;
  private collectionConfigs: Map<string, CollectionConfig> = new Map();

  constructor(vectorStore?: PgVectorStore) {
    this.vectorStore = vectorStore || new PgVectorStore();
  }

  /** Register a collection with its configuration. */
  registerCollection(config: CollectionConfig): void {
    this.collectionConfigs.set(config.name, config);
  }

  /** Bulk register collections. */
  registerCollections(configs: CollectionConfig[]): void {
    for (const config of configs) {
      this.registerCollection(config);
    }
  }

  /** Discover and register all available collections from the vector store. */
  async discoverCollections(userId?: string): Promise<CollectionConfig[]> {
    const collections = await this.vectorStore.listCollections(userId);
    const configs: CollectionConfig[] = [];

    for (const coll of collections) {
      if (!this.collectionConfigs.has(coll.name)) {
        const config: CollectionConfig = {
          name: coll.name,
          label: coll.name,
          boost: 1.0,
          enabled: true,
        };
        this.registerCollection(config);
        configs.push(config);
      }
    }

    return configs;
  }

  /**
   * Execute a federated search across multiple collections.
   */
  async search(options: CrossCollectionSearchOptions): Promise<CrossCollectionResult> {
    const startTime = Date.now();

    const {
      query,
      collections: targetCollections,
      collectionBoosts = {},
      perCollectionLimit = 10,
      totalLimit = 20,
      minScore = 0.2,
      userId,
      useDiversityRanking = true,
      mmrLambda = 0.7,
      useHybridSearch = false,
    } = options;

    // Determine which collections to search
    const collectionsToSearch = this.resolveCollections(targetCollections, userId);

    // Execute parallel searches across all collections
    const searchPromises = collectionsToSearch.map(async (config) => {
      const boost = collectionBoosts[config.name] ?? config.boost;
      if (!config.enabled || boost <= 0) return { config, results: [] as SemanticSearchResult[] };

      try {
        const perCollMinScore = minScore * (options.perCollectionScoreFactor ?? 0.5);
      const searchFn = useHybridSearch
          ? (q: string) => this.vectorStore.hybridSearch(q, {
              limit: perCollectionLimit,
              minScore: perCollMinScore,
              collection: config.name,
              userId,
              metadataFilter: config.metadataFilter,
            })
          : (q: string) => this.vectorStore.search(q, {
              limit: perCollectionLimit,
              minScore: perCollMinScore,
              collection: config.name,
              userId,
              metadataFilter: config.metadataFilter,
            });

        const results = await searchFn(query);
        return { config, results, boost };
      } catch (err) {
        return { config, results: [] as SemanticSearchResult[], boost, error: err };
      }
    });

    const searchResults = await Promise.all(searchPromises);

    // Merge and score results
    const allResults: FederatedSearchResult[] = [];
    const analytics: SearchAnalytics = {
      collectionsQueried: collectionsToSearch.length,
      collectionsWithResults: 0,
      perCollectionCounts: {},
      perCollectionAvgScores: {},
      scoreDistribution: {},
      diversityScore: 0,
    };

    for (const { config, results, boost = 1.0 } of searchResults) {
      const boostedResults = results.map((r, idx) => ({
        ...r,
        sourceCollection: config.name,
        collectionBoost: boost,
        fusedScore: Math.round(r.score * boost * 10000) / 10000,
        globalRank: 0,
        localRank: idx + 1,
      }));

      allResults.push(...boostedResults);

      // Analytics
      const count = boostedResults.length;
      analytics.perCollectionCounts[config.name] = count;
      if (count > 0) {
        analytics.collectionsWithResults++;
        const avgScore = boostedResults.reduce((a, r) => a + r.fusedScore, 0) / count;
        analytics.perCollectionAvgScores[config.name] = Math.round(avgScore * 1000) / 100;
        analytics.scoreDistribution[config.name] = {
          min: Math.round(Math.min(...boostedResults.map((r) => r.fusedScore)) * 100) / 100,
          max: Math.round(Math.max(...boostedResults.map((r) => r.fusedScore)) * 100) / 100,
          avg: Math.round(avgScore * 100) / 100,
        };
      }
    }

    // Sort by fused score
    allResults.sort((a, b) => b.fusedScore - a.fusedScore);

    // Apply minimum score filter
    const filtered = allResults.filter((r) => r.fusedScore >= minScore);

    // Assign global ranks
    filtered.forEach((r, idx) => { r.globalRank = idx + 1; });

    // Apply diversity re-ranking (MMR)
    let finalResults: FederatedSearchResult[];
    if (useDiversityRanking && filtered.length > 2) {
      finalResults = mmrRerank(filtered, mmrLambda, totalLimit);
    } else {
      finalResults = filtered.slice(0, totalLimit);
    }

    // Calculate diversity score
    const collectionsInResults = new Set(finalResults.map((r) => r.sourceCollection));
    analytics.diversityScore = collectionsToSearch.length > 0
      ? collectionsInResults.size / collectionsToSearch.length
      : 0;

    return {
      results: finalResults,
      analytics,
      query,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Get collection-level analytics for a query.
   */
  async getCollectionAnalytics(
    query: string,
    userId?: string
  ): Promise<Array<{
    collection: string;
    documentCount: number;
    chunkCount: number;
    totalTokens: number;
    avgRelevanceScore: number;
  }>> {
    const collectionsToSearch = this.resolveCollections(undefined, userId);
    const analytics: Array<{
      collection: string;
      documentCount: number;
      chunkCount: number;
      totalTokens: number;
      avgRelevanceScore: number;
    }> = [];

    for (const config of collectionsToSearch) {
      try {
        const stats = await this.vectorStore.getStats(userId, config.name);
        const sampleResults = await this.vectorStore.search(query, {
          limit: 5,
          minScore: 0.1,
          collection: config.name,
        });

        analytics.push({
          collection: config.name,
          documentCount: stats.documentCount,
          chunkCount: stats.chunkCount,
          totalTokens: 0, // pgvector store doesn't expose totalTokens per-collection
          avgRelevanceScore: sampleResults.length > 0
            ? Math.round((sampleResults.reduce((a, r) => a + r.score, 0) / sampleResults.length) * 100) / 100
            : 0,
        });
      } catch {
        // Skip collections that error
      }
    }

    return analytics;
  }

  private resolveCollections(targetCollections?: string[], _userId?: string): CollectionConfig[] {
    if (targetCollections && targetCollections.length > 0) {
      return targetCollections
        .map((name) => this.collectionConfigs.get(name))
        .filter((c): c is CollectionConfig => c !== undefined);
    }

    // Return all registered enabled collections
    return Array.from(this.collectionConfigs.values()).filter((c) => c.enabled);
  }
}

// ─── MMR (Maximal Marginal Relevance) Re-ranking ───

/**
 * Applies MMR to balance relevance and diversity.
 * Selects results that are both relevant to the query and diverse
 * from already-selected results.
 */
function mmrRerank(
  candidates: FederatedSearchResult[],
  lambda: number,
  limit: number
): FederatedSearchResult[] {
  if (candidates.length <= limit) return candidates;

  const selected: FederatedSearchResult[] = [];
  const remaining = [...candidates];

  // Always include the top result
  selected.push(remaining.shift()!);

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmrScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance component
      const relevance = candidate.fusedScore;

      // Diversity component: max similarity to already selected results
      let maxSimilarity = 0;
      for (const sel of selected) {
        const sim = computeResultSimilarity(candidate, sel);
        maxSimilarity = Math.max(maxSimilarity, sim);
      }

      // MMR score: lambda * relevance - (1 - lambda) * max_similarity
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  // Re-assign global ranks
  selected.forEach((r, idx) => { r.globalRank = idx + 1; });

  return selected;
}

/**
 * Compute similarity between two search results for MMR diversity.
 * Uses collection origin + content token overlap as a diversity signal.
 */
function computeResultSimilarity(a: FederatedSearchResult, b: FederatedSearchResult): number {
  // Same collection = higher base similarity
  const collectionSim = a.sourceCollection === b.sourceCollection ? 0.3 : 0;

  // Content token overlap
  const tokensA = new Set(a.content.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const tokensB = new Set(b.content.toLowerCase().split(/\s+/).filter((t) => t.length > 3));
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  return collectionSim + jaccard * 0.7;
}

// ─── Convenience Functions ───

/**
 * Quick cross-collection search without engine setup.
 */
export async function crossCollectionSearch(
  vectorStore: PgVectorStore,
  query: string,
  options: {
    collections?: string[];
    totalLimit?: number;
    minScore?: number;
    userId?: string;
    useHybridSearch?: boolean;
  } = {}
): Promise<CrossCollectionResult> {
  const engine = new CrossCollectionSearchEngine(vectorStore);
  await engine.discoverCollections(options.userId);

  return engine.search({
    query,
    collections: options.collections,
    totalLimit: options.totalLimit,
    minScore: options.minScore,
    userId: options.userId,
    useHybridSearch: options.useHybridSearch,
    useDiversityRanking: true,
  });
}
