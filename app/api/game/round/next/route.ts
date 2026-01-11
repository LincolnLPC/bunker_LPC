import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateGameStatistics } from "@/lib/game/stats"

// POST - Advance to next round
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

    // Get room and verify host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase, current_round")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can advance round" }, { status: 403 })
    }

    if (room.phase !== "results") {
      return NextResponse.json({ error: "Must be in results phase to advance" }, { status: 400 })
    }

    // Count remaining players
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("is_eliminated", false)

    if (playersError) throw playersError

    const remainingPlayers = players?.length || 0

    // Check if game should end
    if (remainingPlayers <= 2) {
      // Check if game is already finished (to avoid double stats update)
      if (room.phase === "finished") {
        return NextResponse.json({ 
          success: true, 
          gameFinished: true,
          message: "Game already finished" 
        })
      }

      // Get all players to determine winners (survivors)
      const { data: allPlayersData, error: allPlayersError } = await supabase
        .from("game_players")
        .select("id, user_id, is_eliminated")
        .eq("room_id", roomId)

      if (allPlayersError) throw allPlayersError

      const survivors = allPlayersData?.filter((p) => !p.is_eliminated) || []
      const allPlayers = allPlayersData || []

      // End game first
      const { error: endError } = await supabase
        .from("game_rooms")
        .update({ phase: "finished" })
        .eq("id", roomId)
        .eq("phase", "results") // Only update if still in results phase (prevents race conditions)

      if (endError) {
        // If update failed, game might have already been finished
        console.warn("Failed to update game phase to finished, might already be finished:", endError)
      }

      // Update statistics for all players (only if we successfully updated phase or it was already finished)
      if (!endError || endError.code === "PGRST116") {
        await updateGameStatistics({
          roomId,
          survivorPlayerIds: survivors.map((p) => p.id),
          allPlayerIds: allPlayers.map((p) => p.id),
        })
      }

      await supabase.from("chat_messages").insert({
        room_id: roomId,
        player_id: null,
        message: `Игра окончена! Поздравляем выживших! (${survivors.length} из ${allPlayers.length})`,
        message_type: "system",
      })

      return NextResponse.json({ 
        success: true, 
        gameFinished: true,
        survivors: survivors.map((p) => p.id),
        totalPlayers: allPlayers.length,
      })
    }

    // Advance to next round and restart timer
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
      message: `Начался раунд ${(room.current_round || 0) + 1}`,
      message_type: "system",
    })

    return NextResponse.json({ success: true, newRound: (room.current_round || 0) + 1 })
  } catch (error) {
    console.error("Error advancing round:", error)
    return NextResponse.json({ error: "Failed to advance round" }, { status: 500 })
  }
}
