import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Check if profile exists and return it or create one
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Try to get profile - use maybeSingle to avoid errors if not found
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (profile) {
      return NextResponse.json({ exists: true, profile })
    }

    // Profile doesn't exist - return info for creation
    return NextResponse.json({
      exists: false,
      userId: user.id,
      email: user.email,
      metadata: user.user_metadata,
      error: profileError?.message,
    })
  } catch (error) {
    console.error("Error checking profile:", error)
    return NextResponse.json({ error: "Failed to check profile" }, { status: 500 })
  }
}
