import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateGameStatistics } from "@/lib/game/stats"

// POST - Finish game manually (host only, manual mode, round >= 2)
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

    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase, current_round, settings")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can finish the game" }, { status: 403 })
    }

    const roundMode = (room.settings as any)?.roundMode || "automatic"

    if (roundMode !== "manual") {
      return NextResponse.json(
        { error: "Game can only be finished manually in manual round mode" },
        { status: 400 }
      )
    }

    const currentRound = room.current_round || 1
    if (currentRound < 2) {
      return NextResponse.json(
        { error: "Game can only be finished from round 2 onwards" },
        { status: 400 }
      )
    }

    if (room.phase !== "voting" && room.phase !== "results" && room.phase !== "playing") {
      return NextResponse.json(
        { error: "Game can only be finished during voting, results or playing phase" },
        { status: 400 }
      )
    }

    if (room.phase === "finished") {
      return NextResponse.json({
        success: true,
        gameFinished: true,
        message: "Game already finished",
      })
    }

    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id, user_id, is_eliminated")
      .eq("room_id", roomId)

    if (playersError) throw playersError

    const survivors = (players || []).filter((p) => !p.is_eliminated)
    const allPlayers = players || []

    const { error: endError } = await supabase
      .from("game_rooms")
      .update({ phase: "finished" })
      .eq("id", roomId)

    if (endError) throw endError

    await updateGameStatistics({
      roomId,
      survivorPlayerIds: survivors.map((p) => p.id),
      allPlayerIds: allPlayers.map((p) => p.id),
    })

    await supabase.from("chat_messages").insert({
      room_id: roomId,
      player_id: null,
      message: `Игра завершена ведущим! Поздравляем выживших! (${survivors.length} из ${allPlayers.length})`,
      message_type: "system",
    })

    return NextResponse.json({
      success: true,
      gameFinished: true,
      survivors: survivors.map((p) => p.id),
      totalPlayers: allPlayers.length,
    })
  } catch (error) {
    console.error("[Finish] Error finishing game:", error)
    return NextResponse.json(
      {
        error: "Failed to finish game",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
