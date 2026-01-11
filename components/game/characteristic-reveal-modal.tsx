"use client"

import { useState } from "react"
import type { Characteristic } from "@/types/game"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

interface CharacteristicRevealModalProps {
  characteristics: Characteristic[]
  onReveal: (characteristicId: string) => void
  onClose: () => void
  maxReveals?: number
}

export function CharacteristicRevealModal({
  characteristics,
  onReveal,
  onClose,
  maxReveals = 1,
}: CharacteristicRevealModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  console.log("[CharacteristicRevealModal] Characteristics received:", characteristics?.length || 0, characteristics)

  const unrevealedChars = characteristics.filter((c) => !c.isRevealed)
  
  console.log("[CharacteristicRevealModal] Unrevealed characteristics:", unrevealedChars.length, unrevealedChars)

  const handleConfirm = () => {
    if (selectedId) {
      onReveal(selectedId)
      onClose()
    }
  }

  const getCategoryLabel = (category: string) => {
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
      additional: "Доп.",
    }
    return labels[category] || category
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 p-6 rounded-lg bg-card border-2 border-primary">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-primary bunker-title mb-2">РАСКРЫТЬ ХАРАКТЕРИСТИКУ</h2>
          <p className="text-sm text-muted-foreground">Выберите характеристику для раскрытия другим игрокам</p>
        </div>

        {/* Characteristics list */}
        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
          {unrevealedChars.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Все характеристики уже раскрыты</p>
          ) : (
            unrevealedChars.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedId(char.id)}
                className={cn(
                  "w-full p-3 rounded-lg border-2 transition-all text-left",
                  "hover:border-primary hover:bg-primary/10",
                  selectedId === char.id
                    ? "border-primary bg-primary/20 card-glow-orange"
                    : "border-border bg-secondary/50",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center",
                      selectedId === char.id ? "bg-primary/30" : "bg-muted",
                    )}
                  >
                    {selectedId === char.id ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{getCategoryLabel(char.category)}</div>
                    <div className="font-medium text-foreground truncate">{char.value}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <Button variant="default" onClick={handleConfirm} disabled={!selectedId}>
            Раскрыть
          </Button>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  )
}
