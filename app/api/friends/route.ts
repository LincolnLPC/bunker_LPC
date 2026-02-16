import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET - List my friends and pending requests
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get("status") // accepted | pending (optional)

  try {
    const { data: rows, error } = await supabase
      .from("user_friends")
      .select("id, user_id, friend_id, status, created_at")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

    if (error) {
      console.error("[Friends] GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const otherIds = new Set<string>()
    ;(rows || []).forEach((r: any) => {
      if (r.user_id !== user.id) otherIds.add(r.user_id)
      if (r.friend_id !== user.id) otherIds.add(r.friend_id)
    })

    let profilesMap: Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; last_seen_at: string | null; show_online_status: boolean }> = {}
    if (otherIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, last_seen_at, show_online_status")
        .in("id", Array.from(otherIds))
      if (profiles) {
        profiles.forEach((p: any) => {
          profilesMap[p.id] = {
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            last_seen_at: p.last_seen_at ?? null,
            show_online_status: p.show_online_status ?? true,
          }
        })
      }
    }

    const list = (rows || []).map((r: any) => {
      const otherId = r.user_id === user.id ? r.friend_id : r.user_id
      const other = profilesMap[otherId]
      return {
        id: r.id,
        friend_user_id: otherId,
        username: other?.username ?? "",
        display_name: other?.display_name ?? null,
        avatar_url: other?.avatar_url ?? null,
        last_seen_at: other?.last_seen_at ?? null,
        show_online_status: other?.show_online_status ?? true,
        status: r.status,
        created_at: r.created_at,
        is_incoming_request: r.friend_id === user.id && r.status === "pending",
      }
    })

    let result = list
    if (statusFilter === "accepted") {
      result = list.filter((x) => x.status === "accepted")
    } else if (statusFilter === "pending") {
      result = list.filter((x) => x.status === "pending")
    }

    return NextResponse.json({ friends: result })
  } catch (err) {
    console.error("[Friends] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// POST - Add friend (send request) or accept request
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { friend_id: friendId, action } = body

    if (action === "accept") {
      const { data: row, error: fetchErr } = await supabase
        .from("user_friends")
        .select("id, user_id, friend_id")
        .eq("id", body.request_id)
        .single()

      if (fetchErr || !row) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 })
      }
      if (row.friend_id !== user.id) {
        return NextResponse.json({ error: "Not your request to accept" }, { status: 403 })
      }

      const { error: updateErr } = await supabase
        .from("user_friends")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", row.id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, status: "accepted" })
    }

    if (action === "decline") {
      const { error: delErr } = await supabase
        .from("user_friends")
        .delete()
        .eq("id", body.request_id)
        .eq("friend_id", user.id)
        .eq("status", "pending")

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (!friendId || typeof friendId !== "string") {
      return NextResponse.json({ error: "friend_id required" }, { status: 400 })
    }

    if (friendId === user.id) {
      return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("user_friends")
      .select("id, user_id, friend_id, status")
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
      )
      .limit(1)
      .maybeSingle()

    if (existing) {
      if (existing.status === "accepted") {
        return NextResponse.json({ error: "Already friends" }, { status: 400 })
      }
      if (existing.user_id === user.id && existing.status === "pending") {
        return NextResponse.json({ error: "Request already sent" }, { status: 400 })
      }
      if (existing.friend_id === user.id && existing.status === "pending") {
        return NextResponse.json({ error: "They already sent you a request. Accept it." }, { status: 400 })
      }
      if (existing.status === "blocked") {
        return NextResponse.json({ error: "Cannot add this user" }, { status: 400 })
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("user_friends")
      .insert({
        user_id: user.id,
        friend_id: friendId,
        status: "pending",
      })
      .select("id, status")
      .single()

    if (insertErr) {
      console.error("[Friends] POST insert error:", insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, request: inserted })
  } catch (err) {
    console.error("[Friends] POST error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// DELETE - Remove friend or cancel request
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const friendId = searchParams.get("friend_id")

  if (!friendId) {
    return NextResponse.json({ error: "friend_id required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_friends")
    .delete()
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
