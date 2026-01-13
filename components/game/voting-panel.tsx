"use client"

import { useState, useEffect } from "react"
import type { Player } from "@/types/game"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, User, X } from "lucide-react"

interface VotingPanelProps {
  players: Player[]
  currentPlayerId: string
  onVote: (targetId: string) => void
  onConfirm: (targetId?: string) => void
  votedPlayerId?: string
  timeRemaining?: number
  onClose?: () => void
  isHost?: boolean
  onTimerEnd?: () => void
}

export function VotingPanel({
  players,
  currentPlayerId,
  onVote,
  onConfirm,
  votedPlayerId,
  timeRemaining = 60,
  onClose,
  isHost = false,
  onTimerEnd,
}: VotingPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(votedPlayerId || null)
  const [currentTimeRemaining, setCurrentTimeRemaining] = useState(timeRemaining)

  // Update time remaining from prop
  useEffect(() => {
    setCurrentTimeRemaining(timeRemaining)
  }, [timeRemaining])

  // Countdown timer
  useEffect(() => {
    if (currentTimeRemaining <= 0) {
      // Timer ended, close the panel
      if (onTimerEnd) {
        onTimerEnd()
      }
      return
    }

    const interval = setInterval(() => {
      setCurrentTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          // Timer reached 0, close the panel
          if (onTimerEnd) {
            setTimeout(() => onTimerEnd(), 100) // Small delay to ensure UI updates
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTimeRemaining, onTimerEnd])
  
  // Also check if timeRemaining prop reaches 0
  useEffect(() => {
    if (timeRemaining <= 0 && onTimerEnd) {
      // Timer expired from server
      onTimerEnd()
    }
  }, [timeRemaining, onTimerEnd])


  const eligiblePlayers = players.filter((p) => !p.isEliminated)

  const handleSelect = (playerId: string) => {
    setSelectedId(playerId)
  }

  const handleConfirmVote = () => {
    if (selectedId) {
      onVote(selectedId)
      onConfirm(selectedId)
    }
  }

  // Show message if no eligible players (one player game)
  if (eligiblePlayers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm">
        <div className="w-full max-w-2xl mx-4 p-6 rounded-lg bg-card border-2 border-primary">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-primary bunker-title mb-2">ГОЛОСОВАНИЕ</h2>
            <p className="text-muted-foreground mb-4">
              Нет других игроков для голосования. Ведущий может завершить голосование.
            </p>
            {isHost && onClose && (
              <Button onClick={onClose} variant="default" size="lg">
                Завершить голосование
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 p-6 rounded-lg bg-card border-2 border-primary relative">
        {/* Close button for host */}
        {isHost && onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4"
            onClick={onClose}
            title="Завершить голосование (только для ведущего)"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
        
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-primary bunker-title mb-2">ГОЛОСОВАНИЕ</h2>
          <p className="text-muted-foreground">Выберите игрока для исключения из бункера</p>
          <div className="mt-2 text-xl font-mono text-primary">
            {Math.floor(currentTimeRemaining / 60)}:{(currentTimeRemaining % 60).toString().padStart(2, "0")}
          </div>
        </div>



        {/* Player selection grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {eligiblePlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => handleSelect(player.id)}
              className={cn(
                "p-3 rounded-lg border-2 transition-all text-left",
                "hover:border-primary hover:bg-primary/10",
                selectedId === player.id
                  ? "border-primary bg-primary/20 card-glow-orange"
                  : "border-border bg-secondary/50",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{player.name}</div>
                  {/* Show profession only if revealed */}
                  {(() => {
                    const professionChar = player.characteristics?.find(c => c.category === 'profession' && c.isRevealed)
                    return professionChar ? (
                      <div className="text-xs text-muted-foreground truncate">{professionChar.value}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground truncate italic">Характеристики скрыты</div>
                    )
                  })()}
                </div>
                {selectedId === player.id && <Check className="w-5 h-5 text-primary flex-shrink-0" />}
              </div>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <Button variant="default" size="lg" onClick={handleConfirmVote} disabled={!selectedId} className="min-w-32">
            Подтвердить
          </Button>
          <Button variant="outline" size="lg" onClick={() => setSelectedId(null)} disabled={!selectedId}>
            Сбросить
          </Button>
        </div>

        {votedPlayerId && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Вы уже проголосовали. Можете изменить свой голос, выбрав другого игрока и нажав "Подтвердить".
          </p>
        )}
      </div>
    </div>
  )
}
