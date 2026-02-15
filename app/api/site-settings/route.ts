import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { isValidGateCookie } from "@/lib/security/gate-cookie"

const COOKIE_NAME = "bunker_site_access"

/**
 * GET - Public endpoint to get site settings (gate status, production mode, unlock status)
 * Does not return the password
 */
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("site_settings")
    .select("gate_password, production_mode")
    .eq("id", "main")
    .single()

  if (error) {
    // Table might not exist yet
    return NextResponse.json({
      gateEnabled: false,
      productionMode: true,
      unlocked: true,
    })
  }

  const gateEnabled = !!(data?.gate_password && data.gate_password.trim() !== "")
  const productionMode = data?.production_mode !== false

  // Check if user has unlocked (valid cookie that matches current password)
  let unlocked = true
  if (gateEnabled && data.gate_password) {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(COOKIE_NAME)
    unlocked = await isValidGateCookie(cookie?.value, data.gate_password)
  }

  return NextResponse.json({
    gateEnabled,
    productionMode,
    unlocked,
  })
}
