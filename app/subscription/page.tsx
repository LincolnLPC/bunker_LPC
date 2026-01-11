"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Crown, Check, X, Flame, Zap, Users, Settings, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface SubscriptionInfo {
  currentTier: "basic" | "premium"
  limits: {
    maxRoomsPerDay: number
    maxPlayersPerRoom: number
    canCreateCustomCharacteristics: boolean
    canUseAdvancedFeatures: boolean
    canCreateTemplates: boolean
    canExportGameData: boolean
  }
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    const loadSubscription = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUser(user)

      // Fetch subscription info
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single()

      if (error) {
        console.error("Error loading subscription:", error)
        setLoading(false)
        return
      }

      const tier = (profile?.subscription_tier || "basic") as "basic" | "premium"

      // Get limits for current tier
      const limits = {
        maxRoomsPerDay: tier === "premium" ? -1 : 3,
        maxPlayersPerRoom: tier === "premium" ? 20 : 12,
        canCreateCustomCharacteristics: tier === "premium",
        canUseAdvancedFeatures: tier === "premium",
        canCreateTemplates: tier === "premium",
        canExportGameData: tier === "premium",
      }

      setSubscriptionInfo({
        currentTier: tier,
        limits,
      })

      setLoading(false)
    }

    loadSubscription()
  }, [router])

  const handleUpgrade = async (planId: string = "premium_monthly") => {
    setUpgrading(true)
    
    try {
      // Check if payment provider is configured
      const paymentProvider = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "none"
      
      if (paymentProvider === "none") {
        // Payment provider not configured, show info message
        alert(
          "Интеграция с платежной системой находится в разработке.\n\n" +
          "Для активации платежей необходимо:\n" +
          "1. Настроить Stripe или ЮKassa\n" +
          "2. Добавить API ключи в .env.local\n" +
          "3. Настроить webhook endpoint\n\n" +
          "См. документацию в lib/payment/config.ts"
        )
        setUpgrading(false)
        return
      }

      // TODO: Create payment session and redirect to payment provider
      // For Stripe:
      // const response = await fetch("/api/payment/create-session", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ planId, userId: user.id }),
      // })
      // const { url } = await response.json()
      // window.location.href = url
      
      // For now, show message that payment integration is in progress
      alert(
        "Интеграция с платежной системой почти готова.\n\n" +
        "API endpoints созданы и готовы к подключению:\n" +
        "• /api/subscription - управление подписками\n" +
        "• /api/subscription/webhook - обработка платежей\n\n" +
        "Следующий шаг: подключить Stripe или ЮKassa SDK"
      )
    } catch (error) {
      console.error("Error initiating upgrade:", error)
      alert("Произошла ошибка при обработке запроса")
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Flame className="h-12 w-12 text-primary animate-pulse" />
      </div>
    )
  }

  const isPremium = subscriptionInfo?.currentTier === "premium"

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Подписка</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Current Subscription */}
        <Card className="mb-8 bg-card/50 border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Текущая подписка
                  <Badge variant={isPremium ? "default" : "secondary"}>
                    {isPremium ? (
                      <>
                        <Crown className="w-3 h-3 mr-1" />
                        Премиум
                      </>
                    ) : (
                      "Базовый"
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-2">
                  {isPremium
                    ? "У вас есть доступ ко всем функциям платформы"
                    : "Обновитесь до Премиум для расширенных возможностей"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Comparison Table */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Basic Plan */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">Базовый</CardTitle>
              <CardDescription>Бесплатно</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">До 3 комнат в день</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Комнаты до 12 игроков</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Основные функции игры</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Чат и голосование</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Создание шаблонов</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Экспорт данных</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="bg-gradient-to-br from-primary/20 to-primary/10 border-primary/50 relative">
            {isPremium && (
              <div className="absolute top-4 right-4">
                <Badge variant="default">Ваш план</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Премиум
              </CardTitle>
              <CardDescription>Расширенные возможности</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Безлимитное создание комнат</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Комнаты до 20 игроков</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Все функции Базового</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Создание и сохранение шаблонов</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Экспорт данных игр</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Приоритетная поддержка</span>
                </div>
              </div>
              {!isPremium && (
                <Button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="w-full mt-4 bg-primary hover:bg-primary/90"
                >
                  {upgrading ? "Обработка..." : "Обновить до Премиум"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feature Details */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Детали функций</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Создание комнат</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Базовый тариф: до 3 комнат в день, максимум 12 игроков в комнате. Премиум: безлимитное
                создание комнат, до 20 игроков в комнате.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Расширенные функции</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Премиум пользователи получают доступ к дополнительным инструментам для управления
                игрой, создания шаблонов и экспорта данных.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Шаблоны и экспорт</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-7">
                Сохраняйте настройки игр как шаблоны для быстрого создания похожих комнат. Экспортируйте
                результаты игр для анализа и статистики.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Note */}
        {!isPremium && (
          <Card className="mt-6 bg-primary/10 border-primary/50">
            <CardContent className="pt-6">
              <p className="text-sm text-center text-muted-foreground">
                💡 Интеграция с платежной системой находится в разработке. Следите за обновлениями!
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
