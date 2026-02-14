"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, RefreshCw, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Player } from "@/types/game"

interface VoteCountsModalProps {
  isOpen: boolean
  onClose: () => void
  players: Player[]
  roomId: string
  currentRound: number
  currentPlayerId: string
  onVote?: (targetId: string) => Promise<void>
  votedPlayerId?: string
  isSpectator?: boolean
  /** Идентификаторы игроков, против которых нельзя голосовать (эффект спецкарт «Будь другом» или «План Б») */
  cannotVoteAgainstPlayerIds?: string[]
}

export function VoteCountsModal({
  isOpen,
  onClose,
  players,
  roomId,
  currentRound,
  currentPlayerId,
  onVote,
  votedPlayerId,
  isSpectator = false,
  cannotVoteAgainstPlayerIds = [],
}: VoteCountsModalProps) {
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("results")

  const fetchVoteCounts = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      console.log("[VoteCountsModal] Fetching votes for:", { roomId, currentRound, isSpectator })
      const { data: votes, error } = await supabase
        .from("votes")
        .select("target_id, vote_weight")
        .eq("room_id", roomId)
        .eq("round", currentRound)

      if (error) {
        console.error("[VoteCountsModal] Error fetching votes:", error)
        setVoteCounts({})
        return
      }
      
      console.log("[VoteCountsModal] Raw votes data:", votes)
      
      if (votes && votes.length > 0) {
        const counts: Record<string, number> = {}
        for (const vote of votes) {
          const weight = vote.vote_weight || 1
          counts[vote.target_id] = (counts[vote.target_id] || 0) + weight
        }
        setVoteCounts(counts)
        console.log("[VoteCountsModal] Fetched vote counts:", counts)
      } else {
        console.log("[VoteCountsModal] No votes found for room:", roomId, "round:", currentRound)
        setVoteCounts({})
      }
    } catch (err) {
      console.error("[VoteCountsModal] Error fetching vote counts:", err)
      setVoteCounts({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && roomId && currentRound !== undefined) {
      // Fetch immediately when modal opens
      fetchVoteCounts()
      // Auto-refresh every 2 seconds as fallback
      const interval = setInterval(fetchVoteCounts, 2000)
      
      // Subscribe to realtime updates for votes
      const supabase = createClient()
      const channel = supabase
        .channel(`votes:${roomId}:${currentRound}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, roomId, currentRound])

  // Reset selected player when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayerId(null)
    } else if (isSpectator) {
      // For spectators, always show results tab
      setActiveTab("results")
    }
  }, [isOpen, isSpectator])

  // Сбросить выбор, если выбран заблокированный игрок (эффект спецкарты)
  useEffect(() => {
    if (selectedPlayerId && cannotVoteAgainstPlayerIds.includes(selectedPlayerId)) {
      setSelectedPlayerId(null)
    }
  }, [selectedPlayerId, cannotVoteAgainstPlayerIds])

  const sortedResults = Object.entries(voteCounts)
    .map(([playerId, count]) => ({
      playerId,
      votes: count,
    }))
    .sort((a, b) => b.votes - a.votes)

  const maxVotes = sortedResults[0]?.votes || 0
  const eligiblePlayers = players.filter((p) => !p.isEliminated)

  const handleVote = async () => {
    if (!selectedPlayerId || !onVote) return
    try {
      await onVote(selectedPlayerId)
      setSelectedPlayerId(null) // Clear selection after voting
    } catch (err) {
      console.error("Error casting vote:", err)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Голосование</DialogTitle>
          <DialogDescription>Просмотр результатов и голосование</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <TabsList className={isSpectator ? "grid w-full grid-cols-1" : "grid w-full grid-cols-2"}>
            <TabsTrigger value="results">Голоса</TabsTrigger>
            {!isSpectator && <TabsTrigger value="vote">Проголосовать</TabsTrigger>}
          </TabsList>

          <TabsContent value="results" className="space-y-4 mt-4">
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {loading && sortedResults.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Загрузка голосов...
                </div>
              ) : sortedResults.length > 0 ? (
                sortedResults.map((result) => {
                  const player = players.find((p) => p.id === result.playerId && !p.isEliminated)
                  if (!player) return null

                  const percentage = maxVotes > 0 ? (result.votes / maxVotes) * 100 : 0

                  return (
                    <div
                      key={result.playerId}
                      className={cn(
                        "relative p-3 rounded-lg border-2 overflow-hidden",
                        "border-border bg-secondary/30",
                      )}
                    >
                      {/* Vote bar background */}
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 transition-all duration-500",
                          "bg-primary/20",
                        )}
                        style={{ width: `${percentage}%` }}
                      />

                      {/* Content */}
                      <div className="relative flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{player.name}</div>
                          {/* Show profession only if revealed */}
                          {(() => {
                            const professionChar = player.characteristics?.find(
                              (c) => c.category === "profession" && c.isRevealed,
                            )
                            return professionChar ? (
                              <div className="text-xs text-muted-foreground truncate">
                                {professionChar.value}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground truncate italic">
                                Характеристики скрыты
                              </div>
                            )
                          })()}
                        </div>
                        <div className="text-xl font-bold text-primary">{result.votes}</div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Пока нет голосов
                </div>
              )}
            </div>

            <div className="flex justify-end items-center pt-2 border-t">
              <Button variant="outline" onClick={fetchVoteCounts} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                Обновить
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="vote" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-4">
                Выберите игрока для исключения из бункера
              </p>
              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                {eligiblePlayers.map((player) => {
                  const isBlocked = cannotVoteAgainstPlayerIds.includes(player.id)
                  return (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (isBlocked) return
                        setSelectedPlayerId(player.id)
                      }}
                      disabled={isBlocked}
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all text-left",
                        isBlocked
                          ? "border-muted bg-muted/30 cursor-not-allowed opacity-75"
                          : "hover:border-primary hover:bg-primary/10",
                        !isBlocked && selectedPlayerId === player.id
                          ? "border-primary bg-primary/20"
                          : !isBlocked && "border-border bg-secondary/50",
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate">{player.name}</div>
                            {/* Show profession only if revealed */}
                            {(() => {
                              const professionChar = player.characteristics?.find(
                                (c) => c.category === "profession" && c.isRevealed,
                              )
                              return professionChar ? (
                                <div className="text-xs text-muted-foreground truncate">
                                  {professionChar.value}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground truncate italic">
                                  Характеристики скрыты
                                </div>
                              )
                            })()}
                          </div>
                          {selectedPlayerId === player.id && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
                        </div>
                        {isBlocked && (
                          <div className="text-xs text-amber-500/90 font-medium mt-1">
                            Вы не можете голосовать против этого игрока (эффект спецкарты)
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <Button variant="outline" onClick={() => setSelectedPlayerId(null)} disabled={!selectedPlayerId}>
                Сбросить
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Отмена
                </Button>
                <Button onClick={handleVote} disabled={!selectedPlayerId || !onVote}>
                  Подтвердить
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
