import { updateSession } from "@/lib/supabase/proxy"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Next.js Middleware
 * Handles Supabase session updates and other cross-cutting concerns
 */
export async function middleware(request: NextRequest) {
  // Update Supabase session (handles auth)
  const response = await updateSession(request)

  // Rate limiting is handled per-endpoint in route handlers
  // Additional middleware logic can be added here (CORS, logging, etc.)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
