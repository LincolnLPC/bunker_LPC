"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shuffle, RefreshCw, X, Skull, Vote, ArrowLeftRight, UserX, Ban, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Player, Characteristic } from "@/types/game"
import {
  SAMPLE_HEALTH_CONDITIONS,
  SAMPLE_HOBBIES,
  SAMPLE_PHOBIAS,
  SAMPLE_BAGGAGE,
  SAMPLE_FACTS,
  SAMPLE_SPECIAL,
  SAMPLE_BIO,
  SAMPLE_SKILLS,
  SAMPLE_TRAITS,
} from "@/types/game"

interface CharacteristicsManagerProps {
  isOpen: boolean
  onClose: () => void
  players: Player[]
  currentPlayerId: string
  onUpdateCharacteristic: (playerId: string, characteristicId: string, newValue: string) => Promise<void>
  onExchangeCharacteristics: (
    playerId1: string,
    charId1: string,
    playerId2: string,
    charId2: string,
  ) => Promise<void>
  onRandomizeCharacteristic: (playerId: string, characteristicId: string) => Promise<void>
  roomId?: string
  currentRound?: number
  currentPhase?: "waiting" | "playing" | "voting" | "results" | "finished"
  roundMode?: "manual" | "automatic"
  onEliminatePlayer?: (playerId: string) => void
  onKickPlayer?: (playerId: string) => Promise<void>
  onBanPlayer?: (userId: string) => Promise<void>
  onUnbanPlayer?: (userId: string) => Promise<void>
}

const CATEGORY_OPTIONS: Record<string, string[]> = {
  health: SAMPLE_HEALTH_CONDITIONS,
  hobby: SAMPLE_HOBBIES,
  phobia: SAMPLE_PHOBIAS,
  baggage: SAMPLE_BAGGAGE,
  fact: SAMPLE_FACTS,
  special: SAMPLE_SPECIAL,
  bio: SAMPLE_BIO,
  skill: SAMPLE_SKILLS,
  trait: SAMPLE_TRAITS,
}

