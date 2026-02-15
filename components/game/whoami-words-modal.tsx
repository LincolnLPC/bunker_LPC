"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Check, Circle, UserCheck } from "lucide-react"
import type { Player } from "@/types/game"

interface WhoamiWordsModalProps {
  player: Player
  isCurrentPlayer: boolean
  onClose: () => void
  onNextWord?: (playerId: string) => Promise<{ error?: string }>
  onVoteConfirm?: (targetPlayerId: string) => Promise<{ error?: string }>
  nextWordByVoting?: boolean
  hasVoted?: boolean
  /** Имена игроков, подтвердивших отгадку текущего слова */
  votedPlayerNames?: string[]
}

export function WhoamiWordsModal({
  player,
  isCurrentPlayer,
  onClose,
  onNextWord,
  onVoteConfirm,
  nextWordByVoting = false,
  hasVoted = false,
  votedPlayerNames = [],
}: WhoamiWordsModalProps) {
  const words = player.whoamiWords || []
  const currentWord = words.find((w) => !w.isGuessed)
  const guessedCount = words.filter((w) => w.isGuessed).length
  const totalCount = words.length

  const handleNextWord = async () => {
    if (!onNextWord) return
    const result = await onNextWord(player.id)
    if (result.error) {
      // Could show toast - for now just log
      console.warn("[Whoami] Next word error:", result.error)
    } else {
      onClose()
    }
  }

  const handleVote = async () => {
    if (!onVoteConfirm || hasVoted) return
    await onVoteConfirm(player.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md mx-4 rounded-lg bg-card border-2 border-primary overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-[oklch(0.1_0.02_50)] border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            {isCurrentPlayer ? "Мои слова" : `Слова: ${player.name}`}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Отгадано: {guessedCount} из {totalCount}
          </p>
          <ScrollArea className="h-[280px] pr-3">
            <ul className="space-y-2">
              {words.map((w) => {
                const showWord = w.isGuessed || (!isCurrentPlayer && w.id === currentWord?.id)
                return (
                  <li key={w.id} className="flex items-center gap-2 text-base">
                    {w.isGuessed ? (
                      <Check className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={
                        w.isGuessed
                          ? "text-muted-foreground line-through"
                          : "text-foreground font-medium"
                      }
                    >
                      {showWord ? w.word : "???"}
                    </span>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
          {currentWord && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              {nextWordByVoting && votedPlayerNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <UserCheck className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-muted-foreground">
                    {hasVoted ? "Вы подтвердили отгадку" : `Подтвердили: ${votedPlayerNames.join(", ")}`}
                  </span>
                </div>
              )}
              {isCurrentPlayer ? (
                <Button
                  onClick={handleNextWord}
                  className="w-full"
                >
                  Следующее слово
                </Button>
              ) : nextWordByVoting && !hasVoted && onVoteConfirm ? (
                <Button
                  variant="outline"
                  onClick={handleVote}
                  className="w-full"
                >
                  Подтвердить отгадку
                </Button>
              ) : nextWordByVoting && hasVoted ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Вы подтвердили отгадку
                </div>
              ) : null}
            </div>
          )}
          {!currentWord && (
            <p className="text-center text-primary font-medium">Все слова отгаданы!</p>
          )}
        </div>
      </div>
    </div>
  )
}
