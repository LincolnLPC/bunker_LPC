import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

/**
 * GET - Get all support tickets (admin only)
 */
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // Filter by status: open, in_progress, resolved, closed
    const category = searchParams.get("category") // Filter by category
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    console.log("[Support Tickets API] Fetching tickets for admin:", user.id)

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient()

    let query = serviceClient
      .from("support_tickets")
      .select(
        `
        *,
        user:user_id (
          id,
          username,
          display_name,
          avatar_url
        ),
        admin:admin_user_id (
          id,
          username,
          display_name
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq("status", status)
    }

    if (category) {
      query = query.eq("category", category)
    }

    const { data: tickets, error, count } = await query

    if (error) {
      console.error("[Support Tickets API] Error fetching support tickets:", error)
      return NextResponse.json({ error: "Failed to fetch tickets", details: error.message }, { status: 500 })
    }

    console.log("[Support Tickets API] Fetched tickets:", tickets?.length || 0, "total:", count)

    // Transform data
    const ticketsData = tickets?.map((ticket: any) => ({
      id: ticket.id,
      userId: ticket.user_id,
      user: ticket.user
        ? {
            id: ticket.user.id,
            username: ticket.user.username,
            displayName: ticket.user.display_name,
            avatarUrl: ticket.user.avatar_url,
          }
        : null,
      email: ticket.email,
      subject: ticket.subject,
      category: ticket.category,
      message: ticket.message,
      status: ticket.status,
      adminResponse: ticket.admin_response,
      adminUserId: ticket.admin_user_id,
      admin: ticket.admin
        ? {
            id: ticket.admin.id,
            username: ticket.admin.username,
            displayName: ticket.admin.display_name,
          }
        : null,
      resolvedAt: ticket.resolved_at,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    })) || []

    return NextResponse.json({
      success: true,
      tickets: ticketsData,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error in support tickets API:", error)
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
 * PATCH - Update ticket status (admin only)
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: adminRole, error: adminError } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (adminError || !adminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { ticketId, status: newStatus, adminResponse } = body

    if (!ticketId || !newStatus) {
      return NextResponse.json({ error: "ticketId and status are required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (adminResponse !== undefined) {
      updateData.admin_response = adminResponse
      updateData.admin_user_id = user.id
    }

    if (newStatus === "resolved" || newStatus === "closed") {
      updateData.resolved_at = new Date().toISOString()
    }

    const serviceClient = createServiceRoleClient()

    const { data, error } = await serviceClient
      .from("support_tickets")
      .update(updateData)
      .eq("id", ticketId)
      .select()
      .single()

    if (error) {
      console.error("[Support Tickets API] Error updating ticket:", error)
      return NextResponse.json({ error: error.message || "Failed to update ticket" }, { status: 500 })
    }

    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    console.error("Error in support tickets PATCH:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
