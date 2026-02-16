import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Unread count per user (from_user_id) for the current user — for badges on messages page
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from("private_messages")
    .select("from_user_id")
    .eq("to_user_id", user.id)
    .is("read_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byUser: Record<string, number> = {}
  for (const r of rows || []) {
    const id = r.from_user_id as string
    byUser[id] = (byUser[id] || 0) + 1
  }

  return NextResponse.json(byUser)
}
