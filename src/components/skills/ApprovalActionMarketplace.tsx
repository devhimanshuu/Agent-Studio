"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  ShieldCheck,
  Search,
  Wand2,
} from "lucide-react";
import { clsx } from "clsx";
import { OpenApiIntegrationDTO } from "@/types/openapi";
import { McpServerDTO } from "@/types/mcp";
import { openApiToolRegistryName } from "@/modules/openapi/dynamicTool";
import { mcpToolRegistryName } from "@/modules/mcp/toolAdapter";
import { toast } from "@/stores/toastStore";

export interface ActionMarketplaceItem {
  id: string;
  name: string;
  category: "DISCOVERED" | "FINTECH" | "DEVOPS" | "CRM_WEBHOOKS" | "SECURITY";
  description: string;
  source?: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM";
}

const MARKETPLACE_PRESETS: ActionMarketplaceItem[] = [
  // ─── FINTECH & PAYMENTS ───
  {
    id: "create_task",
    name: "create_task",
    category: "FINTECH",
    description: "Creates tasks or scheduled background jobs (Mock Task Creator)",
    riskLevel: "MEDIUM",
  },
  {
    id: "disburse_funds",
    name: "disburse_funds",
    category: "FINTECH",
    description: "Initiates financial wire transfers, payouts, or treasury disbursements",
    riskLevel: "CRITICAL",
  },
  {
    id: "execute_payment",
    name: "execute_payment",
    category: "FINTECH",
    description: "Charges credit cards, executes Stripe checkout, or merchant captures",
    riskLevel: "CRITICAL",
  },
  {
    id: "charge_stripe_customer",
    name: "charge_stripe_customer",
    category: "FINTECH",
    description: "Invokes Stripe API (POST /v1/charges or /v1/payment_intents)",
    source: "Public API: Stripe Payments",
    riskLevel: "CRITICAL",
  },
  {
    id: "issue_customer_refund",
    name: "issue_customer_refund",
    category: "FINTECH",
    description: "Processes merchant chargeback reversions or Stripe/PayPal dispute refunds",
    riskLevel: "HIGH",
  },
  {
    id: "transfer_crypto_wallet",
    name: "transfer_crypto_wallet",
    category: "FINTECH",
    description: "Signs on-chain blockchain cryptocurrency transfers & smart contracts",
    riskLevel: "CRITICAL",
  },
  {
    id: "approve_invoice_payout",
    name: "approve_invoice_payout",
    category: "FINTECH",
    description: "Releases accounts payable batches in QuickBooks, Xero, or SAP",
    riskLevel: "HIGH",
  },

  // ─── DEVOPS & CLOUD ───
  {
    id: "create_github_issue",
    name: "create_github_issue",
    category: "DEVOPS",
    description: "Creates an issue or bug ticket on GitHub REST API (POST /repos/{owner}/{repo}/issues)",
    source: "Public API: GitHub REST",
    riskLevel: "MEDIUM",
  },
  {
    id: "merge_pull_request",
    name: "merge_pull_request",
    category: "DEVOPS",
    description: "Merges a pull request into the main branch (PUT /repos/{owner}/{repo}/pulls/{id}/merge)",
    source: "Public API: GitHub REST",
    riskLevel: "HIGH",
  },
  {
    id: "delete_s3_bucket_object",
    name: "delete_s3_bucket_object",
    category: "DEVOPS",
    description: "Permanently purges files or media assets from Amazon S3 / Cloudflare R2 storage",
    source: "Public API: AWS S3",
    riskLevel: "CRITICAL",
  },
  {
    id: "deploy_k8s_container",
    name: "deploy_k8s_container",
    category: "DEVOPS",
    description: "Rolls out container image updates to Kubernetes production pods",
    riskLevel: "CRITICAL",
  },
  {
    id: "restart_production_server",
    name: "restart_production_server",
    category: "DEVOPS",
    description: "Initiates reboot or service cycling on cloud compute nodes",
    riskLevel: "HIGH",
  },
  {
    id: "delete_database_record",
    name: "delete_database_record",
    category: "DEVOPS",
    description: "Executes destructive SQL deletes, row purges, or Supabase table mutations",
    riskLevel: "CRITICAL",
  },
  {
    id: "modify_database_schema",
    name: "modify_database_schema",
    category: "DEVOPS",
    description: "Applies database schema migrations, index alters, or drops",
    riskLevel: "CRITICAL",
  },
  {
    id: "purge_cdn_cache",
    name: "purge_cdn_cache",
    category: "DEVOPS",
    description: "Invalidates edge CDN caches globally on Cloudflare/Fastly",
    riskLevel: "MEDIUM",
  },
  {
    id: "rollback_release",
    name: "rollback_release",
    category: "DEVOPS",
    description: "Rolls back application deployments to the previous stable git commit",
    riskLevel: "HIGH",
  },

  // ─── CRM & COMMS ───
  {
    id: "send_slack_broadcast",
    name: "send_slack_broadcast",
    category: "CRM_WEBHOOKS",
    description: "Dispatches public alerts or notifications to primary Slack channels via Webhook/API",
    source: "Public API: Slack API",
    riskLevel: "MEDIUM",
  },
  {
    id: "send_sms_twilio",
    name: "send_sms_twilio",
    category: "CRM_WEBHOOKS",
    description: "Sends outbound SMS alerts via Twilio REST API (POST /2010-04-01/Accounts/{SID}/Messages)",
    source: "Public API: Twilio SMS",
    riskLevel: "HIGH",
  },
  {
    id: "send_email_broadcast",
    name: "send_email_broadcast",
    category: "CRM_WEBHOOKS",
    description: "Sends outbound transactional or marketing email blasts via SendGrid/SES/Postmark",
    source: "Public API: SendGrid / AWS SES",
    riskLevel: "HIGH",
  },
  {
    id: "update_hubspot_deal",
    name: "update_hubspot_deal",
    category: "CRM_WEBHOOKS",
    description: "Mutates stage, revenue, or contact records in HubSpot/Salesforce CRM",
    source: "Public API: HubSpot CRM",
    riskLevel: "MEDIUM",
  },
  {
    id: "execute_n8n_webhook",
    name: "execute_n8n_webhook",
    category: "CRM_WEBHOOKS",
    description: "Fires downstream automated webhook triggers on n8n workflows",
    source: "Public API: n8n Marketplace",
    riskLevel: "HIGH",
  },
  {
    id: "trigger_dify_pipeline",
    name: "trigger_dify_pipeline",
    category: "CRM_WEBHOOKS",
    description: "Invokes external AI agent orchestrations and data pipelines on Dify",
    source: "Public API: Dify.ai",
    riskLevel: "MEDIUM",
  },
  {
    id: "send_external_webhook",
    name: "send_external_webhook",
    category: "CRM_WEBHOOKS",
    description: "Generic HTTP POST webhook trigger with payload mutation",
    riskLevel: "MEDIUM",
  },

  // ─── DEVSECOPS & COMPLIANCE ───
  {
    id: "dispatch_security_alert",
    name: "dispatch_security_alert",
    category: "SECURITY",
    description: "Escalates P1/P0 vulnerabilities or active threats to SecOps on-call",
    riskLevel: "HIGH",
  },
  {
    id: "revoke_api_credentials",
    name: "revoke_api_credentials",
    category: "SECURITY",
    description: "Invalidates compromised bearer tokens, SSH keys, or OAuth secrets",
    riskLevel: "HIGH",
  },
  {
    id: "quarantine_host",
    name: "quarantine_host",
    category: "SECURITY",
    description: "Isolates network interfaces of suspicious compromised instances",
    riskLevel: "CRITICAL",
  },
  {
    id: "approve_admin_escalation",
    name: "approve_admin_escalation",
    category: "SECURITY",
    description: "Grants temporary elevated root or administrative IAM privileges",
    riskLevel: "CRITICAL",
  },
];

