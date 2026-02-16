import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateGameStatistics } from "@/lib/game/stats"

/**
 * POST - Отметить текущее слово как отгаданное и получить следующее.
 * - Без nextWordByVoting: игрок сам нажимает "Следующее слово" — сразу помечаем и даём следующее.
 * - С nextWordByVoting: игрок нажимает — проверяем, что все остальные подтвердили.
 *   Подтверждение — через POST на тот же endpoint с targetPlayerId (другие игроки голосуют).
 */
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
    const { roomId, targetPlayerId, vote } = body as {
      roomId?: string
      targetPlayerId?: string
      vote?: boolean
    }

    // vote=true: другой игрок подтверждает, что target отгадал слово
    if (vote === true && targetPlayerId && roomId) {
      const { data: voter } = await supabase
        .from("game_players")
        .select("id")
        .eq("user_id", user.id)
        .eq("room_id", roomId)
        .single()

      if (!voter) {
        return NextResponse.json({ error: "Игрок не найден" }, { status: 403 })
      }

      const { data: targetWords } = await supabase
        .from("player_whoami_words")
        .select("word_index")
        .eq("player_id", targetPlayerId)
        .eq("is_guessed", false)
        .order("word_index", { ascending: true })
        .limit(1)

      const currentWordIndex = targetWords?.[0]?.word_index ?? 0

      await supabase.from("whoami_word_votes").upsert(
        {
          room_id: roomId,
          target_player_id: targetPlayerId,
          word_index: currentWordIndex,
          voter_player_id: voter.id,
        },
        {
          onConflict: "room_id,target_player_id,word_index,voter_player_id",
        }
      )

      return NextResponse.json({ success: true, voted: true })
    }

    // Обычный запрос: игрок хочет перейти к следующему слову
    const playerId = targetPlayerId
    if (!roomId || !playerId) {
      return NextResponse.json({ error: "roomId and targetPlayerId required" }, { status: 400 })
    }

    const { data: room } = await supabase
      .from("game_rooms")
      .select("id, host_id, settings")
      .eq("id", roomId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    const player = await supabase
      .from("game_players")
      .select("id, user_id")
      .eq("id", playerId)
      .eq("room_id", roomId)
      .single()

    if (!player.data) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const isSelf = player.data.user_id === user.id
    if (!isSelf && room.host_id !== user.id) {
      return NextResponse.json({ error: "Only the player or host can advance words" }, { status: 403 })
    }

    const settings = (room.settings as Record<string, unknown>) || {}
    const nextWordByVoting = !!settings.whoamiNextWordByVoting

    const { data: words } = await supabase
      .from("player_whoami_words")
      .select("id, word_index, is_guessed")
      .eq("player_id", playerId)
      .order("word_index", { ascending: true })

    const currentWord = words?.find((w) => !w.is_guessed)
    if (!currentWord) {
      return NextResponse.json({ error: "All words guessed" }, { status: 400 })
    }

    const currentIndex = currentWord.word_index

    if (nextWordByVoting) {
      const { data: otherPlayers } = await supabase
        .from("game_players")
        .select("id")
        .eq("room_id", roomId)
        .neq("id", playerId)

      const otherIds = (otherPlayers || []).map((p: { id: string }) => p.id)
      if (otherIds.length === 0) {
        // Нет других игроков — можно сразу перейти
      } else {
        const { data: votes } = await supabase
          .from("whoami_word_votes")
          .select("voter_player_id")
          .eq("room_id", roomId)
          .eq("target_player_id", playerId)
          .eq("word_index", currentIndex)

        const votedIds = new Set((votes || []).map((v: { voter_player_id: string }) => v.voter_player_id))
        const allVoted = otherIds.every((id) => votedIds.has(id))
        if (!allVoted) {
          return NextResponse.json(
            { error: "Not all players have confirmed. Wait for everyone to vote.", needVotes: true },
            { status: 400 }
          )
        }
      }
    }

    await supabase
      .from("player_whoami_words")
      .update({ is_guessed: true, guessed_at: new Date().toISOString() })
      .eq("id", currentWord.id)

    const { data: nextWord } = await supabase
      .from("player_whoami_words")
      .select("id, word, word_index, is_guessed")
      .eq("player_id", playerId)
      .eq("is_guessed", false)
      .order("word_index", { ascending: true })
      .limit(1)
      .single()

    const allGuessed = !nextWord

    if (allGuessed) {
      const settings = (room.settings as Record<string, unknown>) || {}
      const { data: winnerPlayer } = await supabase
        .from("game_players")
        .select("name")
        .eq("id", playerId)
        .single()
      const { error: finishError } = await supabase
        .from("game_rooms")
        .update({
          phase: "finished",
          settings: { ...settings, whoamiWinnerId: playerId },
        })
        .eq("id", roomId)
      if (!finishError) {
        const { data: allPlayers } = await supabase
          .from("game_players")
          .select("id")
          .eq("room_id", roomId)
        const allPlayerIds = (allPlayers || []).map((p) => p.id)
        await updateGameStatistics({
          roomId,
          survivorPlayerIds: [playerId],
          allPlayerIds,
        })
        await supabase.from("chat_messages").insert({
          room_id: roomId,
          player_id: null,
          message: `Игра «Кто Я?» окончена! Победитель: ${winnerPlayer?.name || "Игрок"}`,
          message_type: "system",
        })
      } else {
        console.error("[Whoami next-word] Failed to finish game:", finishError)
      }
    }

    return NextResponse.json({
      success: true,
      nextWord: nextWord
        ? { id: nextWord.id, word: nextWord.word, wordIndex: nextWord.word_index }
        : null,
      allGuessed,
    })
  } catch (error) {
    console.error("[Whoami next-word]", error)
    return NextResponse.json({ error: "Failed to advance word" }, { status: 500 })
  }
}
