import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST - Create user profile
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if profile already exists (double check with maybeSingle to avoid errors)
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    // If profile exists, return it (even if there was a minor error in the check)
    if (existingProfile) {
      console.log("Profile already exists:", existingProfile.id)
      return NextResponse.json({ success: true, profile: existingProfile })
    }

    // Log if there was an unexpected error checking
    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "not found" which is expected
      console.warn("Unexpected error checking profile:", checkError)
    }

    let profile: any = null

    // Try using the database function first (more reliable, bypasses RLS)
    try {
      const { data: functionResult, error: functionError } = await supabase.rpc("create_user_profile", {
        user_uuid: user.id,
        user_email: user.email || "",
        user_meta: user.user_metadata || {},
      })

      if (!functionError && functionResult && Array.isArray(functionResult) && functionResult.length > 0) {
        // Fetch full profile data
        const { data: fullProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()

        if (fullProfile) {
          profile = fullProfile
          console.log("Profile created via database function:", { id: profile.id, username: profile.username })
          return NextResponse.json({ success: true, profile })
        }
      } else if (functionError) {
        console.warn("Database function error:", functionError.message)
      }
    } catch (functionErr) {
      console.warn("Could not use create_user_profile function (might not exist), using direct insert:", functionErr)
    }

    // Fallback: Direct insert if function didn't work or doesn't exist
    if (!profile) {
      // Generate unique username
      let baseUsername = user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`
      // Clean username - remove special characters, limit length
      baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, "").substring(0, 20) || `user_${user.id.slice(0, 8)}`

      let username = baseUsername
      let attempts = 0

      while (attempts < 10 && !profile) {
        const { data, error } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            username,
            display_name: user.user_metadata?.display_name || user.user_metadata?.username || username,
            subscription_tier: "basic",
            media_settings: {
              autoRequestCamera: true,
              autoRequestMicrophone: true,
              defaultCameraEnabled: true,
              defaultMicrophoneEnabled: true,
            },
          })
          .select("*")
          .single()

        if (!error && data) {
          profile = data
          console.log("Profile created successfully:", { id: profile.id, username: profile.username })
          break
        }

        // Check if error is because profile already exists (primary key conflict on id)
        if (
          error?.code === "23505" &&
          (error?.message?.includes("profiles_pkey") ||
            error?.message?.includes("(id)") ||
            error?.hint?.includes("Key (id)") ||
            error?.hint?.includes("profiles_pkey"))
        ) {
          // Profile already exists with this ID, fetch it
          console.log("Profile with this ID already exists (primary key conflict), fetching...")
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle()

          if (existingProfile) {
            profile = existingProfile
            console.log("Found existing profile:", { id: profile.id, username: profile.username })
            break
          }
          // If profile not found but exists (race condition), wait and retry
          attempts++
          if (attempts < 10) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            continue
          }
        }
        // If username conflict (unique constraint on username), try different username
        else if (
          error?.code === "23505" &&
          (error?.message?.includes("username") ||
            error?.hint?.includes("username") ||
            error?.hint?.includes("profiles_username_key"))
        ) {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 6)
          username = `${baseUsername}_${timestamp}_${random}`.substring(0, 30)
          attempts++
          console.log(`Username conflict (attempt ${attempts}/10), trying: ${username}`)
          // Wait a bit before retrying to avoid race conditions
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue // Continue to next iteration
        } else {
        // For any other error, log and try one more time with different approach
        console.error("Error creating profile (non-username conflict):", {
          code: error?.code,
          message: error?.message,
          hint: error?.hint,
          details: JSON.stringify(error, null, 2),
          user_id: user.id,
          username,
          attempt: attempts + 1,
        })
        
        // If it's an RLS/permission error, try one more time after a delay
        if (
          error?.message?.toLowerCase().includes("permission") ||
          error?.message?.toLowerCase().includes("policy") ||
          error?.message?.toLowerCase().includes("row-level security") ||
          error?.code === "42501"
        ) {
          attempts++
          if (attempts < 10) {
            console.log("Permission error detected, retrying after delay...")
            await new Promise((resolve) => setTimeout(resolve, 500))
            continue
          }
        }
        
        // Return error only if we can't continue
        return NextResponse.json(
          {
            error: error?.message || "Failed to create profile",
            errorCode: error?.code,
            hint: error?.hint || undefined,
            details: process.env.NODE_ENV === "development" ? JSON.stringify(error, null, 2) : undefined,
          },
          { status: 500 },
        )
        }
      }
    }

    if (!profile) {
      console.error("Failed to create profile after 10 attempts", {
        user_id: user.id,
        baseUsername,
        finalUsername: username,
      })
      return NextResponse.json(
        { 
          error: "Failed to create profile after multiple attempts. Please try refreshing the page or contact support.",
          errorCode: "MAX_ATTEMPTS_EXCEEDED",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error("Error in create profile endpoint:", error)
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
  }
}
