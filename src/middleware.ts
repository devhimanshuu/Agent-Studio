import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/executions(.*)',
  '/versions(.*)',
  '/approvals(.*)',
  // /api/mcp/sse + /api/mcp/messages are the Agent Studio MCP *server* routes:
  // they perform their own auth (Clerk session OR bearer token) so external
  // MCP clients (Cursor, Claude Desktop) can connect without a Clerk cookie.
  /^\/api\/(?!health|mcp\/sse|mcp\/messages)(.*)/,
])

export default clerkMiddleware(async (auth, req) => {
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
