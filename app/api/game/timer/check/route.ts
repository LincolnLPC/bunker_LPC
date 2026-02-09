import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateGameStatistics } from "@/lib/game/stats"

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

    // Check round mode from settings
    const roundMode = (room.settings as any)?.roundMode || "automatic"
    
    // In manual mode, don't check timer - host controls everything
    if (roundMode === "manual") {
      return NextResponse.json({ 
        success: true, 
        expired: false,
        timeRemaining: null,
        manualMode: true
      })
    }

    // Only check if room is in playing or voting phase and timer is active
    if (!room.round_started_at || (room.phase !== "playing" && room.phase !== "voting")) {
      return NextResponse.json({ 
        success: true, 
        expired: false,
        timeRemaining: null 
      })
    }

    // Get timer duration based on current phase
    // For playing phase: use discussion time
    // For voting phase: use voting time
    const settings = (room.settings as any) || {}
    const timerDuration = room.phase === "playing" 
      ? (settings.discussionTime || room.round_timer_seconds)
      : (settings.votingTime || 60)

    // Calculate time remaining
    const startedAt = new Date(room.round_started_at)
    const now = new Date()
    const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)
    const timeRemaining = Math.max(0, timerDuration - elapsedSeconds)

    // If timer expired, handle auto-transition (only in automatic mode)
    if (timeRemaining <= 0 && roundMode === "automatic") {
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
          message: `Время обсуждения раунда ${room.current_round} истекло. Началось голосование.`,
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
      } else if (room.phase === "voting") {
        // Auto-transition to next round
        // Check if this is the last round
        const { data: allPlayers } = await supabase
          .from("game_players")
          .select("id")
          .eq("room_id", roomId)
          .eq("is_eliminated", false)

        const remainingPlayers = allPlayers?.length || 0

        if (remainingPlayers <= 2) {
          // Game finished - determine survivors and all players for stats/history
          const { data: allPlayersForStats } = await supabase
            .from("game_players")
            .select("id, user_id, is_eliminated")
            .eq("room_id", roomId)

          const { data: survivorsWithNames } = await supabase
            .from("game_players")
            .select("id, name")
            .eq("room_id", roomId)
            .eq("is_eliminated", false)

          const { error: finishError } = await supabase
            .from("game_rooms")
            .update({
              phase: "finished",
            })
            .eq("id", roomId)

          if (finishError) throw finishError

          await updateGameStatistics({
            roomId,
            survivorPlayerIds: (allPlayersForStats || []).filter((p: any) => !p.is_eliminated).map((p: any) => p.id),
            allPlayerIds: (allPlayersForStats || []).map((p: any) => p.id),
          })

          await supabase.from("chat_messages").insert({
            room_id: roomId,
            player_id: null,
            message: `Игра завершена! Выжившие: ${survivorsWithNames?.map((p: any) => p.name).join(", ") || "Не определены"}`,
            message_type: "system",
          })

          return NextResponse.json({ 
            success: true, 
            expired: true,
            phaseChanged: true,
            newPhase: "finished",
            timeRemaining: 0
          })
        }

        // Advance to next round
        const { error: updateError } = await supabase
          .from("game_rooms")
          .update({
            phase: "playing",
            current_round: (room.current_round || 0) + 1,
            round_started_at: new Date().toISOString(),
          })
          .eq("id", roomId)

        if (updateError) throw updateError

        // Add system message
        await supabase.from("chat_messages").insert({
          room_id: roomId,
          player_id: null,
          message: `Время голосования истекло. Начался раунд ${(room.current_round || 0) + 1}`,
          message_type: "system",
        })

        return NextResponse.json({ 
          success: true, 
          expired: true,
          phaseChanged: true,
          newPhase: "playing",
          newRound: (room.current_round || 0) + 1,
          timeRemaining: 0
        })
      }
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
