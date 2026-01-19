"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Flame, Trophy, Calendar, Users, Clock, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface GameHistoryItem {
  id: string
  room_code: string
  catastrophe: string
  bunker_description: string
  current_round: number
  max_players: number
  created_at: string
  phase: string
  players_count?: number
  was_winner?: boolean
}

export default function GameHistoryPage() {
  const router = useRouter()
  const [games, setGames] = useState<GameHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadHistory = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      try {
        // First, get all finished game rooms where user participated
        const { data: playerGames, error: playerGamesError } = await supabase
          .from("game_players")
          .select("id, is_eliminated, room_id")
          .eq("user_id", user.id)

        if (playerGamesError) throw playerGamesError

        if (!playerGames || playerGames.length === 0) {
          setGames([])
          setLoading(false)
          return
        }

        // Get room IDs
        const roomIds = playerGames.map((pg) => pg.room_id)

        // Get finished games
        const { data: finishedRooms, error: roomsError } = await supabase
          .from("game_rooms")
          .select("id, room_code, catastrophe, bunker_description, current_round, max_players, created_at, phase")
          .in("id", roomIds)
          .eq("phase", "finished")
          .order("created_at", { ascending: false })
          .limit(50)

        if (roomsError) throw roomsError

        // Create a map of player data by room_id
        const playerMap = new Map<string, typeof playerGames[0]>()
        playerGames.forEach((pg) => {
          playerMap.set(pg.room_id, pg)
        })

        // Transform and enrich data
        const gamesData: GameHistoryItem[] = (finishedRooms || []).map((room: any) => {
          const playerData = playerMap.get(room.id)
          return {
            id: room.id,
            room_code: room.room_code,
            catastrophe: room.catastrophe,
            bunker_description: room.bunker_description,
            current_round: room.current_round,
            max_players: room.max_players,
            created_at: room.created_at,
            phase: room.phase,
            was_winner: playerData ? !playerData.is_eliminated : false,
          }
        })

        // Get player counts for each game
        const finishedRoomIds = gamesData.map((g) => g.id)
        if (finishedRoomIds.length > 0) {
          const { data: playerCounts } = await supabase
            .from("game_players")
            .select("room_id")
            .in("room_id", finishedRoomIds)

          const countsMap = new Map<string, number>()
          playerCounts?.forEach((pc) => {
            countsMap.set(pc.room_id, (countsMap.get(pc.room_id) || 0) + 1)
          })

          gamesData.forEach((game) => {
            game.players_count = countsMap.get(game.id) || 0
          })
        }

        setGames(gamesData)
      } catch (err) {
        console.error("Error loading game history:", err)
        setError(err instanceof Error ? err.message : "Не удалось загрузить историю игр")
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
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

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">История игр</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {error && (
          <Card className="mb-6 bg-destructive/10 border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {games.length === 0 && !error && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">История игр пуста</h3>
              <p className="text-muted-foreground mb-4">
                Вы еще не завершили ни одной игры. Создайте комнату и пригласите друзей!
              </p>
              <Link href="/lobby/create">
                <Button>Создать игру</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {games.length > 0 && (
          <div className="space-y-4">
            {games.map((game) => (
              <Card key={game.id} className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg font-mono">{game.room_code}</CardTitle>
                        {game.was_winner && (
                          <Badge variant="default" className="bg-primary">
                            <Trophy className="w-3 h-3 mr-1" />
                            Победа
                          </Badge>
                        )}
                        {!game.was_winner && (
                          <Badge variant="secondary">Исключен</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {new Date(game.created_at).toLocaleString("ru-RU", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Катастрофа</p>
                    <p className="text-foreground">{game.catastrophe}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Бункер</p>
                    <p className="text-sm text-foreground line-clamp-2">{game.bunker_description}</p>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>
                        {game.players_count || "?"} / {game.max_players} игроков
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>Раунд {game.current_round}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    <Link href={`/profile/history/${game.id}`}>
                      <Button variant="outline" className="w-full">
                        Просмотреть детали
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
