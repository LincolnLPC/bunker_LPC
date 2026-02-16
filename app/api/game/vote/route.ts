import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validateRoomId, validatePlayerId } from "@/lib/security/validation"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"

// POST - Cast vote
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting for voting
  const identifier = getRateLimitIdentifier(request, user.id)
  const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.vote)

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many votes. Please slow down.",
        message: "Rate limit exceeded for voting.",
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

    const { roomId, targetPlayerId } = body

    if (!roomId || !targetPlayerId) {
      return NextResponse.json({ error: "Room ID and target player ID required" }, { status: 400 })
    }

    // Validate inputs
    const roomIdValidation = validateRoomId(roomId)
    const playerIdValidation = validatePlayerId(targetPlayerId)

    if (!roomIdValidation.valid || !playerIdValidation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: [...roomIdValidation.errors, ...playerIdValidation.errors],
        },
        { status: 400 }
      )
    }

    // Get room with player metadata
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select(`
        *,
        game_players (*)
      `)
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      console.error("[Vote] Error fetching room:", roomError)
      return NextResponse.json({ 
        error: "Room not found", 
        details: roomError?.message,
        code: roomError?.code 
      }, { status: 404 })
    }

    if (room.phase !== "voting") {
      return NextResponse.json({ error: "Not in voting phase" }, { status: 400 })
    }

    // Get voter player
    const voter = room.game_players.find((p: { user_id: string }) => p.user_id === user.id)
    if (!voter) {
      console.error("[Vote] Voter not found:", { userId: user.id, roomId, playersCount: room.game_players?.length })
      return NextResponse.json({ 
        error: "Not in this game",
        details: "You are not a player in this room"
      }, { status: 403 })
    }

    const settings = (room.settings as Record<string, unknown>) || {}
    const eliminatedCanVote = settings.eliminatedCanVote === true
    if (voter.is_eliminated && !eliminatedCanVote) {
      return NextResponse.json({ 
        error: "Eliminated players cannot vote",
        details: "You have been eliminated from this game"
      }, { status: 403 })
    }

    // Check if target exists and is not eliminated
    const target = room.game_players.find((p: { id: string }) => p.id === targetPlayerId)
    if (!target) {
      console.error("[Vote] Target not found:", { targetPlayerId, roomId, availablePlayers: room.game_players?.map((p: any) => p.id) })
      return NextResponse.json({ 
        error: "Invalid target",
        details: "Target player not found in this room"
      }, { status: 400 })
    }
    
    if (target.is_eliminated) {
      return NextResponse.json({ 
        error: "Invalid target",
        details: "Cannot vote for eliminated players"
      }, { status: 400 })
    }

    // Get voter metadata for special card effects
    // Handle missing metadata column gracefully
    let voterMetadata: any = {}
    try {
      voterMetadata = voter.metadata || {}
      if (typeof voterMetadata === 'string') {
        voterMetadata = JSON.parse(voterMetadata)
      }
    } catch (e) {
      console.warn("[Vote] Error parsing voter metadata:", e)
      voterMetadata = {}
    }
    
    // Check if voter cannot vote against target (special card effect)
    // If "no-vote-against" card was used, the restriction is stored in voter's metadata
    // The restriction means: voter (who has the restriction) cannot vote against the playerId in the restriction
    if (voterMetadata && voterMetadata.cannotVoteAgainst && Array.isArray(voterMetadata.cannotVoteAgainst)) {
      const cannotVote = voterMetadata.cannotVoteAgainst.some((restriction: any) => {
        const restrictedId = restriction.playerId ?? restriction.player_id
        return restrictedId === targetPlayerId
      })
      if (cannotVote) {
        return NextResponse.json(
          { error: "Вы не можете голосовать против этого игрока (эффект спецкарты)" },
          { status: 403 }
        )
      }
    }

    // Check if voter has double vote
    const hasDoubleVote = voterMetadata && voterMetadata.doubleVote?.active && voterMetadata.doubleVote.round === room.current_round

    // Idempotency: if voter already voted for the same target this round, return 200 without changing data
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id, room_id, round, voter_id, target_id, vote_weight")
      .eq("room_id", roomId)
      .eq("round", room.current_round)
      .eq("voter_id", voter.id)
      .maybeSingle()

    if (existingVote && existingVote.target_id === targetPlayerId) {
      return NextResponse.json({ success: true, vote: existingVote })
    }

    // Use service role client to bypass RLS, or fallback to regular client
    let serviceClient
    try {
      serviceClient = createServiceRoleClient()
      console.log("[Vote] Using service role client (bypasses RLS)")
    } catch (serviceError) {
      console.warn("[Vote] Service role key not available, using regular client (RLS will apply)")
      console.warn("[Vote] If you get RLS errors, either:")
      console.warn("[Vote] 1. Add SUPABASE_SERVICE_ROLE_KEY to .env.local, or")
      console.warn("[Vote] 2. Run the SQL script from scripts/016-fix-votes-rls-policy-simple.sql")
      // Fallback to regular client if service role key is not available
      serviceClient = supabase
    }
    
    const { data: voteData, error: voteError } = await serviceClient
      .from("votes")
      .upsert(
        {
          room_id: roomId,
          round: room.current_round,
          voter_id: voter.id,
          target_id: targetPlayerId,
          vote_weight: hasDoubleVote ? 2 : 1, // Store vote weight
        },
        {
          onConflict: "room_id,round,voter_id",
        },
      )
      .select()

    if (voteError) {
      console.error("[Vote] Database error:", voteError)
      console.error("[Vote] Error code:", voteError.code)
      console.error("[Vote] Error message:", voteError.message)
      console.error("[Vote] Error details:", voteError.details)
      console.error("[Vote] Error hint:", voteError.hint)
      
      // Try to serialize error for logging
      try {
        console.error("[Vote] Error JSON:", JSON.stringify(voteError, Object.getOwnPropertyNames(voteError), 2))
      } catch (e) {
        console.error("[Vote] Could not serialize error:", e)
      }
      
      // Provide more detailed error message
      if (voteError.code === "23503") {
        return NextResponse.json(
          { 
            error: "Invalid player or room reference", 
            message: voteError.message || "Foreign key constraint violation",
            details: voteError.hint || voteError.details || "The player or room does not exist",
            code: voteError.code 
          },
          { status: 400 }
        )
      }
      
      if (voteError.code === "23505") {
        return NextResponse.json(
          { 
            error: "Vote already exists", 
            message: voteError.message || "Unique constraint violation",
            details: voteError.hint || voteError.details || "You have already voted in this round",
            code: voteError.code 
          },
          { status: 409 }
        )
      }
      
      // For other database errors - always provide error message
      const errorMessage = voteError.message || "Database error"
      const errorCode = voteError.code || "UNKNOWN"
      const errorDetails = voteError.hint || voteError.details || String(voteError)
      
      return NextResponse.json(
        { 
          error: "Failed to cast vote", 
          message: errorMessage,
          code: errorCode,
          details: errorDetails,
        },
        { status: 500 }
      )
    }
    
    if (!voteData || voteData.length === 0) {
      console.error("[Vote] Vote upserted but no data returned")
      return NextResponse.json(
        { 
          error: "Failed to cast vote",
          message: "Vote was not saved properly",
          details: "Database operation completed but no vote data was returned"
        },
        { status: 500 }
      )
    }

    console.log("[Vote] Vote cast successfully:", {
      voteId: voteData?.[0]?.id,
      roomId,
      round: room.current_round,
      voterId: voter.id,
      targetId: targetPlayerId,
    })

    const jsonResponse = NextResponse.json({ 
      success: true,
      vote: voteData?.[0],
    })

    // Add rate limit headers
    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      jsonResponse.headers.set(key, value)
    })

    return jsonResponse
  } catch (error) {
    console.error("[Vote] Error casting vote:", error)
    console.error("[Vote] Error type:", typeof error)
    console.error("[Vote] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error) || "Unknown error"
    const errorCode = (error as any)?.code || "UNKNOWN"
    
    // Safely serialize error for response - always return a string to avoid [object Object]
    let errorDetails: string = ""
    try {
      if (error instanceof Error) {
        // For Error objects, extract key information
        const errorInfo: any = {
          message: error.message,
          name: error.name,
        }
        // Only include stack in development
        if (process.env.NODE_ENV === "development" && error.stack) {
          errorInfo.stack = error.stack
        }
        // Try to serialize, but fallback to string if it fails
        try {
          errorDetails = JSON.stringify(errorInfo)
        } catch {
          errorDetails = `${error.name}: ${error.message}`
        }
      } else if (typeof error === 'object' && error !== null) {
        // For other objects, try to extract meaningful info
        const errorObj = error as any
        if (errorObj.message) {
          errorDetails = String(errorObj.message)
        } else if (errorObj.error) {
          errorDetails = String(errorObj.error)
        } else {
          // Try to serialize, but limit depth to avoid circular references
          try {
            errorDetails = JSON.stringify(errorObj, (key, value) => {
              // Skip functions and undefined
              if (typeof value === 'function' || value === undefined) {
                return undefined
              }
              // Limit depth to 3 levels
              if (key && key.split('.').length > 3) {
                return '[Object]'
              }
              return value
            }, 2)
          } catch {
            errorDetails = String(error)
          }
        }
      } else {
        errorDetails = String(error)
      }
    } catch (serializeError) {
      errorDetails = String(error) || "Unknown error"
    }
    
    return NextResponse.json(
      { 
        error: "Failed to cast vote",
        message: errorMessage,
        code: errorCode,
        details: errorDetails, // Now always a string
      },
      { status: 500 }
    )
  }
}
