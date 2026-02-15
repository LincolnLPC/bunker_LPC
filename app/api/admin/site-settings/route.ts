import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const GATE_COOKIE_NAME = "bunker_site_access"

/**
 * GET - Admin: get current site settings (without password value for security)
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: adminRole } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!adminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const adminClient = createServiceRoleClient()
  const { data, error } = await adminClient
    .from("site_settings")
    .select("gate_password, production_mode")
    .eq("id", "main")
    .single()

  if (error) {
    return NextResponse.json({
      gateEnabled: false,
      productionMode: true,
      hasPassword: false,
    })
  }

  const hasPassword = !!(data?.gate_password && data.gate_password.trim() !== "")
  const productionMode = data?.production_mode !== false

  return NextResponse.json({
    gateEnabled: hasPassword,
    productionMode,
    hasPassword,
  })
}

/**
 * PATCH - Admin: update site settings
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: adminRole } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!adminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { gatePassword, productionMode } = body as {
    gatePassword?: string | null
    productionMode?: boolean
  }

  const adminClient = createServiceRoleClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  const passwordChanged = gatePassword !== undefined
  if (passwordChanged) {
    updateData.gate_password = gatePassword === "" || gatePassword === null ? null : String(gatePassword).trim()
  }
  if (productionMode !== undefined) {
    updateData.production_mode = Boolean(productionMode)
  }

  const { error } = await adminClient
    .from("site_settings")
    .upsert(
      { id: "main", ...updateData },
      { onConflict: "id" }
    )

  if (error) {
    console.error("[Admin SiteSettings]", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })
  // When password changes, clear unlock cookie for this user (others invalidated via hash mismatch)
  if (passwordChanged) {
    response.cookies.set(GATE_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
      expires: new Date(0),
    })
  }
  return response
}
