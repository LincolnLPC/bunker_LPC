import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List banned users for a room (host only)
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get("roomId")

  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 })
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
    return NextResponse.json({ error: "Only host can view banned list" }, { status: 403 })
  }

  const settings = (room.settings as Record<string, unknown>) || {}
  const bannedUserIds: string[] = Array.isArray(settings.banned_user_ids) ? settings.banned_user_ids : []

  if (bannedUserIds.length === 0) {
    return NextResponse.json({ banned: [] })
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", bannedUserIds)

  const banned = bannedUserIds.map((userId) => {
    const profile = profiles?.find((p: any) => p.id === userId)
    return {
      userId,
      userName: profile?.display_name || profile?.username || `ID: ${userId.slice(0, 8)}...`,
    }
  })

  return NextResponse.json({ banned })
}
