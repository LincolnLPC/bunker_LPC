import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getPaymentConfig,
  getPlanById,
  encodeOrderMetadata,
} from "@/lib/payment/config"
import type { SubscriptionPlan } from "@/lib/payment/config"
import { createHash, randomBytes } from "crypto"

/**
 * POST - Create Yandex Pay order for subscription upgrade
 * Returns payment URL to redirect user to Yandex Pay checkout
 */
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
    const { planId } = body

    if (!planId || typeof planId !== "string") {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }

    const paymentConfig = getPaymentConfig()

    if (paymentConfig.provider !== "yandex-pay") {
      return NextResponse.json(
        {
          error: "Payment provider not configured",
          message:
            "Yandex Pay is not configured. Set PAYMENT_PROVIDER=yandex-pay and YANDEX_PAY_API_KEY in environment.",
        },
        { status: 500 }
      )
    }

    if (!paymentConfig.apiKey || !paymentConfig.merchantId) {
      return NextResponse.json(
        {
          error: "Yandex Pay credentials not configured",
          message:
            "Set YANDEX_PAY_API_KEY and NEXT_PUBLIC_YANDEX_PAY_MERCHANT_ID in environment.",
        },
        { status: 500 }
      )
    }

    const plan = getPlanById(planId)
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
    }

    const expiresAt = new Date()
    if (plan.interval === "month") {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else if (plan.interval === "year") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }
    const expiresAtIso = expiresAt.toISOString()

    const orderId = encodeOrderMetadata(user.id, plan.id, expiresAtIso)

    const baseUrl = paymentConfig.sandbox
      ? "https://sandbox.pay.yandex.ru/api/merchant/v1"
      : "https://pay.yandex.ru/api/merchant/v1"

    const orderPayload = {
      orderId,
      currencyCode: plan.currency,
      availablePaymentMethods: ["CARD", "SPLIT"],
      fiscalContact: user.email || `user-${user.id.slice(0, 8)}@placeholder.local`,
      redirectUrls: {
        onSuccess: paymentConfig.successUrl!,
        onAbort: paymentConfig.cancelUrl!,
        onError: paymentConfig.cancelUrl!,
      },
      cart: {
        items: [
          {
            productId: plan.id,
            title: plan.name,
            quantity: { count: "1" },
            total: plan.price.toFixed(2),
            unitPrice: plan.price.toFixed(2),
            discountedUnitPrice: plan.price.toFixed(2),
            subtotal: plan.price.toFixed(2),
          },
        ],
        total: {
          amount: plan.price.toFixed(2),
        },
      },
      ttl: 1800,
      orderSource: "WEBSITE",
    }

    const requestId = createHash("sha256")
      .update(`${orderId}-${Date.now()}-${randomBytes(8).toString("hex")}`)
      .digest("hex")
      .slice(0, 32)

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Key ${paymentConfig.apiKey}`,
        "X-Request-Id": requestId,
        "X-Request-Timeout": "10000",
        "X-Request-Attempt": "0",
      },
      body: JSON.stringify(orderPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[CreatePaymentSession] Yandex Pay API error:", response.status, errorText)
      return NextResponse.json(
        {
          error: "Failed to create payment",
          message: `Yandex Pay API error: ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const paymentUrl = data.paymentUrl || data.payment_link || data.url

    if (!paymentUrl) {
      console.error("[CreatePaymentSession] No payment URL in response:", data)
      return NextResponse.json(
        {
          error: "Invalid payment response",
          message: "No payment URL in Yandex Pay response",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      orderId,
      url: paymentUrl,
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
