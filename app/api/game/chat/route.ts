import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateChatMessage, validateRoomId } from "@/lib/security/validation"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"
import { moderateMessage, shouldLogForReview } from "@/lib/security/chat-moderation"

// POST - Send chat message
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting for chat (prevent spam)
  const identifier = getRateLimitIdentifier(request, user.id)
  const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.chat)

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many messages. Please slow down.",
        message: "Rate limit exceeded. Please wait before sending another message.",
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

    const { roomId, message } = body

    if (!roomId || !message) {
      return NextResponse.json({ error: "Room ID and message required" }, { status: 400 })
    }

    // Validate inputs
    const roomIdValidation = validateRoomId(roomId)
    const messageValidation = validateChatMessage(message)

    if (!roomIdValidation.valid || !messageValidation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: [...roomIdValidation.errors, ...messageValidation.errors],
        },
        { status: 400 }
      )
    }

    // Moderate message
    const moderationResult = moderateMessage(message)
    
    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: moderationResult.reason || "Сообщение не прошло модерацию",
        },
        { status: 400 }
      )
    }

    // Use filtered message if available
    const finalMessage = moderationResult.filteredMessage || message.trim()

    // Log moderated messages for admin review (optional, can be implemented later)
    if (shouldLogForReview(moderationResult)) {
      console.log("[Chat Moderation]", {
        userId: user.id,
        roomId,
        originalMessage: message,
        filteredMessage: finalMessage,
        reason: moderationResult.reason,
        severity: moderationResult.severity,
      })
    }

    // Verify user is in the room
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Not in this game" }, { status: 403 })
    }

    // Insert message (use filtered message)
    const { data: chatMessage, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        room_id: roomId,
        player_id: player.id,
        message: finalMessage,
        message_type: "chat",
      })
      .select(
        `
        *,
        game_players (name)
      `,
      )
      .single()

    if (insertError) throw insertError

    // Transform for response
    const response = {
      id: chatMessage.id,
      playerId: chatMessage.player_id || undefined,
      playerName: (chatMessage as any).game_players?.name || undefined,
      message: chatMessage.message,
      type: chatMessage.message_type as "chat" | "system" | "vote" | "reveal",
      timestamp: new Date(chatMessage.created_at),
    }

    const jsonResponse = NextResponse.json({ message: response })

    // Add rate limit headers
    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      jsonResponse.headers.set(key, value)
    })

    return jsonResponse
  } catch (error) {
    console.error("Error sending chat message:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
