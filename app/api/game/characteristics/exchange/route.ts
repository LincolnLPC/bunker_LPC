import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Exchange characteristics between two players
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
    const { roomId, playerId1, charId1, playerId2, charId2 } = body

    if (!roomId || !playerId1 || !charId1 || !playerId2 || !charId2) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify user is host
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("host_id")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can exchange characteristics" }, { status: 403 })
    }

    // Get both characteristics
    const { data: chars, error: charsError } = await supabase
      .from("player_characteristics")
      .select("id, value, player_id")
      .in("id", [charId1, charId2])

    if (charsError || !chars || chars.length !== 2) {
      return NextResponse.json({ error: "Characteristics not found" }, { status: 404 })
    }

    const char1 = chars.find((c) => c.id === charId1)
    const char2 = chars.find((c) => c.id === charId2)

    if (!char1 || !char2) {
      return NextResponse.json({ error: "Characteristics not found" }, { status: 404 })
    }

    // Verify players belong to room
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .in("id", [playerId1, playerId2])
      .eq("room_id", roomId)

    if (playersError || !players || players.length !== 2) {
      return NextResponse.json({ error: "Players not found in this room" }, { status: 404 })
    }

    // Exchange values
    const value1 = char1.value
    const value2 = char2.value

    // Update both characteristics
    const { error: update1Error } = await supabase
      .from("player_characteristics")
      .update({ value: value2 })
      .eq("id", charId1)

    if (update1Error) throw update1Error

    const { error: update2Error } = await supabase
      .from("player_characteristics")
      .update({ value: value1 })
      .eq("id", charId2)

    if (update2Error) throw update2Error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error exchanging characteristics:", error)
    return NextResponse.json({ error: "Failed to exchange characteristics" }, { status: 500 })
  }
}
