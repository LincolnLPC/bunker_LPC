import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - Get specific template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: template, error } = await supabase
      .from("game_templates")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 })
  }
}

// DELETE - Delete template
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Verify template belongs to user
    const { data: template, error: checkError } = await supabase
      .from("game_templates")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (checkError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from("game_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting template:", error)
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
