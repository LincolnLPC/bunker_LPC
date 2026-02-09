import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Helper function to check if a player has immunity for the current round
function hasImmunity(player: any, currentRound: number): boolean {
  if (!player || !player.metadata) return false
  
  try {
    let metadata: any = player.metadata
    if (typeof metadata === 'string') {
      metadata = JSON.parse(metadata)
    }
    
    const immunity = metadata?.immunity
    return immunity?.active === true && immunity?.round === currentRound
  } catch (e) {
    return false
  }
}

// POST - Eliminate player (end voting)
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
    const { roomId, playerId } = body

    // Get room
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, game_players(*)")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can end voting" }, { status: 403 })
    }

    // Get round mode
    const roundMode = (room.settings as any)?.roundMode || "automatic"

    // Count votes
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("room_id", roomId)
      .eq("round", room.current_round)

    if (votesError) throw votesError

    // Tally votes (accounting for vote weights)
    const voteCounts: Record<string, number> = {}
    for (const vote of votes || []) {
      const weight = vote.vote_weight || 1
      voteCounts[vote.target_id] = (voteCounts[vote.target_id] || 0) + weight
    }

    // Determine eliminated player
    let eliminatedPlayerId: string | null = null
    
    // In manual mode, if playerId is provided, use it
    if (roundMode === "manual" && playerId) {
      // Verify player exists and is not eliminated
      const targetPlayer = room.game_players.find((p: any) => p.id === playerId)
      if (!targetPlayer) {
        return NextResponse.json({ error: "Player not found" }, { status: 400 })
      }
      if (targetPlayer.is_eliminated) {
        return NextResponse.json({ error: "Player already eliminated" }, { status: 400 })
      }
      
      // Check if player has immunity
      if (hasImmunity(targetPlayer, room.current_round)) {
        return NextResponse.json({ error: "Player has immunity and cannot be eliminated" }, { status: 400 })
      }
      
      eliminatedPlayerId = playerId
    } else {
      // Automatic mode or manual mode without explicit selection - find player with most votes (excluding players with immunity)
      // Sort players by vote count (descending)
      const sortedPlayers = Object.entries(voteCounts)
        .map(([playerId, count]) => ({
          playerId,
          votes: count,
          player: room.game_players.find((p: any) => p.id === playerId)
        }))
        .sort((a, b) => b.votes - a.votes)
      
      // Find the first player without immunity
      // Also check if the player with most votes has immunity (for notification)
      const topPlayer = sortedPlayers[0]
      let savedByImmunityPlayer: any = null
      
      if (topPlayer && topPlayer.player && hasImmunity(topPlayer.player, room.current_round)) {
        savedByImmunityPlayer = topPlayer.player
      }
      
      for (const { playerId, player } of sortedPlayers) {
        if (player && !hasImmunity(player, room.current_round)) {
          eliminatedPlayerId = playerId
          break
        }
      }
      
      // Add system message if a player was saved by immunity
      if (savedByImmunityPlayer && eliminatedPlayerId && savedByImmunityPlayer.id !== eliminatedPlayerId) {
        await supabase.from("chat_messages").insert({
          room_id: roomId,
          player_id: null,
          message: `${savedByImmunityPlayer.name} спасен от изгнания благодаря иммунитету!`,
          message_type: "system",
        })
      }
    }

    // Eliminate player
    if (eliminatedPlayerId) {
      const eliminatedPlayer = room.game_players.find((p: any) => p.id === eliminatedPlayerId)
      const eliminatedName = eliminatedPlayer?.name || "Игрок"

      const { error: eliminateError } = await supabase
        .from("game_players")
        .update({ is_eliminated: true })
        .eq("id", eliminatedPlayerId)

      if (eliminateError) throw eliminateError

      // Reveal all characteristics of eliminated player
      const { error: revealError } = await supabase
        .from("player_characteristics")
        .update({ is_revealed: true, reveal_round: room.current_round })
        .eq("player_id", eliminatedPlayerId)

      if (revealError) throw revealError

      await supabase.from("chat_messages").insert({
        room_id: roomId,
        player_id: null,
        message: `${eliminatedName} изгнан по результатам голосования.`,
        message_type: "system",
      })
    }

    // Update room to results phase
    const { error: updateError } = await supabase.from("game_rooms").update({ phase: "results" }).eq("id", roomId)

    if (updateError) throw updateError

    // Get vote results for response
    const results = Object.entries(voteCounts).map(([playerId, count]) => ({
      playerId,
      votes: count,
    }))

    return NextResponse.json({
      success: true,
      eliminatedPlayerId,
      results,
    })
  } catch (error) {
    console.error("Error eliminating player:", error)
    return NextResponse.json({ error: "Failed to eliminate player" }, { status: 500 })
  }
}
