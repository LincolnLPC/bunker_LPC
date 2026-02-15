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
// Host gets 90s grace period (allows page refresh); regular players 30s
const HOST_INACTIVE_SECONDS = 90
const PLAYER_INACTIVE_SECONDS = 30

async function checkAndRemoveInactivePlayers(roomId: string, supabase: any) {
  try {
    const thirtySecondsAgo = new Date(Date.now() - PLAYER_INACTIVE_SECONDS * 1000).getTime()
    const ninetySecondsAgo = new Date(Date.now() - HOST_INACTIVE_SECONDS * 1000).getTime()

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

    // Get room info for host_id
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      console.error("[Heartbeat] Error fetching room:", roomError)
      return
    }

    // Inactive = no heartbeat. Host: 90s grace (page refresh); regular: 30s
    const inactivePlayers = allPlayers.filter((p: any) => {
      if (!p.last_seen_at) return true
      const lastSeen = new Date(p.last_seen_at).getTime()
      const threshold = p.user_id === room.host_id ? ninetySecondsAgo : thirtySecondsAgo
      return lastSeen < threshold
    })

    if (!inactivePlayers || inactivePlayers.length === 0) {
      return
    }

    const inactiveHosts = inactivePlayers.filter((p: any) => p.user_id === room.host_id)
    const inactiveRegularPlayers = inactivePlayers.filter((p: any) => p.user_id !== room.host_id)

    // If host is inactive (90s), close the entire room
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
          
          // Check if room is now empty after removing players
          const { data: remainingPlayers, error: checkError } = await supabase
            .from("game_players")
            .select("id")
            .eq("room_id", roomId)
          
          if (!checkError && (!remainingPlayers || remainingPlayers.length === 0)) {
            console.log("[Heartbeat] Room is now empty, deleting room:", roomId)
            // Delete all related data
            await Promise.all([
              supabase.from("votes").delete().eq("room_id", roomId),
              supabase.from("chat_messages").delete().eq("room_id", roomId),
            ])
            // Delete room
            await supabase.from("game_rooms").delete().eq("id", roomId)
            console.log("[Heartbeat] Empty room deleted")
          }
        }
      }
  } catch (error) {
    console.error("[Heartbeat] Error in checkAndRemoveInactivePlayers:", error)
  }
}
