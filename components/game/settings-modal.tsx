"use client"

import { useState } from "react"
import type { GameState } from "@/types/game"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { X, Volume2, Bell, LogOut, Copy, Check, User } from "lucide-react"
import Link from "next/link"

interface SettingsModalProps {
  gameState: GameState
  isHost: boolean
  onClose: () => void
  onLeaveGame: () => void
}

export function SettingsModal({ gameState, isHost, onClose, onLeaveGame }: SettingsModalProps) {
  const [volume, setVolume] = useState(80)
  const [notifications, setNotifications] = useState(true)
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(gameState.roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.05_0.01_60/0.9)] backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-lg bg-card border-2 border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Настройки</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Room Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Комната</h3>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <div className="text-xs text-muted-foreground">Код комнаты</div>
                <div className="text-lg font-mono font-bold text-foreground">{gameState.roomCode}</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 rounded bg-secondary/30">
                <div className="text-xs text-muted-foreground">Игроков</div>
                <div className="font-medium text-foreground">
                  {gameState.players.length}/{gameState.maxPlayers}
                </div>
              </div>
              <div className="p-2 rounded bg-secondary/30">
                <div className="text-xs text-muted-foreground">Раунд</div>
                <div className="font-medium text-foreground">{gameState.currentRound}</div>
              </div>
            </div>
          </div>

          {/* Sound Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Звук</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} max={100} step={1} className="flex-1" />
                <span className="text-sm text-muted-foreground w-8">{volume}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="notifications" className="text-sm text-foreground">
                    Уведомления
                  </Label>
                </div>
                <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
              </div>
            </div>
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Управление (Ведущий)
              </h3>
              <div className="text-xs text-muted-foreground">
                Вы являетесь ведущим этой игры. Вы можете управлять раундами и голосованиями.
              </div>
            </div>
          )}

          {/* Account */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Аккаунт</h3>
            <Link href={`/profile?returnTo=${encodeURIComponent(`/game/${gameState.roomCode}`)}`}>
              <Button variant="outline" className="w-full justify-start">
                <User className="w-4 h-4 mr-2" />
                Профиль и настройки
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <Button variant="destructive" className="w-full" onClick={onLeaveGame}>
            <LogOut className="w-4 h-4 mr-2" />
            Покинуть игру
          </Button>
        </div>
      </div>
    </div>
  )
}
