import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  SAMPLE_PROFESSIONS,
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
import { getSpecialOptionsForGender } from "@/lib/game/characteristics"
import { validateRoomCode } from "@/lib/security/validation"
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RATE_LIMIT_CONFIGS,
  createRateLimitHeaders,
} from "@/lib/security/rate-limit"

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getRandomAge(): number {
  return Math.floor(Math.random() * 60) + 18
}

function getRandomGender(): "М" | "Ж" | "А" {
  const genders: ("М" | "Ж" | "А")[] = ["М", "Ж", "А"]
  return getRandomItem(genders)
}

function getRandomGenderModifier(): "" | "(с)" | "(а)" {
  const modifiers: ("" | "(с)" | "(а)")[] = ["", "(с)", "(а)"]
  return getRandomItem(modifiers)
}

const RUSSIAN_NAMES = [
  "Александр",
  "Дмитрий",
  "Михаил",
  "Иван",
  "Сергей",
  "Артём",
  "Максим",
  "Егор",
  "Никита",
  "Андрей",
  "Мария",
  "Анна",
  "Екатерина",
  "Ольга",
  "Наталья",
  "Елена",
  "София",
  "Виктория",
  "Анастасия",
  "Татьяна",
]

// POST - Join game room
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting for joining games
  const identifier = getRateLimitIdentifier(request, user.id)
  const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIGS.general)

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        message: "Rate limit exceeded for joining games.",
      },
      { status: 429 }
    )

    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }

  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { roomCode: rawRoomCode } = body

    if (!rawRoomCode) {
      return NextResponse.json({ error: "Room code is required" }, { status: 400 })
    }

    const roomCode = typeof rawRoomCode === "string" ? rawRoomCode.toUpperCase() : String(rawRoomCode).toUpperCase()

    // Validate room code format
    const roomCodeValidation = validateRoomCode(roomCode)
    if (!roomCodeValidation.valid) {
      return NextResponse.json(
        { error: "Invalid room code format", errors: roomCodeValidation.errors },
        { status: 400 }
      )
    }

    // Get user profile to use display_name or username
    let { data: profile, error: profileCheckError } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .eq("id", user.id)
      .single()

    if (!profile && profileCheckError) {
      console.log("[Join] Profile not found, attempting to create:", { userId: user.id, error: profileCheckError })
      
      // Try to create profile via API endpoint first (more reliable)
      try {
        const createProfileResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/profile/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        
        if (createProfileResponse.ok) {
          const profileData = await createProfileResponse.json()
          profile = profileData.profile
          console.log("[Join] Profile created via API:", profile)
        } else {
          throw new Error("Failed to create profile via API")
        }
      } catch (apiError) {
        console.warn("[Join] API profile creation failed, trying direct insert:", apiError)
        
        // Fallback: Create profile if it doesn't exist
        let username = user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`
        let attempts = 0
        let createError = null

        while (attempts < 5) {
          const { data, error } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              username,
              display_name: user.user_metadata?.display_name || user.user_metadata?.username || username,
              subscription_tier: "basic",
            })
            .select("id, display_name, username")
            .single()

          if (!error) {
            profile = data
            break
          }

          // Если ошибка уникальности username, попробуем другой
          if (error.code === "23505" || error.message.includes("unique") || error.message.includes("duplicate")) {
            username = `user_${user.id.slice(0, 8)}_${Date.now()}`
            attempts++
          } else {
            createError = error
            break
          }
        }

        if (createError) {
          console.error("[Join] Error creating profile:", createError)
          return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 })
        }
      }
    }

    // Get player name from profile (display_name or username)
    const playerName = profile?.display_name || profile?.username || user.email?.split("@")[0] || `User_${user.id.slice(0, 8)}`

    // Get room
    console.log("[Join] Fetching room:", roomCode)
    const { data: room, error: roomError } = await supabase
      .from("game_rooms")
      .select("*, game_players(*)")
      .eq("room_code", roomCode.toUpperCase())
      .single()

    if (roomError) {
      console.error("[Join] Room fetch error:", roomError)
      return NextResponse.json({ error: "Room not found", details: roomError.message }, { status: 404 })
    }

    if (!room) {
      console.error("[Join] Room not found:", roomCode)
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check password if room has one
    // IMPORTANT: Skip password check if user is the host (they created the room)
    // This allows the host to join as a player without entering the password
    // when hostRole is set to "host_and_player"
    const isHost = room.host_id === user.id
    const { password: providedPassword } = body
    
    if (room.password) {
      if (isHost) {
        // Host can always join without password, regardless of hostRole setting
        console.log("[Join] Host joining room - skipping password check")
      } else {
        // Non-host players must provide the correct password
        if (!providedPassword) {
          return NextResponse.json({ error: "Эта комната защищена паролем", requiresPassword: true }, { status: 403 })
        }
        
        // Simple password comparison (in production, use bcrypt or similar)
        // For now, we'll store plain text passwords (not recommended for production)
        // TODO: Implement proper password hashing
        if (room.password !== providedPassword) {
          return NextResponse.json({ error: "Неверный пароль", requiresPassword: true }, { status: 403 })
        }
      }
    }

    console.log("[Join] Room found:", { roomId: room.id, phase: room.phase, currentPlayers: room.game_players?.length || 0 })

    // Check if user already in room FIRST - allow rejoin regardless of phase
    const existingPlayer = room.game_players.find((p: { user_id: string }) => p.user_id === user.id)
    if (existingPlayer) {
      console.log("[Join] User already in room, returning existing player:", { playerId: existingPlayer.id })
      
      // Update last_seen_at when player rejoins (page refresh)
      await supabase
        .from("game_players")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existingPlayer.id)
      
      // Load characteristics for existing player
      const { data: existingChars, error: charsError } = await supabase
        .from("player_characteristics")
        .select("*")
        .eq("player_id", existingPlayer.id)
        .order("sort_order", { ascending: true })
      
      if (!charsError && existingChars) {
        console.log("[Join] Found existing characteristics:", existingChars.length)
      } else if (charsError) {
        console.error("[Join] Error loading existing characteristics:", charsError)
      }
      
      console.log("[Join] Returning existing player with characteristics:", {
        playerId: existingPlayer.id,
        characteristicsCount: existingChars?.length || 0,
        hasCharacteristics: !charsError && existingChars && existingChars.length > 0
      })
      
      return NextResponse.json({ 
        player: existingPlayer,
        isExisting: true,
        characteristicsCount: existingChars?.length || 0,
        message: "User already in room"
      })
    }

    // If user is not already in room, check if game has started
    // If game has started, allow joining as spectator (if spectators are enabled)
    if (room.phase !== "waiting") {
      // Check if spectators are enabled in room settings
      const roomSettings = room.settings as any || {}
      const spectatorsEnabled = roomSettings.spectators !== false // Default to true if not set
      
      if (!spectatorsEnabled) {
        return NextResponse.json({ 
          error: "Зрители отключены для этой комнаты",
          spectatorsDisabled: true 
        }, { status: 403 })
      }
      
      console.log("[Join] Game already started, attempting to join as spectator")
      
      // Check if user is already a spectator
      const { data: existingSpectator, error: spectatorCheckError } = await supabase
        .from("game_spectators")
        .select("id, joined_at")
        .eq("room_id", room.id)
        .eq("user_id", user.id)
        .single()

      // Check if user was previously a player (by checking if they have characteristics for this room)
      // This is a simple check - if they were a player, they might have left and rejoined as spectator
      // We'll mark them as was_player if they're rejoining (they had a player entry before)
      let wasPlayer = false
      
      // Check if user was a player before (by checking game_players history)
      // Since we can't check deleted records, we'll use a different approach:
      // If user is rejoining and game has started, they were likely a player
      // For now, we'll set wasPlayer to false for new spectators
      
      if (existingSpectator && !spectatorCheckError) {
        console.log("[Join] User already a spectator, updating last_seen_at")
        await supabase
          .from("game_spectators")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existingSpectator.id)
        
        // Check if was_player flag exists
        const { data: spectatorData } = await supabase
          .from("game_spectators")
          .select("was_player")
          .eq("id", existingSpectator.id)
          .single()
        
        wasPlayer = spectatorData?.was_player || false
        
        return NextResponse.json({
          player: null,
          isSpectator: true,
          spectatorId: existingSpectator.id,
          wasPlayer,
          message: "User joined as spectator"
        })
      }

      // Create new spectator entry
      // Note: was_player will be false for new spectators
      // If user was a player and left, we should set was_player to true
      // But we can't check that easily, so we'll leave it as false for now
      const { data: newSpectator, error: spectatorError } = await supabase
        .from("game_spectators")
        .insert({
          room_id: room.id,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          was_player: false, // New spectators are not previous players
        })
        .select()
        .single()

      if (spectatorError) {
        console.error("[Join] Error creating spectator:", spectatorError)
        // If error is duplicate, user is already spectator
        if (spectatorError.code === "23505") {
          return NextResponse.json({
            player: null,
            isSpectator: true,
            message: "User already a spectator"
          })
        }
        return NextResponse.json({ 
          error: "Failed to join as spectator",
          details: spectatorError.message 
        }, { status: 500 })
      }

      console.log("[Join] User joined as spectator:", newSpectator.id)
      return NextResponse.json({
        player: null,
        isSpectator: true,
        spectatorId: newSpectator.id,
        wasPlayer: false, // New spectators are not previous players
        message: "User joined as spectator"
      })
    }

    // Check host role (isHost already declared above)
    const hostRole = (room.settings as any)?.hostRole || "host_and_player"

    // If host chose "host_only" role, don't create player entry
    if (isHost && hostRole === "host_only") {
      return NextResponse.json({ 
        player: null, 
        isHost: true,
        hostOnly: true,
        message: "Host is in host-only mode, not joining as player"
      })
    }

    if (room.game_players.length >= room.max_players) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 })
    }

    // Find next available slot
    const takenSlots = room.game_players.map((p: { slot: number }) => p.slot)
    let nextSlot = 1
    while (takenSlots.includes(nextSlot)) {
      nextSlot++
    }

    // Get characteristics settings from room settings
    const characteristicsSettings = (room.settings as any)?.characteristics || {}

    const categoriesForUniqueness = [
      "profession",
      "health",
      "hobby",
      "phobia",
      "baggage",
      "fact",
      "special",
      "bio",
      "skill",
      "trait",
      "additional",
    ]

    // Fetch used characteristics from existing players (for profession - needed before player create)
    const { data: initialPlayers } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", room.id)
    const initialPlayerIds = initialPlayers?.map((p: { id: string }) => p.id) || []
    const { data: initialChars } = initialPlayerIds.length > 0
      ? await supabase
          .from("player_characteristics")
          .select("value, category")
          .in("player_id", initialPlayerIds)
          .in("category", categoriesForUniqueness)
      : { data: null }

    const usedValues: Record<string, Set<string>> = {}
    categoriesForUniqueness.forEach((cat) => { usedValues[cat] = new Set<string>() })
    initialChars?.forEach((char: { value: string; category: string }) => {
      if (usedValues[char.category]) usedValues[char.category].add(char.value)
    })

    // Helper function to get unique value from list (excluding used values)
    // For profession: assign by slot order (sequential)
    // For others: assign randomly but uniquely
    const getUniqueValue = (usedValues: Record<string, Set<string>>, category: string, options: string[], slot: number): string => {
      const used = usedValues[category]
      if (!used) return getRandomItem(options)

      const available = options.filter((opt) => !used.has(opt))

      if (available.length === 0) {
        console.warn(`[Join] All ${category} values are used, falling back to any value`)
        return getRandomItem(options)
      }

      let selected: string
      if (category === "profession") {
        const index = (slot - 1) % available.length
        selected = available[index]
      } else {
        selected = getRandomItem(available)
      }

      used.add(selected)
      return selected
    }

    // Generate random character attributes (all hidden initially)
    // Use custom settings for gender if available, and check if non-binary gender should be excluded
    const excludeNonBinary = (room.settings as any)?.excludeNonBinaryGender === true
    let defaultGenderOptions = ["М", "Ж", "А"]
    
    // Исключить пол "А", если это настроено в комнате
    if (excludeNonBinary) {
      defaultGenderOptions = ["М", "Ж"]
    }
    
    const genderOptions = characteristicsSettings["gender"]?.customList && characteristicsSettings["gender"]?.customList.length > 0
      ? characteristicsSettings["gender"].customList
      : defaultGenderOptions
    
    // Фильтровать "А" из кастомного списка, если excludeNonBinary включено
    const filteredGenderOptions = excludeNonBinary
      ? genderOptions.filter((g: string) => g !== "А" && g !== "а" && g !== "A" && g !== "a")
      : genderOptions
    
    const gender = characteristicsSettings["gender"]?.enabled !== false
      ? getRandomItem(filteredGenderOptions)
      : getRandomGender()
    
    // Не применять модификатор, если пол "А"
    const genderModifier = (gender === "А" || gender === "а" || gender === "A" || gender === "a") ? "" : getRandomGenderModifier()
    const age = getRandomAge()
    
    // Use custom settings for profession if available, and ensure uniqueness
    // Assign professions sequentially by slot number
    const professionOptions = characteristicsSettings["profession"]?.customList && characteristicsSettings["profession"]?.customList.length > 0
      ? characteristicsSettings["profession"].customList
      : SAMPLE_PROFESSIONS
    const profession = characteristicsSettings["profession"]?.enabled !== false
      ? getUniqueValue(usedValues, "profession", professionOptions, nextSlot)
      : getRandomItem(SAMPLE_PROFESSIONS)

    console.log("[Join] Generated random attributes:", { gender, genderModifier, age, profession })

    // Create player with name from profile
    console.log("[Join] Creating player:", { name: playerName, slot: nextSlot, roomId: room.id, userId: user.id })
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .insert({
        room_id: room.id,
        user_id: user.id,
        slot: nextSlot,
        name: playerName,
        gender,
        gender_modifier: genderModifier,
        age,
        profession,
        is_host: room.host_id === user.id,
        last_seen_at: new Date().toISOString(), // Set initial heartbeat timestamp
      })
      .select()
      .single()

    if (playerError) {
      console.error("[Join] Error creating player:", playerError)
      throw new Error(`Failed to create player: ${playerError.message || JSON.stringify(playerError)}`)
    }

    if (!player) {
      console.error("[Join] Player creation returned null")
      throw new Error("Player creation failed - no player returned")
    }

    console.log("[Join] Player created successfully:", { playerId: player.id, name: player.name })

    // Re-fetch used characteristics right before generating — includes any players who joined concurrently
    const { data: freshPlayers } = await supabase
      .from("game_players")
      .select("id")
      .eq("room_id", room.id)
    const otherPlayerIds = (freshPlayers || []).filter((p: { id: string }) => p.id !== player.id).map((p: { id: string }) => p.id)
    if (otherPlayerIds.length > 0) {
      const { data: freshChars } = await supabase
        .from("player_characteristics")
        .select("value, category")
        .in("player_id", otherPlayerIds)
        .in("category", categoriesForUniqueness)
      categoriesForUniqueness.forEach((cat) => { usedValues[cat] = new Set<string>() })
      freshChars?.forEach((char: { value: string; category: string }) => {
        if (usedValues[char.category]) usedValues[char.category].add(char.value)
      })
      usedValues["profession"]?.add(profession)
    }

    // Helper function to get characteristic value (with uniqueness for all categories except gender, age)
    const getCharacteristicValue = (category: string, defaultList: readonly string[], genderForSpecial?: string): string | null => {
      const setting = characteristicsSettings[category]
      if (!setting || !setting.enabled) {
        return null
      }

      let options: readonly string[] = setting.customList && setting.customList.length > 0
        ? setting.customList
        : defaultList

      if (category === "special" && genderForSpecial) {
        const genderFiltered = getSpecialOptionsForGender(genderForSpecial)
        if (setting.customList && setting.customList.length > 0) {
          options = setting.customList.filter((v: string) => genderFiltered.includes(v))
        } else {
          options = genderFiltered
        }
      }

      if (options.length === 0) {
        return null
      }

      const optionsArr = options as string[]

      if (categoriesForUniqueness.includes(category)) {
        return getUniqueValue(usedValues, category, optionsArr, nextSlot)
      }

      return getRandomItem(optionsArr)
    }

    // Generate characteristics - all initially hidden including gender, age, profession
    const characteristics = []
    let sortOrder = 0

    // Gender - always use generated gender and modifier (но не для пола "А")
    if (characteristicsSettings["gender"]?.enabled !== false) {
      // Не добавлять модификатор для пола "А"
      const genderValue = (gender === "А" || gender === "а" || gender === "A" || gender === "a") 
        ? gender 
        : `${gender}${genderModifier}`
      characteristics.push({
        category: "gender",
        name: "Пол",
        value: genderValue,
        sort_order: sortOrder++,
      })
    }

    // Age - always use generated age
    if (characteristicsSettings["age"]?.enabled !== false) {
      characteristics.push({
        category: "age",
        name: "Возраст",
        value: `${age} лет`,
        sort_order: sortOrder++,
      })
    }

    // Profession - use generated profession (already respects settings)
    if (characteristicsSettings["profession"]?.enabled !== false) {
      characteristics.push({
        category: "profession",
        name: "Профессия",
        value: profession,
        sort_order: sortOrder++,
      })
    }

    // Health
    const healthValue = getCharacteristicValue("health", SAMPLE_HEALTH_CONDITIONS)
    if (healthValue !== null) {
      characteristics.push({
        category: "health",
        name: "Здоровье",
        value: healthValue,
        sort_order: sortOrder++,
      })
    }

    // Hobby
    const hobbyValue = getCharacteristicValue("hobby", SAMPLE_HOBBIES)
    if (hobbyValue !== null) {
      characteristics.push({
        category: "hobby",
        name: "Хобби",
        value: hobbyValue,
        sort_order: sortOrder++,
      })
    }

    // Phobia
    const phobiaValue = getCharacteristicValue("phobia", SAMPLE_PHOBIAS)
    if (phobiaValue !== null) {
      characteristics.push({
        category: "phobia",
        name: "Фобия",
        value: phobiaValue,
        sort_order: sortOrder++,
      })
    }

    // Baggage
    const baggageValue = getCharacteristicValue("baggage", SAMPLE_BAGGAGE)
    if (baggageValue !== null) {
      characteristics.push({
        category: "baggage",
        name: "Багаж",
        value: baggageValue,
        sort_order: sortOrder++,
      })
    }

    // Fact
    const factValue = getCharacteristicValue("fact", SAMPLE_FACTS)
    if (factValue !== null) {
      characteristics.push({
        category: "fact",
        name: "Факт",
        value: factValue,
        sort_order: sortOrder++,
      })
    }

    // Special (с учётом пола — беременность и двойняшки только для Ж)
    const specialValue = getCharacteristicValue("special", SAMPLE_SPECIAL, gender)
    if (specialValue !== null) {
      characteristics.push({
        category: "special",
        name: "Особенность",
        value: specialValue,
        sort_order: sortOrder++,
      })
    }

    // Bio
    const bioValue = getCharacteristicValue("bio", SAMPLE_BIO)
    if (bioValue !== null) {
      characteristics.push({
        category: "bio",
        name: "Биология",
        value: bioValue,
        sort_order: sortOrder++,
      })
    }

    // Skill
    const skillValue = getCharacteristicValue("skill", SAMPLE_SKILLS)
    if (skillValue !== null) {
      characteristics.push({
        category: "skill",
        name: "Навык",
        value: skillValue,
        sort_order: sortOrder++,
      })
    }

    // Trait
    const traitValue = getCharacteristicValue("trait", SAMPLE_TRAITS)
    if (traitValue !== null) {
      characteristics.push({
        category: "trait",
        name: "Характер",
        value: traitValue,
        sort_order: sortOrder++,
      })
    }

    // Additional
    const additionalValue = getCharacteristicValue("additional", [])
    if (additionalValue !== null) {
      characteristics.push({
        category: "additional",
        name: "Дополнительно",
        value: additionalValue,
        sort_order: sortOrder++,
      })
    }

    console.log("[Join] Generated characteristics:", characteristics.map(c => ({ category: c.category, value: c.value })))

    const charInserts = characteristics.map((char) => ({
      player_id: player.id,
      category: char.category,
      name: char.name,
      value: char.value,
      is_revealed: false, // All characteristics are hidden initially
      sort_order: char.sort_order,
    }))

    console.log("[Join] Inserting characteristics into DB:", { playerId: player.id, count: charInserts.length })

    const { data: insertedChars, error: charError } = await supabase
      .from("player_characteristics")
      .insert(charInserts)
      .select()

    if (charError) {
      console.error("[Join] Error inserting characteristics:", charError)
      throw charError
    }

    console.log("[Join] Successfully inserted characteristics:", insertedChars?.length || 0, "characteristics")

    console.log("[Join] Successfully joined room:", {
      playerId: player.id,
      playerName: player.name,
      roomId: room.id,
      roomCode: roomCode,
      characteristicsCount: insertedChars?.length || 0
    })

    const jsonResponse = NextResponse.json({ player, roomId: room.id })

    // Add rate limit headers
    Object.entries(createRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      jsonResponse.headers.set(key, value)
    })

    return jsonResponse
  } catch (error) {
    console.error("[Join] Error joining room:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to join room"
    const errorStack = error instanceof Error ? error.stack : String(error)
    console.error("[Join] Error details:", {
      message: errorMessage,
      stack: errorStack,
      errorName: error instanceof Error ? error.name : "Unknown"
    })
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? errorStack : undefined
      }, 
      { status: 500 }
    )
  }
}
