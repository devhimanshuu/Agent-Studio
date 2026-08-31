"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Check,
  Loader2,
  Users
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "@/stores/toastStore";

// ────────────── Types ──────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
}

interface OrganizationSwitcherProps {
  currentOrganizationId?: string;
  onOrganizationChange: (organizationId: string | null) => void;
}

// ────────────── Component ──────────────

export function OrganizationSwitcher({
  currentOrganizationId,
  onOrganizationChange,
}: OrganizationSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  // Load organizations
  const loadOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.data || []);
        
        // Find current org
        if (currentOrganizationId) {
          const org = data.data?.find((o: Organization) => o.id === currentOrganizationId);
          setCurrentOrg(org || null);
        }
      }
    } catch (err) {
      console.error("Failed to load organizations:", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  // Handle organization selection
  const handleSelect = useCallback((org: Organization | null) => {
    setCurrentOrg(org);
    onOrganizationChange(org?.id || null);
    setIsOpen(false);
    toast.success(
      "Organization switched",
      org ? `Now viewing ${org.name}` : "Viewing personal workspace"
    );
  }, [onOrganizationChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
          "text-xs font-mono font-bold",
          currentOrg
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="truncate max-w-[150px]">
          {currentOrg?.name || "Personal Workspace"}
        </span>
        <ChevronDown className={clsx("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg z-50 dark:border-slate-700 dark:bg-slate-900">
          {/* Personal Workspace Option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={clsx(
              "flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-mono",
              "hover:bg-slate-50 dark:hover:bg-slate-800",
              !currentOrg && "bg-indigo-50 dark:bg-indigo-950"
            )}
          >
            <div className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Users className="h-3 w-3 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                Personal Workspace
              </div>
              <div className="text-[10px] text-slate-500">
                Your private workspace
              </div>
            </div>
            {!currentOrg && <Check className="h-3.5 w-3.5 text-indigo-500" />}
          </button>

          {/* Organizations */}
          {organizations.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-slate-800">
                Organizations
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelect(org)}
                  className={clsx(
                    "flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-mono",
                    "hover:bg-slate-50 dark:hover:bg-slate-800",
                    currentOrg?.id === org.id && "bg-indigo-50 dark:bg-indigo-950"
                  )}
                >
                  <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <Building2 className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {org.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {currentOrg?.id === org.id && <Check className="h-3.5 w-3.5 text-indigo-500" />}
                </button>
              ))}
            </>
          )}

          {/* Create Organization */}
          <div className="border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                // Navigate to create organization page
                window.location.href = "/organizations/new";
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-mono text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Organization
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
