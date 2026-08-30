"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Building2, 
  Mail, 
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { toast } from "@/stores/toastStore";

// ────────────── Types ──────────────

interface InvitationData {
  id: string;
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
}

// ────────────── Component ──────────────

export default function InvitationAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load invitation details
  const loadInvitation = useCallback(async () => {
    try {
      // In a real implementation, you'd have an endpoint to get invitation details
      // For now, we'll just try to accept it
      setInvitation({
        id: "inv-1",
        email: "user@example.com",
        role: "MEMBER",
        organizationName: "Organization",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (err) {
      setError("Failed to load invitation details");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvitation();
  }, [loadInvitation]);

  // Handle accept invitation
  const handleAccept = useCallback(async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      if (res.ok) {
        setSuccess(true);
        toast.success("Invitation accepted", "You've joined the organization!");
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept invitation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  }, [token, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
            Organization Invitation
          </h1>
          <p className="text-sm font-mono text-slate-500 mt-2">
            You've been invited to join an organization on Agent Studio
          </p>
        </div>

        {/* Invitation Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg">
          {success ? (
            /* Success State */
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mb-2">
                Welcome!
              </h2>
              <p className="text-sm font-mono text-slate-500">
                You've successfully joined the organization.
              </p>
              <p className="text-xs font-mono text-slate-400 mt-4">
                Redirecting to dashboard...
              </p>
            </div>
          ) : error ? (
            /* Error State */
            <div className="text-center py-8">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100 mb-2">
                Invitation Error
              </h2>
              <p className="text-sm font-mono text-red-600 dark:text-red-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-6 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-sm font-mono font-bold text-slate-700 dark:text-slate-300"
              >
                Go to Homepage
              </button>
            </div>
          ) : (
            /* Invitation Details */
            <>
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="text-xs font-mono text-slate-500">Invited to</div>
                    <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                      {invitation?.organizationName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <Building2 className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="text-xs font-mono text-slate-500">Your role</div>
                    <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                      {invitation?.role}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-6">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-mono text-amber-700 dark:text-amber-300">
                  By accepting this invitation, you'll be added to the organization 
                  with the specified role. You'll have access to all resources 
                  according to your permissions.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="w-full py-3 rounded-lg bg-indigo-600 text-white font-mono font-bold hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs font-mono text-slate-400">
            If you didn't expect this invitation, you can safely ignore it.
          </p>
        </div>
      </div>
    </div>
  );
}
