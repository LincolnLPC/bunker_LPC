import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// GET - Leaderboard by rating (top players) with host_rating and achievements count
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
      .select("id, username, display_name, avatar_url, rating, host_rating, games_played, games_won")
      .not("rating", "is", null)
      .gt("rating", 0)
      .order("rating", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[Leaderboard] Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = profiles || []
    const userIds = list.map((p: any) => p.id)

    const achievementCounts: Record<string, number> = {}
    if (userIds.length > 0) {
      const serviceClient = createServiceRoleClient()
      const { data: counts } = await serviceClient
        .from("user_achievements")
        .select("user_id")
        .in("user_id", userIds)
      const byUser = (counts || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.user_id] = (acc[row.user_id] || 0) + 1
        return acc
      }, {})
      userIds.forEach((id) => {
        achievementCounts[id] = byUser[id] || 0
      })
    }

    const result = list.map((p: any, index: number) => ({
      rank: index + 1,
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      rating: p.rating ?? 0,
      host_rating: p.host_rating ?? 0,
      games_played: p.games_played ?? 0,
      games_won: p.games_won ?? 0,
      achievements_count: achievementCounts[p.id] ?? 0,
    }))

    return NextResponse.json({ leaderboard: result })
  } catch (err) {
    console.error("[Leaderboard] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
