/**
 * Knowledge Graph Module
 *
 * Builds and queries a graph-based knowledge layer on top of RAG documents:
 * - Entity extraction (people, organizations, concepts, technologies, locations)
 * - Relationship extraction (entity-relationship triples)
 * - Graph storage (in-memory adjacency list + optional pg persistence)
 * - Graph-enhanced retrieval (entity-aware search + relationship traversal)
 * - Community detection for topic clustering
 */

// ─── Types ───

export type EntityType =
  | "person"
  | "organization"
  | "technology"
  | "concept"
  | "location"
  | "document"
  | "method"
  | "metric"
  | "other";

export type RelationshipType =
  | "uses"
  | "implements"
  | "extends"
  | "depends_on"
  | "related_to"
  | "authored_by"
  | "belongs_to"
  | "mentions"
  | "part_of"
  | "precedes"
  | "succeeds"
  | "contrasts"
  | "supports";

export interface KGEntity {
  id: string;
  name: string;
  type: EntityType;
  /** Properties extracted from context */
  properties: Record<string, unknown>;
  /** Source chunk/document IDs where this entity was found */
  sourceIds: string[];
  /** Frequency of mention across all documents */
  frequency: number;
  /** Centrality score (computed during graph analysis) */
  centrality: number;
}

export interface KGRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  /** Confidence score (0-1) for this relationship */
  confidence: number;
  /** Evidence text from the source document */
  evidence: string;
  /** Source document/chunk ID */
  sourceId: string;
}

export interface KGCommunity {
  id: string;
  name: string;
  entityIds: string[];
  /** Keywords that characterize this community */
  keywords: string[];
  /** Coherence score (internal edge density) */
  coherence: number;
}

export interface KnowledgeGraphData {
  entities: Map<string, KGEntity>;
  relationships: KGRelationship[];
  communities: KGCommunity[];
  /** Adjacency list: entityId → list of relationship IDs */
  adjacency: Map<string, string[]>;
}

export interface EntityExtractionResult {
  entities: KGEntity[];
  relationships: KGRelationship[];
}

export interface GraphSearchResult {
  entity: KGEntity;
  score: number;
  /** Path of entities leading to this result */
  path?: string[];
  /** Relationships connecting the path */
  relationships?: KGRelationship[];
}

// ─── Entity Extraction ───

/**
 * Extract entities from text content using pattern-based heuristics.
 * Production deployments should replace this with an LLM-based NER call.
 */
