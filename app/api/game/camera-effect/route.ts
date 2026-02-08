import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { validateRoomId } from "@/lib/security/validation"
import type { CameraEffectType } from "@/lib/camera-effects/config"
import { CAMERA_EFFECTS } from "@/lib/camera-effects/config"

export const dynamic = "force-dynamic"

type Body = { roomId: string; sourcePlayerId: string; targetPlayerId: string; effect: CameraEffectType }

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { roomId, sourcePlayerId, targetPlayerId, effect } = body
  if (!roomId || !sourcePlayerId || !targetPlayerId || !effect) {
    return NextResponse.json(
      { error: "roomId, sourcePlayerId, targetPlayerId and effect are required" },
      { status: 400 },
    )
  }

  const validEffects: CameraEffectType[] = ["tomato", "egg", "revolver"]
  if (!validEffects.includes(effect)) {
    return NextResponse.json({ error: "Invalid effect" }, { status: 400 })
  }

  const roomValidation = validateRoomId(roomId)
  if (!roomValidation.valid) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 })
  }

  const { data: sourcePlayer } = await supabase
    .from("game_players")
    .select("id, name, user_id")
    .eq("id", sourcePlayerId)
    .eq("room_id", roomId)
    .single()

  if (!sourcePlayer) {
    return NextResponse.json({ error: "Source player not found in room" }, { status: 404 })
  }
  if (sourcePlayer.user_id !== user.id) {
    return NextResponse.json({ error: "Not allowed to send effect as this player" }, { status: 403 })
  }

  const { data: targetPlayer } = await supabase
    .from("game_players")
    .select("id, name")
    .eq("id", targetPlayerId)
    .eq("room_id", roomId)
    .single()

  if (!targetPlayer) {
    return NextResponse.json({ error: "Target player not found in room" }, { status: 404 })
  }

  const sourceName = sourcePlayer?.name ?? "Игрок"
  const targetName = targetPlayer.name ?? "Игрок"
  const effectDef = CAMERA_EFFECTS[effect]
  const icon = effectDef?.icon ?? "🎬"
  const message = `${sourceName} использовал ${icon} ${effectDef?.label ?? effect} на ${targetName}`

  const serviceClient = createServiceRoleClient()
  const { error: insertError } = await serviceClient.from("chat_messages").insert({
    room_id: roomId,
    player_id: null,
    message,
    message_type: "system",
  })

  if (insertError) {
    console.error("[CameraEffect] Insert chat message error:", insertError)
    return NextResponse.json({ error: "Failed to add chat message" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
