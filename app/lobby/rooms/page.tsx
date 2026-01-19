"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Flame, Search, Users, Clock, AlertTriangle, Home, Loader2, RefreshCw } from "lucide-react"

interface RoomListItem {
  id: string
  roomCode: string
  hostId: string
  host: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  } | null
  maxPlayers: number
  currentPlayers: number
  availableSlots: number
  isFull: boolean
  catastrophe: string
  bunkerDescription: string
  phase: string
  currentRound: number
  roundTimerSeconds: number
  createdAt: string
  settings: any
}

export default function RoomsListPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<RoomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchCode, setSearchCode] = useState("")
  const [phaseFilter, setPhaseFilter] = useState<string>("all")
  const [maxPlayersFilter, setMaxPlayersFilter] = useState<string>("all")

  const loadRooms = async () => {
    setLoading(true)
    setError(null)

    try {
      // First, cleanup orphaned rooms (rooms without host)
      try {
        const cleanupResponse = await fetch("/api/game/cleanup", {
          method: "POST",
        })
        if (cleanupResponse.ok) {
          const cleanupData = await cleanupResponse.json()
          if (cleanupData.deletedCount > 0) {
            console.log(`[RoomsPage] Cleaned up ${cleanupData.deletedCount} orphaned rooms`)
          }
        }
      } catch (cleanupErr) {
        // Don't fail the whole request if cleanup fails
        console.error("[RoomsPage] Cleanup error (non-critical):", cleanupErr)
      }

      const params = new URLSearchParams()
      if (phaseFilter !== "all") {
        params.append("phase", phaseFilter)
      }
      if (maxPlayersFilter !== "all") {
        params.append("maxPlayers", maxPlayersFilter)
      }
      if (searchCode.trim()) {
        params.append("search", searchCode.trim())
      }

      const response = await fetch(`/api/game/list?${params.toString()}`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to load rooms")
      }

      const data = await response.json()
      setRooms(data.rooms || [])
    } catch (err) {
      console.error("Error loading rooms:", err)
      setError(err instanceof Error ? err.message : "Не удалось загрузить список комнат")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRooms()
  }, [phaseFilter, maxPlayersFilter])

  const handleJoin = async (roomCode: string) => {
    router.push(`/lobby/join?code=${roomCode}`)
  }

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      waiting: "Ожидание",
      playing: "Игра",
      voting: "Голосование",
      results: "Результаты",
      finished: "Завершена",
    }
    return labels[phase] || phase
  }

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      waiting: "bg-blue-500/20 text-blue-500 border-blue-500/50",
      playing: "bg-green-500/20 text-green-500 border-green-500/50",
      voting: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
      results: "bg-purple-500/20 text-purple-500 border-purple-500/50",
      finished: "bg-gray-500/20 text-gray-500 border-gray-500/50",
    }
    return colors[phase] || "bg-gray-500/20 text-gray-500 border-gray-500/50"
  }

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
          <span className="text-xl font-bold">Список комнат</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadRooms} disabled={loading}>
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <Card className="mb-6 bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Фильтры и поиск</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Поиск по коду</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Введите код комнаты..."
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        loadRooms()
                      }
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Phase Filter */}
              <div className="space-y-2">
                <Label>Фаза игры</Label>
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все фазы</SelectItem>
                    <SelectItem value="waiting">Ожидание</SelectItem>
                    <SelectItem value="playing">Игра</SelectItem>
                    <SelectItem value="voting">Голосование</SelectItem>
                    <SelectItem value="results">Результаты</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Max Players Filter */}
              <div className="space-y-2">
                <Label>Макс. игроков</Label>
                <Select value={maxPlayersFilter} onValueChange={setMaxPlayersFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Любое</SelectItem>
                    <SelectItem value="8">8 игроков</SelectItem>
                    <SelectItem value="12">12 игроков</SelectItem>
                    <SelectItem value="16">16 игроков</SelectItem>
                    <SelectItem value="20">20 игроков</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={loadRooms} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Найти комнаты
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Rooms List */}
        {loading && rooms.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Загрузка комнат...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="bg-destructive/10 border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Button onClick={loadRooms} className="mt-4" variant="outline">
                Попробовать снова
              </Button>
            </CardContent>
          </Card>
        ) : rooms.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Комнаты не найдены</h3>
              <p className="text-muted-foreground mb-4">
                Попробуйте изменить фильтры или создать новую комнату
              </p>
              <Link href="/lobby/create">
                <Button>Создать комнату</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card
                key={room.id}
                className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <CardTitle className="text-lg font-mono">{room.roomCode}</CardTitle>
                      <CardDescription className="mt-1">
                        Создано {new Date(room.createdAt).toLocaleString("ru-RU", { 
                          month: "short", 
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={getPhaseColor(room.phase)}>
                      {getPhaseLabel(room.phase)}
                    </Badge>
                  </div>
                  
                  {/* Host */}
                  {room.host && (
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={room.host.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {room.host.displayName?.[0] || room.host.username[0] || "H"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {room.host.displayName || room.host.username}
                      </span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Catastrophe */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">Катастрофа</p>
                    </div>
                    <p className="text-sm font-medium line-clamp-1">{room.catastrophe}</p>
                  </div>

                  {/* Bunker */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Home className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">Бункер</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {room.bunkerDescription}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {room.currentPlayers}/{room.maxPlayers}
                      </span>
                    </div>
                    {room.phase === "playing" || room.phase === "voting" ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Раунд {room.currentRound}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  {room.phase === "waiting" && !room.isFull ? (
                    <Button
                      onClick={() => handleJoin(room.roomCode)}
                      className="w-full mt-2"
                      size="sm"
                    >
                      Присоединиться
                    </Button>
                  ) : room.isFull ? (
                    <Button variant="outline" className="w-full mt-2" size="sm" disabled>
                      Комната заполнена
                    </Button>
                  ) : room.phase !== "waiting" ? (
                    <Button 
                      variant="outline" 
                      className="w-full mt-2" 
                      size="sm"
                      onClick={() => router.push(`/lobby/join?code=${room.roomCode}`)}
                    >
                      Присоединиться
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
