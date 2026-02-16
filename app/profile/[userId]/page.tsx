"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Flame, ArrowLeft, Trophy, Calendar, Users, Crown, Loader2, MessageSquare, UserPlus, Circle, Award, Mic } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { isUserOnline } from "@/lib/online"
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
  host_rating?: number | null
  last_seen_at?: string | null
  show_online_status?: boolean
  created_at: string
}

type FriendStatus = "none" | "pending" | "accepted" | "incoming"

function ProfileViewContent() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.userId as string | undefined

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("none")
  const [friendRequestId, setFriendRequestId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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

      if (user.id === userId) {
        router.replace("/profile")
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, subscription_tier, games_played, games_won, rating, host_rating, last_seen_at, show_online_status, created_at")
        .eq("id", userId)
        .maybeSingle()

      if (profileError || !profileData) {
        setError(profileError?.message || "Профиль не найден")
        setLoading(false)
        return
      }

      setProfile(profileData as ProfileData)

      const { data: friendsData } = await fetch("/api/friends").then((r) => r.json()).catch(() => ({ friends: [] }))
      const rel = (friendsData?.friends || []).find((f: any) => f.friend_user_id === userId)
      if (rel) {
        if (rel.status === "accepted") setFriendStatus("accepted")
        else if (rel.is_incoming_request) {
          setFriendStatus("incoming")
          setFriendRequestId(rel.id)
        }
        else setFriendStatus("pending")
      }

      setLoading(false)
    }

    loadProfile()
  }, [userId, router])

  const handleAddFriend = async () => {
    if (!userId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friend_id: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setFriendStatus("pending")
      } else {
        alert(data.error || "Ошибка")
      }
    } catch (e) {
      alert("Ошибка запроса")
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptFriend = async () => {
    if (!friendRequestId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", request_id: friendRequestId }),
      })
      if (res.ok) setFriendStatus("accepted")
      else {
        const data = await res.json()
        alert(data.error || "Ошибка")
      }
    } catch (e) {
      alert("Ошибка запроса")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeclineFriend = async () => {
    if (!friendRequestId || actionLoading) return
    setActionLoading(true)
    try {
      await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", request_id: friendRequestId }),
      })
      setFriendStatus("none")
      setFriendRequestId(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFriend = async () => {
    if (!userId || actionLoading) return
    if (!confirm("Удалить из друзей?")) return
    setActionLoading(true)
    try {
      await fetch(`/api/friends?friend_id=${encodeURIComponent(userId)}`, { method: "DELETE" })
      setFriendStatus("none")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
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
            <Link href="/lobby">
              <Button variant="outline">В лобби</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const winRate = profile.games_played > 0 ? ((profile.games_won / profile.games_played) * 100).toFixed(1) : 0
  const online = isUserOnline(profile.last_seen_at, profile.show_online_status !== false)

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/lobby">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <span className="text-xl font-bold">Профиль</span>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <Card className="mb-6 bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                    {profile.display_name?.[0] || profile.username[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                {profile.show_online_status !== false && (
                  <span
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                      online ? "bg-green-500" : "bg-muted-foreground/50"
                    }`}
                    title={online ? "В сети" : "Не в сети"}
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                  {profile.show_online_status !== false && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Circle className={`h-2 w-2 ${online ? "fill-green-500 text-green-500" : ""}`} />
                      {online ? "В сети" : "Не в сети"}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">@{profile.username}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link href={`/messages?with=${userId}`}>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Написать
                    </Button>
                  </Link>
                  {friendStatus === "none" && (
                    <Button variant="outline" size="sm" onClick={handleAddFriend} disabled={actionLoading}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      {actionLoading ? "..." : "Добавить в друзья"}
                    </Button>
                  )}
                  {friendStatus === "pending" && (
                    <Badge variant="secondary">Запрос отправлен</Badge>
                  )}
                  {friendStatus === "incoming" && (
                    <>
                      <Button size="sm" onClick={handleAcceptFriend} disabled={actionLoading}>
                        Принять
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDeclineFriend} disabled={actionLoading}>
                        Отклонить
                      </Button>
                    </>
                  )}
                  {friendStatus === "accepted" && (
                    <Button variant="outline" size="sm" onClick={handleRemoveFriend} disabled={actionLoading}>
                      В друзьях
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-primary flex-shrink-0" />
                <span>Рейтинг игрока</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile.rating ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary flex-shrink-0" />
                <span>Рейтинг ведущего</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile.host_rating ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                <span>Игр сыграно</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{profile.games_played}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
                <span>Побед</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start">
              <div className="text-3xl font-bold text-primary">{profile.games_won}</div>
              <p className="text-sm text-muted-foreground mt-1">Процент побед: {winRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary flex-shrink-0" />
                <span>Аккаунт</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Создан: {new Date(profile.created_at).toLocaleDateString("ru-RU")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements (all: earned and not earned) */}
        <AchievementsSection userId={userId} />

        <Link href="/lobby">
          <Button variant="outline" className="w-full justify-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            В лобби
          </Button>
        </Link>
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