export function extractEntities(
  text: string,
  sourceId: string,
  existingEntities?: Map<string, KGEntity>
): EntityExtractionResult {
  const entities: KGEntity[] = [];
  const relationships: KGRelationship[] = [];
  const existing = existingEntities || new Map<string, KGEntity>();

  // ── Pattern-based entity extraction ──
  const entityPatterns: Array<{ pattern: RegExp; type: EntityType }> = [
    // Organizations (capitalized words followed by Inc/Corp/LLC/Ltd/Group/Studio/Labs/Team)
    { pattern: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Inc|Corp|LLC|Ltd|Group|Studio|Labs|Team|Foundation|Institute|University|Company|Co\.))\b/g, type: "organization" },
    // Technologies (known tech stack)
    { pattern: /\b(React|Next\.js|TypeScript|JavaScript|Python|Rust|Go|PostgreSQL|Neo4j|Redis|Docker|Kubernetes|AWS|GCP|Azure|OpenAI|Groq|OpenRouter|Ollama|pgvector|GraphQL|REST|gRPC|WebSocket|Dify|n8n|LangChain|LlamaIndex|FastAPI|Django|Express|Prisma)\b/gi, type: "technology" },
    // Concepts (common CS/AI terms)
    { pattern: /\b(RAG|Retrieval.Augmented.Generation|embeddings?|vectors?|semantic.search|knowledge.graph|fine.tuning|prompt.engineering|chain.of.thought|few.shot|zero.shot|attention.mechanism|transformer|neural.network|machine.learning|deep.learning|natural.language.processing|computer.vision|reinforcement.learning|hallucination|grounding|chunking|tokeniz|retrieval|inference|training)\b/gi, type: "concept" },
    // Methods/Patterns
    { pattern: /\b(DFS|BFS|A\*|Dijkstra|Kruskal|Prim|binary.search|merge.sort|quick.sort|MapReduce|PageRank|TF-IDF|BM25|Reciprocal.Rank.Fusion|HyDE|Small.to.Big|parent.document|sentence.window)\b/gi, type: "method" },
    // Metrics
    { pattern: /\b(cosine.similarity|euclidean.distance|precision|recall|F1.score|BLEU|ROUGE|accuracy|latency|throughput|tokens.per.second|cost.per.token)\b/gi, type: "metric" },
    // People (simple heuristic: "FirstName LastName" patterns near verbs)
    { pattern: /(?:by|from|authored by|written by|created by|developed by)\s+([A-Z][a-z]+\s[A-Z][a-z]+)/g, type: "person" },
  ];

  const extractedEntityMap = new Map<string, { text: string; type: EntityType; count: number; positions: number[] }>();

  for (const { pattern, type } of entityPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const name = (match[1] || match[0]).trim();
      const normalized = name.toLowerCase();

      if (normalized.length < 2) continue;

      const existing_entry = extractedEntityMap.get(normalized);
      if (existing_entry) {
        existing_entry.count++;
        existing_entry.positions.push(match.index);
      } else {
        extractedEntityMap.set(normalized, {
          text: name,
          type,
          count: 1,
          positions: [match.index],
        });
      }
    }
  }

  // Convert to KGEntity objects, merging with existing
  for (const [, entry] of extractedEntityMap) {
    const id = `entity_${entry.text.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const existingEntity = existing.get(id);

    if (existingEntity) {
      existingEntity.sourceIds.push(sourceId);
      existingEntity.frequency += entry.count;
    } else {
      entities.push({
        id,
        name: entry.text,
        type: entry.type,
        properties: {},
        sourceIds: [sourceId],
        frequency: entry.count,
        centrality: 0,
      });
    }
  }

  // ── Relationship Extraction ──
  // Find co-occurring entities within sliding windows
  const allEntityEntries = Array.from(extractedEntityMap.values());
  const windowSize = 150; // characters

  for (let i = 0; i < allEntityEntries.length; i++) {
    for (let j = i + 1; j < allEntityEntries.length; j++) {
      const a = allEntityEntries[i];
      const b = allEntityEntries[j];

      // Check if they co-occur within the window
      const coOccurs = a.positions.some((posA) =>
        b.positions.some((posB) => Math.abs(posA - posB) < windowSize)
      );

      if (coOccurs) {
        const relType = inferRelationshipType(a.type, b.type, text);
        const evidence = extractEvidenceText(text, a.positions[0], b.positions[0]);

        relationships.push({
          id: `rel_${a.text.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${b.text.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          sourceEntityId: `entity_${a.text.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          targetEntityId: `entity_${b.text.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          type: relType,
          confidence: Math.min(1.0, 0.5 + (a.count + b.count) * 0.05),
          evidence: evidence.slice(0, 200),
          sourceId,
        });
      }
    }
  }

  return { entities, relationships };
}

function inferRelationshipType(typeA: EntityType, typeB: EntityType, context: string): RelationshipType {
  const contextLower = context.toLowerCase();

  if (typeA === "person" && typeB === "organization") return "belongs_to";
  if (typeA === "technology" && typeB === "technology") {
    if (contextLower.includes("depend") || contextLower.includes("require")) return "depends_on";
    if (contextLower.includes("use") || contextLower.includes("integrate")) return "uses";
    return "related_to";
  }
  if (typeA === "technology" && typeB === "concept") return "implements";
  if (typeA === "method" && typeB === "concept") return "implements";
  if (typeA === "concept" && typeB === "concept") {
    if (contextLower.includes("versus") || contextLower.includes("vs") || contextLower.includes("contrast")) return "contrasts";
    if (contextLower.includes("part") || contextLower.includes("component")) return "part_of";
    return "related_to";
  }
  if (typeA === "document" || typeB === "document") return "mentions";
  return "related_to";
}

function extractEvidenceText(text: string, posA: number, posB: number): string {
  const start = Math.min(posA, posB);
  const end = Math.max(posA, posB);
  const contextStart = Math.max(0, start - 40);
  const contextEnd = Math.min(text.length, end + 40);
  return text.slice(contextStart, contextEnd).trim();
}

// ─── Knowledge Graph Builder ───

export class KnowledgeGraph {
  private data: KnowledgeGraphData;

  constructor() {
    this.data = {
      entities: new Map(),
      relationships: [],
      communities: [],
      adjacency: new Map(),
    };
  }

