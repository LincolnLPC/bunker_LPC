"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shuffle, RefreshCw, X } from "lucide-react"
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
}: CharacteristicsManagerProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedChar, setSelectedChar] = useState<Characteristic | null>(null)
  const [newValue, setNewValue] = useState("")
  const [loading, setLoading] = useState(false)

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
    return CATEGORY_OPTIONS[category] || []
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Управление характеристиками</DialogTitle>
          <DialogDescription>Редактируйте характеристики игроков (только для ведущего)</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Выбор игрока */}
          <div className="w-64 border-r border-border pr-4 overflow-y-auto">
            <Label className="mb-2 block">Выберите игрока</Label>
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {players.map((player) => (
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
          <div className="flex-1 overflow-y-auto">
            {selectedPlayer ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Характеристики: {selectedPlayer.name}</h3>
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedChar(char)
                              setNewValue(char.value)
                            }}
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
                          {getCategoryOptions(selectedChar.category).map((option) => (
                            <SelectItem key={option} value={option}>
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
      </DialogContent>
    </Dialog>
  )
}