interface ApprovalActionMarketplaceProps {
  selected: string[];
  onChange: (actions: string[]) => void;
  allowedTools?: string[];
  instructions?: string;
}

export function ApprovalActionMarketplace({
  selected,
  onChange,
  allowedTools = [],
  instructions = "",
}: ApprovalActionMarketplaceProps) {
  const [activeCategory, setActiveCategory] = useState<
    "ALL" | "DISCOVERED" | "FINTECH" | "DEVOPS" | "CRM_WEBHOOKS" | "SECURITY"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [discoveredActions, setDiscoveredActions] = useState<ActionMarketplaceItem[]>([]);

  // ─── 1. DISCOVER WRITE ACTIONS FROM ACTIVE TOOLS ───
  useEffect(() => {
    let cancelled = false;

    async function loadDiscoveredActions() {
      const items: ActionMarketplaceItem[] = [];

      // Check if built-in mock_task_creator is in allowedTools
      if (allowedTools.includes("mock_task_creator")) {
        items.push({
          id: "create_task",
          name: "create_task",
          category: "DISCOVERED",
          description: "Mock Task Creator background execution",
          source: "Built-In Tool: mock_task_creator",
          riskLevel: "MEDIUM",
        });
      }

      // Check OpenAPI write endpoints
      try {
        const res = await fetch("/api/openapi/integrations");
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          for (const integration of json.data as OpenApiIntegrationDTO[]) {
            for (const ep of integration.endpoints) {
              const regName = openApiToolRegistryName(integration.id, ep.operationId);
              const isAllowed = allowedTools.includes(regName);
              if (ep.isWrite || ep.method !== "GET" || ep.requiresApproval || isAllowed) {
                if (ep.isWrite || ep.method !== "GET") {
                  items.push({
                    id: ep.operationId,
                    name: ep.operationId,
                    category: "DISCOVERED",
                    description: ep.description || `${ep.method} ${ep.path}`,
                    source: `OpenAPI: ${integration.name}`,
                    riskLevel: "HIGH",
                  });
                }
              }
            }
          }
        }
      } catch {}

      // Check MCP write tools
      try {
        const res = await fetch("/api/mcp/servers");
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          for (const server of json.data as McpServerDTO[]) {
            for (const tool of server.cachedTools) {
              const regName = mcpToolRegistryName(server.id, tool.name);
              if (tool.isWrite || allowedTools.includes(regName)) {
                if (tool.isWrite) {
                  items.push({
                    id: tool.name,
                    name: tool.name,
                    category: "DISCOVERED",
                    description: tool.description || `MCP Tool on ${server.name}`,
                    source: `MCP Server: ${server.name}`,
                    riskLevel: "HIGH",
                  });
                }
              }
            }
          }
        }
      } catch {}

      if (!cancelled) {
        setDiscoveredActions(items);
      }
    }

    loadDiscoveredActions();
    return () => {
      cancelled = true;
    };
  }, [allowedTools]);

  // ─── 2. AI SMART DETECTION FROM PROMPT INSTRUCTIONS ───
  const detectedPromptSuggestions = useMemo(() => {
    if (!instructions || instructions.length < 10) return [];
    const text = instructions.toLowerCase();
    const suggestions: string[] = [];

    const keywordMap: Record<string, string[]> = {
      refund: ["issue_customer_refund"],
      pay: ["execute_payment", "charge_stripe_customer"],
      payment: ["execute_payment"],
      disburse: ["disburse_funds"],
      wire: ["disburse_funds"],
      slack: ["send_slack_broadcast"],
      sms: ["send_sms_twilio"],
      twilio: ["send_sms_twilio"],
      email: ["send_email_broadcast"],
      delete: ["delete_database_record"],
      purge: ["purge_cdn_cache"],
      k8s: ["deploy_k8s_container"],
      kubernetes: ["deploy_k8s_container"],
      deploy: ["deploy_k8s_container"],
      restart: ["restart_production_server"],
      crypto: ["transfer_crypto_wallet"],
      security: ["dispatch_security_alert"],
      vulnerability: ["dispatch_security_alert"],
      quarantine: ["quarantine_host"],
      task: ["create_task"],
      n8n: ["execute_n8n_webhook"],
      webhook: ["send_external_webhook"],
    };

    for (const [kw, actions] of Object.entries(keywordMap)) {
      if (text.includes(kw)) {
        for (const act of actions) {
          if (!suggestions.includes(act) && !selected.includes(act)) {
            suggestions.push(act);
          }
        }
      }
    }

    return suggestions.slice(0, 4);
  }, [instructions, selected]);

  const toggleAction = (actionName: string) => {
    if (selected.includes(actionName)) {
      onChange(selected.filter((a) => a !== actionName));
    } else {
      onChange([...selected, actionName]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
      toast.success("Action Added", `Added "${trimmed}" to approval locks.`);
    }
    setCustomInput("");
  };

  const lockAllDiscovered = () => {
    const names = discoveredActions.map((d) => d.name);
    const combined = Array.from(new Set([...selected, ...names]));
    onChange(combined);
    toast.success("All Active Write Tools Locked", `Applied ${names.length} approval gates.`);
  };

  const allItems = [...discoveredActions, ...MARKETPLACE_PRESETS];
  const uniqueItems = Array.from(new Map(allItems.map((item) => [item.name, item])).values());

  const filteredItems = uniqueItems.filter((item) => {
    const matchesCat =
      activeCategory === "ALL" ||
      (activeCategory === "DISCOVERED"
        ? discoveredActions.some((d) => d.name === item.name)
        : item.category === activeCategory);
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-3 font-mono">
      {/* ─── SECTION 1: LIVE WRITE TOOL AUTO-BINDING BANNER ─── */}
      {discoveredActions.length > 0 && (
        <div className="p-2.5 rounded-lg border border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/90 dark:bg-indigo-950/40 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-pulse shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-indigo-950 dark:text-indigo-200">
                {discoveredActions.length} Write Actions Detected from Active Tools
              </span>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 font-serif leading-tight">
                Tools in your chain contain destructive or mutative operations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={lockAllDiscovered}
            className="shrink-0 px-2.5 py-1 rounded bg-indigo-600 text-white text-[9px] font-bold hover:bg-indigo-500 shadow-sm transition-all cursor-pointer"
          >
            Lock Active Write Tools
          </button>
        </div>
      )}

      {/* ─── SECTION 3: AI PROMPT SMART RECOMMENDATION ─── */}
      {detectedPromptSuggestions.length > 0 && (
        <div className="p-2.5 rounded-lg border border-purple-300 dark:border-purple-800/60 bg-purple-50/80 dark:bg-purple-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="text-[10px] text-purple-950 dark:text-purple-200 font-bold">
              AI Detected Intent in Instructions:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {detectedPromptSuggestions.map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => toggleAction(act)}
                className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-700 text-[9px] font-mono font-bold text-purple-900 dark:text-purple-200 hover:bg-purple-200 cursor-pointer transition-all"
              >
                + Lock {act}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SECTION 4: ACTIVE LOCKED GATES CHIPS ─── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            Active Approval Gates ({selected.length})
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[9px] text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
            >
              CLEAR ALL
            </button>
          )}
        </div>

        {selected.length === 0 ? (
          <p className="text-[10px] text-slate-500 italic p-2.5 rounded-lg border border-dashed border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-black/20">
            No write actions locked. All tool executions will run autonomously without human pauses.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/40">
            {selected.map((action) => (
              <span
                key={action}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-400 bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 text-xs font-bold shadow-sm"
              >
                <code>{action}</code>
                <button
                  type="button"
                  onClick={() => toggleAction(action)}
                  className="text-amber-800 dark:text-amber-400 hover:text-red-600 transition-colors cursor-pointer ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── SECTION 5: CUSTOM ACTION INPUT ─── */}
      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddCustom();
            }
          }}
          placeholder="Type custom action name (e.g. charge_stripe, send_slack) & press enter…"
          className="w-full rounded-lg border border-amber-300 dark:border-amber-900/50 bg-white dark:bg-[#0a0a0a] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder:text-slate-400 focus:border-amber-500 focus:outline-none transition-colors shadow-sm"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-200 dark:bg-amber-900 text-xs font-bold text-amber-950 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-800 transition-all cursor-pointer shadow-sm"
        >
          + ADD
        </button>
      </div>

      {/* ─── SECTION 6: CATEGORIZED MARKETPLACE GRID ─── */}
      <div className="pt-2 border-t border-amber-200 dark:border-amber-900/40 space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {[
              { id: "ALL", label: "ALL PRESETS" },
              { id: "DISCOVERED", label: `DISCOVERED (${discoveredActions.length})` },
              { id: "FINTECH", label: "FINTECH & PAYMENTS" },
              { id: "DEVOPS", label: "DEVOPS & CLOUD" },
              { id: "CRM_WEBHOOKS", label: "CRM & COMMS" },
              { id: "SECURITY", label: "SECURITY & COMPLIANCE" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as typeof activeCategory)}
                className={clsx(
                  "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                  activeCategory === cat.id
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-900/30"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-48">
            <Search className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions…"
              className="w-full pl-7 pr-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-black/60 text-[10px] placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-sm"
            />
          </div>
        </div>

        {/* Action Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const isSelected = selected.includes(item.name);
            return (
              <div
                key={item.id}
                onClick={() => toggleAction(item.name)}
                className={clsx(
                  "p-2.5 rounded-lg border cursor-pointer transition-all text-xs flex flex-col justify-between space-y-1 select-none",
                  isSelected
                    ? "border-amber-500 bg-amber-100/90 dark:bg-amber-950/80 shadow-sm"
                    : "border-amber-200/70 dark:border-amber-900/30 bg-white/70 dark:bg-black/30 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-[10px] text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={clsx(
                        "text-[8px] font-bold uppercase px-1 rounded",
                        item.riskLevel === "CRITICAL"
                          ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                          : item.riskLevel === "HIGH"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {item.riskLevel}
                    </span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="accent-amber-600 pointer-events-none h-3 w-3"
                    />
                  </div>
                </div>

                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-serif line-clamp-1 leading-tight">
                  {item.description}
                </p>

                {item.source && (
                  <span className="text-[8px] text-cyan-600 dark:text-cyan-400 font-mono truncate">
                    {item.source}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
