import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ONLINE_THRESHOLD_MINUTES = 5

// POST - Update last_seen_at for current user (call periodically from client)
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: now, updated_at: now })
    .eq("id", user.id)

  if (error) {
    console.error("[Heartbeat] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, last_seen_at: now })
}

// GET - Check if user is considered online (last_seen_at within threshold)
export function isUserOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  const seen = new Date(lastSeenAt).getTime()
  const threshold = ONLINE_THRESHOLD_MINUTES * 60 * 1000
  return Date.now() - seen < threshold
}

export { ONLINE_THRESHOLD_MINUTES }
