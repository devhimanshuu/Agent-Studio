"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Building2, 
  Users, 
  Mail, 
  Shield, 
  Loader2,
  Save,
  Trash2,
  UserPlus,
  X,
  Check,
  AlertTriangle
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";

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
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
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
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Load organization data
  const loadData = useCallback(async () => {
    try {
      const [orgRes, membersRes, invRes] = await Promise.all([
        fetch(`/api/organizations/${organizationId}`),
        fetch(`/api/organizations/${organizationId}/members`),
        fetch(`/api/organizations/${organizationId}/members? invitations=true`),
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrganization(orgData.data);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.data || []);
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.data || []);
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
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to send invitation");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSaving(false);
    }
  }, [organizationId, inviteEmail, inviteRole, loadData]);

  // Handle remove member
  const handleRemoveMember = useCallback(async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Member removed", "Member has been removed from the organization");
        loadData();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove member");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to remove member");
    }
  }, [organizationId, loadData]);

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
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to update role");
      }
    } catch (err) {
      toast.error("Error", err instanceof Error ? err.message : "Failed to update role");
    }
  }, [organizationId, loadData]);

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
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {member.userName?.[0] || member.userEmail[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                    {member.userName || member.userEmail}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {member.userEmail}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.userId)}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  title="Remove member"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                Invite Member
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
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
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-500 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                >
                  <option value="VIEWER">Viewer - Can view all resources</option>
                  <option value="MEMBER">Member - Can create and edit own resources</option>
                  <option value="ADMIN">Admin - Can manage members and all resources</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={saving || !inviteEmail.trim()}
                  className="px-4 py-2 rounded text-xs font-mono font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Send Invitation"
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
