/**
 * Server-side subscription checking utilities
 */

import { createClient } from "@/lib/supabase/server"
import { canCreateRoom, getSubscriptionLimits, type SubscriptionTier } from "./utils"

/**
 * Get user's subscription tier
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionTier> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single()

  if (error || !profile) {
    console.error("Error fetching subscription:", error)
    return "basic" // Default to basic on error
  }

  return (profile.subscription_tier as SubscriptionTier) || "basic"
}

/**
 * Count rooms created by user today
 */
export async function getRoomsCreatedToday(userId: string): Promise<number> {
  const supabase = await createClient()

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from("game_rooms")
    .select("*", { count: "exact", head: true })
    .eq("host_id", userId)
    .gte("created_at", startOfDay.toISOString())

  if (error) {
    console.error("Error counting rooms:", error)
    return 0
  }

  return count || 0
}

/**
 * Check if user can create a room (server-side)
 */
export async function checkCanCreateRoom(
  userId: string,
  requestedMaxPlayers: number
): Promise<{ allowed: boolean; reason?: string; subscriptionTier?: SubscriptionTier }> {
  const subscriptionTier = await getUserSubscription(userId)
  const roomsCreatedToday = await getRoomsCreatedToday(userId)

  const result = canCreateRoom(subscriptionTier, roomsCreatedToday, requestedMaxPlayers)

  return {
    ...result,
    subscriptionTier,
  }
}
