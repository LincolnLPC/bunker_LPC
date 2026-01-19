"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Flame, Copy, Check, Users, Crown, LogOut, CheckCircle2, Circle } from "lucide-react"
import { useState } from "react"
import type { GameState } from "@/types/game"

interface WaitingRoomProps {
  gameState: GameState
  currentPlayerId: string
  isHost: boolean
  onStartGame: () => void
  onLeaveGame: () => void
  onToggleReady?: (isReady: boolean) => void
}

export function WaitingRoom({
  gameState,
  currentPlayerId,
  isHost,
  onStartGame,
  onLeaveGame,
  onToggleReady,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)
  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId)
  const isCurrentPlayerReady = currentPlayer?.isReady ?? false

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(gameState.roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const minPlayers = 1
  // Only check non-host players for readiness
  const playersToCheck = gameState.players.filter((p) => !p.isHost)
  const readyPlayers = playersToCheck.filter((p) => p.isReady).length
  const allReady = playersToCheck.length > 0 && playersToCheck.every((p) => p.isReady)
  // Host can start only if all non-host players are ready AND there's at least 1 player
  const canStart = isHost && gameState.phase === "waiting" && gameState.players.length >= minPlayers && allReady

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Flame className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">БУНКЕР</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onLeaveGame}>
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Room Code */}
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Код комнаты</p>
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors"
            >
              <span className="text-4xl font-bold tracking-widest text-primary">{gameState.roomCode}</span>
              {copied ? (
                <Check className="h-6 w-6 text-green-500" />
              ) : (
                <Copy className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <p className="text-sm text-muted-foreground mt-2">
              {copied ? "Скопировано!" : "Нажмите, чтобы скопировать"}
            </p>
          </div>

          {/* Players List */}
          <Card className="bg-card/50 border-border/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Игроки
              </h2>
              <span className="text-muted-foreground">
                {gameState.players.length} / {gameState.maxPlayers}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gameState.players.map((player) => (
                <div
                  key={player.id}
                  className={`p-3 rounded-lg border ${
                    player.id === currentPlayerId
                      ? "bg-cyan-500/10 border-cyan-500/50"
                      : "bg-background/50 border-border/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {player.isHost && <Crown className="h-4 w-4 text-primary shrink-0" title="Ведущий" />}
                      <span className="font-medium truncate">{player.name}</span>
                    </div>
                    {/* Show ready status only for non-host players */}
                    {!player.isHost && (
                      player.isReady ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" title="Готов" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" title="Не готов" />
                      )
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {/* Show profession only if revealed, or show "Характеристики скрыты" */}
                    {(() => {
                      const professionChar = player.characteristics?.find(c => c.category === 'profession' && c.isRevealed)
                      return (
                        <span className="text-xs text-muted-foreground truncate">
                          {professionChar ? professionChar.value : "Характеристики скрыты"}
                        </span>
                      )
                    })()}
                    {player.isHost ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-primary border-primary">
                        Ведущий
                      </Badge>
                    ) : (
                      player.isReady && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-600">
                          Готов
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: gameState.maxPlayers - gameState.players.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="p-3 rounded-lg border border-dashed border-border/30 flex items-center justify-center"
                >
                  <span className="text-muted-foreground/50">Пусто</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Ready Status for Players */}
          {!isHost && (
            <Card className="bg-card/50 border-border/50 p-6">
              <div className="text-center space-y-4">
                <div>
                  <p className="text-lg font-semibold mb-2">Статус готовности</p>
                  <p className="text-sm text-muted-foreground">
                    Готово: {readyPlayers} / {playersToCheck.length}
                  </p>
                </div>
                <Button
                  onClick={() => onToggleReady?.(!isCurrentPlayerReady)}
                  variant={isCurrentPlayerReady ? "default" : "outline"}
                  className={`w-full sm:w-auto px-8 py-6 text-lg ${
                    isCurrentPlayerReady
                      ? "bg-green-600 hover:bg-green-700"
                      : "border-2 border-primary text-primary hover:bg-primary/10"
                  }`}
                >
                  {isCurrentPlayerReady ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Готов
                    </>
                  ) : (
                    <>
                      <Circle className="w-5 h-5 mr-2" />
                      Не готов
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Хост запустит игру, когда все будут готовы
                </p>
              </div>
            </Card>
          )}

          {/* Start Game Button for Host */}
          {isHost && (
            <Card className="bg-card/50 border-border/50 p-6">
              <div className="text-center space-y-4">
                <div>
                  <p className="text-lg font-semibold mb-2">Управление игрой</p>
                  <p className="text-sm text-muted-foreground mb-1">
                    Игроков в комнате: {gameState.players.length} / {gameState.maxPlayers}
                  </p>
                  {gameState.players.length > 1 && (
                    <p className="text-sm text-muted-foreground">
                      Готово: {readyPlayers} / {gameState.players.length}
                    </p>
                  )}
                </div>
                <Button
                  onClick={onStartGame}
                  disabled={!canStart}
                  className="bg-primary hover:bg-primary/90 px-12 py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Начать игру
                </Button>
                {!canStart && (
                  <p className="text-sm text-muted-foreground">
                    Нужно минимум {minPlayers} игрока для начала (сейчас {gameState.players.length})
                  </p>
                )}
                {canStart && (
                  <p className="text-xs text-muted-foreground">
                    Вы можете запустить игру в любое время как ведущий
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
