import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// POST - Host bans a user from the room (prevents reconnect)
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
    const { roomId, userId } = body

    if (!roomId || !userId) {
      return NextResponse.json({ error: "roomId and userId are required" }, { status: 400 })
    }

    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, settings")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can ban players" }, { status: 403 })
    }

    if (userId === room.host_id) {
      return NextResponse.json({ error: "Cannot ban the host" }, { status: 400 })
    }

    const settings = (room.settings as Record<string, unknown>) || {}
    const bannedUserIds: string[] = Array.isArray(settings.banned_user_ids) ? [...settings.banned_user_ids] : []

    if (bannedUserIds.includes(userId)) {
      return NextResponse.json({ success: true, message: "User already banned" })
    }

    bannedUserIds.push(userId)
    settings.banned_user_ids = bannedUserIds

    const { error: updateError } = await supabase
      .from("game_rooms")
      .update({ settings })
      .eq("id", roomId)

    if (updateError) throw updateError

    // Kick the player if they're currently in the room (service role for delete)
    const { data: player } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single()

    if (player) {
      const adminClient = createServiceRoleClient()
      await adminClient.from("game_players").delete().eq("id", player.id)
    }

    return NextResponse.json({ success: true, bannedUserId: userId })
  } catch (error) {
    console.error("[RoomBan] Error:", error)
    return NextResponse.json(
      { error: "Failed to ban player", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
