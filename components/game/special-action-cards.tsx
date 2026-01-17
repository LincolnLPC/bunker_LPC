"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shuffle, Eye, Shield, Target, Sparkles, RefreshCw } from "lucide-react"
import type { Player } from "@/types/game"

// Helper function to get category label
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    gender: "Пол",
    age: "Возраст",
    profession: "Профессия",
    health: "Здоровье",
    hobby: "Хобби",
    phobia: "Фобия",
    baggage: "Багаж",
    fact: "Факт",
    special: "Особое",
    bio: "Биология",
    skill: "Навык",
    trait: "Черта",
    additional: "Дополнительное",
  }
  return labels[category] || category
}

// All possible exchange card types for each category
type ExchangeCardType = 
  | "exchange-gender"
  | "exchange-age"
  | "exchange-profession"
  | "exchange-bio"
  | "exchange-health"
  | "exchange-hobby"
  | "exchange-phobia"
  | "exchange-baggage"
  | "exchange-fact"
  | "exchange-special"
  | "exchange-skill"
  | "exchange-trait"
  | "exchange-additional"

interface SpecialCard {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  type: ExchangeCardType | "exchange" | "peek" | "immunity" | "reroll" | "reveal" | "steal" | "double-vote" | "no-vote-against" | "reshuffle" | "reshuffle-health" | "reshuffle-bio" | "reshuffle-fact" | "reshuffle-baggage" | "reshuffle-hobby" | "revote" | "replace-profession" | "replace-health"
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

  // Debug: Log cards when modal opens
  useEffect(() => {
    if (isOpen) {
      const availableCount = cards.filter((c) => !c.isUsed).length
      console.log("[SpecialCards] Modal opened - cards prop:", cards)
      console.log("[SpecialCards] Total cards:", cards.length)
      console.log("[SpecialCards] Cards with isUsed:", cards.filter((c) => c.isUsed).length)
      console.log("[SpecialCards] Cards not used:", availableCount)
      console.log("[SpecialCards] Available cards (after filter):", availableCount)
      console.log("[SpecialCards] All cards details:", cards.map((c) => ({ id: c.id, type: c.type, name: c.name, isUsed: c.isUsed })))
      
      if (cards.length === 0) {
        console.warn("[SpecialCards] ⚠️ No cards received in props - cards may not have been loaded or granted yet")
      } else if (availableCount === 0) {
        console.warn("[SpecialCards] ⚠️ All cards are marked as used")
      }
    }
  }, [isOpen, cards])
  
  // Check if card is reveal card (needs category selection, not characteristic)
  const isRevealCard = selectedCard?.type === "reveal"
  
  // Debug: Log all players and their characteristics when reveal card is selected
  useEffect(() => {
    if (isRevealCard && selectedPlayer) {
      const targetPlayer = players.find((p) => p.id === selectedPlayer)
      if (targetPlayer) {
        console.log("[SpecialCards] Reveal card selected - Full player data:", {
          playerId: targetPlayer.id,
          playerName: targetPlayer.name,
          allCharacteristics: targetPlayer.characteristics,
          characteristicsCount: targetPlayer.characteristics?.length || 0,
          revealedCharacteristics: targetPlayer.characteristics?.filter((c) => c.isRevealed) || [],
          hiddenCharacteristics: targetPlayer.characteristics?.filter((c) => !c.isRevealed) || [],
        })
      }
    }
  }, [isRevealCard, selectedPlayer, players])

  const handleUseCard = () => {
    if (!selectedCard) return
    
    // For reveal card, pass category instead of characteristicId
    // For generic reshuffle card, pass selected category
    // For category-specific reshuffle cards, extract category from card type
    let categoryToUse: string | undefined = undefined
    if (selectedCard.type === "reveal") {
      categoryToUse = selectedCategory ?? undefined
    } else if (selectedCard.type === "reshuffle") {
      categoryToUse = selectedCategory ?? undefined
    } else if (selectedCard.type.startsWith("reshuffle-")) {
      // Category-specific reshuffle - extract category from card type
      categoryToUse = selectedCard.type.replace("reshuffle-", "")
    }
    
    const characteristicIdToUse = (selectedCard.type === "reveal" || selectedCard.type === "reshuffle" || selectedCard.type.startsWith("reshuffle-"))
      ? undefined
      : selectedCharacteristic
      
    onUseCard(selectedCard.id, selectedPlayer ?? undefined, characteristicIdToUse ?? undefined, categoryToUse ?? undefined)
    setSelectedCard(null)
    setSelectedPlayer(null)
    setSelectedCharacteristic(null)
    setSelectedCategory(null)
    onClose()
  }

