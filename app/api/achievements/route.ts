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

    const uaByAchievement = (userAchievements || []).reduce(
      (acc, ua) => {
        acc[ua.achievement_id] = ua
        return acc
      },
      {} as Record<string, { achievement_id: string; earned_at: string | null; progress: number }>
    )

    const achievementsWithStatus = (achievements || []).map((achievement) => {
      const ua = uaByAchievement[achievement.id]
      return {
        id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        tier: achievement.tier,
        points: achievement.points,
        requirementValue: achievement.requirement_value,
        earned: !!ua,
        earnedAt: ua?.earned_at || null,
        progress: ua?.progress ?? 0,
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
