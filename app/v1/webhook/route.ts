import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getPaymentConfig, decodeOrderMetadata } from "@/lib/payment/config"

/**
 * Yandex Pay webhook - receives ORDER_STATUS_UPDATED notifications
 * Callback URL in Yandex Pay console: https://your-domain.com (they append /v1/webhook)
 * Body: JWT token (application/octet-stream), signed with ES256
 */

interface YandexPayWebhookPayload {
  merchantId: string
  event: "ORDER_STATUS_UPDATED" | "OPERATION_STATUS_UPDATED"
  eventTime: string
  order?: {
    orderId: string
    paymentStatus: "PENDING" | "AUTHORIZED" | "CAPTURED" | "VOIDED" | "REFUNDED" | "FAILED" | "PARTIALLY_REFUNDED"
  }
}

export async function POST(request: NextRequest) {
  const paymentConfig = getPaymentConfig()

  try {
    if (paymentConfig.provider !== "yandex-pay") {
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    const body = await request.arrayBuffer()
    const jwtString = new TextDecoder().decode(body)

    if (!jwtString || jwtString.length < 10) {
      console.error("[YandexPay Webhook] Empty or invalid body")
      return NextResponse.json(
        { status: "fail", reasonCode: "UNAUTHORIZED", reason: "Invalid body" },
        { status: 400 }
      )
    }

    let payload: YandexPayWebhookPayload
    try {
      const parts = jwtString.split(".")
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format")
      }
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
      const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8")
      payload = JSON.parse(payloadJson) as YandexPayWebhookPayload
    } catch (parseErr) {
      console.error("[YandexPay Webhook] Failed to decode JWT:", parseErr)
      return NextResponse.json(
        { status: "fail", reasonCode: "UNAUTHORIZED", reason: "Invalid JWT" },
        { status: 400 }
      )
    }

    if (payload.event !== "ORDER_STATUS_UPDATED" || !payload.order) {
      console.log("[YandexPay Webhook] Ignoring event:", payload.event)
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    const { orderId, paymentStatus } = payload.order

    if (paymentStatus !== "CAPTURED") {
      console.log("[YandexPay Webhook] Order not captured:", orderId, paymentStatus)
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    const meta = decodeOrderMetadata(orderId)
    if (!meta) {
      console.error("[YandexPay Webhook] Cannot decode orderId:", orderId)
      return NextResponse.json(
        { status: "fail", reasonCode: "ORDER_NOT_FOUND", reason: "Unknown order format" },
        { status: 400 }
      )
    }

    const { userId, planId, expiresAt } = meta
    console.log("[YandexPay Webhook] Processing CAPTURED:", { orderId, userId, planId })

    const serviceClient = createServiceRoleClient()
    const { error } = await serviceClient
      .from("profiles")
      .update({
        subscription_tier: "premium",
        premium_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (error) {
      console.error("[YandexPay Webhook] Update failed:", error)
      return NextResponse.json(
        { status: "fail", reasonCode: "OTHER", reason: error.message },
        { status: 500 }
      )
    }

    try {
      await serviceClient.rpc("check_and_award_achievement", {
        user_id_param: userId,
        achievement_code_param: "premium_subscriber",
      })
    } catch {
      // Non-critical
    }

    console.log("[YandexPay Webhook] Subscription updated for:", userId)
    return NextResponse.json({ status: "success" }, { status: 200 })
  } catch (error) {
    console.error("[YandexPay Webhook] Error:", error)
    return NextResponse.json(
      { status: "fail", reasonCode: "OTHER", reason: String(error) },
      { status: 500 }
    )
  }
}
