import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateGameStatistics } from "@/lib/game/stats"

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

    // Get room and verify host (including bunker_info)
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase, current_round, settings, bunker_info")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can advance round" }, { status: 403 })
    }
    
    // Get round mode setting
    const roundMode = (room.settings as any)?.roundMode || "automatic"
    
    // In automatic mode, must be in results phase
    // In manual mode, can advance from voting or results phase
    if (roundMode === "automatic" && room.phase !== "results") {
      return NextResponse.json({ error: "Must be in results phase to advance" }, { status: 400 })
    }
    
    if (roundMode === "manual" && room.phase !== "voting" && room.phase !== "results") {
      return NextResponse.json({ error: "Must be in voting or results phase to advance" }, { status: 400 })
    }
    
    // If in voting phase in manual mode, first end voting (eliminate player with most votes) and go to results
    if (roundMode === "manual" && room.phase === "voting") {
      // Count votes
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("*")
        .eq("room_id", roomId)
        .eq("round", room.current_round)

      if (votesError) throw votesError

      // Get players with metadata to check immunity
      const { data: players, error: playersError } = await supabase
        .from("game_players")
        .select("id, metadata")
        .eq("room_id", roomId)

      if (playersError) throw playersError

      // Tally votes (accounting for vote weights)
      const voteCounts: Record<string, number> = {}
      for (const vote of votes || []) {
        const weight = vote.vote_weight || 1
        voteCounts[vote.target_id] = (voteCounts[vote.target_id] || 0) + weight
      }

      // Find player with most votes (excluding players with immunity)
      // Sort players by vote count (descending)
      const sortedPlayers = Object.entries(voteCounts)
        .map(([playerId, count]) => ({
          playerId,
          votes: count,
          player: players?.find((p: any) => p.id === playerId)
        }))
        .sort((a, b) => b.votes - a.votes)
      
      // Find the first player without immunity
      // Also check if the player with most votes has immunity (for notification)
      const topPlayer = sortedPlayers[0]
      let savedByImmunityPlayer: any = null
      
      if (topPlayer && topPlayer.player && hasImmunity(topPlayer.player, room.current_round)) {
        savedByImmunityPlayer = topPlayer.player
      }
      
      let eliminatedPlayerId: string | null = null
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

      // Eliminate player if there are votes
      if (eliminatedPlayerId) {
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
      }

      // Update room to results phase (to show results before next round)
      const { error: resultsError } = await supabase
        .from("game_rooms")
        .update({ phase: "results" })
        .eq("id", roomId)

      if (resultsError) throw resultsError

      return NextResponse.json({
        success: true,
        phase: "results",
        eliminatedPlayerId,
        results: Object.entries(voteCounts).map(([playerId, count]) => ({
          playerId,
          votes: count,
        })),
      })
    }

    // Count remaining players
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("is_eliminated", false)

    if (playersError) throw playersError

    const remainingPlayers = players?.length || 0

    // Check if game should end - only in automatic mode
    // In manual mode, host decides when to end the game
    if (roundMode === "automatic" && remainingPlayers <= 2) {
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

    // Reveal next bunker characteristic
    const newRound = (room.current_round || 0) + 1
    let revealedCharacteristic: { name: string; type: "equipment" | "supply" } | null = null
    
    if (room.bunker_info) {
      try {
        let bunkerInfo: any = room.bunker_info
        if (typeof bunkerInfo === 'string') {
          bunkerInfo = JSON.parse(bunkerInfo)
        }
        
        const totalCharacteristics = 5 // Total equipment + supplies
        const currentRevealed = bunkerInfo.revealedCharacteristics || []
        const totalRevealed = bunkerInfo.totalRevealed || 0
        
        // If not all characteristics are revealed yet, reveal the next one
        if (totalRevealed < totalCharacteristics) {
          // Get all characteristics (equipment + supplies)
          const allCharacteristics: { name: string; type: "equipment" | "supply" }[] = []
          
          // Add equipment
          if (bunkerInfo.equipment && Array.isArray(bunkerInfo.equipment)) {
            bunkerInfo.equipment.forEach((item: string) => {
              allCharacteristics.push({ name: item, type: "equipment" })
            })
          }
          
          // Add supplies
          if (bunkerInfo.supplies && Array.isArray(bunkerInfo.supplies)) {
            bunkerInfo.supplies.forEach((item: string) => {
              allCharacteristics.push({ name: item, type: "supply" })
            })
          }
          
          // Find the next unrevealed characteristic
          const revealedNames = new Set(currentRevealed.map((c: any) => c.name))
          const nextCharacteristic = allCharacteristics.find(c => !revealedNames.has(c.name))
          
          if (nextCharacteristic) {
            // Add to revealed characteristics
            const updatedRevealed = [...currentRevealed, {
              name: nextCharacteristic.name,
              type: nextCharacteristic.type,
              isRevealed: true
            }]
            
            // Update bunker_info
            bunkerInfo.revealedCharacteristics = updatedRevealed
            bunkerInfo.totalRevealed = totalRevealed + 1
            
            revealedCharacteristic = {
              name: nextCharacteristic.name,
              type: nextCharacteristic.type
            }
          }
        }
      } catch (error) {
        console.error("Error processing bunker info:", error)
        // Continue without revealing characteristic if there's an error
      }
    }

    // Advance to next round
    // In manual mode, don't start timer (round_started_at stays null)
    const updateData: any = {
      phase: "playing",
      current_round: newRound,
    }
    
    // Update bunker_info if we revealed a characteristic
    if (revealedCharacteristic && room.bunker_info) {
      try {
        let bunkerInfo: any = room.bunker_info
        if (typeof bunkerInfo === 'string') {
          bunkerInfo = JSON.parse(bunkerInfo)
        }
        updateData.bunker_info = bunkerInfo
      } catch (error) {
        console.error("Error updating bunker_info:", error)
      }
    }
    
    // Only start timer in automatic mode
    if (roundMode === "automatic") {
      updateData.round_started_at = new Date().toISOString()
    } else {
      // In manual mode, clear any existing timer
      updateData.round_started_at = null
    }
    
    const { error: updateError } = await supabase
      .from("game_rooms")
      .update(updateData)
      .eq("id", roomId)

    if (updateError) throw updateError

    // Add system message
    await supabase.from("chat_messages").insert({
      room_id: roomId,
      player_id: null,
      message: `Начался раунд ${newRound}`,
      message_type: "system",
    })

    // Add message about revealed bunker characteristic if one was revealed
    // Also broadcast the event to all players for modal display
    if (revealedCharacteristic) {
      const characteristicTypeLabel = revealedCharacteristic.type === "equipment" ? "Оснащение" : "Запас"
      
      // Add system message to chat
      await supabase.from("chat_messages").insert({
        room_id: roomId,
        player_id: null,
        message: `Исследуя бункер вы обнаружили в нем ${characteristicTypeLabel.toLowerCase()}: ${revealedCharacteristic.name}`,
        message_type: "system",
      })
      
      // Note: Broadcast to clients will be handled via postgres_changes subscription
      // Clients will detect bunker_info changes and show the modal
    }

    return NextResponse.json({ 
      success: true, 
      newRound,
      revealedCharacteristic: revealedCharacteristic || undefined
    })
  } catch (error) {
    console.error("Error advancing round:", error)
    return NextResponse.json({ error: "Failed to advance round" }, { status: 500 })
  }
}
