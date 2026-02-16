import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// GET - List all registered users (profiles)
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    // Use regular client - profiles table has "Users can view all profiles" policy
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, subscription_tier, premium_expires_at, created_at, updated_at, games_played, games_won, rating, last_seen_at, show_online_status")
      .order("created_at", { ascending: false })
      .limit(500)

    if (profilesError) {
      console.error("[AdminUsers] Error fetching profiles:", profilesError)
      return NextResponse.json({ error: "Failed to fetch users", details: profilesError.message }, { status: 500 })
    }

    let users = (profiles || []).map((p) => ({ ...p, email: null as string | null }))

    // Add email from auth if service role is available (optional enrichment)
    try {
      const serviceClient = createServiceRoleClient()
      const maxWithEmail = Math.min(50, users.length)
      const enriched = await Promise.all(
        users.slice(0, maxWithEmail).map(async (profile) => {
          try {
            const { data: authUser } = await serviceClient.auth.admin.getUserById(profile.id)
            return { ...profile, email: authUser?.user?.email || null }
          } catch {
            return profile
          }
        })
      )
      users = [...enriched, ...users.slice(maxWithEmail)]
    } catch {
      // Service role not configured - return without emails
    }

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    })
  } catch (error) {
    console.error("[AdminUsers] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
