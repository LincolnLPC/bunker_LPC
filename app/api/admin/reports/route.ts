import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateUUID, sanitizeInput } from "@/lib/security/validation"
import type { NextRequest } from "next/server"

// PATCH - Update report status
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  
  const authResult = await supabase.auth.getUser()
  const user = authResult.data?.user

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
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { reportId, status, adminNotes } = body

    // Validate required fields
    if (!reportId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: reportId, status" },
        { status: 400 }
      )
    }

    // Validate UUID
    const reportIdValidation = validateUUID(reportId, "reportId")
    if (!reportIdValidation.valid) {
      return NextResponse.json(
        { error: "Invalid reportId format", errors: reportIdValidation.errors },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ["pending", "reviewing", "resolved", "dismissed"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate admin notes if provided
    let sanitizedNotes: string | null = null
    if (adminNotes !== undefined && adminNotes !== null) {
      sanitizedNotes = sanitizeInput(String(adminNotes).trim())
      if (sanitizedNotes.length > 1000) {
        return NextResponse.json(
          { error: "Admin notes must be less than 1000 characters" },
          { status: 400 }
        )
      }
    }

    // Check if report exists
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id")
      .eq("id", reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Update report
    const updateData: any = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (sanitizedNotes !== null) {
      updateData.admin_notes = sanitizedNotes
    }

    const { data: updatedReport, error: updateError } = await supabase
      .from("reports")
      .update(updateData)
      .eq("id", reportId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating report:", updateError)
      return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        report: updatedReport,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error in report update endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
