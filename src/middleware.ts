import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// MCP server routes that handle their own auth (Clerk session OR bearer token).
// These must bypass Clerk middleware entirely so external clients can connect
// without a Clerk cookie.
const isMcpServerRoute = (pathname: string) =>
  pathname.startsWith('/api/mcp/sse') ||
  pathname.startsWith('/api/mcp/messages')

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/executions(.*)',
  '/versions(.*)',
  '/approvals(.*)',
  // All API routes except health and MCP server routes (they do their own auth)
  /^\/api\/(?!health|mcp\/sse|mcp\/messages)(.*)/,
])

export default clerkMiddleware(async (auth, req) => {
  // MCP server routes bypass Clerk entirely — they validate bearer tokens
  // in their own route handlers so external clients (Cursor, Claude Desktop)
  // can connect without a Clerk session cookie.
  if (isMcpServerRoute(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const { userId } = await auth()

  // Signed-in users hitting the landing page → straight to dashboard
  if (userId && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for Clerk's auto-proxy path
    '/__clerk/:path*',
    '/(api|trpc)(.*)',
  ],
}
