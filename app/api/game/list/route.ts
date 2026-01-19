import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List available game rooms
export async function GET(request: Request) {
  const supabase = await createClient()

  try {
    // Cleanup orphaned rooms (rooms without host) before listing
    // This runs synchronously to ensure cleanup happens before returning the list
    try {
      // Get all rooms that are not finished
      const roomsResult = await supabase
        .from("game_rooms")
        .select("id, host_id, game_players(user_id)")
        .neq("phase", "finished")
      
      const allRooms = roomsResult.data

      if (allRooms && allRooms.length > 0) {
        const roomsToDelete: string[] = []

        // Check each room
        for (const room of allRooms) {
          const hostId = room.host_id
          const players = room.game_players || []
          const hostInRoom = players.some((p: any) => p.user_id === hostId)

          if (!hostInRoom) {
            roomsToDelete.push(room.id)
          }
        }

        if (roomsToDelete.length > 0) {
          console.log(`[List] Cleaning up ${roomsToDelete.length} orphaned rooms`)

          // Delete players, votes, chat messages, and rooms
          // Use Promise.all for parallel deletion (faster)
          await Promise.all([
            supabase.from("game_players").delete().in("room_id", roomsToDelete),
            supabase.from("votes").delete().in("room_id", roomsToDelete),
            supabase.from("chat_messages").delete().in("room_id", roomsToDelete),
          ])

          // Finally delete rooms
          await supabase.from("game_rooms").delete().in("id", roomsToDelete)

          console.log(`[List] Successfully cleaned up ${roomsToDelete.length} orphaned rooms`)
        }
      }
    } catch (cleanupError) {
      // Don't fail the request if cleanup fails, but log the error
      console.error("[List] Error during cleanup (non-critical):", cleanupError)
    }

    const { searchParams } = new URL(request.url)
    const phase = searchParams.get("phase") // Filter by phase: waiting, playing, voting, results
    const maxPlayers = searchParams.get("maxPlayers") // Filter by max players: 8, 12, 16, 20
    const searchCode = searchParams.get("search") // Search by room code
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build query
    let query = supabase
      .from("game_rooms")
      .select(
        `
        id,
        room_code,
        host_id,
        max_players,
        catastrophe,
        bunker_description,
        phase,
        current_round,
        round_timer_seconds,
        created_at,
        settings,
        profiles!host_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        game_players (
          id,
          name,
          is_eliminated
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })

    // Exclude hidden rooms from public list
    query = query.eq("is_hidden", false)

    // Filter by phase (exclude finished games)
    if (phase) {
      query = query.eq("phase", phase)
    } else {
      // By default, exclude finished games
      query = query.neq("phase", "finished")
    }

    // Filter by max players
    if (maxPlayers) {
      query = query.eq("max_players", parseInt(maxPlayers))
    }

    // Search by room code (case insensitive)
    if (searchCode) {
      query = query.ilike("room_code", `%${searchCode.toUpperCase()}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: rooms, error, count } = await query

    if (error) throw error

    // Transform data to include player count and available slots
    const roomsWithStats = (rooms || []).map((room: any) => {
      const players = room.game_players || []
      const activePlayers = players.filter((p: any) => !p.is_eliminated).length
      const availableSlots = room.max_players - activePlayers
      const isFull = availableSlots <= 0

      return {
        id: room.id,
        roomCode: room.room_code,
        hostId: room.host_id,
        host: room.profiles
          ? {
              id: room.profiles.id,
              username: room.profiles.username,
              displayName: room.profiles.display_name,
              avatarUrl: room.profiles.avatar_url,
            }
          : null,
        maxPlayers: room.max_players,
        currentPlayers: activePlayers,
        availableSlots,
        isFull,
        catastrophe: room.catastrophe,
        bunkerDescription: room.bunker_description,
        phase: room.phase,
        currentRound: room.current_round,
        roundTimerSeconds: room.round_timer_seconds,
        createdAt: room.created_at,
        settings: room.settings || {},
      }
    })

    // Добавляем краткое кеширование (5 секунд) для уменьшения нагрузки при частых запросах
    // Комнаты обновляются часто, но это поможет при множественных одновременных запросах
    return NextResponse.json(
      {
        rooms: roomsWithStats,
        total: count || 0,
        limit,
        offset,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    )
  } catch (error) {
    console.error("Error listing rooms:", error)
    return NextResponse.json({ error: "Failed to list rooms" }, { status: 500 })
  }
}
