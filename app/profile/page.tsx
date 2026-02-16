"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Flame, ArrowLeft, Edit, Trophy, Calendar, Users, LogOut, Crown, Loader2, Award, MessageSquare, UserPlus, Circle, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { AchievementsSection } from "@/components/profile/achievements-section"

interface ProfileData {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  subscription_tier: "basic" | "premium"
  games_played: number
  games_won: number
  rating?: number | null
  created_at: string
  media_settings?: {
    autoRequestCamera?: boolean
    autoRequestMicrophone?: boolean
    defaultCameraEnabled?: boolean
    defaultMicrophoneEnabled?: boolean
  }
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [friends, setFriends] = useState<{ friend_user_id: string; display_name: string | null; username: string; avatar_url: string | null; last_seen_at: string | null; show_online_status: boolean }[]>([])
  const [friendEmail, setFriendEmail] = useState("")
  const [addByEmailLoading, setAddByEmailLoading] = useState(false)
  const [addByEmailError, setAddByEmailError] = useState<string | null>(null)
  const [addByEmailSuccess, setAddByEmailSuccess] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUser(user)

      // Загрузить профиль из БД (используем maybeSingle чтобы не было ошибки если профиль не найден)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      // Если профиль найден, используем его
      if (profileData && !profileError) {
        setProfile(profileData as ProfileData)
        const friendsRes = await fetch("/api/friends?status=accepted")
        const friendsData = await friendsRes.json()
        if (friendsData.friends) setFriends(friendsData.friends)
        setLoading(false)
        return
      }

