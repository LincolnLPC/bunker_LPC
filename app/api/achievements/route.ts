import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

/**
 * GET - Get achievements for the authenticated user or for another user (user_id= query)
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("user_id") || user.id
  const isOtherUser = targetUserId !== user.id
  const client = isOtherUser ? createServiceRoleClient() : supabase

  try {
    // When loading own achievements, run check so premium and other eligible achievements get awarded
    if (!isOtherUser) {
      await supabase.rpc("check_all_achievements", { user_id_param: user.id })
    }

    const { data: achievements, error: achError } = await client
      .from("achievements")
      .select("*")
      .order("points", { ascending: false })
      .order("category")

    if (achError) {
      console.error("Error fetching achievements:", achError)
      return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 })
    }

    const { data: userAchievements } = await client
      .from("user_achievements")
      .select("achievement_id, earned_at, progress")
      .eq("user_id", targetUserId)

    const { data: profile } = await client
      .from("profiles")
      .select("games_played, games_won, games_hosted, games_played_whoami, subscription_tier, premium_expires_at")
      .eq("id", targetUserId)
      .single()

    const uaByAchievement = (userAchievements || []).reduce(
      (acc, ua) => {
        acc[ua.achievement_id] = ua
        return acc
      },
      {} as Record<string, { achievement_id: string; earned_at: string | null; progress: number }>
    )

    const gp = profile?.games_played ?? 0
    const gw = profile?.games_won ?? 0
    const gh = profile?.games_hosted ?? 0
    const gpWhoami = profile?.games_played_whoami ?? 0
    const totalGames = gp + gh

    function getCurrentValue(code: string): number | null {
      switch (code) {
        case "first_game":
        case "games_10":
        case "games_50":
        case "games_100":
        case "games_500":
          return totalGames
        case "first_win":
        case "wins_5":
        case "wins_25":
        case "wins_100":
          return gw
        case "win_rate_50":
        case "win_rate_75":
          return totalGames >= (code === "win_rate_50" ? 10 : 20) ? Math.round((gw / totalGames) * 100) : 0
        case "host_10":
        case "host_50":
          return gh
        case "premium_subscriber":
          return (profile?.subscription_tier === "premium" || profile?.premium_expires_at != null) ? 1 : 0
        case "whoami_first":
        case "whoami_10":
        case "whoami_50":
          return gpWhoami
        default:
          return null
      }
    }

    const achievementsWithStatus = (achievements || []).map((achievement) => {
      const ua = uaByAchievement[achievement.id]
      const reqVal = achievement.requirement_value ?? 1
      const currentVal = getCurrentValue(achievement.code)
      const progressPct = ua?.progress ?? (currentVal != null && reqVal > 0 ? Math.min(100, Math.round((currentVal / reqVal) * 100)) : 0)
      return {
        id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        tier: achievement.tier,
        points: achievement.points,
        requirementValue: reqVal,
        currentValue: currentVal ?? undefined,
        earned: !!ua,
        earnedAt: ua?.earned_at || null,
        progress: ua ? 100 : progressPct,
      }
    })

    // Group by category
    const grouped = achievementsWithStatus.reduce((acc, achievement) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = []
      }
      acc[achievement.category].push(achievement)
      return acc
    }, {} as Record<string, typeof achievementsWithStatus>)

    // Calculate total points
    const totalPoints = achievementsWithStatus
      .filter((a) => a.earned)
      .reduce((sum, a) => sum + a.points, 0)

    // Count achievements
    const earnedCount = achievementsWithStatus.filter((a) => a.earned).length
    const totalCount = achievementsWithStatus.length

    return NextResponse.json({
      achievements: achievementsWithStatus,
      grouped,
      stats: {
        totalPoints,
        earnedCount,
        totalCount,
        completionRate: totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0,
      },
    })
  } catch (error) {
    console.error("Error in achievements API:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
