import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Eliminate player (end voting)
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

    // Get room
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, game_players(*)")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can end voting" }, { status: 403 })
    }

    // Count votes
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("*")
      .eq("room_id", roomId)
      .eq("round", room.current_round)

    if (votesError) throw votesError

    // Tally votes (accounting for vote weights)
    const voteCounts: Record<string, number> = {}
    for (const vote of votes || []) {
      const weight = vote.vote_weight || 1
      voteCounts[vote.target_id] = (voteCounts[vote.target_id] || 0) + weight
    }

    // Find player with most votes
    let maxVotes = 0
    let eliminatedPlayerId: string | null = null
    for (const [playerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count
        eliminatedPlayerId = playerId
      }
    }

    // Eliminate player
    if (eliminatedPlayerId) {
      const { error: eliminateError } = await supabase
        .from("game_players")
        .update({ is_eliminated: true })
        .eq("id", eliminatedPlayerId)

      if (eliminateError) throw eliminateError

      // Reveal all characteristics of eliminated player
      const { error: revealError } = await supabase
        .from("player_characteristics")
        .update({ is_revealed: true, reveal_round: room.current_round })
        .eq("player_id", eliminatedPlayerId)

      if (revealError) throw revealError
    }

    // Update room to results phase
    const { error: updateError } = await supabase.from("game_rooms").update({ phase: "results" }).eq("id", roomId)

    if (updateError) throw updateError

    // Get vote results for response
    const results = Object.entries(voteCounts).map(([playerId, count]) => ({
      playerId,
      votes: count,
    }))

    return NextResponse.json({
      success: true,
      eliminatedPlayerId,
      results,
    })
  } catch (error) {
    console.error("Error eliminating player:", error)
    return NextResponse.json({ error: "Failed to eliminate player" }, { status: 500 })
  }
}