  /** Add entities and relationships from an extraction result. */
  addExtraction(result: EntityExtractionResult, _sourceId?: string): void {
    for (const entity of result.entities) {
      const existing = this.data.entities.get(entity.id);
      if (existing) {
        existing.sourceIds.push(...entity.sourceIds);
        existing.frequency += entity.frequency;
      } else {
        this.data.entities.set(entity.id, entity);
        this.data.adjacency.set(entity.id, []);
      }
    }

    for (const rel of result.relationships) {
      this.data.relationships.push(rel);
      const adjA = this.data.adjacency.get(rel.sourceEntityId);
      const adjB = this.data.adjacency.get(rel.targetEntityId);
      if (adjA) adjA.push(rel.id);
      if (adjB) adjB.push(rel.id);
    }
  }

  /** Process a document's text and add to the graph. */
  addDocument(text: string, sourceId: string): void {
    const result = extractEntities(text, sourceId, this.data.entities);
    this.addExtraction(result, sourceId);
  }

  /** Compute centrality scores for all entities (degree centrality). */
  computeCentrality(): void {
    const maxEdges = Math.max(1, ...Array.from(this.data.adjacency.values()).map((adj) => adj.length));

    for (const [id, adj] of this.data.adjacency) {
      const entity = this.data.entities.get(id);
      if (entity) {
        entity.centrality = adj.length / maxEdges;
      }
    }
  }

  /** Detect communities using label propagation. */
  detectCommunities(maxIterations: number = 20): KGCommunity[] {
    // Initialize each entity with its own community label
    const labels = new Map<string, string>();
    for (const [id] of this.data.entities) {
      labels.set(id, id);
    }

    // Build neighbor map
    const neighbors = new Map<string, Set<string>>();
    for (const [id, adj] of this.data.adjacency) {
      const neighborSet = new Set<string>();
      for (const relId of adj) {
        const rel = this.data.relationships.find((r) => r.id === relId);
        if (rel) {
          if (rel.sourceEntityId !== id) neighborSet.add(rel.sourceEntityId);
          if (rel.targetEntityId !== id) neighborSet.add(rel.targetEntityId);
        }
      }
      neighbors.set(id, neighborSet);
    }

    // Label propagation
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;
      const entityIds = Array.from(this.data.entities.keys());

      for (const id of entityIds) {
        const neighborLabels = new Map<string, number>();
        const nbs = neighbors.get(id) || new Set();

        for (const nb of nbs) {
          const label = labels.get(nb) || nb;
          neighborLabels.set(label, (neighborLabels.get(label) || 0) + 1);
        }

        if (neighborLabels.size === 0) continue;

        // Pick the most frequent neighbor label
        let maxCount = 0;
        let bestLabel = labels.get(id) || id;
        for (const [label, count] of neighborLabels) {
          if (count > maxCount) {
            maxCount = count;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(id)) {
          labels.set(id, bestLabel);
          changed = true;
        }
      }

      if (!changed) break;
    }

    // Group entities by final label
    const groups = new Map<string, string[]>();
    for (const [id, label] of labels) {
      const group = groups.get(label) || [];
      group.push(id);
      groups.set(label, group);
    }

    // Build community objects
    const communities: KGCommunity[] = [];
    let commIdx = 0;

    for (const [, entityIds] of groups) {
      if (entityIds.length < 2) continue; // Skip singleton communities

      // Extract keywords from entity names
      const keywords = entityIds
        .map((id) => this.data.entities.get(id)?.name || "")
        .filter(Boolean)
        .slice(0, 10);

      // Compute internal edge density (coherence)
      let internalEdges = 0;
      const possibleEdges = (entityIds.length * (entityIds.length - 1)) / 2;
      for (const id of entityIds) {
        const adj = this.data.adjacency.get(id) || [];
        for (const relId of adj) {
          const rel = this.data.relationships.find((r) => r.id === relId);
          if (rel && entityIds.includes(rel.sourceEntityId) && entityIds.includes(rel.targetEntityId)) {
            internalEdges++;
          }
        }
      }
      const coherence = possibleEdges > 0 ? internalEdges / possibleEdges : 0;

      communities.push({
        id: `community_${commIdx++}`,
        name: keywords.slice(0, 3).join(" + ") || `Community ${commIdx}`,
        entityIds,
        keywords,
        coherence: Math.round(coherence * 100) / 100,
      });
    }

    this.data.communities = communities.sort((a, b) => b.entityIds.length - a.entityIds.length);
    return this.data.communities;
  }

