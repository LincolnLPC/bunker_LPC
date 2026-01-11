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
} from "@/types/game"

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

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

    // Verify player belongs to room
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id")
      .eq("id", char.player_id)
      .eq("room_id", roomId)
      .single()

    if (playerError || !player || player.id !== playerId) {
      return NextResponse.json({ error: "Player not found in this room" }, { status: 404 })
    }

    // Get characteristics settings from room settings
    const characteristicsSettings = (room.settings as any)?.characteristics || {}
    const categorySetting = characteristicsSettings[char.category]

    // Determine options: use custom list if available, otherwise use default
    let options: string[] = []
    if (categorySetting?.customList && categorySetting.customList.length > 0) {
      options = categorySetting.customList
    } else {
      options = CATEGORY_OPTIONS[char.category] || []
    }

    if (options.length === 0) {
      return NextResponse.json({ error: "No options available for this category" }, { status: 400 })
    }

    const randomValue = getRandomItem(options)

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
