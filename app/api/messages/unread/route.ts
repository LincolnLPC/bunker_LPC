import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Total count of unread messages for the current user
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { count, error } = await supabase
    .from("private_messages")
    .select("*", { count: "exact", head: true })
    .eq("to_user_id", user.id)
    .is("read_at", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
