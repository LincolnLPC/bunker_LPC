import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// GET - List all premium users
export async function GET(request: Request) {
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
    const serviceClient = createServiceRoleClient()

    // Get all premium users
    const { data: premiumProfiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, username, display_name, avatar_url, subscription_tier, premium_expires_at, created_at, games_played, games_won")
      .eq("subscription_tier", "premium")
      .order("created_at", { ascending: false })

    if (profilesError) {
      console.error("Error fetching premium users:", profilesError)
      return NextResponse.json({ error: "Failed to fetch premium users" }, { status: 500 })
    }

    // Get user emails from auth.users
    const premiumUsers = await Promise.all(
      (premiumProfiles || []).map(async (profile) => {
        try {
          const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.id)
          return {
            ...profile,
            email: authUser?.user?.email || null,
            isExpired: profile.premium_expires_at
              ? new Date(profile.premium_expires_at) < new Date()
              : false,
          }
        } catch (error) {
          return {
            ...profile,
            email: null,
            isExpired: profile.premium_expires_at
              ? new Date(profile.premium_expires_at) < new Date()
              : false,
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      users: premiumUsers,
    })
  } catch (error) {
    console.error("Error listing premium users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
