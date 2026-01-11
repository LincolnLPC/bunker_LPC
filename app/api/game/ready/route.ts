import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Toggle ready status for player
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
    const { roomId, playerId, isReady } = body

    if (!roomId || !playerId || typeof isReady !== "boolean") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify player belongs to user
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("user_id, room_id")
      .eq("id", playerId)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    if (player.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update ready status
    const { error: updateError } = await supabase
      .from("game_players")
      .update({ is_ready: isReady })
      .eq("id", playerId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, isReady })
  } catch (error) {
    console.error("Error updating ready status:", error)
    return NextResponse.json({ error: "Failed to update ready status" }, { status: 500 })
  }
}
