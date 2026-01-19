import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST - Manually trigger achievement check for a user
 * Useful for checking achievements after specific events (premium activation, etc.)
 */
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
    const { achievementCode } = body

    // Check specific achievement or all achievements
    if (achievementCode) {
      const { data, error } = await supabase.rpc("check_and_award_achievement", {
        user_id_param: user.id,
        achievement_code_param: achievementCode,
      })

      if (error) {
        console.error("Error checking achievement:", error)
        return NextResponse.json({ error: "Failed to check achievement" }, { status: 500 })
      }

      return NextResponse.json({
        success: data === true,
        awarded: data === true,
      })
    } else {
      // Check all achievements
      const { data, error } = await supabase.rpc("check_all_achievements", {
        user_id_param: user.id,
      })

      if (error) {
        console.error("Error checking all achievements:", error)
        return NextResponse.json({ error: "Failed to check achievements" }, { status: 500 })
      }

      const newlyAwarded = data?.filter((item: any) => item.awarded) || []

      return NextResponse.json({
        success: true,
        newlyAwarded: newlyAwarded.map((item: any) => item.achievement_code),
        totalChecked: data?.length || 0,
      })
    }
  } catch (error) {
    console.error("Error in achievement check API:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
