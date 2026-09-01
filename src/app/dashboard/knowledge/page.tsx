"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Database,
  UploadCloud,
  Search,
  FileText,
  Layers,
  Sparkles,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Sliders,
  Eye,
  Zap,
  Cpu,
  ShieldCheck,
  Tag,
  Copy,
  Check,
  Activity,
  Compass,
  Scale,
  GitMerge,
} from "lucide-react";
import { previewChunks } from "@/modules/rag/chunkingService";
import { ClusterMapData } from "@/modules/rag/clusterVisualizer";
import { RAGTriadEvaluationReport } from "@/modules/rag/evaluation";

const SAMPLE_DOCUMENTS = [
  {
    title: "AI Engineer Architecture: Production RAG with pgvector",
    collection: "engineering",
    content: `# Production RAG Architecture with pgvector

## Overview
Retrieval-Augmented Generation (RAG) combines dense semantic retrieval with Large Language Models (LLMs) to ground responses in verified, proprietary knowledge. By using PostgreSQL with the \`pgvector\` extension, applications eliminate external vector database overhead and maintain transactional consistency within their primary relational database.

## Ingestion & Chunking Pipeline
1. **Document Loading**: Multi-format document ingestion from Markdown, PDF, text files, and web scrapers.
2. **Hierarchical Recursive Chunking**: Splitting documents across logical boundaries (\`\\n\\n\`, \`\\n\`, sentences, words) while maintaining 150-character contextual overlap.
3. **Context Injection**: Prepending section headings (e.g. H1 > H2) to each chunk so isolated text retains full contextual awareness during vector embedding.

## Dense Vector Embeddings
- Models: OpenAI \`text-embedding-3-small\` (1536 dimensions) or open-source high-dimensional semantic representations.
- Normalization: L2 unit-norm sphere projection ensures that Cosine Distance (\`<=>\`) equals 1 - Inner Product (\`<#>\`), accelerating indexing.

## Semantic Search & Cosine Distance
Queries are converted into dense embeddings and matched against chunk vectors using pgvector's HNSW (Hierarchical Navigable Small World) index:
\`\`\`sql
SELECT id, document_id, content, 1 - (embedding <=> query_vector) AS relevance
FROM document_chunks
WHERE collection = 'engineering'
ORDER BY embedding <=> query_vector ASC
LIMIT 5;
\`\`\`

## Prompt Augmentation & Grounding
Retrieved top-K chunks are injected into the prompt with structured citations, ensuring 0% hallucination and full source provenance.`,
  },
  {
    title: "Google Agent-to-Agent (A2A) Protocol Specification",
    collection: "protocols",
    content: `# Google Agent-to-Agent (A2A) Protocol

## Architecture & Specification
The Google Agent-to-Agent (A2A) Protocol provides a standardized communication layer enabling autonomous AI agents to discover, negotiate, and collaborate across heterogeneous frameworks.

## Key Subsystems
1. **Agent Manifest Discovery (\`/.well-known/agent.json\`)**: Exposes an agent's identity, capabilities, input/output JSON schemas, and authentication schemes.
2. **Task Delegation (\`/api/a2a/tasks\`)**: Allows client agents to submit structured multi-step tasks with Server-Sent Events (SSE) token streaming.
3. **Multi-Agent Channels (\`/api/a2a/messages\`)**: Facilitates round-robin, debate, and consensus deliberations between specialized agents (e.g. Proposer vs Critic).
4. **Resilience & Fallbacks**: Built-in circuit breakers, timeout budgets, and autonomous synthesis fallback modes.`,
  },
];

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<
    "ingest" | "search" | "cluster_map" | "documents" | "architecture"
  >("ingest");

  // Ingest State
  const [title, setTitle] = useState("Production RAG Architecture with pgvector");
  const [collection, setCollection] = useState("engineering");
  const [content, setContent] = useState(SAMPLE_DOCUMENTS[0].content);
  const [strategy, setStrategy] = useState<"recursive" | "markdown" | "semantic" | "fixed">("markdown");
  const [useParentChunking, setUseParentChunking] = useState(true);
  const [maxChunkSize, setMaxChunkSize] = useState(500);
  const [overlap, setOverlap] = useState(120);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState<Record<string, unknown> | null>(null);

  // Live Chunk Preview
  const [chunkPreview, setChunkPreview] = useState(() => previewChunks(content, { strategy, maxChunkSize, overlap }));

  // Search State
  const [searchQuery, setSearchQuery] = useState("How does pgvector cosine distance search work?");
  const [searchCollection, setSearchCollection] = useState("");
  const [searchLimit, setSearchLimit] = useState(5);
  const [minScore, setMinScore] = useState(0.2);
  const [useHybridSearch, setUseHybridSearch] = useState(true);
  const [expandToParent, setExpandToParent] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [qaAnswer, setQaAnswer] = useState<{
    answer: string;
    sources: Array<{ title: string; score: number; snippet: string; section?: string }>;
  } | null>(null);
  const [isGeneratingQA, setIsGeneratingQA] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState<RAGTriadEvaluationReport | null>(null);

  // Cluster Map State
  const [clusterData, setClusterData] = useState<ClusterMapData | null>(null);
  const [isLoadingCluster, setIsLoadingCluster] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Documents State
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>([]);
  const [collections, setCollections] = useState<
    Array<{ name: string; documentCount: number; chunkCount: number; totalTokens: number }>
  >([]);
  const [stats, setStats] = useState<{ documentCount: number; chunkCount: number; storageEngine: string } | null>(
    null
  );
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDocChunks, setSelectedDocChunks] = useState<Record<string, unknown> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update preview when content or chunk settings change
  useEffect(() => {
    try {
      const res = previewChunks(content, { strategy, maxChunkSize, overlap });
      setChunkPreview(res);
    } catch {
      // Ignore preview errors
    }
  }, [content, strategy, maxChunkSize, overlap]);

  // Load documents and collections
  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const res = await fetch("/api/rag/documents?includeCollections=true");
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.documents || []);
        setCollections(json.collections || []);
        setStats(json.stats || null);
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Load 2D Vector Cluster Data
  const fetchClusterData = useCallback(async (queryText?: string) => {
    setIsLoadingCluster(true);
    try {
      const queryParam = queryText || searchQuery;
      const res = await fetch(
        `/api/rag/cluster?${queryParam ? `query=${encodeURIComponent(queryParam)}` : ""}${
          searchCollection ? `&collection=${encodeURIComponent(searchCollection)}` : ""
        }`
      );
      if (res.ok) {
        const json = await res.json();
        setClusterData(json);
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingCluster(false);
    }
  }, [searchQuery, searchCollection]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (activeTab === "cluster_map") {
      fetchClusterData();
    }
  }, [activeTab, fetchClusterData]);

  // Render 2D Vector Canvas
  useEffect(() => {
    if (activeTab !== "cluster_map" || !clusterData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Draw Grid & Axes
    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Origin Axes
    ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Map color by collection
    const colorMap = new Map<string, string>();
    clusterData.collections.forEach((c) => colorMap.set(c.name, c.color));

    // Draw Cluster Points
    for (const pt of clusterData.points) {
      const px = width / 2 + pt.x * (width * 0.42);
      const py = height / 2 - pt.y * (height * 0.42);

      const color = colorMap.get(pt.collection) || "#6366f1";

      // Outer glow
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = `${color}40`;
      ctx.fill();

      // Core point
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw Query Point Pin (if available)
    if (clusterData.queryPoint) {
      const qx = width / 2 + clusterData.queryPoint.x * (width * 0.42);
      const qy = height / 2 - clusterData.queryPoint.y * (height * 0.42);

      ctx.beginPath();
      ctx.arc(qx, qy, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(qx, qy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#ef4444";
      ctx.fillText("QUERY PIN", qx + 8, qy - 8);
    }
  }, [clusterData, activeTab]);

  // Handle Ingest
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !title.trim()) return;

    setIsIngesting(true);
    setIngestSuccess(null);

    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          collection: collection || "default",
          content,
          mimeType: strategy === "markdown" ? "text/markdown" : "text/plain",
          chunking: {
            strategy,
            maxChunkSize,
            overlap,
            parentChunkSize: useParentChunking ? 1200 : undefined,
          },
          useParentChunking,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setIngestSuccess(json.document);
        fetchDocuments();
      } else {
        alert(json.error || "Failed to ingest document");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error during ingestion");
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setQaAnswer(null);
    setEvaluationReport(null);

    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          collection: searchCollection || undefined,
          limit: searchLimit,
          minScore,
          useHybridSearch,
          expandToParent,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSearchResults(json.context || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Grounded QA & Evaluation
  const handleGenerateQA = async () => {
    if (!searchQuery.trim()) return;

    setIsGeneratingQA(true);
    setEvaluationReport(null);

    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          collection: searchCollection || undefined,
          limit: searchLimit,
          minScore,
          generateAnswer: true,
          expandToParent,
        }),
      });

      const json = await res.json();
      if (res.ok && json.result) {
        setQaAnswer(json.result);

        // Run automated RAG Triad Evaluation
        const evalRes = await fetch("/api/rag/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            contextChunks: searchResults.map((r) => ({ content: r.content as string, score: r.score as number })),
            generatedAnswer: json.result.answer,
          }),
        });

        if (evalRes.ok) {
          const evalJson = await evalRes.json();
          setEvaluationReport(evalJson.evaluation);
        }
      }
    } catch (err) {
      console.error("QA generation failed:", err);
    } finally {
      setIsGeneratingQA(false);
    }
  };

  // Handle Delete Document
  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document and all its pgvector embeddings?")) return;

    try {
      const res = await fetch(`/api/rag/documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDocuments();
        if (selectedDocChunks?.id === id) {
          setSelectedDocChunks(null);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Handle Inspect Document Chunks
  const handleInspectDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/rag/documents/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedDocChunks(json.document);
      }
    } catch (err) {
      console.error("Failed to load document chunks:", err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-indigo-50/50 dark:from-indigo-950/40 dark:via-black/60 dark:to-indigo-950/20 shadow-sm backdrop-blur-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50">
              ADVANCED RAG ARCHITECTURE
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> PGVECTOR (HYBRID RRF)
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> SMALL-TO-BIG RETRIEVAL
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Database className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Knowledge Base & pgvector RAG Engine
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Hierarchical chunking, 1536D normalized embeddings, Hybrid Reciprocal Rank Fusion (RRF), Small-to-Big parent context expansion, 2D PCA cluster mapping, and RAG Triad observability.
          </p>
        </div>

        {/* Global Quick Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 shadow-sm text-center min-w-[100px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Documents</div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats?.documentCount ?? documents.length}
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 shadow-sm text-center min-w-[100px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Vector Chunks</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {stats?.chunkCount ?? "0"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-indigo-900/40 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ingest")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 shrink-0 ${
            activeTab === "ingest"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <UploadCloud className="h-4 w-4" /> 1. Ingestion & Chunking
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 shrink-0 ${
            activeTab === "search"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Search className="h-4 w-4" /> 2. Hybrid Search & RAG
        </button>
        <button
          onClick={() => setActiveTab("cluster_map")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 shrink-0 ${
            activeTab === "cluster_map"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Compass className="h-4 w-4" /> 3. 2D Vector Cluster Map (PCA)
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 shrink-0 ${
            activeTab === "documents"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Layers className="h-4 w-4" /> 4. Collections ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("architecture")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-150 shrink-0 ${
            activeTab === "architecture"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-indigo-950/40"
          }`}
        >
          <Cpu className="h-4 w-4" /> 5. Architecture & RRF Benchmarks
        </button>
      </div>

      {/* TAB 1: INGESTION & CHUNKING */}
      {activeTab === "ingest" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <form
              onSubmit={handleIngest}
              className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Document Ingestion & Chunking Studio
                </h2>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px]">Load Sample:</span>
                  {SAMPLE_DOCUMENTS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTitle(s.title);
                        setCollection(s.collection);
                        setContent(s.content);
                      }}
                      className="px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-800 text-[10px] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                    >
                      {s.collection}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Collection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. System Architecture Whitepaper"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Collection Namespace
                  </label>
                  <input
                    type="text"
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. engineering, research, legal"
                  />
                </div>
              </div>

              {/* Chunking Settings */}
              <div className="p-3.5 rounded-lg border border-indigo-100 dark:border-indigo-950 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Chunking Engine Parameters
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={useParentChunking}
                      onChange={(e) => setUseParentChunking(e.target.checked)}
                      className="rounded border-purple-400 text-purple-600"
                    />
                    Small-to-Big Parent Context
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["markdown", "recursive", "semantic", "fixed"] as const).map((strat) => (
                    <button
                      key={strat}
                      type="button"
                      onClick={() => setStrategy(strat)}
                      className={`px-2.5 py-1.5 rounded border text-[11px] font-medium capitalize transition-all ${
                        strategy === strat
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                          : "border-slate-300 dark:border-indigo-900/50 bg-white dark:bg-black text-slate-700 dark:text-slate-300 hover:border-indigo-400"
                      }`}
                    >
                      {strat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Leaf Chunk Size:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{maxChunkSize} chars</span>
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="1200"
                      step="50"
                      value={maxChunkSize}
                      onChange={(e) => setMaxChunkSize(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-600 dark:text-slate-400">Chunk Overlap:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{overlap} chars</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="20"
                      value={overlap}
                      onChange={(e) => setOverlap(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Content Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Content (Markdown / Plaintext)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  required
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                  placeholder="Paste or write document text here..."
                />
              </div>

              <button
                type="submit"
                disabled={isIngesting || !content.trim()}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Chunking, Embedding (1536D) & Storing in pgvector...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Ingest Document into pgvector
                  </>
                )}
              </button>
            </form>

            {ingestSuccess && (
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 animate-fadeIn space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Document Successfully Ingested & Indexed in pgvector!
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  <div>
                    Doc ID: <span className="font-mono font-bold">{(ingestSuccess.documentId as string)?.slice(0, 10)}...</span>
                  </div>
                  <div>
                    Chunks: <span className="font-bold">{ingestSuccess.chunkCount as number}</span>
                  </div>
                  <div>
                    Tokens: <span className="font-bold">{ingestSuccess.totalTokens as number}</span>
                  </div>
                  <div>
                    Embedding: <span className="font-bold">{ingestSuccess.embeddingModel as string}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Chunk Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-indigo-900/30 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Live Chunking Visualizer
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
                  {chunkPreview.stats.chunkCount} Chunks
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500">Characters</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {chunkPreview.stats.totalChars}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500">Est. Tokens</div>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {chunkPreview.stats.totalTokens}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500">Avg Chars/Chunk</div>
                  <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {chunkPreview.stats.avgChunkChars}
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {chunkPreview.chunks.map((chunk, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/50 bg-slate-50/70 dark:bg-slate-950/70 space-y-2 text-xs hover:border-indigo-400 transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-200/50 dark:border-slate-800 pb-1.5">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        Chunk #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {chunk.metadata.section && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px]">
                            {chunk.metadata.section}
                          </span>
                        )}
                        <span>
                          {chunk.metadata.charCount} chars • {chunk.metadata.tokenCount} tokens
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HYBRID SEARCH & RAG */}
      {activeTab === "search" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Hybrid Semantic Retrieval (Dense + Sparse RRF) & RAG
              </h2>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useHybridSearch}
                    onChange={(e) => setUseHybridSearch(e.target.checked)}
                    className="rounded border-indigo-400 text-indigo-600"
                  />
                  <Scale className="h-3.5 w-3.5" /> Hybrid RRF Ranking
                </label>
                <label className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expandToParent}
                    onChange={(e) => setExpandToParent(e.target.checked)}
                    className="rounded border-purple-400 text-purple-600"
                  />
                  <GitMerge className="h-3.5 w-3.5" /> Small-to-Big Context
                </label>
              </div>
            </div>

            {/* Quick Queries */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 text-[11px]">Quick Queries:</span>
              {[
                "How does pgvector cosine distance search work?",
                "Explain A2A protocol task delegation",
                "What is hierarchical chunking with overlap?",
                "How does Reciprocal Rank Fusion combine dense and sparse search?",
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSearchQuery(q);
                    setTimeout(() => handleSearch(), 50);
                  }}
                  className="px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter a natural language search query or question..."
                  className="w-full pl-4 pr-24 py-3.5 rounded-xl border border-slate-300 dark:border-indigo-900/60 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-sans"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Collection:</span>
                  <select
                    value={searchCollection}
                    onChange={(e) => setSearchCollection(e.target.value)}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <option value="">All Collections</option>
                    {collections.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.chunkCount} chunks)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Top-K:</span>
                  <select
                    value={searchLimit}
                    onChange={(e) => setSearchLimit(parseInt(e.target.value, 10))}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <option value={3}>3 Chunks</option>
                    <option value={5}>5 Chunks</option>
                    <option value={10}>10 Chunks</option>
                    <option value={20}>20 Chunks</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Min Similarity:</span>
                  <span className="font-bold text-indigo-600">{Math.round(minScore * 100)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={minScore}
                    onChange={(e) => setMinScore(parseFloat(e.target.value))}
                    className="w-24 accent-indigo-600"
                  />
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={handleGenerateQA}
                    disabled={isGeneratingQA || !searchQuery.trim()}
                    className="px-3.5 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isGeneratingQA ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Synthesize Grounded RAG Answer
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RAG Triad Observability Card */}
          {evaluationReport && (
            <div className="p-6 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-black/60 shadow-md space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-indigo-900/30 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-indigo-950 dark:text-indigo-200">
                  <Activity className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  RAG Triad Observability & Grounding Audit
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    evaluationReport.overallGrade === "A"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : evaluationReport.overallGrade === "B"
                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  Grade {evaluationReport.overallGrade} ({Math.round(evaluationReport.overallScore * 100)}%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-slate-950 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>1. Context Relevance</span>
                    <span className="text-indigo-600">
                      {Math.round(evaluationReport.contextRelevance.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{evaluationReport.contextRelevance.details}</p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-slate-950 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>2. Groundedness</span>
                    <span className="text-emerald-600">
                      {Math.round(evaluationReport.groundedness.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{evaluationReport.groundedness.details}</p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-slate-50 dark:bg-slate-950 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>3. Answer Relevance</span>
                    <span className="text-purple-600">
                      {Math.round(evaluationReport.answerRelevance.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{evaluationReport.answerRelevance.details}</p>
                </div>
              </div>
            </div>
          )}

          {/* Grounded QA Answer Display */}
          {qaAnswer && (
            <div className="p-6 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/50 dark:from-purple-950/30 dark:via-black dark:to-indigo-950/20 shadow-md space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-900/40 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-purple-950 dark:text-purple-200">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Grounded AI Answer (Retrieved via pgvector)
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  {qaAnswer.sources?.length} Sources Cited
                </span>
              </div>
              <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed font-sans whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                {qaAnswer.answer}
              </div>
            </div>
          )}

          {/* Search Results List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Retrieved Vector Chunks ({searchResults.length})
              </h3>
            </div>

            {searchResults.length === 0 && !isSearching ? (
              <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-indigo-900/40 text-slate-500">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No vector matches found. Ingest new documents or adjust threshold.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {searchResults.map((result, idx) => {
                  const scorePct = Math.round(((result.score as number) || 0) * 100);
                  const searchType = (result.searchType as string) || "dense";

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black/60 shadow-sm space-y-3 hover:border-indigo-400 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-indigo-900/30 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {result.title as string}
                          </span>
                          {Boolean(result.section) && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px]">
                              {result.section as string}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                            {searchType}
                          </span>
                        </div>

                        {/* Similarity Meter */}
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {scorePct}% Relevance
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-900">
                        {result.content as string}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>
                          Collection: <strong className="text-slate-700 dark:text-slate-300">{result.collection as string}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(result.content as string, `result-${idx}`)}
                          className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {copiedId === `result-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          Copy Context Chunk
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: 2D VECTOR CLUSTER MAP (PCA) */}
      {activeTab === "cluster_map" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  2D Principal Component Analysis (PCA) Vector Space
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  1536-dimensional dense embedding vectors mathematically projected to 2D coordinates.
                </p>
              </div>
              <button
                onClick={() => fetchClusterData()}
                disabled={isLoadingCluster}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950 shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCluster ? "animate-spin" : ""}`} /> Recalculate PCA
              </button>
            </div>

            {/* Collections Legend */}
            {clusterData && clusterData.collections.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <span className="text-slate-500 text-[11px]">Collections:</span>
                {clusterData.collections.map((coll) => (
                  <div key={coll.name} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: coll.color }} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coll.name}</span>
                    <span className="text-slate-500 text-[10px]">({coll.count})</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="font-semibold text-red-700 dark:text-red-300">Query Pin</span>
                </div>
              </div>
            )}

            {/* Canvas */}
            <div className="relative border border-slate-200 dark:border-indigo-900/60 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center p-4">
              <canvas
                ref={canvasRef}
                width={800}
                height={500}
                className="w-full max-w-[800px] h-[500px] rounded-lg cursor-crosshair"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STORED DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                PostgreSQL pgvector Document Store
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                All stored knowledge bases, vector chunks, and collection partitions in PostgreSQL.
              </p>
            </div>
            <button
              onClick={fetchDocuments}
              disabled={isLoadingDocs}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDocs ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {collections.map((coll) => (
              <div
                key={coll.name}
                className="p-4 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> {coll.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {coll.documentCount} Docs
                  </span>
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {coll.chunkCount} <span className="text-xs font-normal text-slate-500">Vector Chunks</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Total Tokens: ~{coll.totalTokens.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-indigo-900/30 font-bold text-xs">
              Ingested Documents ({documents.length})
            </div>

            {documents.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No documents ingested yet. Go to the "Ingestion & Chunking" tab to ingest your first document.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-indigo-900/20 text-xs">
                {documents.map((doc) => (
                  <div
                    key={doc.id as string}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-indigo-950/20 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        {doc.title as string}
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px]">
                          {doc.collection as string}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>ID: {(doc.id as string).slice(0, 10)}...</span>
                        <span>{doc.chunkCount as number} chunks</span>
                        <span>{doc.tokenCount as number} tokens</span>
                        <span>{new Date(doc.createdAt as string).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInspectDoc(doc.id as string)}
                        className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-indigo-900/60 hover:bg-slate-100 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> View Chunks
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id as string)}
                        className="px-2.5 py-1.5 rounded border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedDocChunks && (
            <div className="p-6 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-black/90 shadow-xl space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Chunks for: {selectedDocChunks.title as string}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedDocChunks.chunkCount as number} total vector chunks
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDocChunks(null)}
                  className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {((selectedDocChunks.chunks as Array<Record<string, unknown>>) || []).map((chunk, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span>Chunk #{chunk.chunkIndex as number}</span>
                      <span>{chunk.tokenCount as number} tokens</span>
                    </div>
                    <p className="text-[11px] font-mono whitespace-pre-wrap">{chunk.content as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ARCHITECTURE */}
      {activeTab === "architecture" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-indigo-900/40 bg-white dark:bg-black/60 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Advanced RAG Architecture & Reciprocal Rank Fusion (RRF)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This end-to-end implementation combines Hybrid Search (pgvector dense vector search + sparse keyword search), Reciprocal Rank Fusion, Small-to-Big parent chunk expansion, 2D PCA vector cluster mapping, and automated RAG Triad observability.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-4">
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs space-y-2">
                <div className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> 1. Ingestion
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Parses Markdown, PDF, plaintext with section metadata & parent context linking.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 text-xs space-y-2">
                <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <Sliders className="h-4 w-4" /> 2. Small-to-Big
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Indexes 200-char leaf chunks while preserving 1200-char parent section context.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-2">
                <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> 3. 1536D Vectors
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  OpenAI text-embedding-3 / Open Models / Local normalized embeddings.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs space-y-2">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Scale className="h-4 w-4" /> 4. Hybrid RRF
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Combines pgvector cosine distance (<code className="font-mono">&lt;=&gt;</code>) with sparse full-text keyword ranking.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-2">
                <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> 5. RAG Triad Audit
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Evaluates Context Relevance, Groundedness, and Answer Relevance on every query.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
