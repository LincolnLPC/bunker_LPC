import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Get vote results for current round
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 })
    }

    // Get room to find current round
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("current_round, phase")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Only show results if in results phase
    if (room.phase !== "results") {
      return NextResponse.json({ error: "Not in results phase" }, { status: 400 })
    }

    // Get votes for current round
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("room_id", roomId)
      .eq("round", room.current_round || 0)

    if (votesError) throw votesError

    // Tally votes (accounting for vote weights)
    const voteCounts: Record<string, number> = {}
    for (const vote of votes || []) {
      const weight = vote.vote_weight || 1
      voteCounts[vote.target_id] = (voteCounts[vote.target_id] || 0) + weight
    }

    // Get all players to create results array
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)

    if (playersError) throw playersError

    // Create results array
    const results = (players || []).map((p) => ({
      playerId: p.id,
      votes: voteCounts[p.id] || 0,
    }))

    // Find eliminated player
    const eliminatedPlayer = results.find((r) => {
      // Check if this player was eliminated in this round
      return false // Will be determined by is_eliminated flag
    })

    return NextResponse.json({
      results,
      round: room.current_round || 0,
    })
  } catch (error) {
    console.error("Error getting vote results:", error)
    return NextResponse.json({ error: "Failed to get vote results" }, { status: 500 })
  }
}
