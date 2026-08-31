"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Trash2,
  Edit3,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "@/stores/toastStore";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

// ────────────── Types ──────────────

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
}

// ────────────── Permission Categories ──────────────

const PERMISSION_GROUPS = [
  {
    label: "Organization",
    permissions: ["org:manage"],
  },
  {
    label: "Members",
    permissions: ["members:manage", "members:read"],
  },
  {
    label: "Skills",
    permissions: [
      "skills:create",
      "skills:read",
      "skills:edit",
      "skills:edit:own",
      "skills:delete",
      "skills:delete:own",
      "skills:execute",
      "skills:publish",
    ],
  },
  {
    label: "Executions",
    permissions: [
      "executions:create",
      "executions:read",
      "executions:read:own",
      "executions:cancel",
      "executions:cancel:own",
    ],
  },
  {
    label: "MCP Servers",
    permissions: ["mcp:manage", "mcp:read", "mcp:create", "mcp:delete"],
  },
  {
    label: "Vault",
    permissions: [
      "vault:manage",
      "vault:create",
      "vault:read",
      "vault:read:own",
      "vault:delete",
      "vault:delete:own",
    ],
  },
  {
    label: "Audit",
    permissions: ["audit:view", "audit:read"],
  },
  {
    label: "API Keys",
    permissions: ["api_keys:manage", "api_keys:read"],
  },
  {
    label: "Roles",
    permissions: ["roles:manage", "roles:read"],
  },
];

// Quick presets
const ROLE_PRESETS: { name: string; description: string; permissions: string[] }[] = [
  {
    name: "Developer",
    description: "Can create, edit, and execute skills and MCP servers",
    permissions: [
      "skills:create",
      "skills:read",
      "skills:edit",
      "skills:execute",
      "mcp:read",
      "mcp:create",
      "executions:create",
      "executions:read",
      "vault:create",
      "vault:read:own",
    ],
  },
  {
    name: "Auditor",
    description: "Read-only access to all resources plus audit logs",
    permissions: [
      "skills:read",
      "executions:read",
      "mcp:read",
      "vault:read",
      "audit:view",
      "audit:read",
      "members:read",
      "roles:read",
    ],
  },
  {
    name: "Ops Manager",
    description: "Can manage members, executions, and MCP servers",
    permissions: [
      "members:manage",
      "members:read",
      "skills:read",
      "skills:execute",
      "executions:create",
      "executions:read",
      "executions:cancel",
      "mcp:manage",
      "mcp:read",
      "mcp:create",
      "mcp:delete",
    ],
  },
];

// ────────────── Component ──────────────

interface CustomRolesManagerProps {
  organizationId: string;
  onUpdate?: () => void;
}

