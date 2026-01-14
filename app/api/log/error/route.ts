import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Log error from client
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, error, stack, url, userAgent, timestamp } = body

    // Get user ID if authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const userId = user?.id || "anonymous"

    // Log error to server console
    console.error("[Client Error]", {
      userId,
      message: message || error?.message || "Unknown error",
      error: error?.name || error?.constructor?.name || "Unknown",
      stack: stack || error?.stack,
      url,
      userAgent,
      timestamp: timestamp || new Date().toISOString(),
    })

    // In the future, you can also save errors to database here
    // const { error: dbError } = await supabase
    //   .from("error_logs")
    //   .insert({
    //     user_id: userId || null,
    //     message,
    //     error_details: error,
    //     stack_trace: stack,
    //     url,
    //     user_agent: userAgent,
    //   })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Error Logger] Failed to log error:", err)
    return NextResponse.json({ error: "Failed to log error" }, { status: 500 })
  }
}
