"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Skull, AlertTriangle } from "lucide-react"
import type { Player } from "@/types/game"
import { cn } from "@/lib/utils"

interface SacrificialAltarProps {
  isOpen: boolean
  onClose: () => void
  players: Player[]
  currentPlayerId: string
  eliminatedPlayers: Player[]
  onViewPlayer: (player: Player) => void
}

export function SacrificialAltar({
  isOpen,
  onClose,
  players,
  currentPlayerId,
  eliminatedPlayers,
  onViewPlayer,
}: SacrificialAltarProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-destructive/10">
          <div className="flex items-center gap-3">
            <Skull className="w-6 h-6 text-destructive" />
            <h2 className="text-xl font-bold text-destructive">Жертвенник</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {eliminatedPlayers.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">Жертвенник пуст</h3>
              <p className="text-sm text-muted-foreground/70">Пока никто не был принесен в жертву выживанию</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Здесь покоятся те, кого не пустили в бункер. Их характеристики теперь раскрыты полностью.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {eliminatedPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      setSelectedPlayer(player.id)
                      onViewPlayer(player)
                    }}
                    className={cn(
                      "p-4 rounded-lg border text-left transition-all",
                      "bg-destructive/5 border-destructive/30 hover:border-destructive/50 hover:bg-destructive/10",
                      selectedPlayer === player.id && "ring-2 ring-destructive",
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-foreground">{player.name}</h3>
                        {/* Show profession from characteristics (eliminated players have all revealed) */}
                        {(() => {
                          const professionChar = player.characteristics?.find(c => c.category === 'profession')
                          return professionChar ? (
                            <p className="text-sm text-destructive">{professionChar.value}</p>
                          ) : null
                        })()}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {/* Show gender and age from characteristics */}
                        {(() => {
                          const genderChar = player.characteristics?.find(c => c.category === 'gender')
                          const ageChar = player.characteristics?.find(c => c.category === 'age')
                          return (
                            <>
                              {genderChar && <div>{genderChar.value}</div>}
                              {ageChar && <div>{ageChar.value}</div>}
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-destructive/20">
                      <div className="text-xs text-muted-foreground mb-1">Раскрытые характеристики:</div>
                      <div className="flex flex-wrap gap-1">
                        {player.characteristics.slice(0, 4).map((char) => (
                          <span
                            key={char.id}
                            className="px-2 py-0.5 rounded text-xs bg-destructive/20 text-destructive"
                          >
                            {char.name}
                          </span>
                        ))}
                        {player.characteristics.length > 4 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                            +{player.characteristics.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} className="bg-transparent">
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  )
}
