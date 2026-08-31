"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Building2, 
  Users, 
  Loader2,
  Trash2,
  UserPlus,
  X,
  Shield
} from "lucide-react";
import { CustomRolesManager } from "@/components/organizations/CustomRolesManager";
import { toast } from "@/stores/toastStore";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

// ────────────── Types ──────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billingEmail: string | null;
  memberCount: number;
}

interface Member {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  role: string;
  customRoleId?: string | null;
  joinedAt: string;
}

interface OrganizationSettingsProps {
  organizationId: string;
  onUpdate?: () => void;
}

// ────────────── Component ──────────────

export function OrganizationSettings({
  organizationId,
  onUpdate,
}: OrganizationSettingsProps) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Load organization data
  const loadData = useCallback(async () => {
    try {
      const [orgRes, membersRes, rolesRes] = await Promise.all([
        fetch(`/api/organizations/${organizationId}`),
        fetch(`/api/organizations/${organizationId}/members`),
        fetch(`/api/organizations/${organizationId}/roles`),
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrganization(orgData.data);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data || []);
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setCustomRoles(rolesData.data || []);
      }
    } catch (err) {
      console.error("Failed to load organization data:", err);
      toast.error("Error", "Failed to load organization data");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle invite member
  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      toast.error("Error", "Email is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.ok) {
        toast.success("Invitation sent", `Invite sent to ${inviteEmail}`);
        setInviteEmail("");
        setShowInviteModal(false);
        loadData();
        onUpdate?.();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to send invitation");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSaving(false);
    }
  }, [organizationId, inviteEmail, inviteRole, loadData, onUpdate]);

  // Handle remove member
  const handleRemoveMember = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Member removed", "Member has been removed from the organization");
        setMemberToRemove(null);
        loadData();
        onUpdate?.();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove member");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to remove member");
    }
  }, [organizationId, loadData, onUpdate]);

  // Handle update role
  const handleUpdateRole = useCallback(async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        toast.success("Role updated", "Member role has been updated");
        loadData();
        onUpdate?.();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to update role");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to update role");
    }
  }, [organizationId, loadData, onUpdate]);

  // Handle assign custom role to member
  const handleAssignCustomRole = useCallback(async (userId: string, roleId: string) => {
    try {
      if (!roleId) {
        // Remove custom role
        const res = await fetch(
          `/api/organizations/${organizationId}/members/${userId}/role`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to remove custom role");
        }
      } else {
        const res = await fetch(
          `/api/organizations/${organizationId}/members/${userId}/role`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleId }),
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to assign custom role");
        }
      }
      toast.success("Role updated", "Member's custom role has been updated");
      loadData();
      onUpdate?.();
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to update role");
    }
  }, [organizationId, loadData, onUpdate]);

  // Handle delete organization
  const handleDeleteOrganization = useCallback(async () => {
    if (deleteConfirmText !== organization?.name) {
      toast.error("Error", "Type the organization name to confirm deletion");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Organization deleted", "The organization has been permanently removed.");
        onUpdate?.();
        window.location.href = "/organizations";
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete organization");
      }
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : "Failed to delete organization");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  }, [organizationId, organization?.name, deleteConfirmText, onUpdate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-8 w-8 text-slate-400 mx-auto" />
        <p className="text-sm font-mono text-slate-600 mt-2">Organization not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-500" />
            {organization.name}
          </h2>
          <p className="text-xs font-mono text-slate-500 mt-1">
            {organization.memberCount} member{organization.memberCount !== 1 ? "s" : ""} · {organization.plan} plan
          </p>
        </div>
      </div>

      {/* Members Section */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            Members
          </h3>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold bg-indigo-600 text-white hover:bg-indigo-500"
          >
            <UserPlus className="h-3 w-3" />
            Invite
          </button>
        </div>

        {/* Members List */}
        <div className="space-y-2">
          {members.map((member) => {
            const displayName = (member.userName && member.userName !== "string") ? member.userName : member.userEmail;
            const initials = displayName[0]?.toUpperCase() || "?";
            return (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {initials}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                    {displayName}
                  </div>
                  {member.userName && member.userName !== displayName && (
                    <div className="text-[10px] font-mono text-slate-500">
                      {member.userEmail}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={member.role}
                  onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </select>
                <select
                  value={(member as Member & { customRoleId?: string }).customRoleId || ""}
                  onChange={(e) => handleAssignCustomRole(member.userId, e.target.value)}
                  className="px-2 py-1 rounded text-[10px] font-mono border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300"
                  title="Custom role (additive permissions)"
                >
                  <option value="">No custom role</option>
                  {customRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMemberToRemove({ userId: member.userId, name: member.userName || member.userEmail })}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Remove member"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded border border-slate-200 dark:border-indigo-900/50 bg-white dark:bg-black p-6 font-mono shadow-2xl dark:shadow-indigo-950/80 animate-fadeInUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Invite Member
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-500 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-indigo-900/50 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="VIEWER">Viewer — Can view all resources</option>
                  <option value="MEMBER">Member — Can create and edit own resources</option>
                  <option value="ADMIN">Admin — Can manage members and all resources</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded border border-slate-300 dark:border-indigo-500/40 bg-slate-100 dark:bg-indigo-950/40 text-xs font-mono font-semibold text-slate-700 dark:text-indigo-200 hover:border-indigo-400 hover:bg-slate-200 dark:hover:bg-indigo-900/60 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer text-center"
                >
                  [ CANCEL ]
                </button>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={saving || !inviteEmail.trim()}
                  className="w-full sm:w-auto px-4 py-2 rounded border border-indigo-400 bg-indigo-600 text-xs font-mono font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50 text-center"
                >
                  {saving ? "[ SENDING ]" : "[ SEND INVITE ]"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Remove Member Confirm Dialog */}
      <ConfirmDialog
        isOpen={memberToRemove !== null}
        title="Remove Member"
        description={`Are you sure you want to remove ${memberToRemove?.name || "this member"} from the organization? They will lose access to all organization resources.`}
        confirmLabel="REMOVE"
        variant="danger"
        onConfirm={() => memberToRemove && handleRemoveMember(memberToRemove.userId)}
        onClose={() => setMemberToRemove(null)}
      />

      {/* Custom Roles Section */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <CustomRolesManager
          organizationId={organizationId}
          onUpdate={() => {
            loadData();
            onUpdate?.();
          }}
        />
      </div>

      {/* Danger Zone — Delete Organization */}
      <div className="rounded-lg border-2 border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-950/20 p-5 space-y-3">
        <h3 className="text-sm font-mono font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          DANGER ZONE
        </h3>
        <p className="text-xs font-mono text-red-600/80 dark:text-red-300/60">
          Deleting this organization is permanent and cannot be undone. All members will lose access. Skills, executions, and other resources will be dissociated (not deleted).
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-400 bg-red-600 text-white text-xs font-mono font-bold hover:bg-red-500 shadow-sm transition-all cursor-pointer"
        >
          <Trash2 className="h-3 w-3" /> DELETE ORGANIZATION
        </button>
      </div>

      {/* Delete Organization Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded border border-red-300 dark:border-red-500/40 bg-white dark:bg-black p-6 font-mono shadow-2xl dark:shadow-red-950/40 animate-fadeInUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Delete Organization
              </h3>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 p-3 text-xs font-mono text-red-700 dark:text-red-300 space-y-1">
                <p className="font-bold">This action is irreversible.</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-600/80 dark:text-red-300/60">
                  <li>All {organization?.memberCount ?? 0} members will lose access</li>
                  <li>Skills &amp; executions will be dissociated (kept as personal resources)</li>
                  <li>Custom roles, API keys, and invitations will be deleted</li>
                  <li>Audit log for this org will be removed</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-500 mb-1">
                  Type <span className="text-red-600 dark:text-red-400">{organization?.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={organization?.name ?? ""}
                  className="w-full px-3 py-2 rounded border border-red-300 dark:border-red-500/40 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  className="w-full sm:w-auto px-4 py-2 rounded border border-slate-300 dark:border-slate-500/40 bg-slate-100 dark:bg-slate-900 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer text-center"
                >
                  [ CANCEL ]
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOrganization}
                  disabled={deleting || deleteConfirmText !== organization?.name}
                  className="w-full sm:w-auto px-4 py-2 rounded border border-red-400 bg-red-600 text-xs font-mono font-semibold text-white hover:bg-red-500 shadow-md shadow-red-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
                >
                  {deleting ? "[ DELETING… ]" : "[ PERMANENTLY DELETE ]"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
