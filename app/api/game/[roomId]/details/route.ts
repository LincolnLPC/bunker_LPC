import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET - Get detailed information about a finished game
 */
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { roomId } = await params

    // Get room details
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    // Check if user participated in this game
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, is_eliminated")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only allow access to finished games
    if (room.phase !== "finished") {
      return NextResponse.json({ error: "Game is not finished yet" }, { status: 400 })
    }

    // Get all players with their characteristics
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("room_id", roomId)
      .order("slot", { ascending: true })

    if (playersError) {
      console.error("Error fetching players:", playersError)
      return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 })
    }

    // Get characteristics for all players
    const playerIds = players?.map((p) => p.id) || []
    let characteristics: any[] = []

    if (playerIds.length > 0) {
      const { data: chars, error: charsError } = await supabase
        .from("player_characteristics")
        .select("*")
        .in("player_id", playerIds)
        .order("sort_order", { ascending: true })

      if (charsError) {
        console.error("Error fetching characteristics:", charsError)
      } else {
        characteristics = chars || []
      }
    }

    // Get all votes
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("room_id", roomId)
      .order("round", { ascending: true })
      .order("created_at", { ascending: true })

    if (votesError) {
      console.error("Error fetching votes:", votesError)
    }

    // Get chat messages
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })

    if (chatError) {
      console.error("Error fetching chat messages:", chatError)
    }

    // Organize characteristics by player
    const characteristicsByPlayer = new Map<string, any[]>()
    characteristics.forEach((char) => {
      if (!characteristicsByPlayer.has(char.player_id)) {
        characteristicsByPlayer.set(char.player_id, [])
      }
      characteristicsByPlayer.get(char.player_id)!.push(char)
    })

    // Organize votes by round
    const votesByRound = new Map<number, any[]>()
    votes?.forEach((vote) => {
      if (!votesByRound.has(vote.round)) {
        votesByRound.set(vote.round, [])
      }
      votesByRound.get(vote.round)!.push(vote)
    })

    // Get host profile
    let hostProfile = null
    if (room.host_id) {
      const { data: host } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", room.host_id)
        .single()

      hostProfile = host
    }

    // Transform players data
    const playersData = players?.map((p: any) => {
      const profile = p.profiles || {}
      const playerChars = characteristicsByPlayer.get(p.id) || []

      return {
        id: p.id,
        slot: p.slot,
        name: p.name,
        userId: p.user_id,
        username: profile.username || profile.display_name || p.name,
        displayName: profile.display_name || p.name,
        avatarUrl: profile.avatar_url,
        gender: p.gender,
        genderModifier: p.gender_modifier || "",
        age: p.age,
        profession: p.profession,
        isEliminated: p.is_eliminated,
        isHost: p.is_host || room.host_id === p.user_id,
        videoEnabled: p.video_enabled,
        audioEnabled: p.audio_enabled,
        joinedAt: p.joined_at,
        characteristics: playerChars.map((c: any) => ({
          id: c.id,
          category: c.category,
          name: c.name,
          value: c.value,
          isRevealed: c.is_revealed,
          revealRound: c.reveal_round,
          sortOrder: c.sort_order,
        })),
      }
    }) || []

    // Calculate statistics
    const survivors = playersData.filter((p) => !p.isEliminated)
    const eliminated = playersData.filter((p) => p.isEliminated)

    return NextResponse.json({
      game: {
        id: room.id,
        roomCode: room.room_code,
        hostId: room.host_id,
        host: hostProfile
          ? {
              id: hostProfile.id,
              username: hostProfile.username,
              displayName: hostProfile.display_name,
              avatarUrl: hostProfile.avatar_url,
            }
          : null,
        catastrophe: room.catastrophe,
        bunkerDescription: room.bunker_description,
        maxPlayers: room.max_players,
        phase: room.phase,
        currentRound: room.current_round,
        roundTimerSeconds: room.round_timer_seconds,
        settings: room.settings,
        createdAt: room.created_at,
        updatedAt: room.updated_at,
      },
      players: playersData,
      survivors,
      eliminated,
      votes: votes || [],
      votesByRound: Object.fromEntries(votesByRound),
      chatMessages: chatMessages || [],
      statistics: {
        totalPlayers: playersData.length,
        survivorsCount: survivors.length,
        eliminatedCount: eliminated.length,
        survivalRate: playersData.length > 0 ? Math.round((survivors.length / playersData.length) * 100) : 0,
        totalRounds: room.current_round,
        totalVotes: votes?.length || 0,
        totalMessages: chatMessages?.length || 0,
      },
    })
  } catch (error) {
    console.error("Error in game details API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
