/**
 * Input validation utilities
 * Provides validation functions for user inputs and API requests
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate room code format (6 uppercase alphanumeric characters)
 */
export function validateRoomCode(code: string): ValidationResult {
  const errors: string[] = []

  if (!code) {
    errors.push("Код комнаты обязателен")
  } else if (typeof code !== "string") {
    errors.push("Код комнаты должен быть строкой")
  } else if (code.length !== 6) {
    errors.push("Код комнаты должен состоять из 6 символов")
  } else if (!/^[A-Z0-9]{6}$/.test(code)) {
    errors.push("Код комнаты должен содержать только заглавные буквы и цифры")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate max players value
 */
export function validateMaxPlayers(maxPlayers: number): ValidationResult {
  const errors: string[] = []

  if (typeof maxPlayers !== "number" || isNaN(maxPlayers)) {
    errors.push("Количество игроков должно быть числом")
  } else if (![8, 12, 16, 20].includes(maxPlayers)) {
    errors.push("Количество игроков должно быть 8, 12, 16 или 20")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate round timer seconds
 */
export function validateRoundTimer(seconds: number): ValidationResult {
  const errors: string[] = []

  if (typeof seconds !== "number" || isNaN(seconds)) {
    errors.push("Время раунда должно быть числом")
  } else if (seconds < 30) {
    errors.push("Время раунда должно быть не менее 30 секунд")
  } else if (seconds > 600) {
    errors.push("Время раунда не должно превышать 600 секунд (10 минут)")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate username
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = []

  if (!username) {
    errors.push("Имя пользователя обязательно")
  } else if (typeof username !== "string") {
    errors.push("Имя пользователя должно быть строкой")
  } else if (username.length < 3) {
    errors.push("Имя пользователя должно содержать минимум 3 символа")
  } else if (username.length > 20) {
    errors.push("Имя пользователя не должно превышать 20 символов")
  } else if (!/^[a-zA-Z0-9а-яА-ЯёЁ_\-.]*$/.test(username)) {
    errors.push("Имя пользователя может содержать только буквы, цифры, подчеркивание, дефис и точку")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate display name
 */
export function validateDisplayName(displayName: string | null | undefined): ValidationResult {
  const errors: string[] = []

  if (displayName === null || displayName === undefined || displayName === "") {
    // Display name is optional, so empty is valid
    return { valid: true, errors: [] }
  }

  if (typeof displayName !== "string") {
    errors.push("Отображаемое имя должно быть строкой")
  } else if (displayName.length > 50) {
    errors.push("Отображаемое имя не должно превышать 50 символов")
  } else if (/[<>]/.test(displayName)) {
    errors.push("Отображаемое имя не должно содержать символы < и >")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate chat message
 */
export function validateChatMessage(message: string): ValidationResult {
  const errors: string[] = []

  if (!message) {
    errors.push("Сообщение не может быть пустым")
  } else if (typeof message !== "string") {
    errors.push("Сообщение должно быть строкой")
  } else if (message.length > 500) {
    errors.push("Сообщение не должно превышать 500 символов")
  } else if (message.trim().length === 0) {
    errors.push("Сообщение не может состоять только из пробелов")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate catastrophe/bunker description
 */
export function validateDescription(description: string, fieldName: string = "Описание"): ValidationResult {
  const errors: string[] = []

  if (!description) {
    errors.push(`${fieldName} обязательно`)
  } else if (typeof description !== "string") {
    errors.push(`${fieldName} должно быть строкой`)
  } else if (description.length < 10) {
    errors.push(`${fieldName} должно содержать минимум 10 символов`)
  } else if (description.length > 1000) {
    errors.push(`${fieldName} не должно превышать 1000 символов`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): ValidationResult {
  const errors: string[] = []

  if (!uuid) {
    errors.push("UUID обязателен")
  } else if (typeof uuid !== "string") {
    errors.push("UUID должен быть строкой")
  } else if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
  ) {
    errors.push("Неверный формат UUID")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate player ID (UUID)
 */
export function validatePlayerId(playerId: string): ValidationResult {
  return validateUUID(playerId)
}

/**
 * Validate room ID (UUID)
 */
export function validateRoomId(roomId: string): ValidationResult {
  return validateUUID(roomId)
}

/**
 * Sanitize string to prevent XSS (basic)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return ""
  }

  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

/**
 * Validate and sanitize room settings object
 */
export function validateRoomSettings(settings: any): ValidationResult {
  const errors: string[] = []

  if (settings === null || settings === undefined) {
    return { valid: true, errors: [] } // Settings are optional
  }

  if (typeof settings !== "object" || Array.isArray(settings)) {
    errors.push("Настройки должны быть объектом")
    return { valid: false, errors }
  }

  // Validate hostRole if present
  if (settings.hostRole !== undefined) {
    if (!["host_and_player", "host_only"].includes(settings.hostRole)) {
      errors.push("hostRole должен быть 'host_and_player' или 'host_only'")
    }
  }

  // Validate autoReveal if present
  if (settings.autoReveal !== undefined && typeof settings.autoReveal !== "boolean") {
    errors.push("autoReveal должен быть булевым значением")
  }

  // Validate spectators if present
  if (settings.spectators !== undefined && typeof settings.spectators !== "boolean") {
    errors.push("spectators должен быть булевым значением")
  }

  // Validate excludeNonBinaryGender if present
  if (settings.excludeNonBinaryGender !== undefined && typeof settings.excludeNonBinaryGender !== "boolean") {
    errors.push("excludeNonBinaryGender должен быть булевым значением")
  }

  // Validate characteristics if present
  if (settings.characteristics !== undefined) {
    if (typeof settings.characteristics !== "object" || Array.isArray(settings.characteristics)) {
      errors.push("characteristics должен быть объектом")
    } else {
      // Validate each category setting
      const validCategories = [
        "gender",
        "age",
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

      for (const [category, setting] of Object.entries(settings.characteristics)) {
        if (!validCategories.includes(category)) {
          errors.push(`Неизвестная категория характеристик: ${category}`)
          continue
        }

        if (typeof setting !== "object" || Array.isArray(setting) || setting === null) {
          errors.push(`Настройка категории ${category} должна быть объектом`)
          continue
        }

        const categorySetting = setting as { enabled?: boolean; customList?: string[] }

        // Validate enabled
        if (categorySetting.enabled !== undefined && typeof categorySetting.enabled !== "boolean") {
          errors.push(`enabled для категории ${category} должен быть булевым значением`)
        }

        // Validate customList
        if (categorySetting.customList !== undefined) {
          if (!Array.isArray(categorySetting.customList)) {
            errors.push(`customList для категории ${category} должен быть массивом`)
          } else {
            // Validate that all items in customList are strings
            const invalidItems = categorySetting.customList.filter(
              (item) => typeof item !== "string" || item.trim().length === 0
            )
            if (invalidItems.length > 0) {
              errors.push(
                `customList для категории ${category} должен содержать только непустые строки`
              )
            }

            // Limit maximum number of items to prevent abuse
            if (categorySetting.customList.length > 200) {
              errors.push(
                `customList для категории ${category} не может содержать более 200 элементов`
              )
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap((r) => r.errors)
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  }
}
