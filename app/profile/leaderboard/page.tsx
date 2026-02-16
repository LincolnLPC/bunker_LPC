"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Award, Trophy, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface LeaderboardEntry {
  rank: number
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  rating: number
  games_played: number
  games_won: number
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [list, setList] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setCurrentUserId(user.id)

      try {
        const res = await fetch("/api/leaderboard?limit=50")
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load")
        setList(data.leaderboard || [])
      } catch (e) {
        console.error("Leaderboard load error:", e)
        setList([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Таблица лидеров</span>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Рейтинг игроков
            </CardTitle>
            <CardDescription>
              Рейтинг начисляется за участие в играх (+5) и за победы (+20 за победу)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Пока ни у кого нет рейтинга. Сыграйте игры, чтобы попасть в таблицу!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground w-14">#</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Игрок</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Рейтинг</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Игр</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Побед</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`border-b border-border/50 ${
                          currentUserId === entry.id ? "bg-primary/10" : ""
                        }`}
                      >
                        <td className="py-3 px-2 font-mono text-muted-foreground">
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                        </td>
                        <td className="py-3 px-2">
                          <Link
                            href={`/profile/${entry.id}`}
                            className="flex items-center gap-2 hover:opacity-80"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={entry.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {(entry.display_name || entry.username)[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {entry.display_name || entry.username}
                              {currentUserId === entry.id && (
                                <span className="ml-1 text-xs text-muted-foreground">(вы)</span>
                              )}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-primary">
                          {entry.rating}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground hidden sm:table-cell">
                          {entry.games_played}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground hidden sm:table-cell">
                          {entry.games_won}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
