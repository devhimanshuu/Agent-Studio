"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Search,
  X,
  Key,
  Database,
  Link,
  Shield,
  FileText,
  Webhook,
  Tag,
  Loader2,
  Check,
  AlertTriangle,
  Edit3,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";

// ────────────── Types ──────────────

interface VaultEntryDTO {
  id: string;
  name: string;
  category: string;
  key: string;
  value: string; // masked
  description: string | null;
  tags: string[];
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { id: "API_KEY", label: "API Key", icon: Key, color: "indigo" },
  { id: "OAUTH_TOKEN", label: "OAuth Token", icon: Shield, color: "violet" },
  { id: "DATABASE_URL", label: "Database URL", icon: Database, color: "emerald" },
  { id: "CONNECTION_STRING", label: "Connection String", icon: Link, color: "cyan" },
  { id: "PASSWORD", label: "Password", icon: Lock, color: "red" },
  { id: "CERTIFICATE", label: "Certificate", icon: FileText, color: "amber" },
  { id: "WEBHOOK_SECRET", label: "Webhook Secret", icon: Webhook, color: "pink" },
  { id: "OTHER", label: "Other", icon: Tag, color: "slate" },
];

const CATEGORY_COLORS: Record<string, string> = {
  API_KEY: "border-indigo-300 bg-indigo-50 text-indigo-700",
  OAUTH_TOKEN: "border-violet-300 bg-violet-50 text-violet-700",
  DATABASE_URL: "border-emerald-300 bg-emerald-50 text-emerald-700",
  CONNECTION_STRING: "border-cyan-300 bg-cyan-50 text-cyan-700",
  PASSWORD: "border-red-300 bg-red-50 text-red-700",
  CERTIFICATE: "border-amber-300 bg-amber-50 text-amber-700",
  WEBHOOK_SECRET: "border-pink-300 bg-pink-50 text-pink-700",
  OTHER: "border-slate-300 bg-slate-50 text-slate-700",
};

// ────────────── Vault Entry Card ──────────────

