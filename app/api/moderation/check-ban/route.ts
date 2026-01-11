import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if user is banned using the database function
    const { data, error } = await supabase.rpc("is_user_banned", {
      check_user_id: user.id,
    })

    if (error) {
      console.error("Error checking ban status:", error)
      // Fallback: direct query
      const { data: banData, error: banError } = await supabase
        .from("bans")
        .select("id, reason, ban_type, expires_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle()

      if (banError) {
        return NextResponse.json({ error: "Failed to check ban status" }, { status: 500 })
      }

      return NextResponse.json({
        isBanned: !!banData,
        ban: banData
          ? {
              reason: banData.reason,
              type: banData.ban_type,
              expiresAt: banData.expires_at,
            }
          : null,
      })
    }

    return NextResponse.json({
      isBanned: data === true,
      ban: data === true ? { message: "User is banned" } : null,
    })
  } catch (error) {
    console.error("Error in check-ban endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
