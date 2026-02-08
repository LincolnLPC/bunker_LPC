"use client"

import type { Player } from "@/types/game"
import { PlayerCard, type ActiveCameraEffect } from "./player-card"
import type { CameraEffectType } from "@/lib/camera-effects/config"

interface PlayerGridProps {
  players: Player[]
  maxPlayers: 8 | 12 | 16 | 20
  currentPlayerId?: string
  onToggleCharacteristic?: (playerId: string, characteristicId: string) => void
  onSelectPlayer?: (player: Player) => void
  mutedPlayers?: Set<string>
  onTogglePlayerMute?: (playerId: string) => void
  vdoNinjaCameraUrl?: string | null
  cameraEffects?: Map<string, ActiveCameraEffect[]>
  onCameraEffectDrop?: (playerId: string, effect: CameraEffectType) => void
  onCameraEffectComplete?: (playerId: string, effectId: string) => void
}

export function PlayerGrid({
  players,
  maxPlayers,
  currentPlayerId,
  onToggleCharacteristic,
  onSelectPlayer,
  mutedPlayers,
  onTogglePlayerMute,
  vdoNinjaCameraUrl,
  cameraEffects,
  onCameraEffectDrop,
  onCameraEffectComplete,
}: PlayerGridProps) {
  // Create array with empty slots
  const slots = Array.from({ length: maxPlayers }, (_, i) => {
    return players.find((p) => p.slot === i + 1) || null
  })

  // Determine grid columns based on max players
  const gridCols = maxPlayers <= 8 ? 4 : maxPlayers <= 12 ? 4 : maxPlayers <= 16 ? 4 : 5
  const gridRows = Math.ceil(maxPlayers / gridCols)

  return (
    <div className="flex-1 min-h-0 min-w-0 w-full overflow-hidden p-2 sm:p-3 md:p-4 box-border flex flex-col">
      <div
        className="grid flex-1 w-full min-h-0 gap-1.5 sm:gap-2 md:gap-3"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
        }}
      >
      {slots.map((player, index) => (
        <div key={index} className="relative min-h-0 min-w-0 overflow-hidden">
          {player ? (
            <PlayerCard
              player={player}
              slotNumber={index + 1}
              isCurrentPlayer={player.id === currentPlayerId}
              onToggleCharacteristic={(charId) => onToggleCharacteristic?.(player.id, charId)}
              onSelect={() => onSelectPlayer?.(player)}
              isMuted={mutedPlayers?.has(player.id) ?? false}
              onToggleMute={() => onTogglePlayerMute?.(player.id)}
              vdoNinjaCameraUrl={player.id === currentPlayerId ? vdoNinjaCameraUrl : undefined}
              activeEffects={cameraEffects?.get(player.id) ?? []}
              onEffectDrop={(effect) => onCameraEffectDrop?.(player.id, effect)}
              onEffectComplete={(effectId) => onCameraEffectComplete?.(player.id, effectId)}
            />
          ) : (
            <EmptySlot slotNumber={index + 1} />
          )}
        </div>
      ))}
      </div>
    </div>
  )
}

function EmptySlot({ slotNumber }: { slotNumber: number }) {
  return (
    <div className="relative h-full w-full min-h-0 rounded-sm border-2 border-dashed border-[oklch(0.3_0.02_50)] bg-[oklch(0.08_0.01_60/0.5)] flex items-center justify-center">
      <div className="absolute top-1 left-1 text-[oklch(0.3_0_0)] text-xs font-mono">{slotNumber}</div>
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-[oklch(0.25_0.02_50)]" />
    </div>
  )
}
