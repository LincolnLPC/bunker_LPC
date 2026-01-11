"use client"

import type { Player } from "@/types/game"
import { PlayerCard } from "./player-card"

interface PlayerGridProps {
  players: Player[]
  maxPlayers: 8 | 12 | 16 | 20
  currentPlayerId?: string
  onToggleCharacteristic?: (playerId: string, characteristicId: string) => void
  onSelectPlayer?: (player: Player) => void
}

export function PlayerGrid({
  players,
  maxPlayers,
  currentPlayerId,
  onToggleCharacteristic,
  onSelectPlayer,
}: PlayerGridProps) {
  // Create array with empty slots
  const slots = Array.from({ length: maxPlayers }, (_, i) => {
    return players.find((p) => p.slot === i + 1) || null
  })

  // Determine grid columns based on max players
  const gridCols = maxPlayers <= 8 ? 4 : maxPlayers <= 12 ? 4 : maxPlayers <= 16 ? 4 : 5

  return (
    <div
      className="grid gap-3 p-4"
      style={{
        gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
      }}
    >
      {slots.map((player, index) => (
        <div key={index} className="relative">
          {player ? (
            <PlayerCard
              player={player}
              slotNumber={index + 1}
              isCurrentPlayer={player.id === currentPlayerId}
              onToggleCharacteristic={(charId) => onToggleCharacteristic?.(player.id, charId)}
              onSelect={() => onSelectPlayer?.(player)}
            />
          ) : (
            <EmptySlot slotNumber={index + 1} />
          )}
        </div>
      ))}
    </div>
  )
}

function EmptySlot({ slotNumber }: { slotNumber: number }) {
  return (
    <div className="relative aspect-[4/3] rounded-sm border-2 border-dashed border-[oklch(0.3_0.02_50)] bg-[oklch(0.08_0.01_60/0.5)] flex items-center justify-center">
      <div className="absolute top-1 left-1 text-[oklch(0.3_0_0)] text-xs font-mono">{slotNumber}</div>
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-[oklch(0.25_0.02_50)]" />
    </div>
  )
}
