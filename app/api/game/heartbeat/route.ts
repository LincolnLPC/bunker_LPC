import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Update player's last seen timestamp (heartbeat)
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

    if (!roomId || !playerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify player belongs to user
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, user_id, room_id")
      .eq("id", playerId)
      .eq("user_id", user.id)
      .eq("room_id", roomId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Update last_seen_at timestamp
    const { error: updateError } = await supabase
      .from("game_players")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", playerId)

    if (updateError) {
      console.error("[Heartbeat] Error updating last_seen_at:", updateError)
      return NextResponse.json({ error: "Failed to update heartbeat" }, { status: 500 })
    }

    // Check for inactive players in this room (players who haven't sent heartbeat for 30+ seconds)
    await checkAndRemoveInactivePlayers(roomId, supabase)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Heartbeat] Error processing heartbeat:", error)
    return NextResponse.json(
      { error: "Failed to process heartbeat", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Helper function to check and remove inactive players
async function checkAndRemoveInactivePlayers(roomId: string, supabase: any) {
  try {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()

    // Find players who haven't sent heartbeat in last 30 seconds
    // Query for players with null last_seen_at OR last_seen_at older than 30 seconds
    const { data: allPlayers, error: allPlayersError } = await supabase
      .from("game_players")
      .select("id, user_id, name, last_seen_at, room_id")
      .eq("room_id", roomId)

    if (allPlayersError) {
      console.error("[Heartbeat] Error finding players:", allPlayersError)
      return
    }

    if (!allPlayers || allPlayers.length === 0) {
      return // No players in room
    }

    // Filter inactive players manually (Supabase doesn't support complex OR queries easily)
    const inactivePlayers = allPlayers.filter((p: any) => {
      if (!p.last_seen_at) return true // Never sent heartbeat
      const lastSeen = new Date(p.last_seen_at).getTime()
      const thirtySecondsAgoTime = new Date(thirtySecondsAgo).getTime()
      return lastSeen < thirtySecondsAgoTime
    })

    if (!inactivePlayers || inactivePlayers.length === 0) {
      return // No inactive players
    }

    // Get room info to check if any inactive player is host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      console.error("[Heartbeat] Error fetching room:", roomError)
      return
    }

    // Separate host from regular players
    const inactiveHosts = inactivePlayers.filter((p: any) => p.user_id === room.host_id)
    const inactiveRegularPlayers = inactivePlayers.filter((p: any) => p.user_id !== room.host_id)

    // If host is inactive, close the entire room
    if (inactiveHosts.length > 0) {
      console.log("[Heartbeat] Host is inactive, closing room:", roomId)
      
      // Delete all players
      await supabase.from("game_players").delete().eq("room_id", roomId)
      // Delete votes
      await supabase.from("votes").delete().eq("room_id", roomId)
      // Delete chat messages
      await supabase.from("chat_messages").delete().eq("room_id", roomId)
      // Delete room
      await supabase.from("game_rooms").delete().eq("id", roomId)
      
      console.log("[Heartbeat] Room closed due to inactive host")
      return
    }

    // Remove inactive regular players
    if (inactiveRegularPlayers.length > 0) {
      const inactivePlayerIds = inactiveRegularPlayers.map((p: any) => p.id)
      console.log("[Heartbeat] Removing inactive players:", inactivePlayerIds)
      
      const { error: deleteError } = await supabase
        .from("game_players")
        .delete()
        .in("id", inactivePlayerIds)

      if (deleteError) {
        console.error("[Heartbeat] Error removing inactive players:", deleteError)
      } else {
        console.log("[Heartbeat] Removed inactive players:", inactivePlayerIds)
      }
    }
  } catch (error) {
    console.error("[Heartbeat] Error in checkAndRemoveInactivePlayers:", error)
  }
}