      // Если профиль не найден (не ошибка, а просто отсутствие), создаем его
      if (!profileData && (!profileError || profileError.code === "PGRST116")) {
        // Если профиль не существует, создать его через API endpoint
        console.log("Profile not found, attempting to create...", { userId: user.id, error: profileError })
        try {
          const response = await fetch("/api/profile/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })

          const responseData = await response.json()

          if (!response.ok) {
            console.error("API error response:", responseData)
            throw new Error(
              responseData.error || responseData.details || "Failed to create profile"
            )
          }

          if (responseData.profile) {
            console.log("Profile created successfully:", responseData.profile)
            setProfile(responseData.profile as ProfileData)
            const friendsRes = await fetch("/api/friends?status=accepted")
            const friendsData = await friendsRes.json()
            if (friendsData.friends) setFriends(friendsData.friends)
          } else {
            throw new Error("Profile was not returned from API")
          }
        } catch (createErr) {
          console.error("Error creating profile:", createErr)
          const errorMessage =
            createErr instanceof Error
              ? createErr.message
              : "Не удалось создать профиль. Попробуйте позже."
          
          setError(
            errorMessage.includes("Failed to create profile after multiple attempts")
              ? "Не удалось создать профиль. Возможно, профиль уже существует. Попробуйте обновить страницу."
              : `Не удалось создать профиль: ${errorMessage}`
          )
          setLoading(false)
          return
        }
      } else {
        setProfile(profileData as ProfileData)
        const friendsRes = await fetch("/api/friends?status=accepted")
        const friendsData = await friendsRes.json()
        if (friendsData.friends) setFriends(friendsData.friends)
      }

      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Flame className="h-12 w-12 text-primary animate-pulse" />
      </div>
    )
  }

  if (error || (!profile && !loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка создания профиля</CardTitle>
            <CardDescription>{error || "Профиль не найден"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Возможные причины:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Не выполнен SQL скрипт для создания триггера</li>
                <li>Проблемы с правами доступа (RLS policies)</li>
                <li>Имя пользователя уже занято</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} variant="outline">
                Попробовать снова
              </Button>
              <Button onClick={() => router.push("/lobby")}>Вернуться в лобби</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const winRate = profile.games_played > 0 ? ((profile.games_won / profile.games_played) * 100).toFixed(1) : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/lobby">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Профиль</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Profile Header */}
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
                <p className="text-muted-foreground mb-4">@{profile.username}</p>
                <Link href={`/profile/edit${searchParams.get("returnTo") ? `?returnTo=${encodeURIComponent(searchParams.get("returnTo")!)}` : ""}`}>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Редактировать профиль
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Рейтинг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile.rating ?? 0}</div>
              <Link href="/profile/leaderboard" className="text-sm text-primary hover:underline mt-1 inline-block">
                Таблица лидеров
              </Link>
            </CardContent>
          </Card>
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

        {/* Subscription Section */}
        {profile.subscription_tier === "basic" && (
          <Card className="bg-gradient-to-r from-primary/20 to-primary/10 border-primary/50 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Премиум подписка
              </CardTitle>
              <CardDescription>Разблокируйте все возможности игры</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Создание игр
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Полный контроль характеристик
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Расширенные инструменты ведущего
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Эксклюзивные наборы карт
                </li>
              </ul>
              <Link href="/subscription">
                <Button className="w-full bg-primary hover:bg-primary/90">
                  Обновить до Премиум
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Achievements */}
        <AchievementsSection />

        {/* Game History */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>История игр</CardTitle>
            <CardDescription>Просмотр завершенных игр и статистики</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/profile/history">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                Просмотреть историю игр
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Friends */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Друзья
                </CardTitle>
                <CardDescription>Список друзей и личные сообщения</CardDescription>
              </div>
              <Link href="/messages">
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Сообщения
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex gap-2">
                <Input
                  type="email"
                  placeholder="Email друга"
                  value={friendEmail}
                  onChange={(e) => {
                    setFriendEmail(e.target.value)
                    setAddByEmailError(null)
                    setAddByEmailSuccess(false)
                  }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={addByEmailLoading || !friendEmail.trim()}
                  onClick={async () => {
                    setAddByEmailError(null)
                    setAddByEmailSuccess(false)
                    setAddByEmailLoading(true)
                    try {
                      const res = await fetch("/api/friends/add-by-email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: friendEmail.trim() }),
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setAddByEmailSuccess(true)
                        setFriendEmail("")
                        const fr = await fetch("/api/friends?status=accepted")
                        const fd = await fr.json()
                        if (fd.friends) setFriends(fd.friends)
                      } else {
                        setAddByEmailError(data.error || "Ошибка")
                      }
                    } catch {
                      setAddByEmailError("Ошибка запроса")
                    } finally {
                      setAddByEmailLoading(false)
                    }
                  }}
                >
                  {addByEmailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                  Добавить по email
                </Button>
              </div>
            </div>
            {addByEmailError && <p className="text-sm text-destructive">{addByEmailError}</p>}
            {addByEmailSuccess && <p className="text-sm text-green-600">Запрос в друзья отправлен.</p>}
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Пока нет друзей. Добавляйте игроков в друзья с их страницы профиля.
              </p>
            ) : (
              <ul className="space-y-2">
                {friends.map((f) => {
                  const online = f.show_online_status && f.last_seen_at
                    ? (Date.now() - new Date(f.last_seen_at).getTime() < 5 * 60 * 1000)
                    : false
                  return (
                    <li key={f.friend_user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <Link href={`/profile/${f.friend_user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={f.avatar_url || undefined} />
                          <AvatarFallback>{(f.display_name || f.username)[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">{f.display_name || f.username}</span>
                        {f.show_online_status && (
                          <span className={`text-xs ${online ? "text-green-600" : "text-muted-foreground"}`}>
                            <Circle className={`inline h-2 w-2 mr-0.5 ${online ? "fill-green-500" : ""}`} />
                            {online ? "в сети" : "не в сети"}
                          </span>
                        )}
                      </Link>
                      <Link href={`/messages?with=${f.friend_user_id}`}>
                        <Button variant="ghost" size="sm">Написать</Button>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Настройки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href={`/profile/edit${searchParams.get("returnTo") ? `?returnTo=${encodeURIComponent(searchParams.get("returnTo")!)}` : ""}`}>
              <Button variant="outline" className="w-full justify-start">
                <Edit className="w-4 h-4 mr-2" />
                Редактировать профиль и настройки медиа
              </Button>
            </Link>
            {profile.media_settings && (
              <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p>
                  Камера: {profile.media_settings.autoRequestCamera ? "автозапрос" : "ручной"} /{" "}
                  {profile.media_settings.defaultCameraEnabled ? "включена по умолчанию" : "выключена по умолчанию"}
                </p>
                <p>
                  Микрофон: {profile.media_settings.autoRequestMicrophone ? "автозапрос" : "ручной"} /{" "}
                  {profile.media_settings.defaultMicrophoneEnabled ? "включен по умолчанию" : "выключен по умолчанию"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/lobby">
              <Button variant="outline" className="w-full justify-start">
                Вернуться в лобби
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Выйти из аккаунта
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  )
}
