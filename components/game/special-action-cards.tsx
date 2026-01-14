"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shuffle, Eye, Shield, Target, Sparkles, RefreshCw } from "lucide-react"
import type { Player } from "@/types/game"

interface SpecialCard {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  type: "exchange" | "peek" | "immunity" | "reroll" | "reveal" | "steal" | "double-vote" | "no-vote-against" | "reshuffle" | "revote" | "replace-profession" | "replace-health"
  isUsed: boolean
}

interface SpecialActionCardsProps {
  isOpen: boolean
  onClose: () => void
  cards: SpecialCard[]
  players: Player[]
  currentPlayerId: string
  onUseCard: (cardId: string, targetPlayerId?: string, characteristicId?: string, category?: string) => void
}

export function SpecialActionCards({
  isOpen,
  onClose,
  cards,
  players,
  currentPlayerId,
  onUseCard,
}: SpecialActionCardsProps) {
  const [selectedCard, setSelectedCard] = useState<SpecialCard | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const availableCards = cards.filter((c) => !c.isUsed)
  const otherPlayers = players.filter((p) => p.id !== currentPlayerId && !p.isEliminated)

  const handleUseCard = () => {
    if (!selectedCard) return
    onUseCard(selectedCard.id, selectedPlayer ?? undefined, selectedCharacteristic ?? undefined, selectedCategory ?? undefined)
    setSelectedCard(null)
    setSelectedPlayer(null)
    setSelectedCharacteristic(null)
    setSelectedCategory(null)
    onClose()
  }

  const getCardIcon = (type: SpecialCard["type"]) => {
    switch (type) {
      case "exchange":
        return <Shuffle className="w-6 h-6" />
      case "peek":
        return <Eye className="w-6 h-6" />
      case "immunity":
        return <Shield className="w-6 h-6" />
      case "reroll":
        return <RefreshCw className="w-6 h-6" />
      case "reveal":
        return <Target className="w-6 h-6" />
      case "steal":
        return <Sparkles className="w-6 h-6" />
      case "double-vote":
        return <Sparkles className="w-6 h-6" />
      case "no-vote-against":
        return <Shield className="w-6 h-6" />
      case "reshuffle":
        return <Shuffle className="w-6 h-6" />
      case "revote":
        return <RefreshCw className="w-6 h-6" />
      case "replace-profession":
      case "replace-health":
        return <RefreshCw className="w-6 h-6" />
      default:
        return <Sparkles className="w-6 h-6" />
    }
  }

  const needsTarget =
    selectedCard?.type === "exchange" ||
    selectedCard?.type === "peek" ||
    selectedCard?.type === "reveal" ||
    selectedCard?.type === "steal" ||
    selectedCard?.type === "no-vote-against" ||
    selectedCard?.type === "replace-profession" ||
    selectedCard?.type === "replace-health"

  const needsCategory = selectedCard?.type === "reshuffle"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[oklch(0.12_0.01_60)] border-[oklch(0.7_0.2_50)] text-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[oklch(0.7_0.2_50)] text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Специальные карты
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Используйте специальные карты для получения преимущества
          </DialogDescription>
        </DialogHeader>

        {!selectedCard ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {availableCards.map((card) => (
                <Card
                  key={card.id}
                  className="bg-[oklch(0.15_0.02_60)] border-[oklch(0.3_0.01_60)] hover:border-[oklch(0.7_0.2_50)] transition-colors cursor-pointer"
                  onClick={() => setSelectedCard(card)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-[oklch(0.7_0.2_50)]">
                      {getCardIcon(card.type)}
                      {card.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {availableCards.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">У вас нет доступных специальных карт</div>
            )}
          </ScrollArea>
        ) : (
          <div className="space-y-4">
            <Card className="bg-[oklch(0.15_0.02_60)] border-[oklch(0.7_0.2_50)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-[oklch(0.7_0.2_50)]">
                  {getCardIcon(selectedCard.type)}
                  {selectedCard.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{selectedCard.description}</p>
              </CardContent>
            </Card>

            {needsTarget && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Выберите игрока:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {otherPlayers.map((player) => (
                      <Button
                        key={player.id}
                        variant={selectedPlayer === player.id ? "default" : "outline"}
                        size="sm"
                        className={
                          selectedPlayer === player.id
                            ? "bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)]"
                            : "border-[oklch(0.3_0.01_60)] text-foreground hover:border-[oklch(0.7_0.2_50)]"
                        }
                        onClick={() => {
                          setSelectedPlayer(player.id)
                          setSelectedCharacteristic(null) // Reset characteristic when player changes
                        }}
                      >
                        {player.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedPlayer && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {selectedCard.type === "exchange"
                        ? "Выберите характеристику для обмена:"
                        : selectedCard.type === "peek"
                          ? "Выберите характеристику для просмотра:"
                          : selectedCard.type === "reveal"
                            ? "Выберите характеристику для раскрытия:"
                            : selectedCard.type === "steal"
                              ? "Выберите характеристику для кражи:"
                              : selectedCard.type === "replace-profession"
                                  ? "Выберите открытую карту профессии:"
                                  : selectedCard.type === "replace-health"
                                    ? "Выберите открытую карту здоровья:"
                                    : "Выберите характеристику:"}
                    </p>
                    <ScrollArea className="h-[200px] pr-4">
                      {(() => {
                        const targetPlayer = players.find((p) => p.id === selectedPlayer)
                        if (!targetPlayer) return null

                        let availableChars = targetPlayer.characteristics

                        if (selectedCard.type === "replace-profession") {
                          availableChars = targetPlayer.characteristics.filter(
                            (c) => c.category === "profession" && c.isRevealed
                          )
                        } else if (selectedCard.type === "replace-health") {
                          availableChars = targetPlayer.characteristics.filter(
                            (c) => c.category === "health" && c.isRevealed
                          )
                        } else if (selectedCard.type === "exchange" || selectedCard.type === "steal") {
                          availableChars = targetPlayer.characteristics.filter((c) => !c.isRevealed)
                        } else if (selectedCard.type === "no-vote-against") {
                          // No characteristic needed for this card
                          availableChars = []
                        }

                        return (
                          <div className="space-y-2">
                            {availableChars.map((char) => (
                              <Button
                                key={char.id}
                                variant={selectedCharacteristic === char.id ? "default" : "outline"}
                                size="sm"
                                className={`w-full justify-start ${
                                  selectedCharacteristic === char.id
                                    ? "bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)]"
                                    : "border-[oklch(0.3_0.01_60)] text-foreground hover:border-[oklch(0.7_0.2_50)]"
                                }`}
                                onClick={() => setSelectedCharacteristic(char.id)}
                              >
                                <span className="font-medium">{char.name}:</span>{" "}
                                {char.isRevealed ? char.value : "???"}
                              </Button>
                            ))}
                          </div>
                        )
                      })()}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {selectedCard?.type === "reroll" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Выберите характеристику для переброски:</p>
                <ScrollArea className="h-[200px] pr-4">
                  {(() => {
                    const currentPlayer = players.find((p) => p.id === currentPlayerId)
                    if (!currentPlayer) return null

                    return (
                      <div className="space-y-2">
                        {currentPlayer.characteristics.map((char) => (
                          <Button
                            key={char.id}
                            variant={selectedCharacteristic === char.id ? "default" : "outline"}
                            size="sm"
                            className={`w-full justify-start ${
                              selectedCharacteristic === char.id
                                ? "bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)]"
                                : "border-[oklch(0.3_0.01_60)] text-foreground hover:border-[oklch(0.7_0.2_50)]"
                            }`}
                            onClick={() => setSelectedCharacteristic(char.id)}
                          >
                            <span className="font-medium">{char.name}:</span> {char.value}
                          </Button>
                        ))}
                      </div>
                    )
                  })()}
                </ScrollArea>
              </div>
            )}

            {needsCategory && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Выберите категорию для перераспределения:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "bio", label: "Биология" },
                    { value: "baggage", label: "Багаж" },
                    { value: "health", label: "Здоровье" },
                    { value: "fact", label: "Факты" },
                    { value: "hobby", label: "Хобби" },
                  ].map((cat) => (
                    <Button
                      key={cat.value}
                      variant={selectedCategory === cat.value ? "default" : "outline"}
                      size="sm"
                      className={
                        selectedCategory === cat.value
                          ? "bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)]"
                          : "border-[oklch(0.3_0.01_60)] text-foreground hover:border-[oklch(0.7_0.2_50)]"
                      }
                      onClick={() => setSelectedCategory(cat.value)}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-[oklch(0.3_0.01_60)] bg-transparent"
                onClick={() => {
                  setSelectedCard(null)
                  setSelectedPlayer(null)
                  setSelectedCharacteristic(null)
                  setSelectedCategory(null)
                }}
              >
                Назад
              </Button>
              <Button
                className="flex-1 bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)] hover:bg-[oklch(0.75_0.22_50)]"
                onClick={handleUseCard}
                disabled={
                  needsCategory && !selectedCategory
                    ? true
                    : needsTarget && !selectedPlayer
                      ? true
                      : (selectedCard.type === "exchange" || 
                          selectedCard.type === "peek" || 
                          selectedCard.type === "reveal" || 
                          selectedCard.type === "steal" ||
                          selectedCard.type === "replace-profession" ||
                          selectedCard.type === "replace-health")
                        ? !selectedCharacteristic
                        : selectedCard.type === "reroll"
                          ? !selectedCharacteristic
                          : selectedCard.type === "no-vote-against"
                            ? false // No characteristic needed
                            : false
                }
              >
                Использовать
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Default special cards
export const DEFAULT_SPECIAL_CARDS: SpecialCard[] = [
  {
    id: "exchange-1",
    name: "Обмен характеристикой",
    description: "Обменяйте одну из своих характеристик с другим игроком",
    icon: <Shuffle className="w-6 h-6" />,
    type: "exchange",
    isUsed: false,
  },
  {
    id: "peek-1",
    name: "Подглядывание",
    description: "Посмотрите одну скрытую характеристику другого игрока",
    icon: <Eye className="w-6 h-6" />,
    type: "peek",
    isUsed: false,
  },
  {
    id: "immunity-1",
    name: "Иммунитет",
    description: "Защитите себя от изгнания на этом раунде",
    icon: <Shield className="w-6 h-6" />,
    type: "immunity",
    isUsed: false,
  },
  {
    id: "reroll-1",
    name: "Перебросить",
    description: "Перегенерируйте одну из своих характеристик",
    icon: <RefreshCw className="w-6 h-6" />,
    type: "reroll",
    isUsed: false,
  },
]
