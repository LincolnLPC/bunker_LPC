import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

// POST - Grant premium subscription to user
export async function POST(request: Request) {
  console.log("[GrantPremium] Request received")
  
  const supabase = await createClient()

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log("[GrantPremium] Unauthorized: No user")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[GrantPremium] User:", user.id)

  // Check admin role
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole || adminRole.role !== "admin") {
    console.log("[GrantPremium] Forbidden:", adminError?.message || "Not admin")
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  console.log("[GrantPremium] Admin check passed")

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { email, durationDays } = body

    console.log("[GrantPremium] Request body:", { email, durationDays })

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Use service role client for admin operations
    let serviceClient
    try {
      serviceClient = createServiceRoleClient()
    } catch (error) {
      console.error("Error creating service client:", error)
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: error instanceof Error ? error.message : "SUPABASE_SERVICE_ROLE_KEY is not set. Please configure it in your environment variables.",
        },
        { status: 500 }
      )
    }

    // Find user by email - try multiple methods
    let targetUserId: string | null = null

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const normalizedEmail = email.toLowerCase().trim()

      console.log("[GrantPremium] Searching for user with email:", normalizedEmail)

      // Method 1: Use Supabase Admin API to find user by email
      // Note: profiles table doesn't have email field, so we must use Admin API
        // Method 2: Use Supabase Admin API via RPC or direct SQL query
        // Try using RPC function to query auth.users
        try {
          const { data: rpcResult, error: rpcError } = await serviceClient.rpc('get_user_by_email', {
            user_email: normalizedEmail
          })
          
          if (!rpcError && rpcResult) {
            targetUserId = rpcResult.id || rpcResult
            console.log("[GrantPremium] Found user via RPC:", targetUserId)
          }
        } catch (rpcErr) {
          console.log("[GrantPremium] RPC method not available, trying Admin API")
        }

      // Method 2: Use Supabase Admin API via HTTP
      const adminApiUrl = `${supabaseUrl}/auth/v1/admin/users`
      
      // Admin API doesn't support email filter directly, so we need to list and filter
      console.log("[GrantPremium] Fetching users from Admin API")
      const listResponse = await fetch(`${adminApiUrl}?per_page=1000`, {
        method: "GET",
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      })

      console.log("[GrantPremium] Admin API response status:", listResponse.status, listResponse.statusText)

      if (listResponse.ok) {
        const allUsersResult = await listResponse.json()
        console.log("[GrantPremium] Response keys:", Object.keys(allUsersResult || {}))
        
        // Admin API returns { users: [...] } format
        const allUsers = allUsersResult?.users || (Array.isArray(allUsersResult) ? allUsersResult : [])
        console.log("[GrantPremium] Total users fetched:", allUsers.length)
        
        if (allUsers && Array.isArray(allUsers) && allUsers.length > 0) {
          // Log first few emails for debugging
          const sampleEmails = allUsers.slice(0, 10).map((u: any) => u.email).filter(Boolean)
          console.log("[GrantPremium] Sample emails in system:", sampleEmails.join(", "))
          
          const foundUser = allUsers.find((u: any) => 
            u.email && u.email.toLowerCase().trim() === normalizedEmail
          )
          
          if (foundUser) {
            targetUserId = foundUser.id
            console.log("[GrantPremium] ✅ Found user ID:", targetUserId, "Email:", foundUser.email)
          } else {
            console.log("[GrantPremium] ❌ User not found. Searched email:", normalizedEmail)
            console.log("[GrantPremium] Available emails (first 20):", 
              allUsers.slice(0, 20).map((u: any) => u.email).filter(Boolean).join(", "))
          }
        } else {
          console.log("[GrantPremium] No users returned from Admin API")
        }
      } else {
        const errorText = await listResponse.text()
        console.error("[GrantPremium] Admin API error:", listResponse.status, errorText)
      }

      if (!targetUserId) {
        // Final attempt: try to find by searching profiles with partial match or check auth.users via service client
        console.log("[GrantPremium] User not found, checking if email exists in auth system...")
        
        // Since we can't directly query auth.users, we'll return 404
        return NextResponse.json(
          {
            error: "User not found",
            message: `No user found with email: ${email}. Please make sure the user has registered and the email is correct.`,
          },
          { status: 404 }
        )
      }
    } catch (error) {
      console.error("[GrantPremium] Error finding user:", error)
      return NextResponse.json(
        {
          error: "Failed to find user",
          message: error instanceof Error ? error.message : "Could not query user database. Make sure SUPABASE_SERVICE_ROLE_KEY is set.",
        },
        { status: 500 }
      )
    }

    // Calculate expiration date
    let premiumExpiresAt: Date | null = null
    if (durationDays && typeof durationDays === "number" && durationDays > 0) {
      premiumExpiresAt = new Date()
      premiumExpiresAt.setDate(premiumExpiresAt.getDate() + durationDays)
    }
    // If durationDays is null, 0, or not provided, premium is permanent (premium_expires_at = null)

    // Update or create profile with premium subscription using service client
    const { data: existingProfile, error: checkError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle()

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "not found", which is expected if profile doesn't exist
      console.error("Error checking existing profile:", checkError)
      return NextResponse.json({ 
        error: "Failed to check profile",
        details: checkError.message 
      }, { status: 500 })
    }

    let profile
    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await serviceClient
        .from("profiles")
        .update({
          subscription_tier: "premium",
          premium_expires_at: premiumExpiresAt?.toISOString() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select()
        .single()

      if (updateError) {
        console.error("Error updating profile:", updateError)
        return NextResponse.json({ 
          error: "Failed to update profile",
          details: updateError.message,
          code: updateError.code 
        }, { status: 500 })
      }

      profile = updatedProfile
    } else {
      // Create new profile
      const { data: newProfile, error: createError } = await serviceClient
        .from("profiles")
        .insert({
          id: targetUserId,
          username: email.split("@")[0] || `user_${targetUserId.slice(0, 8)}`,
          subscription_tier: "premium",
          premium_expires_at: premiumExpiresAt?.toISOString() || null,
        })
        .select()
        .single()

      if (createError) {
        console.error("Error creating profile:", createError)
        return NextResponse.json({ 
          error: "Failed to create profile",
          details: createError.message,
          code: createError.code 
        }, { status: 500 })
      }

      profile = newProfile
    }

    console.log("[GrantPremium] Success! Profile updated:", profile.id)

    // Check for premium subscriber achievement
    try {
      const { error: achievementError } = await serviceClient.rpc("check_and_award_achievement", {
        user_id_param: targetUserId,
        achievement_code_param: "premium_subscriber",
      })

      if (achievementError) {
        console.error("[GrantPremium] Error checking premium achievement:", achievementError)
      } else {
        console.log("[GrantPremium] Premium achievement checked for user:", targetUserId)
      }
    } catch (achievementErr) {
      console.error("[GrantPremium] Error in premium achievement check:", achievementErr)
      // Don't fail the premium grant if achievement check fails
    }

    return NextResponse.json({
      success: true,
      message: `Premium subscription granted to ${email}`,
      profile,
      expiresAt: premiumExpiresAt?.toISOString() || null,
      expiresAtFormatted: premiumExpiresAt
        ? new Date(premiumExpiresAt).toLocaleString("ru-RU")
        : "Никогда (постоянная)",
    });
  } catch (error) {
    console.error("Error granting premium:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const errorResponse: Record<string, any> = {
      error: "Internal server error",
      message: errorMessage,
    };
    
    if (process.env.NODE_ENV === "development" && errorStack) {
      errorResponse.stack = errorStack;
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
