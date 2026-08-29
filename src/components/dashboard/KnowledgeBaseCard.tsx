"use client";

import React from "react";
import Link from "next/link";
import { Database, FileText, Plus, ArrowUpRight, Layers } from "lucide-react";
import { RagInsightsDTO } from "@/types/dashboard";

interface KnowledgeBaseCardProps {
  insights: RagInsightsDTO;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function KnowledgeBaseCard({ insights }: KnowledgeBaseCardProps) {
  return (
    <div className="p-5 rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/60 space-y-4 h-full shadow-sm font-mono flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              KNOWLEDGE BASE & RAG
            </h3>
          </div>
          <Link
            href="/dashboard/knowledge"
            className="text-[11px] text-violet-700 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 font-semibold flex items-center gap-1"
          >
            [ BROWSE ] <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Chunks & Documents Banner */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded border border-violet-200 dark:border-violet-950/60 bg-violet-50/50 dark:bg-violet-950/20 space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase">Documents</span>
            <div className="text-xl font-pixel text-slate-900 dark:text-slate-100">
              {insights.totalDocuments}
            </div>
          </div>
          <div className="p-2.5 rounded border border-violet-200 dark:border-violet-950/60 bg-violet-50/50 dark:bg-violet-950/20 space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase">Vector Chunks</span>
            <div className="text-xl font-pixel text-slate-900 dark:text-slate-100">
              {insights.totalChunks.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Collections Breakdown */}
        {insights.topCollections.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Layers className="h-3 w-3 text-violet-500" /> Active Collections:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {insights.topCollections.map((c) => (
                <span
                  key={c.collection}
                  className="text-[10px] px-2 py-0.5 rounded border border-slate-200 dark:border-indigo-950 bg-slate-50 dark:bg-black/50 text-slate-700 dark:text-slate-300 flex items-center gap-1 font-medium"
                >
                  <span className="font-semibold">{c.collection}</span>
                  <span className="text-violet-600 dark:text-violet-400">({c.chunkCount} chunks)</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Ingested Documents */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Recent Documents:
          </div>
          {insights.recentDocuments.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">No documents indexed in vector database yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-indigo-950/60 text-xs">
              {insights.recentDocuments.map((doc) => (
                <li key={doc.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                      {doc.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDate(doc.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-indigo-950/60">
        <Link
          href="/dashboard/knowledge"
          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded border border-violet-400/80 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 text-xs font-semibold hover:border-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> UPLOAD & INGEST DOCUMENTS
        </Link>
      </div>
    </div>
  );
}
