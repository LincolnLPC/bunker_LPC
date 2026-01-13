"use client"

import { Button } from "@/components/ui/button"
import { Settings, MessageSquare, Users, Clock, BookOpen, Skull } from "lucide-react"
import { RoundTimer } from "@/components/game/round-timer"
import type { GameState } from "@/types/game"

interface GameHeaderProps {
  gameState: GameState
  onOpenChat?: () => void
  onOpenSettings?: () => void
  onOpenJournal?: () => void
  onOpenAltar?: () => void
  onTimerEnd?: () => void
  unreadMessagesCount?: number
}

export function GameHeader({
  gameState,
  onOpenChat,
  onOpenSettings,
  onOpenJournal,
  onOpenAltar,
  onTimerEnd,
  unreadMessagesCount = 0,
}: GameHeaderProps) {
  const activePlayers = gameState.players.filter((p) => !p.isEliminated).length
  const totalPlayers = gameState.players.length
  const eliminatedCount = gameState.players.filter((p) => p.isEliminated).length

  const phaseLabels: Record<string, string> = {
    waiting: "Ожидание",
    playing: "Игра",
    voting: "Голосование",
    results: "Результаты",
    finished: "Завершено",
  }

  // Показывать таймер только во время игры или голосования и только в автоматическом режиме
  const roundMode = gameState.settings?.roundMode || "automatic"
  const showTimer = (gameState.phase === "playing" || gameState.phase === "voting") && roundMode === "automatic"

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-[oklch(0.08_0.01_60)] border-b border-border">
      {/* Left section - Navigation & Stats */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-wide gap-1.5"
          onClick={onOpenJournal}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Журнал</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-wide gap-1.5"
          onClick={onOpenAltar}
        >
          <Skull className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Жертвенник</span>
          {eliminatedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px]">
              {eliminatedCount}
            </span>
          )}
        </Button>

        <div className="hidden md:flex items-center gap-3 ml-2 pl-2 border-l border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Раунд <span className="text-foreground font-medium">{gameState.currentRound}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>
              <span className="text-foreground font-medium">{activePlayers}</span>/{totalPlayers}
            </span>
          </div>
          {showTimer && (
            <RoundTimer
              duration={gameState.roundTimerSeconds}
              isActive={gameState.phase === "playing" || gameState.phase === "voting"}
              onTimeUp={onTimerEnd}
              startedAt={gameState.roundStartedAt}
            />
          )}
        </div>
      </div>

      {/* Center - Title */}
      <h1
        className="text-2xl sm:text-4xl font-bold text-[oklch(0.7_0.2_50)] bunker-title tracking-wider"
        style={{ fontFamily: "serif" }}
      >
        БУНКЕР
      </h1>

      {/* Right section - Room code, phase and controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:flex px-2 py-1 bg-[oklch(0.7_0.2_50/0.2)] border border-[oklch(0.7_0.2_50/0.5)] rounded text-xs text-[oklch(0.7_0.2_50)] uppercase tracking-wide">
          {phaseLabels[gameState.phase]}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-[oklch(0.15_0.01_60)] rounded border border-border">
          <span className="hidden sm:inline text-xs text-muted-foreground uppercase">Код:</span>
          <span className="text-xs sm:text-sm font-mono text-foreground">{gameState.roomCode}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8 relative"
          onClick={onOpenChat}
        >
          <MessageSquare className="w-4 h-4" />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-background flex items-center justify-center">
              <span className="text-[8px] text-destructive-foreground font-bold">
                {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
              </span>
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          onClick={onOpenSettings}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
