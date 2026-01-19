import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// POST - Revoke premium subscription
export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole || adminRole.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { userId } = body

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const serviceClient = createServiceRoleClient()

    // Update profile to basic tier
    const { data: updatedProfile, error: updateError } = await serviceClient
      .from("profiles")
      .update({
        subscription_tier: "basic",
        premium_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single()

    if (updateError) {
      console.error("Error revoking premium:", updateError)
      return NextResponse.json(
        {
          error: "Failed to revoke premium",
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Premium subscription revoked successfully",
      profile: updatedProfile,
    })
  } catch (error) {
    console.error("Error revoking premium:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
