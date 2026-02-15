import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { gateCookieValue } from "@/lib/security/gate-cookie"

const COOKIE_NAME = "bunker_site_access"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * POST - Verify password and set unlock cookie
 * Cookie value is derived from password — when password changes, old cookies are invalidated
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body as { password?: string }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Пароль не указан" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("site_settings")
      .select("gate_password")
      .eq("id", "main")
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Настройки не найдены" }, { status: 500 })
    }

    const storedPassword = data.gate_password
    if (!storedPassword || storedPassword.trim() === "") {
      return NextResponse.json({ success: true, unlocked: true })
    }

    if (password.trim() !== storedPassword.trim()) {
      return NextResponse.json({ success: false, error: "Неверный пароль" }, { status: 401 })
    }

    const cookieValue = await gateCookieValue(storedPassword)
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })

    return NextResponse.json({ success: true, unlocked: true })
  } catch (err) {
    console.error("[SiteSettings Unlock]", err)
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 })
  }
}
