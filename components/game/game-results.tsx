"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trophy, Skull, Users, ArrowRight, RotateCcw, Home } from "lucide-react"
import type { Player, GameState } from "@/types/game"

interface GameResultsProps {
  gameState: GameState
  survivors: Player[]
  eliminated: Player[]
  onPlayAgain: () => void
  onBackToLobby: () => void
}

export function GameResults({ gameState, survivors, eliminated, onPlayAgain, onBackToLobby }: GameResultsProps) {
  const survivalRate = Math.round((survivors.length / gameState.players.length) * 100)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[oklch(0.7_0.2_50/0.2)] mb-4">
            <Trophy className="w-10 h-10 text-[oklch(0.7_0.2_50)]" />
          </div>
          <h1 className="text-4xl font-bold text-[oklch(0.7_0.2_50)]">Игра окончена</h1>
          <p className="text-muted-foreground text-lg">{gameState.catastrophe}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-[oklch(0.12_0.01_60)] border-[oklch(0.25_0.01_60)]">
            <CardContent className="pt-6 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-[oklch(0.7_0.2_50)]" />
              <p className="text-2xl font-bold">{gameState.players.length}</p>
              <p className="text-xs text-muted-foreground">Всего игроков</p>
            </CardContent>
          </Card>
          <Card className="bg-[oklch(0.12_0.01_60)] border-green-500/30">
            <CardContent className="pt-6 text-center">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <p className="text-2xl font-bold text-green-400">{survivors.length}</p>
              <p className="text-xs text-muted-foreground">Выжили</p>
            </CardContent>
          </Card>
          <Card className="bg-[oklch(0.12_0.01_60)] border-destructive/30">
            <CardContent className="pt-6 text-center">
              <Skull className="w-6 h-6 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold text-destructive">{eliminated.length}</p>
              <p className="text-xs text-muted-foreground">Изгнаны</p>
            </CardContent>
          </Card>
        </div>

        {/* Survival Rate Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Выживаемость</span>
            <span className="text-[oklch(0.7_0.2_50)] font-bold">{survivalRate}%</span>
          </div>
          <div className="h-3 bg-[oklch(0.15_0.02_60)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[oklch(0.7_0.2_50)] to-[oklch(0.8_0.25_50)] transition-all duration-1000"
              style={{ width: `${survivalRate}%` }}
            />
          </div>
        </div>

        {/* Survivors */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-green-400 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Выжившие ({survivors.length})
          </h2>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {survivors.map((player, index) => (
                <Card key={player.id} className="bg-[oklch(0.15_0.02_60)] border-green-500/30">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{player.name}</p>
                      {/* Show profession, gender, age only if revealed */}
                      {(() => {
                        const professionChar = player.characteristics.find(c => c.category === 'profession' && c.isRevealed)
                        const genderChar = player.characteristics.find(c => c.category === 'gender' && c.isRevealed)
                        const ageChar = player.characteristics.find(c => c.category === 'age' && c.isRevealed)
                        const info: string[] = []
                        if (professionChar) info.push(professionChar.value)
                        if (genderChar) info.push(genderChar.value)
                        if (ageChar) info.push(ageChar.value)
                        return info.length > 0 ? (
                          <p className="text-xs text-muted-foreground">{info.join(' • ')}</p>
                        ) : null
                      })()}
                    </div>
                    <ArrowRight className="w-4 h-4 text-green-400" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Eliminated */}
        {eliminated.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <Skull className="w-5 h-5" />
              Изгнаны ({eliminated.length})
            </h2>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {eliminated.map((player, index) => (
                  <Card key={player.id} className="bg-[oklch(0.15_0.02_60)] border-destructive/30 opacity-70">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                        <Skull className="w-4 h-4 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium line-through">{player.name}</p>
                        {/* Show profession from characteristics (eliminated players have all revealed) */}
                        {(() => {
                          const professionChar = player.characteristics?.find(c => c.category === 'profession')
                          return professionChar ? (
                            <p className="text-xs text-muted-foreground">
                              {professionChar.value} • Раунд изгнания: {index + 1}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Раунд изгнания: {index + 1}</p>
                          )
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1 border-[oklch(0.3_0.01_60)] hover:bg-[oklch(0.15_0.02_60)] bg-transparent"
            onClick={onBackToLobby}
          >
            <Home className="w-4 h-4 mr-2" />В лобби
          </Button>
          <Button
            className="flex-1 bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)] hover:bg-[oklch(0.75_0.22_50)]"
            onClick={onPlayAgain}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Играть снова
          </Button>
        </div>
      </div>
    </div>
  )
}
