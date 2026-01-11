import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { SAMPLE_CATASTROPHES, SAMPLE_BUNKERS } from "@/types/game"
import { checkCanCreateRoom } from "@/lib/subscription/check"
import {
  validateMaxPlayers,
  validateRoundTimer,
  validateRoomSettings,
  validateDescription,
  validateRoomCode,
  combineValidations,
} from "@/lib/security/validation"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// POST - Create new game room
export async function POST(request: Request) {
  const supabase = await createClient()

  // Get user first for rate limiting
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting (after authentication)
  const identifier = getRateLimitIdentifier(request, user.id)
  const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.create)

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        message: "Rate limit exceeded. Please wait before creating another room.",
      },
      { status: 429 }
    )

    // Add rate limit headers
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
      maxPlayers: rawMaxPlayers = 12,
      roundTimerSeconds: rawRoundTimerSeconds = 120,
      settings = {},
      catastrophe,
      bunkerDescription,
    } = body

    // Validate input
    const maxPlayers = typeof rawMaxPlayers === "string" ? parseInt(rawMaxPlayers, 10) : rawMaxPlayers
    const roundTimerSeconds =
      typeof rawRoundTimerSeconds === "string" ? parseInt(rawRoundTimerSeconds, 10) : rawRoundTimerSeconds
    
    // Determine round timer based on mode
    // For automatic mode, use discussion time for playing phase
    // For manual mode, timer is not used (set to 0 or a large value)
    const roundMode = (settings as any)?.roundMode || "automatic"
    const finalRoundTimerSeconds = roundMode === "automatic" 
      ? ((settings as any)?.discussionTime || roundTimerSeconds)
      : 0 // Manual mode doesn't use timer

    const validationResults = combineValidations(
      validateMaxPlayers(maxPlayers),
      validateRoundTimer(roundTimerSeconds),
      validateRoomSettings(settings)
    )

    // Validate catastrophe and bunker if provided
    if (catastrophe) {
      const catValidation = validateDescription(catastrophe, "Катастрофа")
      if (!catValidation.valid) {
        validationResults.errors.push(...catValidation.errors)
        validationResults.valid = false
      }
    }

    if (bunkerDescription) {
      const bunkerValidation = validateDescription(bunkerDescription, "Описание бункера")
      if (!bunkerValidation.valid) {
        validationResults.errors.push(...bunkerValidation.errors)
        validationResults.valid = false
      }
    }

    if (!validationResults.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: validationResults.errors },
        { status: 400 }
      )
    }

    // Ensure user has a profile
    let { data: profile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id, subscription_tier")
      .eq("id", user.id)
      .single()

    if (!profile && profileCheckError) {
      // Create profile if it doesn't exist
      let username = user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`
      let attempts = 0
      let createError = null

      while (attempts < 5) {
        const { data, error } = await supabase.from("profiles").insert({
          id: user.id,
          username,
          display_name: user.user_metadata?.display_name || user.user_metadata?.username || username,
          subscription_tier: "basic",
        }).select().single()

        if (!error) {
          profile = data
          break
        }

        // Если ошибка уникальности username, попробуем другой
        if (error.code === "23505" || error.message.includes("unique") || error.message.includes("duplicate")) {
          username = `user_${user.id.slice(0, 8)}_${Date.now()}`
          attempts++
        } else {
          createError = error
          break
        }
      }

      if (createError) {
        console.error("Error creating profile:", createError)
        return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 })
      }
    }

    // Check subscription limits before creating room
    // TEMPORARILY DISABLED FOR TESTING - Remove this comment and uncomment below to re-enable
    // Check subscription limits (after validation)
    /*
    const subscriptionCheck = await checkCanCreateRoom(user.id, maxPlayers)
    if (!subscriptionCheck.allowed) {
      return NextResponse.json(
        {
          error: subscriptionCheck.reason || "Subscription limit reached",
          subscriptionTier: subscriptionCheck.subscriptionTier,
          requiresUpgrade: true,
        },
        { status: 403 }
      )
    }
    */
    console.log("[CreateRoom] Subscription check temporarily disabled for testing")

    const roomCode = generateRoomCode()
    // Use provided catastrophe/bunker or random if not provided
    const finalCatastrophe = catastrophe || getRandomItem(SAMPLE_CATASTROPHES)
    const finalBunkerDescription = bunkerDescription || getRandomItem(SAMPLE_BUNKERS)

    const { data: room, error } = await supabase
      .from("game_rooms")
      .insert({
        room_code: roomCode,
        host_id: user.id,
        max_players: maxPlayers,
        catastrophe: finalCatastrophe,
        bunker_description: finalBunkerDescription,
        phase: "waiting",
        current_round: 0,
        round_timer_seconds: roundTimerSeconds,
        settings,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error creating room:", error)
      throw error
    }

    if (!room) {
      console.error("Room was not created despite no error")
      return NextResponse.json(
        { error: "Failed to create room. Please try again." },
        { status: 500 }
      )
    }

    const response = NextResponse.json({ room }, { status: 200 })

    // Add rate limit headers
    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error: any) {
    console.error("Error creating room:", error)
    
    // Ensure we always return valid JSON
    const errorMessage = error?.message || "Failed to create room"
    const errorCode = error?.code || "UNKNOWN_ERROR"
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET - Get room by code
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const roomCode = searchParams.get("code")

  if (!roomCode) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 })
  }

  // Validate room code format
  const roomCodeValidation = validateRoomCode(roomCode.toUpperCase())
  if (!roomCodeValidation.valid) {
    return NextResponse.json(
      { error: "Invalid room code format", errors: roomCodeValidation.errors },
      { status: 400 }
    )
  }

  try {
    const { data: room, error } = await supabase
      .from("game_rooms")
      .select(
        `
        *,
        game_players (
          *,
          player_characteristics (*)
        )
      `,
      )
      .eq("room_code", roomCode.toUpperCase())
      .single()

    if (error) throw error
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error("Error fetching room:", error)
    return NextResponse.json({ error: "Failed to fetch room" }, { status: 500 })
  }
}
