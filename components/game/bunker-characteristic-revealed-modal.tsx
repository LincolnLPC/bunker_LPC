"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Home, Package, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface BunkerCharacteristicRevealedModalProps {
  isOpen: boolean
  characteristicName: string
  characteristicType: "equipment" | "supply"
  onClose: () => void
}

export function BunkerCharacteristicRevealedModal({
  isOpen,
  characteristicName,
  characteristicType,
  onClose,
}: BunkerCharacteristicRevealedModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setTimeout(() => {
          onClose()
        }, 300) // Wait for animation to complete
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  const getIcon = () => {
    if (characteristicType === "equipment") {
      return <Shield className="w-12 h-12 text-green-400" />
    }
    return <Package className="w-12 h-12 text-blue-400" />
  }

  const getTypeLabel = () => {
    return characteristicType === "equipment" ? "Оснащение" : "Запас"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[oklch(0.12_0.01_60)] border-[oklch(0.7_0.2_50)] text-foreground max-w-2xl overflow-hidden p-0">
        <div
          className={cn(
            "relative p-8 space-y-6 transition-all duration-500",
            isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.15_0.05_60)] to-[oklch(0.1_0.02_60)] opacity-50" />

          {/* Content */}
          <div className="relative z-10 text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center animate-pulse">{getIcon()}</div>

            {/* Title */}
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-[oklch(0.7_0.2_50)] flex items-center justify-center gap-2">
                <Home className="w-6 h-6" />
                Исследуя бункер вы обнаружили в нем
              </DialogTitle>
            </DialogHeader>

            {/* Type */}
            <div className="text-lg font-semibold text-[oklch(0.6_0.15_50)]">
              {getTypeLabel()}
            </div>

            {/* Characteristic name */}
            <div className="text-3xl font-bold text-white bg-[oklch(0.15_0.02_60)] border-2 border-[oklch(0.7_0.2_50)] rounded-lg p-6">
              {characteristicName}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