export function CharacteristicsManager({
  isOpen,
  onClose,
  players,
  currentPlayerId,
  onUpdateCharacteristic,
  onExchangeCharacteristics,
  onRandomizeCharacteristic,
  roomId,
  currentRound,
  currentPhase,
  roundMode = "automatic",
  onEliminatePlayer,
  onKickPlayer,
  onBanPlayer,
  onUnbanPlayer,
}: CharacteristicsManagerProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedChar, setSelectedChar] = useState<Characteristic | null>(null)
  const [newValue, setNewValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedForElimination, setSelectedForElimination] = useState<string | null>(null)
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState("characteristics")
  // Exchange tab state
  const [exchangePlayer1, setExchangePlayer1] = useState<Player | null>(null)
  const [bannedUsers, setBannedUsers] = useState<Array<{ userId: string; userName: string }>>([])
  const [bannedLoading, setBannedLoading] = useState(false)
  const [exchangePlayer2, setExchangePlayer2] = useState<Player | null>(null)
  const [exchangeCategory, setExchangeCategory] = useState<string | null>(null)

  // Stabilize values for useEffect dependencies
  const stableRoundMode = roundMode || "automatic"
  const stableCurrentPhase = currentPhase || "waiting"

  // Reset tab when panel opens/closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("characteristics")
      return
    }
    // Always default to characteristics tab when opening
    // User can manually switch to elimination tab if needed
    setActiveTab("characteristics")
  }, [isOpen])

  // Fetch banned users when players tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== "players" || !roomId) return
    setBannedLoading(true)
    fetch(`/api/game/room/banned?roomId=${roomId}`)
      .then((r) => r.json())
      .then((data) => setBannedUsers(data.banned || []))
      .catch(() => setBannedUsers([]))
      .finally(() => setBannedLoading(false))
  }, [isOpen, activeTab, roomId])

  // Update selectedPlayer when players prop changes (for real-time updates)
  useEffect(() => {
    if (!selectedPlayer) return
    
    const updatedPlayer = players.find(p => p.id === selectedPlayer.id)
    if (!updatedPlayer) return
    
    // Update selectedPlayer with fresh data
    setSelectedPlayer(updatedPlayer)
    
    // Update selectedChar if it still exists
    if (selectedChar) {
      const updatedChar = updatedPlayer.characteristics.find(c => c.id === selectedChar.id)
      if (updatedChar && updatedChar.value !== selectedChar.value) {
        setSelectedChar(updatedChar)
        setNewValue(updatedChar.value)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players])

  const handleRandomize = async () => {
    if (!selectedPlayer || !selectedChar) return

    setLoading(true)
    try {
      await onRandomizeCharacteristic(selectedPlayer.id, selectedChar.id)
      setSelectedChar(null)
      setNewValue("")
    } catch (error) {
      console.error("Error randomizing characteristic:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedPlayer || !selectedChar || !newValue.trim()) return

    setLoading(true)
    try {
      await onUpdateCharacteristic(selectedPlayer.id, selectedChar.id, newValue.trim())
      setSelectedChar(null)
      setNewValue("")
    } catch (error) {
      console.error("Error updating characteristic:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryOptions = (category: string): string[] => {
    const options = CATEGORY_OPTIONS[category] || []
    // Remove duplicates by converting to Set and back to array
    return Array.from(new Set(options))
  }

  // Fetch vote counts for elimination tab (fetch when panel is open and in voting phase)
  useEffect(() => {
    if (roomId && currentRound !== undefined && stableCurrentPhase === "voting") {
      const fetchVoteCounts = async () => {
        try {
          const supabase = createClient()
          const { data: votes, error } = await supabase
            .from("votes")
            .select("target_id, vote_weight")
            .eq("room_id", roomId)
            .eq("round", currentRound)

          if (!error && votes) {
            const counts: Record<string, number> = {}
            for (const vote of votes) {
              const weight = vote.vote_weight || 1
              counts[vote.target_id] = (counts[vote.target_id] || 0) + weight
            }
            setVoteCounts(counts)
          }
        } catch (err) {
          console.error("Error fetching vote counts:", err)
        }
      }

      fetchVoteCounts()
      // Auto-refresh every 2 seconds as fallback
      const interval = setInterval(fetchVoteCounts, 2000)
      
      // Subscribe to realtime updates for votes
      const supabase = createClient()
      const channel = supabase
        .channel(`votes_elimination:${roomId}:${currentRound}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "votes",
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            // Refresh vote counts when votes change
            fetchVoteCounts()
          }
        )
        .subscribe()

      return () => {
        clearInterval(interval)
        if (channel) {
          supabase.removeChannel(channel)
        }
      }
    }
  }, [roomId, currentRound, stableCurrentPhase, stableRoundMode])

  const eligiblePlayers = players.filter((p) => !p.isEliminated)

  const handleEliminate = async () => {
    if (!selectedForElimination || !onEliminatePlayer) return
    await onEliminatePlayer(selectedForElimination)
    setSelectedForElimination(null)
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
      trait: "Черта характера",
      additional: "Дополнительно",
    }
    return labels[category] || category
  }

  const handleExchange = async () => {
    if (!exchangePlayer1 || !exchangePlayer2 || !exchangeCategory) return
    if (exchangePlayer1.id === exchangePlayer2.id) return
    
    // Find characteristics of the selected category for each player
    const char1 = exchangePlayer1.characteristics.find((c) => c.category === exchangeCategory)
    const char2 = exchangePlayer2.characteristics.find((c) => c.category === exchangeCategory)
    
    if (!char1 || !char2) {
      console.error("Characteristic not found for selected category")
      return
    }
    
    setLoading(true)
    try {
      await onExchangeCharacteristics(
        exchangePlayer1.id,
        char1.id,
        exchangePlayer2.id,
        char2.id,
      )
      // Reset selections
      setExchangePlayer1(null)
      setExchangePlayer2(null)
      setExchangeCategory(null)
    } catch (error) {
      console.error("Error exchanging characteristics:", error)
    } finally {
      setLoading(false)
    }
  }

  // Get available categories (categories that exist in both selected players)
  const getAvailableCategories = (): string[] => {
    if (!exchangePlayer1 || !exchangePlayer2) return []
    
    const categories1 = new Set(exchangePlayer1.characteristics.map((c) => c.category))
    const categories2 = new Set(exchangePlayer2.characteristics.map((c) => c.category))
    
    // Return categories that exist in both players
    return Array.from(categories1).filter((cat) => categories2.has(cat))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[72rem] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Управление игрой</DialogTitle>
          <DialogDescription>Управление характеристиками и игроками (только для ведущего)</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="flex w-full gap-1 p-1 flex-wrap">
            <TabsTrigger value="characteristics" className="flex-1 min-w-[120px]">Характеристики</TabsTrigger>
            <TabsTrigger value="exchange" className="flex-1 min-w-[80px]">Обмен</TabsTrigger>
            <TabsTrigger value="players" className="flex-1 min-w-[140px]">Управление игроками</TabsTrigger>
            <TabsTrigger value="elimination" className="flex-1 min-w-[120px]">
              Изгнание игрока
              {stableCurrentPhase === "voting" && Object.keys(voteCounts).length > 0 && (
                <span className="ml-2 text-xs bg-primary/20 px-1.5 py-0.5 rounded">Голоса</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="characteristics" className="flex-1 overflow-hidden mt-4">
            <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Выбор игрока */}
          <div className="w-64 border-r border-border pr-4 overflow-y-auto">
            <Label className="mb-2 block">Выберите игрока</Label>
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {[...players].sort((a, b) => a.slot - b.slot).map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      setSelectedPlayer(player)
                      setSelectedChar(null)
                      setNewValue("")
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPlayer?.id === player.id
                        ? "bg-primary/20 border-primary"
                        : "bg-card border-border hover:bg-accent"
                    }`}
                  >
                    <div className="font-semibold">{player.name}</div>
                    {/* Show profession from characteristics (host can see all) */}
                    {(() => {
                      const professionChar = player.characteristics?.find(c => c.category === 'profession')
                      return professionChar ? (
                        <div className="text-sm text-muted-foreground">{professionChar.value}</div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">Профессия скрыта</div>
                      )
                    })()}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Характеристики выбранного игрока */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {selectedPlayer ? (
              <div className="flex flex-col h-full min-h-0">
                <h3 className="font-semibold mb-2 flex-shrink-0">Характеристики: {selectedPlayer.name}</h3>
                <div className="max-h-[50vh] overflow-y-auto pr-4">
                  <div className="space-y-2">
                    {selectedPlayer.characteristics.map((char) => (
                      <div
                        key={char.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedChar?.id === char.id
                            ? "bg-primary/20 border-primary"
                            : "bg-card border-border hover:bg-accent"
                        }`}
                        onClick={() => {
                          setSelectedChar(char)
                          setNewValue(char.value)
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-muted-foreground">{char.name}</div>
                            <div className="text-sm">{char.value}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {char.isRevealed ? "Раскрыто" : "Скрыто"}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2"
                            onClick={async (e) => {
                              e.stopPropagation()
                              setLoading(true)
                              try {
                                await onRandomizeCharacteristic(selectedPlayer.id, char.id)
                                // Update selected char if it's currently selected
                                if (selectedChar?.id === char.id) {
                                  // Reload will happen via gameState update, just clear selection
                                  setSelectedChar(null)
                                  setNewValue("")
                                }
                              } catch (error) {
                                console.error("Error randomizing characteristic:", error)
                              } finally {
                                setLoading(false)
                              }
                            }}
                            disabled={loading}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Редактирование выбранной характеристики */}
                {selectedChar && (
                  <div className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="space-y-2">
                      <Label>Редактировать: {selectedChar.name}</Label>
                      <Select value={newValue} onValueChange={setNewValue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите из списка" />
                        </SelectTrigger>
                        <SelectContent>
                          {getCategoryOptions(selectedChar.category).map((option, index) => (
                            <SelectItem key={`${option}-${index}`} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Или введите свое значение"
                      />
                      <p className="text-xs text-muted-foreground">
                        Выберите значение из списка или введите свое
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleUpdate} disabled={loading || !newValue.trim()}>
                        Обновить
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleRandomize}
                        disabled={loading}
                        className="gap-2"
                      >
                        <Shuffle className="w-4 h-4" />
                        Случайное
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Выберите игрока для редактирования характеристик
              </div>
            )}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="exchange" className="flex-1 overflow-hidden mt-4">
            <div className="space-y-6">
              <h3 className="font-semibold mb-4">Обмен характеристиками между игроками</h3>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Player 1 selection */}
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Игрок 1</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                      {players.filter((p) => !p.isEliminated).map((player) => (
                        <button
                          key={player.id}
                          onClick={() => {
                            setExchangePlayer1(player)
                            setExchangeCategory(null)
                          }}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-colors",
                            exchangePlayer1?.id === player.id
                              ? "bg-primary/20 border-primary"
                              : "bg-card border-border hover:bg-accent",
                          )}
                        >
                          <div className="font-semibold">{player.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Player 2 selection */}
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Игрок 2</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                      {players
                        .filter((p) => !p.isEliminated && p.id !== exchangePlayer1?.id)
                        .map((player) => (
                          <button
                            key={player.id}
                            onClick={() => {
                              setExchangePlayer2(player)
                              setExchangeCategory(null)
                            }}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors",
                              exchangePlayer2?.id === player.id
                                ? "bg-primary/20 border-primary"
                                : "bg-card border-border hover:bg-accent",
                            )}
                          >
                            <div className="font-semibold">{player.name}</div>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Category selection */}
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Характеристика</Label>
                    {exchangePlayer1 && exchangePlayer2 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                        {getAvailableCategories().map((category) => (
                          <button
                            key={category}
                            onClick={() => setExchangeCategory(category)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors",
                              exchangeCategory === category
                                ? "bg-primary/20 border-primary"
                                : "bg-card border-border hover:bg-accent",
                            )}
                          >
                            <div className="font-semibold">{getCategoryLabel(category)}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm text-center">
                        Выберите двух игроков
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Exchange button */}
              {exchangePlayer1 && exchangePlayer2 && exchangeCategory && (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleExchange}
                  disabled={loading}
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Обменять характеристики
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="players" className="flex-1 overflow-hidden mt-4">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Игроки в комнате</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Исключите игрока из комнаты или заблокируйте его для этой комнаты
                </p>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {players
                    .filter((p) => !p.isEliminated && !p.isHost)
                    .sort((a, b) => (a.slot || 0) - (b.slot || 0))
                    .map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                      >
                        <div>
                          <div className="font-semibold">{player.name}</div>
                          {player.characteristics?.find((c) => c.category === "profession") && (
                            <div className="text-xs text-muted-foreground">
                              {player.characteristics.find((c) => c.category === "profession")?.value}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {onKickPlayer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/50 hover:bg-destructive/10"
                              onClick={async () => {
                                if (confirm(`Исключить ${player.name} из комнаты?`)) {
                                  try {
                                    await onKickPlayer(player.id)
                                  } catch (e) {
                                    alert((e as Error).message)
                                  }
                                }
                              }}
                            >
                              <UserX className="w-4 h-4 mr-1" />
                              Исключить
                            </Button>
                          )}
                          {onBanPlayer && player.userId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-amber-600 border-amber-600/50 hover:bg-amber-600/10"
                              onClick={async () => {
                                if (confirm(`Заблокировать ${player.name} в этой комнате? Он не сможет подключиться снова.`)) {
                                  try {
                                    await onBanPlayer(player.userId!)
                                    if (roomId) {
                                      const res = await fetch(`/api/game/room/banned?roomId=${roomId}`)
                                      const data = await res.json()
                                      setBannedUsers(data.banned || [])
                                    }
                                  } catch (e) {
                                    alert((e as Error).message)
                                  }
                                }
                              }}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Заблокировать
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  {players.filter((p) => !p.isEliminated && !p.isHost).length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Нет других игроков</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Заблокированные игроки</h3>
                {bannedLoading ? (
                  <p className="text-sm text-muted-foreground py-4">Загрузка...</p>
                ) : bannedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Нет заблокированных игроков</p>
                ) : (
                  <div className="space-y-2 max-h-[25vh] overflow-y-auto">
                    {bannedUsers.map((b) => (
                      <div
                        key={b.userId}
                        className="flex items-center justify-between p-3 rounded-lg border border-amber-600/30 bg-amber-600/5"
                      >
                        <span className="font-medium">{b.userName}</span>
                        {onUnbanPlayer && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await onUnbanPlayer(b.userId)
                                setBannedUsers((prev) => prev.filter((u) => u.userId !== b.userId))
                              } catch (e) {
                                alert((e as Error).message)
                              }
                            }}
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Разблокировать
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="elimination" className="flex-1 overflow-hidden mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-4">Выбрать игрока для изгнания</h3>
                  
                  {/* Vote counts display */}
                  {Object.keys(voteCounts).length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <div className="text-sm font-semibold text-primary mb-2">Текущие голоса:</div>
                      <div className="space-y-1">
                        {Object.entries(voteCounts)
                          .sort(([, a], [, b]) => b - a)
                          .map(([playerId, count]) => {
                            const player = players.find((p) => p.id === playerId)
                            if (!player) return null
                            return (
                              <div key={playerId} className="flex justify-between text-sm">
                                <span className="text-foreground">{player.name}:</span>
                                <span className="font-bold text-primary">{count}</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Player selection */}
                  <div className="grid grid-cols-2 gap-3">
                    {eligiblePlayers.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => setSelectedForElimination(player.id)}
                        className={cn(
                          "p-3 rounded-lg border-2 text-left transition-all",
                          selectedForElimination === player.id
                            ? "border-destructive bg-destructive/20"
                            : "border-border bg-card hover:border-destructive/50",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{player.name}</div>
                            {voteCounts[player.id] !== undefined && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {voteCounts[player.id]} голосов
                              </div>
                            )}
                          </div>
                          {selectedForElimination === player.id && (
                            <Skull className="w-5 h-5 text-destructive" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Eliminate button */}
                  {selectedForElimination && (
                    <Button
                      variant="destructive"
                      size="lg"
                      className="w-full mt-4"
                      onClick={handleEliminate}
                      disabled={loading}
                    >
                      <Skull className="w-4 h-4 mr-2" />
                      Изгнать {players.find((p) => p.id === selectedForElimination)?.name}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
