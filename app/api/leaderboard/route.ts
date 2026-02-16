import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// GET - Leaderboard by rating (top players)
export async function GET(request: Request) {
  const supabase = await createClient()

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)),
      MAX_LIMIT
    )

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, rating, games_played, games_won")
      .not("rating", "is", null)
      .gt("rating", 0)
      .order("rating", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[Leaderboard] Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = (profiles || []).map((p, index) => ({
      rank: index + 1,
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      rating: p.rating ?? 0,
      games_played: p.games_played ?? 0,
      games_won: p.games_won ?? 0,
    }))

    return NextResponse.json({ leaderboard: list })
  } catch (err) {
    console.error("[Leaderboard] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
