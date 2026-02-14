import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Host unbans a user from the room
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
      return NextResponse.json({ error: "Only host can unban players" }, { status: 403 })
    }

    const settings = (room.settings as Record<string, unknown>) || {}
    const bannedUserIds: string[] = Array.isArray(settings.banned_user_ids) ? [...settings.banned_user_ids] : []

    settings.banned_user_ids = bannedUserIds.filter((id) => id !== userId)

    const { error: updateError } = await supabase
      .from("game_rooms")
      .update({ settings })
      .eq("id", roomId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, unbannedUserId: userId })
  } catch (error) {
    console.error("[RoomUnban] Error:", error)
    return NextResponse.json(
      { error: "Failed to unban player", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
