/**
 * Subscription utilities
 * Functions for checking subscription status and limitations
 */

export type SubscriptionTier = "basic" | "premium"

export interface SubscriptionLimits {
  maxRoomsPerDay: number
  maxPlayersPerRoom: number
  canCreateCustomCharacteristics: boolean
  canUseAdvancedFeatures: boolean
  canCreateTemplates: boolean
  canExportGameData: boolean
}

/**
 * Get subscription limits for a tier
 */
export function getSubscriptionLimits(tier: SubscriptionTier): SubscriptionLimits {
  switch (tier) {
    case "premium":
      return {
        maxRoomsPerDay: -1, // Unlimited
        maxPlayersPerRoom: 20,
        canCreateCustomCharacteristics: true,
        canUseAdvancedFeatures: true,
        canCreateTemplates: true,
        canExportGameData: true,
      }
    case "basic":
    default:
      return {
        maxRoomsPerDay: 3,
        maxPlayersPerRoom: 12,
        canCreateCustomCharacteristics: false,
        canUseAdvancedFeatures: false,
        canCreateTemplates: false,
        canExportGameData: false,
      }
  }
}

/**
 * Check if user can create a room based on subscription
 */
export function canCreateRoom(
  tier: SubscriptionTier,
  roomsCreatedToday: number,
  requestedMaxPlayers: number
): { allowed: boolean; reason?: string } {
  const limits = getSubscriptionLimits(tier)

  // Check max players limit
  if (requestedMaxPlayers > limits.maxPlayersPerRoom) {
    return {
      allowed: false,
      reason: `Базовый тариф позволяет создавать комнаты максимум на ${limits.maxPlayersPerRoom} игроков. Для комнат на ${requestedMaxPlayers} игроков требуется Премиум подписка.`,
    }
  }

  // Check daily room limit for basic tier
  if (limits.maxRoomsPerDay > 0 && roomsCreatedToday >= limits.maxRoomsPerDay) {
    return {
      allowed: false,
      reason: `Базовый тариф позволяет создавать ${limits.maxRoomsPerDay} комнат в день. Обновитесь до Премиум для безлимитного создания комнат.`,
    }
  }

  return { allowed: true }
}

/**
 * Check if user can use advanced feature
 */
export function canUseAdvancedFeature(tier: SubscriptionTier, feature: string): boolean {
  const limits = getSubscriptionLimits(tier)

  switch (feature) {
    case "customCharacteristics":
      return limits.canCreateCustomCharacteristics
    case "templates":
      return limits.canCreateTemplates
    case "export":
      return limits.canExportGameData
    default:
      return limits.canUseAdvancedFeatures
  }
}
