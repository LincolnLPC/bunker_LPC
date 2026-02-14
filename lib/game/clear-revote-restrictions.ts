import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Очищает ограничения «План Б» (revote) из metadata всех игроков комнаты.
 * Вызывать при завершении голосования — ограничения «План Б» действуют только до конца текущего голосования.
 */
export async function clearRevoteRestrictions(roomId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data: players, error: playersError } = await supabase
    .from("game_players")
    .select("id, metadata")
    .eq("room_id", roomId)

  if (playersError || !players) return

  for (const p of players) {
    let metadata: any = {}
    try {
      if (p.metadata) {
        metadata = typeof p.metadata === "string" ? JSON.parse(p.metadata) : p.metadata
      }
    } catch {
      continue
    }
    if (!metadata.cannotVoteAgainst || !Array.isArray(metadata.cannotVoteAgainst)) continue

    const filtered = metadata.cannotVoteAgainst.filter(
      (r: any) => r.cardType !== "revote"
    )
    if (filtered.length === metadata.cannotVoteAgainst.length) continue

    metadata.cannotVoteAgainst = filtered
    await supabase.from("game_players").update({ metadata }).eq("id", p.id)
  }
}
