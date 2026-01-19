import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET - Get achievements for the authenticated user
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all achievements with user's progress
    const { data: achievements, error } = await supabase
      .from("achievements")
      .select(
        `
        *,
        user_achievements!left (
          id,
          earned_at,
          progress
        )
      `
      )
      .eq("user_achievements.user_id", user.id)
      .order("points", { ascending: false })
      .order("category")

    if (error) {
      console.error("Error fetching achievements:", error)
      return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 })
    }

    // Transform data to include earned status
    const achievementsWithStatus = achievements?.map((achievement) => {
      const userAchievement = achievement.user_achievements?.[0]
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
        earned: !!userAchievement,
        earnedAt: userAchievement?.earned_at || null,
        progress: userAchievement?.progress || 0,
      }
    }) || []

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
