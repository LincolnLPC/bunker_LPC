/**
 * Game statistics utilities
 * Functions for updating player statistics after game completion
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export interface GameCompletionStats {
  roomId: string
  survivorPlayerIds: string[] // IDs of players who survived (won)
  allPlayerIds: string[] // IDs of all players who participated
}

/**
 * Update player statistics after game completion
 * Increments games_played for all players and games_won for survivors
 * Note: This function should only be called once per game completion
 */
export async function updateGameStatistics({ roomId, survivorPlayerIds, allPlayerIds }: GameCompletionStats) {
  const supabase = createServiceRoleClient()

  try {
    // Verify game is in finished state and get host_id for host rating
    const { data: room, error: roomCheckError } = await supabase
      .from("game_rooms")
      .select("id, phase, host_id")
      .eq("id", roomId)
      .single()

    if (roomCheckError || !room) {
      console.error("Error checking room state:", roomCheckError)
      return
    }

    if (room.phase !== "finished") {
      console.warn(`Room ${roomId} is not in finished phase (${room.phase}), skipping stats update`)
      return
    }

    // Get user_ids for all players from game_players table
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id, user_id")
      .eq("room_id", roomId)

    if (playersError) {
      console.error("Error fetching players for stats:", playersError)
      return
    }

    if (!players || players.length === 0) {
      console.warn("No players found for statistics update")
      return
    }

    // Create maps for quick lookup
    const playerIdToUserId = new Map(players.map((p) => [p.id, p.user_id]))
    const survivorUserIds = new Set(
      players.filter((p) => survivorPlayerIds.includes(p.id)).map((p) => p.user_id)
    )

    // Update games_played for all participants
    const allUserIds = Array.from(new Set(players.map((p) => p.user_id)))

    // Try using RPC functions first (more efficient and atomic), fallback to direct update
    for (const userId of allUserIds) {
      const isWinner = survivorUserIds.has(userId)

      // Try RPC function first
      let playedUpdated = false
      const { error: rpcPlayedError } = await supabase.rpc("increment_games_played", {
        user_id_param: userId,
      })

      if (!rpcPlayedError) {
        playedUpdated = true
      } else {
        // Fallback: Get current value and update
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("games_played, games_won")
          .eq("id", userId)
          .single()

        if (fetchError) {
          console.error(`Error fetching profile for user ${userId}:`, fetchError)
          continue
        }

        const currentGamesPlayed = profile?.games_played || 0

        const { error: updatePlayedError } = await supabase
          .from("profiles")
          .update({
            games_played: currentGamesPlayed + 1,
          })
          .eq("id", userId)

        if (updatePlayedError) {
          console.error(`Error updating games_played for user ${userId}:`, updatePlayedError)
          continue
        }
        playedUpdated = true
      }

      // Increment games_won for survivors
      if (isWinner && playedUpdated) {
        const { error: rpcWonError } = await supabase.rpc("increment_games_won", {
          user_id_param: userId,
        })

        if (rpcWonError) {
          // Fallback: Get current value and update
          const { data: profile } = await supabase
            .from("profiles")
            .select("games_won")
            .eq("id", userId)
            .single()

          const currentGamesWon = profile?.games_won || 0

          const { error: updateWonError } = await supabase
            .from("profiles")
            .update({
              games_won: currentGamesWon + 1,
            })
            .eq("id", userId)

          if (updateWonError) {
            console.error(`Error updating games_won for user ${userId}:`, updateWonError)
          }
        }
      }

      // Rating: +5 for participation, +20 for win (winners get 25 total)
      const ratingPoints = isWinner ? 25 : 5
      await supabase.rpc("add_rating", {
        user_id_param: userId,
        points_param: ratingPoints,
      })

      // Host rating: if this user is the host (and also a player), +10 to host_rating
      if (room.host_id && userId === room.host_id) {
        await supabase.rpc("add_host_rating", {
          user_id_param: userId,
          points_param: 10,
        })
      }
    }

    // Host who was only host (not in game_players): +20 host_rating, no player stats
    if (room.host_id && !allUserIds.includes(room.host_id)) {
      await supabase.rpc("add_host_rating", {
        user_id_param: room.host_id,
        points_param: 20,
      })
    }

    console.log(`Statistics updated for ${allUserIds.length} players, ${survivorUserIds.size} winners`)

    // Check and award achievements for all participants
    // This runs asynchronously to not block the main flow
    for (const userId of allUserIds) {
      try {
        const { error: achievementError } = await supabase.rpc("check_all_achievements", {
          user_id_param: userId,
        })
        
        if (achievementError) {
          console.error(`Error checking achievements for user ${userId}:`, achievementError)
        }
      } catch (achievementErr) {
        console.error(`Error in achievement check for user ${userId}:`, achievementErr)
      }
    }
  } catch (error) {
    console.error("Error updating game statistics:", error)
  }
}
