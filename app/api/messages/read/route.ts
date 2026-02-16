import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

// PATCH - Mark messages from a user as read
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const fromUserId = body.from_user_id

  if (!fromUserId) {
    return NextResponse.json({ error: "from_user_id required" }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from("private_messages")
    .update({ read_at: now })
    .eq("to_user_id", user.id)
    .eq("from_user_id", fromUserId)
    .is("read_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
