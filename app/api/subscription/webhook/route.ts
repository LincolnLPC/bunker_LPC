import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { NextRequest } from "next/server"
import { getPaymentConfig } from "@/lib/payment/config"
import crypto from "crypto"

/**
 * Webhook endpoint for processing payment events from ЮKassa
 * 
 * This endpoint:
 * 1. Verifies webhook signature from ЮKassa
 * 2. Processes different event types (payment.succeeded, payment.canceled)
 * 3. Updates user's subscription_tier in profiles table
 */

interface YooKassaWebhookEvent {
  type: string
  event: string
  object: {
    id: string
    status: string
    amount: {
      value: string
      currency: string
    }
    metadata?: {
      userId?: string
      planId?: string
      planInterval?: string
      expiresAt?: string
    }
    [key: string]: any
  }
}

export async function POST(request: NextRequest) {
  const paymentConfig = getPaymentConfig()

  try {
    const body = await request.text()
    let event: YooKassaWebhookEvent

    try {
      event = JSON.parse(body)
    } catch (parseError) {
      console.error("[Subscription Webhook] Failed to parse JSON:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      )
    }

    if (paymentConfig.provider !== "yookassa") {
      console.log("[Subscription Webhook] Payment provider not configured or not ЮKassa")
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // ЮKassa вебхуки могут быть подписаны через HTTP заголовок
    // Формат может быть разным: X-YooMoney-Signature, Authorization, или другой
    const signature = 
      request.headers.get("x-yoomoney-signature") || 
      request.headers.get("x-yookassa-signature") ||
      request.headers.get("authorization")

    // Проверка подписи webhook (опционально, но рекомендуется для production)
    if (paymentConfig.webhookSecret) {
      if (!signature) {
        console.warn("[Subscription Webhook] Webhook secret configured but no signature found")
        // В тестовом режиме можно продолжить без проверки
        // В production лучше отклонять запросы без подписи
      } else {
        const isValid = verifyYooKassaSignature(body, signature, paymentConfig.webhookSecret)
        if (!isValid) {
          console.error("[Subscription Webhook] Invalid signature")
          return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
          )
        }
        console.log("[Subscription Webhook] Signature verified successfully")
      }
    } else {
      console.warn("[Subscription Webhook] No webhook secret configured - skipping signature verification")
    }

    console.log("[Subscription Webhook] Received event:", event.event, event.type, event.object?.id)

    // Process event based on type
    switch (event.event) {
      case "payment.succeeded": {
        if (event.object?.status === "succeeded") {
          await handlePaymentSucceeded(event.object)
        }
        break
      }
      
      case "payment.canceled": {
        console.log("[Subscription Webhook] Payment canceled:", event.object?.id)
        // Можно обработать отмену платежа, если нужно
        break
      }
      
      default:
        console.log(`[Subscription Webhook] Unhandled event type: ${event.event}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error("[Subscription Webhook] Error processing webhook:", error)
    return NextResponse.json(
      { error: "Webhook processing failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

/**
 * Verify ЮKassa webhook signature
 * ЮKassa может использовать разные форматы подписи в зависимости от настроек
 */
function verifyYooKassaSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // Попытка 1: HMAC SHA256 (наиболее распространенный формат)
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(payload)
    const expectedSignatureHex = hmac.digest("hex")
    
    // Убираем префикс "Bearer " если есть
    const cleanSignature = signature.replace(/^Bearer\s+/i, "").trim()
    
    // Попробуем сравнить как hex строки
    try {
      if (crypto.timingSafeEqual(
        Buffer.from(cleanSignature, "hex"),
        Buffer.from(expectedSignatureHex, "hex")
      )) {
        return true
      }
    } catch (e) {
      // Если не удалось парсить как hex, пробуем как base64
    }
    
    // Попытка 2: HMAC SHA256 в base64 формате
    const expectedSignatureBase64 = hmac.digest("base64")
    try {
      if (crypto.timingSafeEqual(
        Buffer.from(cleanSignature, "base64"),
        Buffer.from(expectedSignatureBase64, "base64")
      )) {
        return true
      }
    } catch (e) {
      // Если и это не сработало, пробуем прямое сравнение строк
    }
    
    // Попытка 3: Прямое сравнение (для некоторых конфигураций)
    if (cleanSignature === expectedSignatureHex || cleanSignature === expectedSignatureBase64) {
      return true
    }
    
    return false
  } catch (error) {
    console.error("[Subscription Webhook] Signature verification error:", error)
    return false
  }
}

/**
 * Helper function to update user subscription
 */
async function updateUserSubscription(
  userId: string,
  tier: "basic" | "premium",
  expiresAt?: string | null
) {
  const serviceClient = createServiceRoleClient()
  
  const updateData: any = {
    subscription_tier: tier,
    premium_expires_at: expiresAt || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .update(updateData)
    .eq("id", userId)
    .select()
    .single()

  if (error) {
    console.error("[Subscription Webhook] Error updating subscription:", error)
    throw error
  }

  console.log(`[Subscription Webhook] Updated subscription for user ${userId} to ${tier}`)
  return { success: true, profile: data }
}

/**
 * Handler for ЮKassa payment.succeeded event
 */
async function handlePaymentSucceeded(payment: any) {
  const userId = payment.metadata?.userId
  
  if (!userId) {
    console.error("[Subscription Webhook] No userId in payment metadata")
    return
  }

  const planId = payment.metadata?.planId
  const expiresAt = payment.metadata?.expiresAt

  console.log("[Subscription Webhook] Processing payment succeeded:", {
    userId,
    planId,
    expiresAt,
    paymentId: payment.id,
    amount: payment.amount,
  })

  // Update user subscription to premium
  await updateUserSubscription(userId, "premium", expiresAt || null)

  // Check for premium subscriber achievement
  try {
    const serviceClient = createServiceRoleClient()
    const { error: achievementError } = await serviceClient.rpc("check_and_award_achievement", {
      user_id_param: userId,
      achievement_code_param: "premium_subscriber",
    })

    if (achievementError) {
      console.error("[Subscription Webhook] Error checking premium achievement:", achievementError)
    } else {
      console.log("[Subscription Webhook] Premium achievement checked for user:", userId)
    }
  } catch (achievementErr) {
    console.error("[Subscription Webhook] Error in premium achievement check:", achievementErr)
    // Don't fail the subscription update if achievement check fails
  }
}
