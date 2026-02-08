"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CameraEffectType } from "@/lib/camera-effects/config"
import { CAMERA_EFFECTS, CAMERA_EFFECT_DRAG_TYPE } from "@/lib/camera-effects/config"

interface CameraEffectsPanelProps {
  open: boolean
  onClose: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  isPremium?: boolean
  className?: string
}

export function CameraEffectsPanel({ open, onClose, onDragStart, onDragEnd, isPremium = false, className }: CameraEffectsPanelProps) {
  const [draggingEffect, setDraggingEffect] = useState<CameraEffectType | null>(null)

  const handleDragStart = (e: React.DragEvent, effect: CameraEffectType) => {
    setDraggingEffect(effect)
    onDragStart?.()
    e.dataTransfer.effectAllowed = "copy"
    e.dataTransfer.setData(CAMERA_EFFECT_DRAG_TYPE, effect)
    e.dataTransfer.setData("text/plain", effect)
    if (e.dataTransfer.setDragImage) {
      const el = document.createElement("div")
      el.textContent = CAMERA_EFFECTS[effect].icon
      el.className = "text-3xl pointer-events-none opacity-80"
      el.style.position = "absolute"
      el.style.top = "-1000px"
      document.body.appendChild(el)
      e.dataTransfer.setDragImage(el, 20, 20)
      requestAnimationFrame(() => document.body.removeChild(el))
    }
  }

  const handleDragEnd = () => {
    setDraggingEffect(null)
    onDragEnd?.()
  }

  const effects = Object.values(CAMERA_EFFECTS) as Array<{ id: CameraEffectType; label: string; icon: string }>

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 overflow-hidden transition-all duration-300 ease-out",
        open ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        open && draggingEffect && "opacity-0 pointer-events-none",
        className
      )}
      style={{ bottom: "72px" }}
    >
      <div className="bg-[oklch(0.1_0.02_50/0.98)] border-t border-border backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">
          {isPremium ? "Дразнить — перетащите эффект на камеру игрока" : "Дразнить доступны только премиум игрокам"}
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-[oklch(0.2_0.02_50)] transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex gap-4 px-4 pb-4 overflow-x-auto">
        {isPremium && effects.map((effect) => (
          <div
            key={effect.id}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, effect.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex flex-col items-center gap-1.5 p-4 rounded-xl cursor-grab active:cursor-grabbing select-none min-w-[80px]",
              "bg-[oklch(0.15_0.02_50)] border-2 border-[oklch(0.25_0.02_50)]",
              "hover:bg-[oklch(0.2_0.02_50)] hover:border-[oklch(0.4_0.1_50)] hover:scale-105",
              "transition-all duration-200",
              draggingEffect === effect.id && "opacity-60 scale-95"
            )}
          >
            <span className="text-4xl">{effect.icon}</span>
            <span className="text-xs font-medium text-muted-foreground text-center">{effect.label}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
