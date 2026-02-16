import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MESSAGE_BODY_MAX_LENGTH = 5000

// GET - List conversations (users I have messages with) with last message and unread count
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const withUserId = searchParams.get("with") // get thread with this user

  if (withUserId) {
    const { data: messages, error } = await supabase
      .from("private_messages")
      .select("id, from_user_id, to_user_id, body, read_at, created_at")
      .or(
        `and(from_user_id.eq.${user.id},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const otherId = withUserId === user.id ? null : withUserId
    const otherProfile = otherId
      ? await supabase.from("profiles").select("id, username, display_name, avatar_url, last_seen_at, show_online_status").eq("id", otherId).single()
      : { data: null }

    return NextResponse.json({
      messages: messages || [],
      other: otherProfile.data,
    })
  }

  const { data: sent } = await supabase
    .from("private_messages")
    .select("to_user_id, created_at")
    .eq("from_user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: received } = await supabase
    .from("private_messages")
    .select("from_user_id, created_at, read_at")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false })

  const partnerIds = new Set<string>()
  const lastActivity: Record<string, string> = {}
  const lastMessageFromMe: Record<string, boolean> = {}
  const unreadCount: Record<string, number> = {}

  ;(sent?.data || []).forEach((r: any) => {
    partnerIds.add(r.to_user_id)
    if (!lastActivity[r.to_user_id] || r.created_at > lastActivity[r.to_user_id]) {
      lastActivity[r.to_user_id] = r.created_at
      lastMessageFromMe[r.to_user_id] = true
    }
  })
  ;(received?.data || []).forEach((r: any) => {
    partnerIds.add(r.from_user_id)
    if (!lastActivity[r.from_user_id] || r.created_at > lastActivity[r.from_user_id]) {
      lastActivity[r.from_user_id] = r.created_at
      lastMessageFromMe[r.from_user_id] = false
    }
    const isUnread = r.read_at == null || r.read_at === ""
    if (isUnread) {
      unreadCount[r.from_user_id] = (unreadCount[r.from_user_id] || 0) + 1
    }
  })

  const ids = Array.from(partnerIds)
  const totalUnread = Object.values(unreadCount).reduce((a, b) => a + b, 0)
  if (ids.length === 0) {
    return NextResponse.json({ conversations: [], total_unread: 0 })
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids)

  const profilesMap: Record<string, any> = {}
  ;(profiles || []).forEach((p: any) => {
    profilesMap[p.id] = p
  })

  const conversations = ids.map((id) => ({
    user_id: id,
    username: profilesMap[id]?.username,
    display_name: profilesMap[id]?.display_name,
    avatar_url: profilesMap[id]?.avatar_url,
    last_activity_at: lastActivity[id],
    last_message_from_me: lastMessageFromMe[id],
    unread_count: Number(unreadCount[id] || 0),
  })).sort((a, b) => {
    // Unread first, then by most recent activity
    if ((a.unread_count || 0) > 0 && (b.unread_count || 0) === 0) return -1
    if ((a.unread_count || 0) === 0 && (b.unread_count || 0) > 0) return 1
    return (b.last_activity_at || "").localeCompare(a.last_activity_at || "")
  })

  return NextResponse.json({ conversations, total_unread: totalUnread })
}

// POST - Send a message
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { to_user_id: toUserId, body: messageBody } = body

  if (!toUserId || typeof toUserId !== "string") {
    return NextResponse.json({ error: "to_user_id required" }, { status: 400 })
  }

  let bodyStr: string
  if (typeof messageBody === "string") {
    bodyStr = messageBody.trim()
  } else {
    bodyStr = ""
  }
  if (!bodyStr) {
    return NextResponse.json({ error: "Message body required" }, { status: 400 })
  }
  if (bodyStr.length > MESSAGE_BODY_MAX_LENGTH) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 })
  }

  if (toUserId === user.id) {
    return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 })
  }

  const { data: msg, error } = await supabase
    .from("private_messages")
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      body: bodyStr,
    })
    .select("id, from_user_id, to_user_id, body, read_at, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: msg })
}
