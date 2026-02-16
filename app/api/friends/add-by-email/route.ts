import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

/**
 * POST - Add friend by email (look up user by email via Auth Admin, then send friend request)
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email) {
    return NextResponse.json({ error: "Укажите email пользователя" }, { status: 400 })
  }

  if (user.email?.toLowerCase() === email) {
    return NextResponse.json({ error: "Нельзя добавить самого себя" }, { status: 400 })
  }

  let targetUserId: string | null = null

  try {
    const serviceClient = createServiceRoleClient()
    const { data: listData, error: listError } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listError) {
      console.error("[Friends add-by-email] listUsers error:", listError)
      return NextResponse.json({ error: "Не удалось найти пользователя" }, { status: 500 })
    }

    const found = listData?.users?.find((u) => u.email?.toLowerCase() === email)
    if (!found) {
      return NextResponse.json({ error: "Пользователь с таким email не найден" }, { status: 404 })
    }

    targetUserId = found.id
  } catch (err) {
    console.error("[Friends add-by-email] Error:", err)
    return NextResponse.json({ error: "Ошибка поиска пользователя" }, { status: 500 })
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from("user_friends")
    .select("id, user_id, friend_id, status")
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`
    )
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Вы уже в друзьях" }, { status: 400 })
    }
    if (existing.user_id === user.id && existing.status === "pending") {
      return NextResponse.json({ error: "Запрос уже отправлен" }, { status: 400 })
    }
    if (existing.friend_id === user.id && existing.status === "pending") {
      return NextResponse.json({ error: "Входящая заявка уже есть — примите её в разделе «Друзья»" }, { status: 400 })
    }
  }

  const { error: insertErr } = await supabase.from("user_friends").insert({
    user_id: user.id,
    friend_id: targetUserId,
    status: "pending",
  })

  if (insertErr) {
    console.error("[Friends add-by-email] insert error:", insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "Запрос в друзья отправлен" })
}
