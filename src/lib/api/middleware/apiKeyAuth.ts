/**
 * API Key Authentication Middleware
 *
 * Validates API keys and attaches organization context to requests.
 * Supports both API key and Clerk session authentication.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ApiKeyService } from "@/services/ApiKeyService";
import { logger } from "@/lib/logger";

// ────────────── Types ──────────────

export interface ApiKeyContext {
  type: "api_key";
  keyId: string;
  organizationId: string;
  scopes: string[];
}

export interface SessionContext {
  type: "session";
  userId: string;
  organizationId?: string;
}

export type AuthContext = ApiKeyContext | SessionContext;

export type AuthenticatedHandler = (
  request: Request,
  context: AuthContext & Record<string, unknown>
) => Promise<Response>;

// ────────────── Service ──────────────

const apiKeyService = new ApiKeyService();

// ────────────── Middleware ──────────────

/**
 * Extract API key from request
 * Checks Authorization header (Bearer token) and X-API-Key header
 */
function extractApiKey(request: Request): string | null {
  // Check X-API-Key header
  const xApiKey = request.headers.get("X-API-Key");
  if (xApiKey) return xApiKey;

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check query parameter (for webhook callbacks)
  const url = new URL(request.url);
  const apiKeyParam = url.searchParams.get("api_key");
  if (apiKeyParam) return apiKeyParam;

  return null;
}

/**
 * Middleware that authenticates via API key or session
 * Priority: API key > Clerk session
 */
export function withApiKeyAuth(handler: AuthenticatedHandler) {
  return async (request: Request, context?: Record<string, unknown>) => {
    // Try API key first
    const apiKey = extractApiKey(request);
    
    if (apiKey) {
      try {
        const validation = await apiKeyService.validateKey(apiKey);
        
        if (!validation.valid) {
          return NextResponse.json(
            { error: "Invalid or expired API key" },
            { status: 401 }
          );
        }

        return handler(request, {
          ...context,
          type: "api_key",
          keyId: validation.keyId!,
          organizationId: validation.organizationId!,
          scopes: validation.scopes!,
        });
      } catch (error) {
        logger.error({ error }, "API key validation failed");
        return NextResponse.json(
          { error: "Authentication failed" },
          { status: 401 }
        );
      }
    }

    // Fall back to Clerk session
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return handler(request, {
      ...context,
      type: "session",
      userId,
    });
  };
}

/**
 * Middleware that requires API key authentication (no session fallback)
 */
export function requireApiKey(handler: AuthenticatedHandler) {
  return async (request: Request, context?: Record<string, unknown>) => {
    const apiKey = extractApiKey(request);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key required. Provide via X-API-Key header or Bearer token." },
        { status: 401 }
      );
    }

    try {
      const validation = await apiKeyService.validateKey(apiKey);
      
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Invalid or expired API key" },
          { status: 401 }
        );
      }

      return handler(request, {
        ...context,
        type: "api_key",
        keyId: validation.keyId!,
        organizationId: validation.organizationId!,
        scopes: validation.scopes!,
      });
    } catch (error) {
      logger.error({ error }, "API key validation failed");
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }
  };
}

/**
 * Check if context has required scope
 */
export function hasScope(context: AuthContext, scope: string): boolean {
  if (context.type === "session") {
    // Session users have all scopes
    return true;
  }

  // API key users need explicit scopes
  return context.scopes.includes("*") || context.scopes.includes(scope);
}

/**
 * Require specific scope or return 403
 */
export function requireScope(context: AuthContext, scope: string): NextResponse | null {
  if (!hasScope(context, scope)) {
    return NextResponse.json(
      { error: `Missing required scope: ${scope}` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Get organization ID from context
 * For API keys, it's required. For sessions, it's optional.
 */
export function getOrganizationId(context: AuthContext): string | null {
  if (context.type === "api_key") {
    return context.organizationId;
  }
  return context.organizationId || null;
}

/**
 * Get user ID from context
 * Only available for session authentication
 */
export function getUserId(context: AuthContext): string | null {
  if (context.type === "session") {
    return context.userId;
  }
  return null;
}
