import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { createEdgeClient } from "./edge"
import { isValidGateCookie } from "@/lib/security/gate-cookie"

const GATE_COOKIE_NAME = "bunker_site_access"

export async function updateSession(request: NextRequest) {
  try {
    return await updateSessionInner(request)
  } catch (err) {
    console.error("[Middleware]", err)
    return NextResponse.next({ request })
  }
}

async function updateSessionInner(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // Site gate check: if password is set and user hasn't unlocked, redirect to /
  const pathname = request.nextUrl.pathname
  const bypassPaths = [
    "/",
    "/api/site-settings",
    "/api/site-settings/unlock",
    "/auth/callback", // Supabase OAuth callback
  ]
  const shouldCheckGate = !bypassPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))

  if (shouldCheckGate) {
    const cookieValue = request.cookies.get(GATE_COOKIE_NAME)?.value
    const edgeClient = createEdgeClient()
    if (edgeClient) {
      try {
        const { data } = await edgeClient
          .from("site_settings")
          .select("gate_password")
          .eq("id", "main")
          .single()
        const gatePassword = data?.gate_password
        const gateEnabled = !!(gatePassword && String(gatePassword).trim() !== "")
        if (gateEnabled) {
          const valid = await isValidGateCookie(cookieValue, gatePassword)
          if (!valid) {
            const url = request.nextUrl.clone()
            url.pathname = "/"
            return NextResponse.redirect(url)
          }
        }
      } catch {
        // Table might not exist, allow request
      }
    }
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - redirect to login if not authenticated
  if (request.nextUrl.pathname.startsWith("/game") && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (request.nextUrl.pathname.startsWith("/lobby") && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
