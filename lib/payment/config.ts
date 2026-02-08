/**
 * Payment configuration for Yandex Pay integration
 */

export type PaymentProvider = "yandex-pay" | "none"

export interface PaymentConfig {
  provider: PaymentProvider
  apiKey?: string
  merchantId?: string
  currency?: string
  successUrl?: string
  cancelUrl?: string
  sandbox?: boolean
}

/**
 * Get payment configuration from environment variables
 */
export function getPaymentConfig(): PaymentConfig {
  const provider = (process.env.PAYMENT_PROVIDER || "yandex-pay") as PaymentProvider
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return {
    provider,
    apiKey: process.env.YANDEX_PAY_API_KEY,
    merchantId: process.env.NEXT_PUBLIC_YANDEX_PAY_MERCHANT_ID,
    currency: process.env.PAYMENT_CURRENCY || "RUB",
    successUrl: process.env.PAYMENT_SUCCESS_URL || `${appUrl}/subscription?success=true`,
    cancelUrl: process.env.PAYMENT_CANCEL_URL || `${appUrl}/subscription?canceled=true`,
    sandbox: process.env.YANDEX_PAY_SANDBOX === "true",
  }
}

/**
 * Subscription plans configuration
 */
export interface SubscriptionPlan {
  id: string
  name: string
  tier: "basic" | "premium"
  price: number
  currency: string
  interval: "month" | "year"
  features: string[]
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  premium_monthly: {
    id: "premium_monthly",
    name: "Премиум (месяц)",
    tier: "premium",
    price: 299, // RUB
    currency: "RUB",
    interval: "month",
    features: [
      "Неограниченное создание комнат",
      "До 20 игроков в комнате",
      "Кастомные характеристики",
      "Продвинутые функции",
      "Сохранение шаблонов игр",
      "Экспорт результатов",
    ],
  },
  premium_yearly: {
    id: "premium_yearly",
    name: "Премиум (год)",
    tier: "premium",
    price: 2990, // RUB (≈10% discount)
    currency: "RUB",
    interval: "year",
    features: [
      "Неограниченное создание комнат",
      "До 20 игроков в комнате",
      "Кастомные характеристики",
      "Продвинутые функции",
      "Сохранение шаблонов игр",
      "Экспорт результатов",
      "Приоритетная поддержка",
    ],
  },
}

/**
 * Get plan by ID
 */
export function getPlanById(planId: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS[planId] || null
}

const ORDER_PREFIX = "sub"
const ORDER_SEP = "|"

/**
 * Encode order metadata for Yandex Pay orderId (to recover userId, planId, expiresAt from webhook)
 * Format: sub|userId|planId|expiresAt (expiresAt with - instead of : and .)
 */
export function encodeOrderMetadata(userId: string, planId: string, expiresAt: string): string {
  const safeExpires = expiresAt.replace(/[:.]/g, "-")
  return [ORDER_PREFIX, userId, planId, safeExpires].join(ORDER_SEP)
}

/**
 * Decode order metadata from orderId
 */
export function decodeOrderMetadata(orderId: string): { userId: string; planId: string; expiresAt: string } | null {
  if (!orderId.startsWith(ORDER_PREFIX + ORDER_SEP)) return null
  const parts = orderId.split(ORDER_SEP)
  if (parts.length < 5) return null
  const [, userId, planId, ...expParts] = parts
  const expiresAtEncoded = expParts.join(ORDER_SEP)
  const expiresAt = expiresAtEncoded.replace(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d+)Z/,
    "$1-$2-$3T$4:$5:$6.$7Z"
  )
  return { userId, planId, expiresAt }
}
