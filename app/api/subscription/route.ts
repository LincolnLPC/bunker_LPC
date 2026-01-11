import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateUUID } from "@/lib/security/validation"
import type { NextRequest } from "next/server"

// GET - Get current user's subscription info
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Fetch subscription info from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_status, subscription_expires_at")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("Error fetching subscription:", profileError)
      return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
    }

    const tier = (profile?.subscription_tier || "basic") as "basic" | "premium"
    const status = profile?.subscription_status || "active"
    const expiresAt = profile?.subscription_expires_at || null

    // Check if subscription is expired
    let isActive = true
    if (expiresAt && new Date(expiresAt) < new Date()) {
      isActive = false
      // Auto-downgrade expired subscriptions
      if (tier === "premium") {
        await supabase
          .from("profiles")
          .update({
            subscription_tier: "basic",
            subscription_status: "expired",
          })
          .eq("id", user.id)
      }
    }

    // Get limits for current tier
    const limits = {
      maxRoomsPerDay: tier === "premium" ? -1 : 3,
      maxPlayersPerRoom: tier === "premium" ? 20 : 12,
      canCreateCustomCharacteristics: tier === "premium",
      canUseAdvancedFeatures: tier === "premium",
      canCreateTemplates: tier === "premium",
      canExportGameData: tier === "premium",
    }

    return NextResponse.json({
      tier,
      status: isActive ? status : "expired",
      expiresAt,
      limits,
      isActive,
    })
  } catch (error) {
    console.error("Error in subscription GET endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Update subscription tier (internal, used by webhooks)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { tier, status, expiresAt } = body

    // Validate tier
    if (!tier || !["basic", "premium"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier. Must be 'basic' or 'premium'" },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status && !["active", "expired", "cancelled", "pending"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: active, expired, cancelled, pending" },
        { status: 400 }
      )
    }

    // Update subscription
    const updateData: any = {
      subscription_tier: tier,
    }

    if (status) {
      updateData.subscription_status = status
    }

    if (expiresAt) {
      updateData.subscription_expires_at = expiresAt
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)

    if (updateError) {
      console.error("Error updating subscription:", updateError)
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully",
    })
  } catch (error) {
    console.error("Error in subscription POST endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
