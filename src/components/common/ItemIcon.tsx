"use client";

import React, { useState } from "react";
import {
  Globe,
  Database,
  Code,
  Terminal,
  Zap,
  Brain,
  BookOpen,
  Wrench,
  MessageSquare,
  BarChart3,
  Monitor,
  Cpu,
  ShieldCheck,
  Sparkles,
  CloudSun,
  BadgeDollarSign,
  Search,
  Boxes,
  ShoppingBag,
  Github,
  Bot,
  Mail,
  FolderTree,
} from "lucide-react";
import { clsx } from "clsx";

interface ItemIconProps {
  name: string;
  category?: string;
  tags?: string[];
  owner?: string;
  repoUrl?: string;
  logoUrl?: string;
  iconName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function ItemIcon({
  name,
  category,
  tags = [],
  owner,
  repoUrl,
  logoUrl,
  iconName,
  size = "md",
  className,
}: ItemIconProps) {
  const [imgError, setImgError] = useState(false);

  // 1. Determine image source URL
  let resolvedImgUrl = logoUrl;
  if (!resolvedImgUrl && repoUrl && repoUrl.includes("github.com/")) {
    const match = repoUrl.match(/github\.com\/([^/]+)/);
    if (match && match[1] && match[1] !== "modelcontextprotocol") {
      resolvedImgUrl = `https://github.com/${match[1]}.png?size=64`;
    }
  }
  if (!resolvedImgUrl && owner && owner !== "community" && owner !== "modelcontextprotocol") {
    resolvedImgUrl = `https://github.com/${owner}.png?size=64`;
  }

  // 2. Select matching vector icon if image fails or is unavailable
  const IconComponent = getFallbackIcon(name, category, tags, iconName);

  const sizeClasses = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  if (resolvedImgUrl && !imgError) {
    return (
      <div
        className={clsx(
          "rounded border border-slate-200 dark:border-indigo-950/80 bg-white dark:bg-[#0c0c12] p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs",
          sizeClasses[size],
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedImgUrl}
          alt={name}
          className="w-full h-full object-contain rounded-xs"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded border border-indigo-300 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs",
        sizeClasses[size],
        className
      )}
    >
      <IconComponent className={iconSizes[size]} />
    </div>
  );
}

function getFallbackIcon(
  name = "",
  category = "",
  tags: string[] = [],
  iconName?: string
): React.ComponentType<{ className?: string }> {
  const query = `${name} ${category} ${tags.join(" ")} ${iconName || ""}`.toLowerCase();

  // Name / Keyword Heuristics
  if (query.includes("github") || query.includes("git")) return Github;
  if (query.includes("postgres") || query.includes("mysql") || query.includes("sql") || query.includes("supabase") || query.includes("database") || query.includes("mongo") || query.includes("db")) return Database;
  if (query.includes("qdrant") || query.includes("pinecone") || query.includes("vector") || query.includes("weaviate") || query.includes("chroma")) return Boxes;
  if (query.includes("weather") || query.includes("forecast") || query.includes("climate") || query.includes("meteo")) return CloudSun;
  if (query.includes("currency") || query.includes("forex") || query.includes("finance") || query.includes("money") || query.includes("rate") || query.includes("bank") || query.includes("stripe")) return BadgeDollarSign;
  if (query.includes("search") || query.includes("brave") || query.includes("google") || query.includes("lookup") || query.includes("query")) return Search;
  if (query.includes("browser") || query.includes("puppeteer") || query.includes("playwright") || query.includes("scrape") || query.includes("crawl")) return Monitor;
  if (query.includes("slack") || query.includes("discord") || query.includes("chat") || query.includes("message") || query.includes("telegram")) return MessageSquare;
  if (query.includes("mail") || query.includes("email") || query.includes("gmail") || query.includes("resend")) return Mail;
  if (query.includes("wiki") || query.includes("book") || query.includes("knowledge") || query.includes("doc")) return BookOpen;
  if (query.includes("code") || query.includes("developer") || query.includes("typescript") || query.includes("python") || query.includes("runtime")) return Code;
  if (query.includes("terminal") || query.includes("shell") || query.includes("bash") || query.includes("cli") || query.includes("command")) return Terminal;
  if (query.includes("ai") || query.includes("agent") || query.includes("llm") || query.includes("openai") || query.includes("claude") || query.includes("gemini") || query.includes("gpt")) return Brain;
  if (query.includes("bot") || query.includes("assistant")) return Bot;
  if (query.includes("analysis") || query.includes("analytics") || query.includes("metrics") || query.includes("chart")) return BarChart3;
  if (query.includes("security") || query.includes("auth") || query.includes("crypto") || query.includes("vault")) return ShieldCheck;
  if (query.includes("cloud") || query.includes("aws") || query.includes("azure") || query.includes("gcp") || query.includes("docker") || query.includes("devops")) return Cpu;
  if (query.includes("file") || query.includes("fs") || query.includes("folder") || query.includes("disk")) return FolderTree;
  if (query.includes("shop") || query.includes("commerce") || query.includes("product") || query.includes("cart")) return ShoppingBag;
  if (query.includes("geo") || query.includes("map") || query.includes("country") || query.includes("ip") || query.includes("network")) return Globe;

  // Category fallback
  switch (category.toUpperCase()) {
    case "DATABASES":
    case "DATA":
      return Database;
    case "BROWSER AUTOMATION":
      return Monitor;
    case "DEVELOPER TOOLS":
    case "CODING":
      return Code;
    case "RESEARCH":
    case "KNOWLEDGE":
    case "KNOWLEDGE & MEMORY":
      return BookOpen;
    case "COMMUNICATION":
      return MessageSquare;
    case "ANALYSIS":
      return BarChart3;
    case "AUTOMATION":
    case "OS AUTOMATION":
      return Zap;
    case "SECURITY":
      return ShieldCheck;
    case "CLOUD PLATFORMS":
    case "DEVOPS & CLOUD":
      return Cpu;
    case "FINANCE & FINTECH":
      return BadgeDollarSign;
    case "PRODUCTIVITY":
      return Wrench;
    case "AI & REASONING":
      return Brain;
    default:
      return Sparkles;
  }
}
