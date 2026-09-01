"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import {
  Building2,
  Plus,
  Users,
  Loader2,
  ChevronRight,
  Settings
} from "lucide-react";
import { toast } from "@/stores/toastStore";

// ────────────── Types ──────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
  createdAt: string;
}

// ────────────── Component ──────────────

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  // Load organizations
  const loadOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.data || []);
      }
    } catch (err) {
      logger.error({ err }, "Failed to load organizations");
      toast.error("Error", "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  // Handle create organization
  const handleCreate = useCallback(async () => {
    if (!newOrgName.trim()) {
      toast.error("Error", "Organization name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });

      if (res.ok) {
        toast.success("Organization created", `${newOrgName} has been created`);
        setNewOrgName("");
        setShowCreateModal(false);
        loadOrganizations();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to create organization");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  }, [newOrgName, loadOrganizations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <Building2 className="h-6 w-6 text-indigo-500" />
            Organizations
          </h1>
          <p className="text-sm font-mono text-slate-500 mt-1">
            Manage your team workspaces and collaborators
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-mono font-bold hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </button>
      </div>

      {/* Organizations Grid */}
      {organizations.length === 0 ? (
        <div className="text-center py-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 mb-2">
            No organizations yet
          </h3>
          <p className="text-sm font-mono text-slate-500 mb-6">
            Create an organization to collaborate with your team
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-mono font-bold hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Create Your First Organization
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                    {org.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                      {org.plan}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/organizations/${org.id}`)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Settings"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/organizations/${org.id}`)}
                  className="p-2 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 mb-4">
              Create Organization
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono font-bold text-slate-500 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="My Team"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewOrgName("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-mono font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newOrgName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-mono font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
