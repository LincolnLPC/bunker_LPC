"use client"

import type { Player } from "@/types/game"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { User, Skull } from "lucide-react"

interface VoteResult {
  playerId: string
  votes: number
}

interface VoteResultsProps {
  players: Player[]
  results: VoteResult[]
  eliminatedPlayerId?: string
  onContinue: () => void
}

export function VoteResults({ players, results, eliminatedPlayerId, onContinue }: VoteResultsProps) {
  const sortedResults = [...results].sort((a, b) => b.votes - a.votes)
  const maxVotes = sortedResults[0]?.votes || 0

  const getPlayer = (id: string) => players.find((p) => p.id === id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm">
      <div className="w-full max-w-xl mx-4 p-6 rounded-lg bg-card border-2 border-primary">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-primary bunker-title mb-2">РЕЗУЛЬТАТЫ ГОЛОСОВАНИЯ</h2>
        </div>

        {/* Results list */}
        <div className="space-y-2 mb-6">
          {sortedResults.map((result, index) => {
            const player = getPlayer(result.playerId)
            if (!player) return null

            const isEliminated = result.playerId === eliminatedPlayerId
            const percentage = maxVotes > 0 ? (result.votes / maxVotes) * 100 : 0

            return (
              <div
                key={result.playerId}
                className={cn(
                  "relative p-3 rounded-lg border-2 overflow-hidden",
                  isEliminated ? "border-destructive bg-destructive/10" : "border-border bg-secondary/30",
                )}
              >
                {/* Vote bar background */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-500",
                    isEliminated ? "bg-destructive/30" : "bg-primary/20",
                  )}
                  style={{ width: `${percentage}%` }}
                />

                {/* Content */}
                <div className="relative flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {isEliminated ? (
                      <Skull className="w-4 h-4 text-destructive" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-semibold truncate", isEliminated && "text-destructive")}>
                      {player.name}
                    </div>
                    {/* Show profession only if revealed */}
                    {(() => {
                      const professionChar = player.characteristics?.find(c => c.category === 'profession' && c.isRevealed)
                      return professionChar ? (
                        <div className="text-xs text-muted-foreground">{professionChar.value}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">Характеристики скрыты</div>
                      )
                    })()}
                  </div>
                  <div className={cn("text-xl font-bold", isEliminated ? "text-destructive" : "text-primary")}>
                    {result.votes}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Eliminated player announcement */}
        {eliminatedPlayerId && (
          <div className="text-center mb-6 p-4 rounded-lg bg-destructive/20 border border-destructive">
            <Skull className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-lg font-bold text-destructive">{getPlayer(eliminatedPlayerId)?.name} покидает бункер</p>
          </div>
        )}

        {/* Continue button */}
        <div className="flex justify-center">
          <Button variant="default" size="lg" onClick={onContinue}>
            Продолжить игру
          </Button>
        </div>
      </div>
    </div>
  )
}
