"use client"

import type { Player, Characteristic } from "@/types/game"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Eye, EyeOff, User, Skull, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReportModal } from "@/components/moderation/report-modal"
import { useState } from "react"

interface PlayerDetailModalProps {
  player: Player
  isCurrentPlayer: boolean
  isHost: boolean
  hostRole?: "host_and_player" | "host_only"
  roomId?: string
  onClose: () => void
  onRevealCharacteristic?: (characteristicId: string) => void
}

export function PlayerDetailModal({
  player,
  isCurrentPlayer,
  isHost,
  hostRole = "host_and_player",
  roomId,
  onClose,
  onRevealCharacteristic,
}: PlayerDetailModalProps) {
  const [showReportModal, setShowReportModal] = useState(false)
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
      trait: "Черта характера",
      additional: "Дополнительно",
    }
    return labels[category] || category
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      gender: "bg-[oklch(0.6_0.2_300/0.3)] border-[oklch(0.6_0.2_300)]",
      age: "bg-[oklch(0.6_0.15_60/0.3)] border-[oklch(0.6_0.15_60)]",
      profession: "bg-[oklch(0.65_0.18_40/0.3)] border-[oklch(0.65_0.18_40)]",
      health: "bg-[oklch(0.5_0.15_140/0.3)] border-[oklch(0.5_0.15_140)]",
      hobby: "bg-[oklch(0.6_0.15_200/0.3)] border-[oklch(0.6_0.15_200)]",
      phobia: "bg-[oklch(0.55_0.2_25/0.3)] border-[oklch(0.55_0.2_25)]",
      baggage: "bg-[oklch(0.6_0.15_80/0.3)] border-[oklch(0.6_0.15_80)]",
      fact: "bg-[oklch(0.6_0.1_280/0.3)] border-[oklch(0.6_0.1_280)]",
      special: "bg-[oklch(0.7_0.2_50/0.3)] border-[oklch(0.7_0.2_50)]",
      bio: "bg-[oklch(0.5_0.1_180/0.3)] border-[oklch(0.5_0.1_180)]",
      skill: "bg-[oklch(0.55_0.15_120/0.3)] border-[oklch(0.55_0.15_120)]",
      trait: "bg-[oklch(0.6_0.12_320/0.3)] border-[oklch(0.6_0.12_320)]",
    }
    return colors[category] || "bg-muted border-border"
  }

  // Can view if it's revealed, or if current player/host
  // Current player can always see their own characteristics (even if not revealed)
  // Host can only see all characteristics if in "host_only" mode (not "host_and_player")
  const canView = (char: Characteristic) => {
    if (char.isRevealed) return true // Revealed characteristics are visible to everyone
    if (isCurrentPlayer) return true // Current player always sees their own characteristics
    // Host can see all characteristics only if in "host_only" mode
    if (isHost && hostRole === "host_only") return true
    return false // Otherwise, hidden characteristics are not visible
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-lg bg-card border-2 border-primary overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[oklch(0.1_0.02_50)] border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                player.isEliminated ? "bg-destructive/20" : "bg-primary/20",
              )}
            >
              {player.isEliminated ? (
                <Skull className="w-6 h-6 text-destructive" />
              ) : (
                <User className="w-6 h-6 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{player.name}</h2>
              {/* Gender, age, profession are now shown as characteristics if revealed */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {/* Find revealed gender, age, profession from characteristics */}
                {(() => {
                  const genderChar = player.characteristics.find(c => c.category === 'gender' && c.isRevealed)
                  const ageChar = player.characteristics.find(c => c.category === 'age' && c.isRevealed)
                  const professionChar = player.characteristics.find(c => c.category === 'profession' && c.isRevealed)
                  
                  const revealed: string[] = []
                  if (genderChar) revealed.push(genderChar.value)
                  if (ageChar) revealed.push(ageChar.value)
                  if (professionChar) revealed.push(professionChar.value)
                  
                  return revealed.length > 0 ? (
                    <span className="text-primary">{revealed.join(' • ')}</span>
                  ) : isCurrentPlayer || isHost ? (
                    <span className="text-muted-foreground italic">Характеристики скрыты</span>
                  ) : (
                    <span className="text-muted-foreground italic">Характеристики скрыты</span>
                  )
                })()}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Characteristics */}
        <ScrollArea className="h-[60vh]">
          <div className="p-4 space-y-2">
            {player.characteristics.map((char) => (
              <div
                key={char.id}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  canView(char) ? getCategoryColor(char.category) : "bg-muted/50 border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {char.isRevealed ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {getCategoryLabel(char.category)}
                    </span>
                  </div>
                  {!char.isRevealed && isCurrentPlayer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-primary hover:text-primary"
                      onClick={() => onRevealCharacteristic?.(char.id)}
                    >
                      Раскрыть
                    </Button>
                  )}
                </div>
                <div className="mt-1">
                  {isCurrentPlayer ? (
                    // Current player sees all their characteristics
                    <div className="space-y-1">
                      <span className="text-foreground font-medium">{char.value}</span>
                      {!char.isRevealed && (
                        <div className="text-xs text-muted-foreground italic">
                          (Ещё не раскрыто другим игрокам)
                        </div>
                      )}
                    </div>
                  ) : canView(char) ? (
                    <span className="text-foreground font-medium">{char.value}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Скрыто</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          {player.isEliminated && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
              <span className="text-destructive font-semibold">Игрок выбыл из бункера</span>
            </div>
          )}
          
          {!isCurrentPlayer && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setShowReportModal(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Пожаловаться на игрока
            </Button>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        open={showReportModal}
        onOpenChange={setShowReportModal}
        reportedUserId={player.userId || player.id}
        reportedUserName={player.name}
        roomId={roomId}
      />
    </div>
  )
}
