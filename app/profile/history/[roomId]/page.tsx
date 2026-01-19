"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  Flame,
  Trophy,
  Skull,
  Users,
  Clock,
  Loader2,
  Download,
  Calendar,
  User,
  Shield,
  MessageSquare,
} from "lucide-react"
import { safeFetch } from "@/lib/api/safe-fetch"

interface GameDetails {
  game: {
    id: string
    roomCode: string
    hostId: string
    host: {
      id: string
      username: string
      displayName: string
      avatarUrl: string | null
    } | null
    catastrophe: string
    bunkerDescription: string
    maxPlayers: number
    phase: string
    currentRound: number
    roundTimerSeconds: number
    settings: any
    createdAt: string
    updatedAt: string
  }
  players: Array<{
    id: string
    slot: number
    name: string
    userId: string
    username: string
    displayName: string
    avatarUrl: string | null
    gender: string
    age: number
    profession: string
    isEliminated: boolean
    isHost: boolean
    characteristics: Array<{
      id: string
      category: string
      name: string
      value: string
      isRevealed: boolean
      revealRound: number | null
    }>
  }>
  survivors: typeof players
  eliminated: typeof players
  votes: Array<{
    id: string
    round: number
    voter_id: string
    target_id: string
    created_at: string
  }>
  votesByRound: Record<number, typeof votes>
  chatMessages: Array<{
    id: string
    message: string
    message_type: string
    created_at: string
    player_id: string | null
  }>
  statistics: {
    totalPlayers: number
    survivorsCount: number
    eliminatedCount: number
    survivalRate: number
    totalRounds: number
    totalVotes: number
    totalMessages: number
  }
}

