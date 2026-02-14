import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  SAMPLE_HEALTH_CONDITIONS,
  SAMPLE_HOBBIES,
  SAMPLE_PHOBIAS,
  SAMPLE_BAGGAGE,
  SAMPLE_FACTS,
  SAMPLE_SPECIAL,
  SAMPLE_BIO,
  SAMPLE_SKILLS,
  SAMPLE_TRAITS,
  SAMPLE_PROFESSIONS,
} from "@/types/game"
import { getSpecialOptionsForGender } from "@/lib/game/characteristics"
import { pickPreferringUnused } from "@/lib/game/random"

const GENDER_OPTIONS = ["М", "Ж", "А", "М(с)", "Ж(с)", "М(а)", "Ж(а)"]
const AGE_OPTIONS: string[] = Array.from({ length: 103 }, (_, i) => `${i + 18} лет`) // Возраст от 18 до 120

const CATEGORY_OPTIONS: Record<string, string[]> = {
  health: SAMPLE_HEALTH_CONDITIONS,
  hobby: SAMPLE_HOBBIES,
  phobia: SAMPLE_PHOBIAS,
  baggage: SAMPLE_BAGGAGE,
  fact: SAMPLE_FACTS,
  special: SAMPLE_SPECIAL,
  bio: SAMPLE_BIO,
  skill: SAMPLE_SKILLS,
  trait: SAMPLE_TRAITS,
  profession: SAMPLE_PROFESSIONS,
  gender: GENDER_OPTIONS,
  age: AGE_OPTIONS,
}

// POST - Randomize characteristic value
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
    const { roomId, playerId, characteristicId } = body

    if (!roomId || !playerId || !characteristicId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify user is host and get room settings
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("host_id, settings")
      .eq("id", roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only host can randomize characteristics" }, { status: 403 })
    }

    // Get characteristic to find category
    const { data: char, error: charError } = await supabase
      .from("player_characteristics")
      .select("category, player_id")
      .eq("id", characteristicId)
      .single()

    if (charError || !char) {
      return NextResponse.json({ error: "Characteristic not found" }, { status: 404 })
    }

    // Verify player belongs to room and get gender for gender characteristic logic
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, gender")
      .eq("id", char.player_id)
      .eq("room_id", roomId)
      .single()

    if (playerError || !player || player.id !== playerId) {
      return NextResponse.json({ error: "Player not found in this room" }, { status: 404 })
    }

    // Get characteristics settings from room settings
    const characteristicsSettings = (room.settings as any)?.characteristics || {}
    const categorySetting = characteristicsSettings[char.category]

    // Determine options: use custom list if available and not empty, otherwise use default values
    let options: string[] = []
    const hasCustomList = categorySetting?.customList && Array.isArray(categorySetting.customList) && categorySetting.customList.length > 0

    if (char.category === "special") {
      const genderFiltered = getSpecialOptionsForGender(player.gender)
      const baseOptions = hasCustomList ? categorySetting.customList : SAMPLE_SPECIAL
      options = baseOptions.filter((v: string) => genderFiltered.includes(v))
      if (options.length === 0) options = [...genderFiltered]
    } else if (hasCustomList) {
      options = categorySetting.customList
    } else {
      options = CATEGORY_OPTIONS[char.category] || []
    }

    // Log for debugging
    console.log("[Randomize] Category options:", {
      category: char.category,
      hasCustomList,
      customListLength: categorySetting?.customList?.length || 0,
      defaultOptionsLength: CATEGORY_OPTIONS[char.category]?.length || 0,
      finalOptionsLength: options.length,
      usingDefault: !hasCustomList,
    })

    if (options.length === 0) {
      console.error("[Randomize] No options available for category:", char.category, {
        categorySetting,
        availableCategories: Object.keys(CATEGORY_OPTIONS),
        hasDefaultOptions: !!CATEGORY_OPTIONS[char.category],
      })
      return NextResponse.json({ 
        error: `No options available for category: ${char.category}. Please configure options in game settings.`,
        category: char.category,
      }, { status: 400 })
    }

    // Get current value of this characteristic
    const { data: currentChar, error: currentCharError } = await supabase
      .from("player_characteristics")
      .select("value")
      .eq("id", characteristicId)
      .single()

    const currentValue = currentChar?.value || null

    // For non-gender characteristics
    // Get all players in the room
    const { data: roomPlayers, error: playersError } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", roomId)

    if (playersError || !roomPlayers) {
      return NextResponse.json({ error: "Failed to get room players" }, { status: 500 })
    }

    const playerIds = roomPlayers.map((p) => p.id)

    // Get all used characteristics of this category from all players in the room
    // Exclude the current characteristic
    const { data: usedCharacteristics, error: usedError } = await supabase
      .from("player_characteristics")
      .select("value")
      .in("player_id", playerIds)
      .eq("category", char.category)
      .neq("id", characteristicId) // Exclude the current characteristic

    if (usedError) {
      return NextResponse.json({ error: "Failed to get used characteristics" }, { status: 500 })
    }

    // Get set of used values (excluding current value)
    const usedValues = new Set((usedCharacteristics || []).map((c) => c.value))

    // Filter out used values AND current value from available options
    const availableOptions = options.filter((option) => !usedValues.has(option) && option !== currentValue)

    // If no available options left (all are used), allow reusing any value except current
    const optionsToChooseFrom = availableOptions.length > 0 
      ? availableOptions 
      : options.filter(opt => opt !== currentValue)

    if (optionsToChooseFrom.length === 0) {
      return NextResponse.json({ error: "No options available for this category" }, { status: 400 })
    }

    // Предпочитать значения, которые этот игрок давно не получал в прошлых играх
    const { data: targetPlayer } = await supabase
      .from("game_players")
      .select("user_id")
      .eq("id", playerId)
      .single()
    const userRecentlyUsed = new Set<string>()
    if (targetPlayer?.user_id) {
      const { data: pastPlayers } = await supabase
        .from("game_players")
        .select("id")
        .eq("user_id", targetPlayer.user_id)
        .neq("room_id", roomId)
      const pastPlayerIds = pastPlayers?.map((p: { id: string }) => p.id) || []
      if (pastPlayerIds.length > 0) {
        const { data: pastChars } = await supabase
          .from("player_characteristics")
          .select("value")
          .in("player_id", pastPlayerIds)
          .eq("category", char.category)
        pastChars?.forEach((c: { value: string }) => userRecentlyUsed.add(c.value))
      }
    }
    const randomValue = pickPreferringUnused(optionsToChooseFrom, userRecentlyUsed)

    // Update characteristic
    const { error: updateError } = await supabase
      .from("player_characteristics")
      .update({ value: randomValue })
      .eq("id", characteristicId)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, newValue: randomValue })
  } catch (error) {
    console.error("Error randomizing characteristic:", error)
    return NextResponse.json({ error: "Failed to randomize characteristic" }, { status: 500 })
  }
}