  const getCardIcon = (type: SpecialCard["type"]) => {
    // All exchange cards use the same icon
    if (type.startsWith("exchange-")) {
      return <Shuffle className="w-6 h-6" />
    }
    
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
      case "reshuffle-health":
      case "reshuffle-bio":
      case "reshuffle-fact":
      case "reshuffle-baggage":
      case "reshuffle-hobby":
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

  // Check if card needs a target player
  const needsTarget =
    selectedCard?.type === "exchange" ||
    selectedCard?.type.startsWith("exchange-") ||
    selectedCard?.type === "peek" ||
    selectedCard?.type === "reveal" ||
    selectedCard?.type === "steal" ||
    selectedCard?.type === "no-vote-against" ||
    selectedCard?.type === "replace-profession" ||
    selectedCard?.type === "replace-health"
  
  // Check if card is a category-specific exchange card
  const isCategoryExchange = selectedCard?.type.startsWith("exchange-")
  const exchangeCategory = isCategoryExchange 
    ? selectedCard.type.replace("exchange-", "") 
    : null

  // Check if card is a category-specific reshuffle card
  const isCategoryReshuffle = selectedCard?.type.startsWith("reshuffle-")
  const reshuffleCategory = isCategoryReshuffle
    ? selectedCard.type.replace("reshuffle-", "")
    : null

  // Only generic reshuffle needs category selection
  const needsCategory = selectedCard?.type === "reshuffle" && !isCategoryReshuffle

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
            {availableCards.length > 0 ? (
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
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                {cards.length === 0 ? (
                  <>
                    <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">Специальные карты не найдены</p>
                    <p className="text-sm text-muted-foreground">
                      Карты еще не были выданы вам. Они будут доступны после начала игры.
                    </p>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">Все карты использованы</p>
                    <p className="text-sm text-muted-foreground">
                      У вас есть {cards.length} карт, но все они уже использованы.
                    </p>
                  </>
                )}
              </div>
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
                      {isCategoryExchange
                        ? `Выберите характеристику категории "${getCategoryLabel(exchangeCategory!)}" для обмена:`
                        : selectedCard.type === "exchange"
                          ? "Выберите характеристику для обмена:"
                          : selectedCard.type === "peek"
                            ? "Выберите характеристику для просмотра:"
                            : selectedCard.type === "reveal"
                              ? "Выберите категорию характеристики для раскрытия:"
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

                        // For reveal card, show categories instead of characteristics
                        if (isRevealCard) {
                          // Get unique categories from target player's hidden characteristics
                          // Check if characteristics exist and is an array
                          const allCharacteristics = targetPlayer.characteristics || []
                          
                          // Debug logging - very detailed
                          console.log("[SpecialCards] Reveal card - checking player:", {
                            playerId: targetPlayer.id,
                            playerName: targetPlayer.name,
                            characteristicsCount: allCharacteristics.length,
                            allCharacteristics: allCharacteristics.map((c: any) => ({
                              id: c.id,
                              category: c.category,
                              name: c.name,
                              value: c.value,
                              isRevealed: c.isRevealed,
                            })),
                            rawCharacteristics: targetPlayer.characteristics,
                          })
                          
                          // Filter hidden characteristics (NOT revealed)
                          const hiddenCharacteristics = allCharacteristics.filter((c: any) => {
                            const isHidden = !c.isRevealed
                            console.log(`[SpecialCards] Characteristic ${c.category} (${c.id}): isRevealed=${c.isRevealed}, isHidden=${isHidden}`)
                            return isHidden
                          })
                          const hiddenCategories = Array.from(
                            new Set(hiddenCharacteristics.map((c: any) => c.category))
                          )
                          
                          console.log("[SpecialCards] Reveal card - filtered characteristics:", {
                            allCount: allCharacteristics.length,
                            hiddenCount: hiddenCharacteristics.length,
                            hiddenCategories,
                            hiddenCharacteristics: hiddenCharacteristics.map((c: any) => ({
                              id: c.id,
                              category: c.category,
                              name: c.name,
                              isRevealed: c.isRevealed,
                            })),
                          })
                          
                          const categoryLabels: Record<string, string> = {
                            gender: "Пол",
                            age: "Возраст",
                            profession: "Профессия",
                            health: "Здоровье",
                            hobby: "Хобби",
                            phobia: "Фобия",
                            baggage: "Багаж",
                            fact: "Факт",
                            special: "Особое",
                            bio: "Биология",
                            skill: "Навык",
                            trait: "Черта",
                            additional: "Дополнительное",
                          }
                          
                          if (allCharacteristics.length === 0) {
                            // Player has no characteristics at all
                            return (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                У игрока нет характеристик. Возможно, они еще не загружены.
                              </p>
                            )
                          }
                          
                          if (hiddenCategories.length === 0) {
                            // Player has characteristics but all are revealed
                            const totalCount = allCharacteristics.length
                            const revealedCount = allCharacteristics.filter((c) => c.isRevealed).length
                            return (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                У игрока нет скрытых характеристик. Все {totalCount} {totalCount === 1 ? 'характеристика' : totalCount > 1 && totalCount < 5 ? 'характеристики' : 'характеристик'} уже раскрыты.
                              </p>
                            )
                          }
                          
                          return (
                            <div className="space-y-2">
                              {hiddenCategories.map((category) => (
                                <Button
                                  key={category}
                                  variant={selectedCategory === category ? "default" : "outline"}
                                  size="sm"
                                  className={
                                    selectedCategory === category
                                      ? "bg-[oklch(0.7_0.2_50)] text-[oklch(0.1_0_0)] w-full justify-start"
                                      : "border-[oklch(0.3_0.01_60)] text-foreground hover:border-[oklch(0.7_0.2_50)] w-full justify-start"
                                  }
                                  onClick={() => setSelectedCategory(category)}
                                >
                                  {categoryLabels[category] || category}
                                </Button>
                              ))}
                            </div>
                          )
                        }

                        let availableChars = targetPlayer.characteristics

                        if (selectedCard.type === "replace-profession") {
                          availableChars = targetPlayer.characteristics.filter(
                            (c) => c.category === "profession" && c.isRevealed
                          )
                        } else if (selectedCard.type === "replace-health") {
                          availableChars = targetPlayer.characteristics.filter(
                            (c) => c.category === "health" && c.isRevealed
                          )
                        } else if (isCategoryExchange) {
                          // For category-specific exchange, show only characteristics of that category
                          availableChars = targetPlayer.characteristics.filter(
                            (c) => c.category === exchangeCategory && !c.isRevealed
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
                      : isRevealCard && !selectedCategory
                        ? true
                        : (selectedCard.type === "exchange" || 
                            selectedCard.type === "peek" || 
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
