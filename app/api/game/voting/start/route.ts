import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Start voting phase
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

    // Get room and verify host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("id, host_id, phase, settings")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can start voting" }, { status: 403 })
    }

    if (room.phase !== "playing") {
      return NextResponse.json({ error: "Game must be in playing phase" }, { status: 400 })
    }

    // Get round mode setting
    const roundMode = (room.settings as any)?.roundMode || "automatic"

    // Update room to voting phase
    // In manual mode, don't start timer (round_started_at stays null)
    const updateData: any = {
      phase: "voting",
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
      message: "Началось голосование! Выберите игрока для исключения.",
      message_type: "system",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error starting voting:", error)
    return NextResponse.json({ error: "Failed to start voting" }, { status: 500 })
  }
}
