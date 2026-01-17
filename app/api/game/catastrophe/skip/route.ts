import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Skip catastrophe intro screen and start the game
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
      .select("id, host_id, phase, current_round, settings")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can skip catastrophe screen" }, { status: 403 })
    }

    // Only allow skipping if we're at the start of the game (playing phase, round 1)
    if (room.phase !== "playing" || room.current_round !== 1) {
      return NextResponse.json({ 
        error: "Can only skip catastrophe screen at the start of the game",
        currentPhase: room.phase,
        currentRound: room.current_round
      }, { status: 400 })
    }

    const roundMode = (room.settings as any)?.roundMode || "automatic"
    
    // Always set round_started_at to signal that catastrophe intro is skipped
    // This will trigger realtime updates for all players
    // In automatic mode, this also starts the timer
    // In manual mode, timer won't be used but this marks that intro is done
    const updateData: any = {
      round_started_at: new Date().toISOString(),
    }
    
    // Mark that catastrophe intro was skipped (store in metadata)
    const currentSettings = (room.settings as any) || {}
    currentSettings.catastropheIntroSkipped = true
    updateData.settings = currentSettings
    
    const { error: updateError } = await supabase
      .from("game_rooms")
      .update(updateData)
      .eq("id", roomId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error skipping catastrophe screen:", error)
    return NextResponse.json({ error: "Failed to skip catastrophe screen" }, { status: 500 })
  }
}