  /** Graph-enhanced search: find entities related to a query text. */
  searchByEntities(queryText: string, limit: number = 10): GraphSearchResult[] {
    const queryLower = queryText.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);
    const results: GraphSearchResult[] = [];

    for (const [, entity] of this.data.entities) {
      let score = 0;
      const nameLower = entity.name.toLowerCase();

      // Exact name match
      if (queryLower.includes(nameLower) || nameLower.includes(queryLower)) {
        score += 1.0;
      }

      // Term overlap
      for (const term of queryTerms) {
        if (nameLower.includes(term)) score += 0.3;
      }

      // Boost by centrality
      score += entity.centrality * 0.2;

      // Boost by frequency
      score += Math.min(0.3, entity.frequency * 0.05);

      if (score > 0.1) {
        results.push({ entity, score: Math.min(1.0, score) });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Traverse relationships from an entity (BFS up to maxDepth). */
  traverse(
    startEntityId: string,
    maxDepth: number = 2,
    maxResults: number = 20
  ): Array<{ entity: KGEntity; depth: number; via: KGRelationship }> {
    const visited = new Set<string>();
    const queue: Array<{ entityId: string; depth: number }> = [{ entityId: startEntityId, depth: 0 }];
    const results: Array<{ entity: KGEntity; depth: number; via: KGRelationship }> = [];

    while (queue.length > 0 && results.length < maxResults) {
      const { entityId, depth } = queue.shift()!;
      if (visited.has(entityId) || depth > maxDepth) continue;
      visited.add(entityId);

      if (depth > 0) {
        const entity = this.data.entities.get(entityId);
        if (entity) {
          // Find the relationship that got us here
          const rel = this.data.relationships.find(
            (r) => (r.sourceEntityId === entityId || r.targetEntityId === entityId) &&
                   !visited.has(r.sourceEntityId === entityId ? r.targetEntityId : r.sourceEntityId)
          );
          if (rel) results.push({ entity, depth, via: rel });
        }
      }

      // Queue neighbors
      const adj = this.data.adjacency.get(entityId) || [];
      for (const relId of adj) {
        const rel = this.data.relationships.find((r) => r.id === relId);
        if (!rel) continue;
        const nextId = rel.sourceEntityId === entityId ? rel.targetEntityId : rel.sourceEntityId;
        if (!visited.has(nextId)) {
          queue.push({ entityId: nextId, depth: depth + 1 });
        }
      }
    }

    return results;
  }

  /** Get entities by type. */
  getByType(type: EntityType, limit?: number): KGEntity[] {
    const results = Array.from(this.data.entities.values())
      .filter((e) => e.type === type)
      .sort((a, b) => b.frequency - a.frequency);
    return limit ? results.slice(0, limit) : results;
  }

  /** Get relationships for an entity. */
  getRelationships(entityId: string): KGRelationship[] {
    return this.data.relationships.filter(
      (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId
    );
  }

  /** Get community membership. */
  getCommunity(entityId: string): KGCommunity | undefined {
    return this.data.communities.find((c) => c.entityIds.includes(entityId));
  }

  /** Export the graph as a serializable object. */
  serialize(): {
    entities: KGEntity[];
    relationships: KGRelationship[];
    communities: KGCommunity[];
  } {
    return {
      entities: Array.from(this.data.entities.values()),
      relationships: this.data.relationships,
      communities: this.data.communities,
    };
  }

  /** Get graph statistics. */
  getStats(): {
    entityCount: number;
    relationshipCount: number;
    communityCount: number;
    entityTypes: Record<EntityType, number>;
    avgCentrality: number;
    density: number;
  } {
    const entities = Array.from(this.data.entities.values());
    const entityTypes = {} as Record<EntityType, number>;
    let totalCentrality = 0;

    for (const e of entities) {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
      totalCentrality += e.centrality;
    }

    const n = entities.length;
    const maxPossibleEdges = n * (n - 1) / 2;

    return {
      entityCount: n,
      relationshipCount: this.data.relationships.length,
      communityCount: this.data.communities.length,
      entityTypes: entityTypes as Record<EntityType, number>,
      avgCentrality: n > 0 ? totalCentrality / n : 0,
      density: maxPossibleEdges > 0 ? this.data.relationships.length / maxPossibleEdges : 0,
    };
  }
}
