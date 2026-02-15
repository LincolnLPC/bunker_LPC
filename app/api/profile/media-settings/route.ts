import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * PATCH - Update media_settings for current user (merge with existing).
 * Used to clear stale device IDs when fallback succeeds.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { cameraDeviceId, microphoneDeviceId } = body as {
      cameraDeviceId?: string | null
      microphoneDeviceId?: string | null
    }

    // Get current profile
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("media_settings")
      .eq("id", user.id)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const currentMediaSettings = (profile.media_settings as Record<string, unknown>) || {}
    const updatedMediaSettings = {
      ...currentMediaSettings,
      ...(cameraDeviceId !== undefined && { cameraDeviceId: cameraDeviceId ?? null }),
      ...(microphoneDeviceId !== undefined && { microphoneDeviceId: microphoneDeviceId ?? null }),
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ media_settings: updatedMediaSettings })
      .eq("id", user.id)

    if (updateError) {
      console.error("[Profile] media-settings update error:", updateError)
      return NextResponse.json({ error: "Failed to update media settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Profile] media-settings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
