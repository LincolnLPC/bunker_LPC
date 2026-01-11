import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateUUID, sanitizeInput } from "@/lib/security/validation"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting for reports
  const identifier = getRateLimitIdentifier(request, user.id)
  const rateLimitResult = checkRateLimit(identifier, {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 reports per minute
  })

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        message: "Rate limit exceeded for reports.",
      },
      { status: 429 }
    )

    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { reportedUserId, roomId, reportType, description } = body

    // Validate required fields
    if (!reportedUserId || !reportType || !description) {
      return NextResponse.json(
        { error: "Missing required fields: reportedUserId, reportType, description" },
        { status: 400 }
      )
    }

    // Validate report type
    const validReportTypes = ["cheating", "harassment", "spam", "inappropriate_content", "other"]
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { error: `Invalid report type. Must be one of: ${validReportTypes.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate UUID
    const reportedUserValidation = validateUUID(reportedUserId, "reportedUserId")
    if (!reportedUserValidation.valid) {
      return NextResponse.json(
        { error: "Invalid reportedUserId format", errors: reportedUserValidation.errors },
        { status: 400 }
      )
    }

    // Validate description length
    const sanitizedDescription = sanitizeInput(description.trim())
    if (sanitizedDescription.length < 10 || sanitizedDescription.length > 1000) {
      return NextResponse.json(
        { error: "Description must be between 10 and 1000 characters" },
        { status: 400 }
      )
    }

    // Validate roomId if provided
    if (roomId) {
      const roomIdValidation = validateUUID(roomId, "roomId")
      if (!roomIdValidation.valid) {
        return NextResponse.json(
          { error: "Invalid roomId format", errors: roomIdValidation.errors },
          { status: 400 }
        )
      }
    }

    // Prevent self-reporting
    if (reportedUserId === user.id) {
      return NextResponse.json({ error: "You cannot report yourself" }, { status: 400 })
    }

    // Check if user exists
    const { data: reportedUser, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", reportedUserId)
      .single()

    if (userError || !reportedUser) {
      return NextResponse.json({ error: "Reported user not found" }, { status: 404 })
    }

    // Check if room exists (if provided)
    if (roomId) {
      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .select("id")
        .eq("id", roomId)
        .single()

      if (roomError || !room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 })
      }
    }

    // Create report
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        room_id: roomId || null,
        report_type: reportType,
        description: sanitizedDescription,
        status: "pending",
      })
      .select()
      .single()

    if (reportError) {
      console.error("Error creating report:", reportError)
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
    }

    const response = NextResponse.json(
      {
        success: true,
        report: {
          id: report.id,
          status: report.status,
        },
      },
      { status: 201 }
    )

    // Add rate limit headers
    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error("Error in report endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
