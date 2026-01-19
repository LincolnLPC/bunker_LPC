import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateEmail, validateDescription } from "@/lib/security/validation"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"

/**
 * POST - Submit contact form / support ticket
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  // Get user (optional - can submit anonymously)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { subject, category, message, email } = body

    // Validate required fields
    if (!subject || !category || !message || !email) {
      return NextResponse.json(
        { error: "Missing required fields: subject, category, message, email" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: emailValidation.errors },
        { status: 400 }
      )
    }

    // Validate subject length
    if (typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 100) {
      return NextResponse.json(
        { error: "Subject must be between 3 and 100 characters" },
        { status: 400 }
      )
    }

    // Validate message length
    const messageValidation = validateDescription(message, "Сообщение", 10, 2000)
    if (!messageValidation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: messageValidation.errors },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = ["general", "technical", "billing", "bug", "suggestion", "other"]
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    // Rate limiting (by email for anonymous users, by user_id for authenticated users)
    const identifier = user ? user.id : email
    const rateLimitResult = checkRateLimit(
      identifier,
      RATE_LIMIT_CONFIGS.general // Use general rate limit (5 requests per minute)
    )

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          message: "Rate limit exceeded. Please wait before submitting another ticket.",
        },
        { status: 429 }
      )

      Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }

    // Create support ticket
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user?.id || null,
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        category,
        message: message.trim(),
        status: "open",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating support ticket:", error)
      return NextResponse.json(
        { error: "Failed to create support ticket", details: error.message },
        { status: 500 }
      )
    }

    console.log("[Support Contact] New ticket created:", {
      ticketId: ticket.id,
      email: ticket.email,
      category: ticket.category,
      userId: ticket.user_id || "anonymous",
    })

    return NextResponse.json({
      success: true,
      message: "Ваше обращение успешно отправлено. Мы ответим вам в ближайшее время.",
      ticketId: ticket.id,
    })
  } catch (error) {
    console.error("Error processing contact form:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get user's support tickets (authenticated users only)
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching support tickets:", error)
      return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 })
    }

    return NextResponse.json({ tickets: tickets || [] })
  } catch (error) {
    console.error("Error in GET /api/support/contact:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
