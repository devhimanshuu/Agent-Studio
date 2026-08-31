"use client";

import { useEffect, useState, useCallback } from "react";
import { OrgRole, OrgPermissionSet } from "@/services/RBACService";

interface PermissionsState {
  role: OrgRole | null;
  permissions: OrgPermissionSet | null;
  isLoading: boolean;
  error: Error | null;
}

export function usePermissions(organizationId?: string | null) {
  const [state, setState] = useState<PermissionsState>({
    role: null,
    permissions: null,
    isLoading: !!organizationId,
    error: null,
  });

  const fetchPermissions = useCallback(async (orgId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/organizations/${orgId}/permissions`);
      if (!res.ok) {
        throw new Error(`Failed to fetch permissions: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setState({
          role: json.data.role,
          permissions: json.data.permissions,
          isLoading: false,
          error: null,
        });
      } else {
        throw new Error(json.error || "Failed to load permissions");
      }
    } catch (err) {
      setState({
        role: null,
        permissions: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, []);

  useEffect(() => {
    if (organizationId) {
      fetchPermissions(organizationId);
    } else {
      setState({
        role: null,
        permissions: null,
        isLoading: false,
        error: null,
      });
    }
  }, [organizationId, fetchPermissions]);

  const can = useCallback(
    (permissionKey: keyof OrgPermissionSet): boolean => {
      if (!state.permissions) return false;
      return !!state.permissions[permissionKey];
    },
    [state.permissions]
  );

  return {
    ...state,
    can,
    isOwner: state.role === "OWNER",
    isAdmin: state.role === "OWNER" || state.role === "ADMIN",
    isMember: state.role === "MEMBER",
    isViewer: state.role === "VIEWER",
    refetch: () => organizationId && fetchPermissions(organizationId),
  };
}
