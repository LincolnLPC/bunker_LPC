/**
 * Payment configuration for Stripe/ЮKassa integration
 * 
 * This file contains configuration and utilities for payment processing.
 * Ready for integration with payment providers.
 */

export type PaymentProvider = "stripe" | "yookassa" | "none"

export interface PaymentConfig {
  provider: PaymentProvider
  apiKey?: string
  secretKey?: string
  webhookSecret?: string
  currency?: string
  successUrl?: string
  cancelUrl?: string
}

/**
 * Get payment configuration from environment variables
 */
export function getPaymentConfig(): PaymentConfig {
  const provider = (process.env.PAYMENT_PROVIDER || "none") as PaymentProvider

  return {
    provider,
    apiKey: process.env.PAYMENT_API_KEY,
    secretKey: process.env.PAYMENT_SECRET_KEY,
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
    currency: process.env.PAYMENT_CURRENCY || "RUB",
    successUrl: process.env.PAYMENT_SUCCESS_URL || `${process.env.NEXT_PUBLIC_APP_URL}/subscription?success=true`,
    cancelUrl: process.env.PAYMENT_CANCEL_URL || `${process.env.NEXT_PUBLIC_APP_URL}/subscription?canceled=true`,
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

/**
 * Verify webhook signature (placeholder, ready for implementation)
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  provider: PaymentProvider
): Promise<boolean> {
  // TODO: Implement signature verification based on provider
  /*
  if (provider === "stripe") {
    // Stripe signature verification
    const stripe = require("stripe")(secret)
    try {
      stripe.webhooks.constructEvent(payload, signature, secret)
      return true
    } catch (err) {
      return false
    }
  } else if (provider === "yookassa") {
    // ЮKassa signature verification
    // Implementation depends on ЮKassa SDK
  }
  */
  
  // For now, return true (should be implemented before production)
  return true
}