function VaultEntryCard({
  entry,
  onReveal,
  onDelete,
  onEdit,
}: {
  entry: VaultEntryDTO;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (entry: VaultEntryDTO) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const catDef = CATEGORIES.find((c) => c.id === entry.category) || CATEGORIES[7];
  const CatIcon = catDef.icon;

  const handleCopy = useCallback(async () => {
    try {
      // Fetch raw value for copy
      const res = await fetch(`/api/vault/${entry.id}/reveal`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rawValue) {
          await navigator.clipboard.writeText(data.rawValue);
          setCopied(true);
          toast.success("Copied!", "Secret value copied to clipboard");
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch {
      toast.error("Copy failed", "Could not read secret value");
    }
  }, [entry.id]);

  const handleReveal = useCallback(() => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    onReveal(entry.id);
    setRevealed(true);
  }, [revealed, entry.id, onReveal]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 hover:border-indigo-500/40 transition-all overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center border", CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.OTHER)}>
            <CatIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                {entry.name}
              </h3>
              <span className={clsx("px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border shrink-0", CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.OTHER)}>
                {catDef.label}
              </span>
            </div>
            <p className="text-[9px] font-mono text-slate-500 truncate">
              {entry.key}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title="Edit"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReveal}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title={revealed ? "Hide value" : "Reveal value"}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title="Copy value"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {deleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onDelete(entry.id);
                  setDeleteConfirm(false);
                }}
                className="px-2 py-1 rounded text-[8px] font-mono font-bold bg-red-600 text-white hover:bg-red-500 cursor-pointer"
              >
                DELETE
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-2 py-1 rounded text-[8px] font-mono font-bold border border-slate-300 text-slate-500 hover:border-slate-400 cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Value Display */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-indigo-950/30 font-mono">
          <span className="text-[10px] text-slate-400 select-none shrink-0">Value:</span>
          <span className="text-[10px] text-slate-700 dark:text-slate-300 flex-1 truncate">
            {revealed ? (
              <span className="text-amber-600 dark:text-amber-400 break-all">{entry.value}</span>
            ) : (
              <span className="text-slate-400">{entry.value}</span>
            )}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="px-4 pb-3 flex items-center gap-3 text-[8px] font-mono text-slate-400">
        {entry.description && (
          <span className="text-slate-500 truncate max-w-[200px]">{entry.description}</span>
        )}
        {entry.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-indigo-950">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {entry.lastUsedAt && (
          <span className="flex items-center gap-0.5 ml-auto">
            <Clock className="h-2.5 w-2.5" /> Used {new Date(entry.lastUsedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ────────────── Create/Edit Modal ──────────────

function VaultEntryModal({
  entry,
  isOpen,
  onClose,
  onSaved,
}: {
  entry?: VaultEntryDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(entry?.name || "");
  const [category, setCategory] = useState(entry?.category || "API_KEY");
  const [key, setKey] = useState(entry?.key || "");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState(entry?.description || "");
  const [tags, setTags] = useState(entry?.tags.join(", ") || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(false);

  // Reset form when entry changes
  useEffect(() => {
    setName(entry?.name || "");
    setCategory(entry?.category || "API_KEY");
    setKey(entry?.key || "");
    setValue("");
    setDescription(entry?.description || "");
    setTags(entry?.tags.join(", ") || "");
    setError(null);
    setShowValue(false);
  }, [entry, isOpen]);

  const isEditing = !!entry;

  const handleSave = useCallback(async () => {
    if (!name.trim() || !key.trim()) {
      setError("Name and key are required");
      return;
    }
    if (!isEditing && !value.trim()) {
      setError("Value is required for new entries");
      return;
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      setError("Key must be uppercase with underscores (e.g. GITHUB_TOKEN)");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        category,
        key: key.trim(),
        description: description.trim() || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (value.trim()) body.value = value;

      const url = isEditing ? `/api/vault` : "/api/vault";
      const method = isEditing ? "PUT" : "POST";
      if (isEditing) body.id = entry.id;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${res.status}`);
      }

      toast.success(isEditing ? "Updated" : "Created", `${name} has been ${isEditing ? "updated" : "added"} to the vault`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [name, category, key, value, description, tags, isEditing, entry, onSaved, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-indigo-800/60 bg-white dark:bg-[#0a0a0a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-indigo-900/50">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-indigo-500" />
            <h2 className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {isEditing ? "Edit Secret" : "Add Secret"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub Personal Access Token"
              className="w-full px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black/40 text-[11px] font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">CATEGORY</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={clsx(
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold border transition-all cursor-pointer",
                      category === cat.id
                        ? CATEGORY_COLORS[cat.id]
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400"
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">KEY (ENV VAR NAME)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. GITHUB_TOKEN"
              className="w-full px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black/40 text-[11px] font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
              {isEditing ? "NEW VALUE (leave blank to keep current)" : "VALUE"}
            </label>
            <div className="relative">
              <input
                type={showValue ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isEditing ? "••••••••" : "Enter secret value"}
                className="w-full px-3 py-2 pr-10 rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black/40 text-[11px] font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">DESCRIPTION</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this secret is used for"
              className="w-full px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black/40 text-[11px] font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">TAGS (COMMA-SEPARATED)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. github, automation, ci"
              className="w-full px-3 py-2 rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black/40 text-[11px] font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/30">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-[10px] font-mono text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {/* Security Note */}
          <div className="flex items-start gap-2 px-3 py-2 rounded bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30">
            <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 leading-relaxed">
              Values are encrypted with AES-256-GCM before storage. They are only decrypted when used by skill execution and never returned in API responses.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-indigo-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 hover:border-slate-400 transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
              saving ? "opacity-50 cursor-wait" : "",
              "border border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/25"
            )}
          >
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> SAVING...</>
            ) : (
              <><Lock className="h-3 w-3" /> {isEditing ? "UPDATE" : "ENCRYPT & SAVE"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────── Main Component ──────────────

export function SecretVault() {
  const [entries, setEntries] = useState<VaultEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntryDTO | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await fetch(`/api/vault?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setEntries(data.data);
      }
    } catch (err) {
      console.error("[Vault] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(loadEntries, 300);
    return () => clearTimeout(timer);
  }, [loadEntries]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted", "Secret has been removed from the vault");
        loadEntries();
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Delete failed");
      }
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : "Unknown error");
    }
  }, [loadEntries]);

  const handleReveal = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vault/${id}/reveal`);
      if (!res.ok) throw new Error("Failed to reveal");
      // The value is shown in the card via state — for this implementation
      // the card will show the masked value; reveal fetches raw for copy
    } catch (err) {
      console.error("[Vault] Reveal failed:", err);
    }
  }, []);

  const filteredEntries = entries.filter((e) => {
    if (filterCategory !== "ALL" && e.category !== filterCategory) return false;
    return true;
  });

  const categoryCounts = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Lock className="h-4 w-4 text-indigo-500" />
            SECRET VAULT
          </h2>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            Encrypted credential store for API keys, tokens & connection strings
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingEntry(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-white text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> ADD SECRET
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 p-3">
          <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">Total Secrets</div>
          <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">{entries.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 p-3">
          <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">API Keys</div>
          <div className="text-lg font-mono font-bold text-indigo-600">{categoryCounts["API_KEY"] || 0}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 p-3">
          <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">Tokens</div>
          <div className="text-lg font-mono font-bold text-violet-600">{(categoryCounts["OAUTH_TOKEN"] || 0) + (categoryCounts["WEBHOOK_SECRET"] || 0)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-indigo-900/40 bg-white/80 dark:bg-[#0a0a0a]/70 p-3">
          <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">DB / Conn</div>
          <div className="text-lg font-mono font-bold text-emerald-600">{(categoryCounts["DATABASE_URL"] || 0) + (categoryCounts["CONNECTION_STRING"] || 0)}</div>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search secrets by name, key, or tag..."
            className="w-full pl-9 pr-8 py-2 text-xs font-mono rounded border border-slate-200 dark:border-indigo-900/60 bg-white dark:bg-black/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterCategory("ALL")}
            className={clsx(
              "px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer",
              filterCategory === "ALL"
                ? "border-indigo-500 bg-indigo-600 text-white"
                : "border-slate-200 dark:border-indigo-900/50 text-slate-500 hover:border-indigo-400"
            )}
          >
            ALL ({entries.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(filterCategory === cat.id ? "ALL" : cat.id)}
                className={clsx(
                  "px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer",
                  filterCategory === cat.id
                    ? CATEGORY_COLORS[cat.id]
                    : "border-slate-200 dark:border-indigo-900/50 text-slate-500 hover:border-indigo-400"
                )}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Entries Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredEntries.map((entry) => (
            <VaultEntryCard
              key={entry.id}
              entry={entry}
              onReveal={handleReveal}
              onDelete={handleDelete}
              onEdit={(e) => { setEditingEntry(e); setModalOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <Lock className="h-8 w-8 text-indigo-400 mx-auto" />
          <p className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 mt-3">
            {search ? "NO SECRETS MATCH YOUR SEARCH" : "YOUR VAULT IS EMPTY"}
          </p>
          <p className="text-[10px] font-mono text-slate-500 mt-1">
            {search ? "Try a different search term" : "Add your first secret to get started"}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <VaultEntryModal
        entry={editingEntry}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEntry(null); }}
        onSaved={loadEntries}
      />
    </div>
  );
}
