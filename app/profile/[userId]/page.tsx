"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Flame, ArrowLeft, Trophy, Calendar, Users, Crown, Loader2, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface ProfileData {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  subscription_tier: "basic" | "premium"
  games_played: number
  games_won: number
  created_at: string
}

function ProfileViewContent() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.userId as string | undefined

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setError("Не указан пользователь")
      setLoading(false)
      return
    }

    const loadProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      // Свой профиль — редирект на /profile
      if (user.id === userId) {
        router.replace("/profile")
        return
      }

      // Проверка прав админа
      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()

      if (!adminRole) {
        setError("Доступ запрещён. Просмотр чужих профилей доступен только администраторам.")
        setLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, subscription_tier, games_played, games_won, created_at")
        .eq("id", userId)
        .maybeSingle()

      if (profileError || !profileData) {
        setError(profileError?.message || "Профиль не найден")
      } else {
        setProfile(profileData as ProfileData)
      }

      setLoading(false)
    }

    loadProfile()
  }, [userId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка</CardTitle>
            <CardDescription>{error || "Профиль не найден"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin">
              <Button variant="outline">Вернуться в админ-панель</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const winRate = profile.games_played > 0 ? ((profile.games_won / profile.games_played) * 100).toFixed(1) : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Профиль пользователя</span>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <Card className="mb-6 bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                  {profile.display_name?.[0] || profile.username[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{profile.display_name || profile.username}</h1>
                  <Badge variant={profile.subscription_tier === "premium" ? "default" : "secondary"}>
                    {profile.subscription_tier === "premium" ? (
                      <>
                        <Crown className="w-3 h-3 mr-1" />
                        Премиум
                      </>
                    ) : (
                      "Базовый"
                    )}
                  </Badge>
                </div>
                <p className="text-muted-foreground">@{profile.username}</p>
                <p className="text-xs text-muted-foreground mt-2">ID: {profile.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Игр сыграно
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile.games_played}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Побед
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile.games_won}</div>
              <p className="text-sm text-muted-foreground mt-1">Процент побед: {winRate}%</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Аккаунт
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Создан: {new Date(profile.created_at).toLocaleDateString("ru-RU")}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Действия</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/admin">
              <Button variant="outline" className="w-full justify-start">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться в админ-панель
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function ProfileViewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ProfileViewContent />
    </Suspense>
  )
}
