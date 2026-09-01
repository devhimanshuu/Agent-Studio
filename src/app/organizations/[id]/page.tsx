"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { 
  Building2, 
  ArrowLeft,
  Loader2
} from "lucide-react";
import { OrganizationSettings } from "@/components/organizations/OrganizationSettings";
import { toast } from "@/stores/toastStore";

// ────────────── Types ──────────────

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  memberCount: number;
}

// ────────────── Component ──────────────

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // Load organization
  const loadOrganization = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationId}`);
      if (res.ok) {
        const data = await res.json();
        setOrganization(data.data);
      } else {
        toast.error("Error", "Organization not found");
        router.push("/organizations");
      }
    } catch (err) {
      logger.error({ err }, "Failed to load organization");
      toast.error("Error", "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }, [organizationId, router]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6 w-full font-mono">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push("/organizations")}
          className="inline-flex items-center gap-2 text-sm font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Organizations
        </button>
        
        <h1 className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
          <Building2 className="h-6 w-6 text-indigo-500" />
          {organization.name}
        </h1>
        <p className="text-sm font-mono text-slate-500 mt-1">
          {organization.memberCount} member{organization.memberCount !== 1 ? "s" : ""} · {organization.plan} plan
        </p>
      </div>

      {/* Organization Settings */}
      <OrganizationSettings 
        organizationId={organizationId}
        onUpdate={loadOrganization}
      />
    </div>
  );
}
