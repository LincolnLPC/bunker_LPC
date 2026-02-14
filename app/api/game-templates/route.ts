import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"
import { canCreateTemplates } from "@/lib/subscription/utils"

// GET - List user's templates
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user has premium subscription (templates are premium feature)
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single()

    if (!profile || !canCreateTemplates(profile.subscription_tier as "basic" | "premium")) {
      return NextResponse.json(
        { error: "Templates are only available for premium users" },
        { status: 403 }
      )
    }

    const { data: templates, error } = await supabase
      .from("game_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
  }
}

// POST - Create new template
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting
  const identifier = getRateLimitIdentifier(request, user.id)
  const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.create)

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
      },
      { status: 429 }
    )

    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const {
      name,
      description,
      maxPlayers,
      roundMode,
      discussionTime,
      votingTime,
      autoReveal,
      spectators,
      hostRole,
      catastrophe,
      bunkerDescription,
      excludeNonBinaryGender,
      eliminatedCanVote,
      specialCardsPerPlayer,
      characteristicsSettings,
      customCharacteristics,
    } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Template name is too long (max 100 characters)" }, { status: 400 })
    }

    // Check if user has premium subscription
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single()

    if (!profile || !canCreateTemplates(profile.subscription_tier as "basic" | "premium")) {
      return NextResponse.json(
        { error: "Templates are only available for premium users" },
        { status: 403 }
      )
    }

    // Insert template
    const { data: template, error: insertError } = await supabase
      .from("game_templates")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        max_players: maxPlayers || 12,
        round_mode: roundMode || "automatic",
        discussion_time: discussionTime || 120,
        voting_time: votingTime || 60,
        auto_reveal: autoReveal || false,
        spectators: spectators !== undefined ? spectators : true,
        host_role: hostRole || "host_and_player",
        catastrophe: catastrophe || null,
        bunker_description: bunkerDescription || null,
        exclude_non_binary_gender: excludeNonBinaryGender || false,
        eliminated_can_vote: eliminatedCanVote || false,
        special_cards_per_player: typeof specialCardsPerPlayer === "number" ? Math.min(30, Math.max(1, specialCardsPerPlayer)) : 1,
        characteristics_settings: characteristicsSettings || {},
        custom_characteristics: customCharacteristics || {},
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique constraint violation (duplicate name)
        return NextResponse.json(
          { error: "Template with this name already exists" },
          { status: 409 }
        )
      }
      throw insertError
    }

    const jsonResponse = NextResponse.json({ template })

    // Add rate limit headers
    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      jsonResponse.headers.set(key, value)
    })

    return jsonResponse
  } catch (error) {
    console.error("Error creating template:", error)
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
  }
}