export function CustomRolesManager({
  organizationId,
  onUpdate,
}: CustomRolesManagerProps) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(PERMISSION_GROUPS.map((g) => g.label))
  );
  const [permissionSearch, setPermissionSearch] = useState("");

  // Load roles
  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/roles`);
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data || []);
      }
    } catch {
      toast.error("Error", "Failed to load custom roles");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Open create modal
  const openCreate = (preset?: (typeof ROLE_PRESETS)[number]) => {
    setEditingRole(null);
    setFormName(preset?.name ?? "");
    setFormDescription(preset?.description ?? "");
    setFormPermissions(preset?.permissions ?? []);
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEdit = (role: CustomRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description ?? "");
    setFormPermissions([...role.permissions]);
    setShowCreateModal(true);
  };

  // Toggle permission
  const togglePermission = (perm: string) => {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  // Toggle group (all perms in group)
  const toggleGroup = (groupPerms: string[]) => {
    setFormPermissions((prev) => {
      const allSelected = groupPerms.every((p) => prev.includes(p));
      if (allSelected) {
        return prev.filter((p) => !groupPerms.includes(p));
      }
      return [...new Set([...prev, ...groupPerms])];
    });
  };

  // Save role (create or update)
  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Error", "Role name is required");
      return;
    }
    if (formPermissions.length === 0) {
      toast.error("Error", "Select at least one permission");
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingRole;
      const url = isEdit
        ? `/api/organizations/${organizationId}/roles/${editingRole!.id}`
        : `/api/organizations/${organizationId}/roles`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          permissions: formPermissions,
        }),
      });

      if (res.ok) {
        toast.success(
          isEdit ? "Role updated" : "Role created",
          `"${formName.trim()}" has been ${isEdit ? "updated" : "created"}.`
        );
        setShowCreateModal(false);
        loadRoles();
        onUpdate?.();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to save role");
      }
    } catch (err) {
      toast.error(
        "Error",
        err instanceof Error ? err.message : "Failed to save role"
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete role
  const handleDelete = async () => {
    if (!deletingRole) return;

    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/roles/${deletingRole.id}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success("Role deleted", `"${deletingRole.name}" has been removed.`);
        setDeletingRole(null);
        loadRoles();
        onUpdate?.();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete role");
      }
    } catch (err) {
      toast.error(
        "Delete failed",
        err instanceof Error ? err.message : "Failed to delete role"
      );
    }
  };

  // Toggle group expansion
  const toggleGroupExpand = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Filter permissions by search
  const filteredGroups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    permissions: group.permissions.filter(
      (p) =>
        !permissionSearch ||
        p.toLowerCase().includes(permissionSearch.toLowerCase())
    ),
  })).filter((group) => group.permissions.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-500" />
          CUSTOM ROLES
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold border border-violet-200 dark:border-violet-500/40">
            {roles.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold bg-violet-600 text-white hover:bg-violet-500 shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-3 w-3" /> NEW ROLE
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {ROLE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => openCreate(preset)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all cursor-pointer"
            title={preset.description}
          >
            <Plus className="h-2.5 w-2.5" /> {preset.name}
          </button>
        ))}
      </div>

      {/* Roles List */}
      {roles.length === 0 ? (
        <div className="text-center py-8 rounded border border-dashed border-slate-300 dark:border-slate-700">
          <Shield className="h-6 w-6 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-mono text-slate-500">
            No custom roles yet. Create one to define granular permissions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 hover:border-violet-400 dark:hover:border-violet-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                      {role.name}
                    </span>
                    {role.isSystem && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold border border-slate-200 dark:border-slate-700">
                        SYSTEM
                      </span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono inline-flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" />
                      {role.memberCount}
                    </span>
                  </div>
                  {role.description && (
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {role.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {role.permissions.slice(0, 6).map((p) => (
                      <span
                        key={p}
                        className="text-[8px] px-1 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-mono border border-violet-100 dark:border-violet-800/40"
                      >
                        {p}
                      </span>
                    ))}
                    {role.permissions.length > 6 && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                        +{role.permissions.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
                {!role.isSystem && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(role)}
                      className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors cursor-pointer"
                      title="Edit role"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRole(role)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="Delete role"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black font-mono shadow-2xl dark:shadow-indigo-950/80 animate-fadeInUp">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-500" />
                {editingRole ? "Edit Role" : "Create Role"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Deploy Manager"
                  maxLength={50}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What can holders of this role do?"
                  maxLength={500}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Permission search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="Search permissions..."
                    className="w-full pl-8 pr-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Selected count */}
              <div className="text-[10px] font-mono text-violet-600 dark:text-violet-400 font-bold">
                {formPermissions.length} permission{formPermissions.length !== 1 ? "s" : ""} selected
              </div>

              {/* Permission Groups */}
              <div className="space-y-2">
                {filteredGroups.map((group) => {
                  const allSelected = group.permissions.every((p) =>
                    formPermissions.includes(p)
                  );
                  const someSelected = group.permissions.some((p) =>
                    formPermissions.includes(p)
                  );
                  const isExpanded = expandedGroups.has(group.label);

                  return (
                    <div
                      key={group.label}
                      className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      {/* Group header */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                        <button
                          type="button"
                          onClick={() =>
                            toggleGroup(group.permissions)
                          }
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                            allSelected
                              ? "bg-violet-600 border-violet-600"
                              : someSelected
                              ? "bg-violet-200 dark:bg-violet-800 border-violet-400"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {(allSelected || someSelected) && (
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleGroupExpand(group.label)}
                          className="flex items-center gap-1.5 flex-1 text-left"
                        >
                          <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                            {group.label}
                          </span>
                          <span className="text-[8px] font-mono text-slate-400">
                            {group.permissions.filter((p) =>
                              formPermissions.includes(p)
                            ).length}/{group.permissions.length}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          )}
                        </button>
                      </div>

                      {/* Permissions list */}
                      {isExpanded && (
                        <div className="px-3 py-2 space-y-1 border-t border-slate-100 dark:border-slate-800">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm}
                              className="flex items-center gap-2 cursor-pointer group/perm"
                            >
                              <input
                                type="checkbox"
                                checked={formPermissions.includes(perm)}
                                onChange={() => togglePermission(perm)}
                                className="w-3 h-3 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 group-hover/perm:text-slate-900 dark:group-hover/perm:text-slate-100 transition-colors">
                                {perm}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-all cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formName.trim() || formPermissions.length === 0}
                className="px-4 py-2 rounded border border-violet-400 bg-violet-600 text-xs font-mono font-semibold text-white hover:bg-violet-500 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving
                  ? "SAVING..."
                  : editingRole
                  ? "UPDATE ROLE"
                  : "CREATE ROLE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deletingRole !== null}
        title="Delete Custom Role"
        description={
          deletingRole
            ? `Delete "${deletingRole.name}"? ${deletingRole.memberCount > 0 ? `${deletingRole.memberCount} member(s) are using this role — reassign them first.` : "No members are using this role."}`
            : ""
        }
        confirmLabel="DELETE"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeletingRole(null)}
      />
    </div>
  );
}
