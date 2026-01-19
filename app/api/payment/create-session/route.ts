import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPaymentConfig, getPlanById, type SubscriptionPlan } from "@/lib/payment/config"

/**
 * POST - Create ЮKassa payment for subscription upgrade
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { planId } = body

    if (!planId || typeof planId !== "string") {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    // Get payment configuration
    const paymentConfig = getPaymentConfig()

    if (paymentConfig.provider !== "yookassa") {
      return NextResponse.json(
        {
          error: "Payment provider not configured",
          message: "ЮKassa is not configured. Please set PAYMENT_PROVIDER=yookassa and ЮKassa keys in environment variables.",
        },
        { status: 500 }
      )
    }

    if (!paymentConfig.secretKey || !paymentConfig.shopId) {
      return NextResponse.json(
        {
          error: "ЮKassa credentials not configured",
          message: "Please set PAYMENT_SECRET_KEY and PAYMENT_SHOP_ID in environment variables.",
        },
        { status: 500 }
      )
    }

    // Get plan details
    const plan = getPlanById(planId)
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
    }

    // Calculate expiration date based on plan interval
    const expiresAt = new Date()
    if (plan.interval === "month") {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else if (plan.interval === "year") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }

    // Create ЮKassa payment
    const yookassaApiUrl = "https://api.yookassa.ru/v3/payments"
    
    const paymentData = {
      amount: {
        value: plan.price.toFixed(2),
        currency: plan.currency,
      },
      confirmation: {
        type: "redirect",
        return_url: paymentConfig.successUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscription?success=true`,
      },
      capture: true,
      description: `${plan.name} - Премиум подписка на ${plan.interval === "month" ? "месяц" : "год"}`,
      metadata: {
        userId: user.id,
        planId: plan.id,
        planInterval: plan.interval,
        expiresAt: expiresAt.toISOString(),
      },
    }

    // Basic auth for ЮKassa: base64(shopId:secretKey)
    const credentials = Buffer.from(`${paymentConfig.shopId}:${paymentConfig.secretKey}`).toString("base64")

    const response = await fetch(yookassaApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": `${user.id}-${planId}-${Date.now()}`, // Уникальный ключ для предотвращения дублирования
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[CreatePaymentSession] ЮKassa API error:", response.status, errorText)
      return NextResponse.json(
        {
          error: "Failed to create payment",
          message: `ЮKassa API error: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const payment = await response.json()

    // ЮKassa возвращает объект с confirmation.url для редиректа
    if (!payment.confirmation?.confirmation_url) {
      return NextResponse.json(
        {
          error: "Invalid payment response",
          message: "No confirmation URL in payment response",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      url: payment.confirmation.confirmation_url,
    })
  } catch (error) {
    console.error("[CreatePaymentSession] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to create payment session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
