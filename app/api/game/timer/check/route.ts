import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Check timer and auto-advance if needed
// This endpoint is called periodically by clients to check if timer expired
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { roomId } = body

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Get room with timer info
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase, current_round, round_timer_seconds, round_started_at, settings")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Only check if room is in playing or voting phase and timer is active
    if (!room.round_started_at || (room.phase !== "playing" && room.phase !== "voting")) {
      return NextResponse.json({ 
        success: true, 
        expired: false,
        timeRemaining: null 
      })
    }

    // Calculate time remaining
    const startedAt = new Date(room.round_started_at)
    const now = new Date()
    const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
    const timeRemaining = Math.max(0, room.round_timer_seconds - elapsedSeconds)

    // If timer expired, handle auto-transition
    if (timeRemaining <= 0) {
      // Only auto-transition if in playing phase (auto-transition to voting)
      // For voting phase, we wait for host to manually end voting
      if (room.phase === "playing") {
        // Auto-transition to voting
        const { error: updateError } = await supabase
          .from("game_rooms")
          .update({
            phase: "voting",
            round_started_at: new Date().toISOString(),
          })
          .eq("id", roomId)

        if (updateError) throw updateError

        // Add system message
        await supabase.from("chat_messages").insert({
          room_id: roomId,
          player_id: null,
          message: `Время раунда ${room.current_round} истекло. Началось голосование.`,
          message_type: "system",
        })

        // Handle auto-reveal if enabled
        const autoReveal = (room.settings as any)?.autoReveal || false
        if (autoReveal) {
          // Reveal one random characteristic for each player
          const { data: players } = await supabase
            .from("game_players")
            .select("id")
            .eq("room_id", roomId)
            .eq("is_eliminated", false)

          if (players && players.length > 0) {
            for (const player of players) {
              // Get unrevealed characteristics
              const { data: unrevealed } = await supabase
                .from("player_characteristics")
                .select("id")
                .eq("player_id", player.id)
                .eq("is_revealed", false)
                .limit(1)

              if (unrevealed && unrevealed.length > 0) {
                // Randomly select one to reveal
                const randomChar = unrevealed[Math.floor(Math.random() * unrevealed.length)]
                await supabase
                  .from("player_characteristics")
                  .update({
                    is_revealed: true,
                    reveal_round: room.current_round,
                  })
                  .eq("id", randomChar.id)

                // Get characteristic name for message
                const { data: char } = await supabase
                  .from("player_characteristics")
                  .select("name, value, game_players!inner(name)")
                  .eq("id", randomChar.id)
                  .single()

                if (char) {
                  const playerName = (char as any).game_players?.name || "Игрок"
                  await supabase.from("chat_messages").insert({
                    room_id: roomId,
                    player_id: null,
                    message: `[Автоматическое раскрытие] ${playerName}: ${char.name} - ${char.value}`,
                    message_type: "reveal",
                  })
                }
              }
            }
          }
        }

        return NextResponse.json({ 
          success: true, 
          expired: true,
          phaseChanged: true,
          newPhase: "voting",
          timeRemaining: 0
        })
      }

      // For voting phase, just notify that time is up (host still needs to manually end)
      return NextResponse.json({ 
        success: true, 
        expired: true,
        phaseChanged: false,
        timeRemaining: 0
      })
    }

    return NextResponse.json({ 
      success: true, 
      expired: false,
      timeRemaining,
      phase: room.phase
    })
  } catch (error) {
    console.error("Error checking timer:", error)
    return NextResponse.json({ error: "Failed to check timer" }, { status: 500 })
  }
}
