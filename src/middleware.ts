import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Public routes that bypass Clerk middleware entirely:
// - /api/health: health check probe
// - /api/mcp/sse & /api/mcp/messages: external MCP clients with bearer tokens
const isPublicRoute = (pathname: string) =>
  pathname === '/api/health' ||
  pathname.startsWith('/api/mcp/sse') ||
  pathname.startsWith('/api/mcp/messages');

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/executions(.*)',
  '/versions(.*)',
  '/approvals(.*)',
  '/api/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next();
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