export default function GameDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params?.roomId as string
  const [gameDetails, setGameDetails] = useState<GameDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return

    const loadGameDetails = async () => {
      try {
        const { data, error: fetchError } = await safeFetch<GameDetails>(
          `/api/game/${roomId}/details`
        )

        if (fetchError || !data) {
          setError(fetchError?.message || "Не удалось загрузить детали игры")
          return
        }

        setGameDetails(data)
      } catch (err) {
        console.error("Error loading game details:", err)
        setError("Произошла ошибка при загрузке деталей игры")
      } finally {
        setLoading(false)
      }
    }

    loadGameDetails()
  }, [roomId])

  const handleExportJSON = () => {
    if (!gameDetails) return

    const exportData = {
      game: gameDetails.game,
      players: gameDetails.players,
      statistics: gameDetails.statistics,
      votes: gameDetails.votes,
      chatMessages: gameDetails.chatMessages,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `game-${gameDetails.game.roomCode}-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    if (!gameDetails) return

    // Create CSV content
    const headers = ["Игрок", "Статус", "Пол", "Возраст", "Профессия", "Характеристики"]
    const rows = gameDetails.players.map((player) => {
      const status = player.isEliminated ? "Исключен" : "Выжил"
      const characteristics = player.characteristics
        .filter((c) => c.isRevealed)
        .map((c) => `${c.name}: ${c.value}`)
        .join("; ")

      return [
        player.displayName,
        status,
        player.gender,
        player.age.toString(),
        player.profession,
        characteristics || "-",
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }) // BOM for Excel
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `game-${gameDetails.game.roomCode}-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    )
  }

  if (error || !gameDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="bg-card/50 border-border/50 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error || "Игра не найдена"}</p>
            <Link href="/profile/history">
              <Button variant="outline">Вернуться к истории</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      gender: "Пол",
      age: "Возраст",
      profession: "Профессия",
      health: "Здоровье",
      hobby: "Хобби",
      phobia: "Фобия",
      baggage: "Багаж",
      fact: "Факт",
      special: "Особое",
      bio: "Биология",
      skill: "Навык",
      trait: "Черта",
      additional: "Доп.",
    }
    return labels[category] || category
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Link href="/profile/history">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Детали игры</span>
            <Badge variant="secondary" className="font-mono">
              {gameDetails.game.roomCode}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportJSON}>
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Game Info */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Информация об игре</CardTitle>
              <CardDescription>
                {new Date(gameDetails.game.createdAt).toLocaleString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Катастрофа</p>
                <p className="text-lg font-medium">{gameDetails.game.catastrophe}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Описание бункера</p>
                <p className="text-foreground">{gameDetails.game.bunkerDescription}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Хост</p>
                  <p className="font-medium">
                    {gameDetails.game.host?.displayName || gameDetails.game.host?.username || "Неизвестно"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Игроков</p>
                  <p className="font-medium">
                    {gameDetails.statistics.totalPlayers} / {gameDetails.game.maxPlayers}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Раундов</p>
                  <p className="font-medium">{gameDetails.statistics.totalRounds}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Выживаемость</p>
                  <p className="font-medium text-primary">{gameDetails.statistics.survivalRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{gameDetails.statistics.totalPlayers}</p>
                <p className="text-xs text-muted-foreground">Всего игроков</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-green-500/30">
              <CardContent className="pt-6 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-2 text-green-400" />
                <p className="text-2xl font-bold text-green-400">{gameDetails.statistics.survivorsCount}</p>
                <p className="text-xs text-muted-foreground">Выжили</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-destructive/30">
              <CardContent className="pt-6 text-center">
                <Skull className="w-6 h-6 mx-auto mb-2 text-destructive" />
                <p className="text-2xl font-bold text-destructive">{gameDetails.statistics.eliminatedCount}</p>
                <p className="text-xs text-muted-foreground">Изгнаны</p>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6 text-center">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{gameDetails.statistics.totalMessages}</p>
                <p className="text-xs text-muted-foreground">Сообщений</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="players" className="w-full">
            <TabsList>
              <TabsTrigger value="players">Игроки</TabsTrigger>
              <TabsTrigger value="votes">Голосования</TabsTrigger>
              <TabsTrigger value="chat">Чат</TabsTrigger>
            </TabsList>

            {/* Players Tab */}
            <TabsContent value="players" className="space-y-4">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Выжившие</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {gameDetails.survivors.map((player) => (
                      <Card key={player.id} className="bg-green-950/20 border-green-500/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Trophy className="w-4 h-4 text-green-400" />
                                <p className="font-semibold">{player.displayName}</p>
                                {player.isHost && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Хост
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                {player.gender}, {player.age} лет • {player.profession}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {player.characteristics
                                  .filter((c) => c.isRevealed)
                                  .map((char) => (
                                    <Badge key={char.id} variant="outline" className="text-xs">
                                      {getCategoryLabel(char.category)}: {char.value}
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {gameDetails.eliminated.length > 0 && (
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle>Изгнанные</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {gameDetails.eliminated.map((player) => (
                        <Card key={player.id} className="bg-destructive/10 border-destructive/30 opacity-75">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Skull className="w-4 h-4 text-destructive" />
                                  <p className="font-semibold line-through">{player.displayName}</p>
                                  {player.isHost && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Shield className="w-3 h-3 mr-1" />
                                      Хост
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground mb-2">
                                  {player.gender}, {player.age} лет • {player.profession}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {player.characteristics
                                    .filter((c) => c.isRevealed)
                                    .map((char) => (
                                      <Badge key={char.id} variant="outline" className="text-xs">
                                        {getCategoryLabel(char.category)}: {char.value}
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Votes Tab */}
            <TabsContent value="votes">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>История голосований</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {Object.entries(gameDetails.votesByRound)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([round, roundVotes]) => {
                          // Count votes per target
                          const voteCounts = new Map<string, number>()
                          roundVotes.forEach((vote) => {
                            voteCounts.set(vote.target_id, (voteCounts.get(vote.target_id) || 0) + 1)
                          })

                          // Find eliminated player
                          const eliminatedPlayer = gameDetails.eliminated.find(
                            (p) => p.id === roundVotes[0]?.target_id
                          )

                          return (
                            <Card key={round} className="bg-card/30 border-border/50">
                              <CardHeader>
                                <CardTitle className="text-lg">Раунд {round}</CardTitle>
                                {eliminatedPlayer && (
                                  <CardDescription>
                                    Исключен: <span className="font-semibold">{eliminatedPlayer.displayName}</span>
                                  </CardDescription>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {Array.from(voteCounts.entries())
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([targetId, count]) => {
                                      const player = gameDetails.players.find((p) => p.id === targetId)
                                      return (
                                        <div key={targetId} className="flex items-center justify-between text-sm">
                                          <span>{player?.displayName || "Неизвестно"}</span>
                                          <Badge variant="secondary">{count} голосов</Badge>
                                        </div>
                                      )
                                    })}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      {Object.keys(gameDetails.votesByRound).length === 0 && (
                        <p className="text-center text-muted-foreground py-8">Голосований не было</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>История чата</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-2">
                      {gameDetails.chatMessages.map((msg) => {
                        const player = gameDetails.players.find((p) => p.id === msg.player_id)
                        const isSystem = msg.message_type === "system"

                        return (
                          <div
                            key={msg.id}
                            className={`p-2 rounded ${
                              isSystem
                                ? "bg-muted/50 text-muted-foreground text-xs italic"
                                : "bg-card/30 border border-border/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {!isSystem && player && (
                                <span className="font-semibold text-sm">{player.displayName}</span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        )
                      })}
                      {gameDetails.chatMessages.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">Сообщений нет</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
