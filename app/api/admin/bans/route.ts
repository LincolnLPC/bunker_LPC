import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateUUID, sanitizeInput } from "@/lib/security/validation"
import type { NextRequest } from "next/server"

// GET - List all bans
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active") === "true"

    let query = supabase
      .from("bans")
      .select(
        `
        *,
        user:profiles!bans_user_id_fkey(display_name, username),
        banned_by_user:profiles!bans_banned_by_fkey(display_name, username)
      `
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (activeOnly) {
      query = query.eq("is_active", true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    }

    const { data: bans, error } = await query

    if (error) throw error

    return NextResponse.json({ bans: bans || [] })
  } catch (error) {
    console.error("Error fetching bans:", error)
    return NextResponse.json({ error: "Failed to fetch bans" }, { status: 500 })
  }
}

// POST - Create a ban
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { userId, reason, banType, expiresAt } = body

    // Validate required fields
    if (!userId || !reason || !banType) {
      return NextResponse.json(
        { error: "Missing required fields: userId, reason, banType" },
        { status: 400 }
      )
    }

    // Validate ban type
    if (!["temporary", "permanent"].includes(banType)) {
      return NextResponse.json(
        { error: "Invalid banType. Must be 'temporary' or 'permanent'" },
        { status: 400 }
      )
    }

    // Validate UUID
    const userIdValidation = validateUUID(userId, "userId")
    if (!userIdValidation.valid) {
      return NextResponse.json(
        { error: "Invalid userId format", errors: userIdValidation.errors },
        { status: 400 }
      )
    }

    // Validate reason length
    const sanitizedReason = sanitizeInput(reason.trim())
    if (sanitizedReason.length < 5 || sanitizedReason.length > 500) {
      return NextResponse.json(
        { error: "Reason must be between 5 and 500 characters" },
        { status: 400 }
      )
    }

    // Validate expiresAt for temporary bans
    if (banType === "temporary" && !expiresAt) {
      return NextResponse.json(
        { error: "expiresAt is required for temporary bans" },
        { status: 400 }
      )
    }

    // Check if user exists
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Deactivate any existing active bans for this user
    await supabase
      .from("bans")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_active", true)

    // Create new ban
    const { data: ban, error: banError } = await supabase
      .from("bans")
      .insert({
        user_id: userId,
        banned_by: user.id,
        reason: sanitizedReason,
        ban_type: banType,
        expires_at: banType === "permanent" ? null : expiresAt,
        is_active: true,
      })
      .select()
      .single()

    if (banError) {
      console.error("Error creating ban:", banError)
      return NextResponse.json({ error: "Failed to create ban" }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        ban: {
          id: ban.id,
          userId: ban.user_id,
          reason: ban.reason,
          banType: ban.ban_type,
          expiresAt: ban.expires_at,
          isActive: ban.is_active,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error in ban creation endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
