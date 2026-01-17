"use client"

import { useEffect, useState } from "react"
import { Sparkles, Shuffle, Eye, Shield, Target, RefreshCw } from "lucide-react"
import type React from "react"
import { cn } from "@/lib/utils"

interface SpecialCardUsedModalProps {
  isOpen: boolean
  playerName: string
  cardName: string
  cardDescription: string
  cardType: string
  onClose: () => void
}

export function SpecialCardUsedModal({
  isOpen,
  playerName,
  cardName,
  cardDescription,
  cardType,
  onClose,
}: SpecialCardUsedModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false)
        setTimeout(() => {
          onClose()
        }, 300) // Wait for fade out animation
      }, 3000)

      return () => clearTimeout(timer)
    } else {
      setIsAnimating(false)
    }
  }, [isOpen, onClose])

  const getCardIcon = (type: string) => {
    // All exchange cards use the same icon
    if (type.startsWith("exchange-")) {
      return <Shuffle className="w-16 h-16" />
    }
    
    switch (type) {
      case "exchange":
        return <Shuffle className="w-16 h-16" />
      case "peek":
        return <Eye className="w-16 h-16" />
      case "immunity":
        return <Shield className="w-16 h-16" />
      case "reroll":
        return <RefreshCw className="w-16 h-16" />
      case "reveal":
        return <Target className="w-16 h-16" />
      case "steal":
        return <Sparkles className="w-16 h-16" />
      case "double-vote":
        return <Sparkles className="w-16 h-16" />
      case "no-vote-against":
        return <Shield className="w-16 h-16" />
      case "reshuffle":
        return <Shuffle className="w-16 h-16" />
      case "revote":
        return <RefreshCw className="w-16 h-16" />
      case "replace-profession":
      case "replace-health":
        return <RefreshCw className="w-16 h-16" />
      default:
        return <Sparkles className="w-16 h-16" />
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300",
        isAnimating ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative bg-[oklch(0.12_0.01_60)] border-2 border-[oklch(0.7_0.2_50)] rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl",
          "transform transition-all duration-500",
          isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card icon with animation */}
        <div className="flex justify-center mb-6">
          <div
            className={cn(
              "text-[oklch(0.7_0.2_50)] transition-transform duration-500",
              isAnimating ? "scale-100 rotate-0" : "scale-0 rotate-180",
            )}
          >
            {getCardIcon(cardType)}
          </div>
        </div>

        {/* Player name */}
        <div className="text-center mb-4">
          <p className="text-lg text-muted-foreground mb-2">Использовал карту:</p>
          <h2 className="text-3xl font-bold text-[oklch(0.7_0.2_50)]">{playerName}</h2>
        </div>

        {/* Card name */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-semibold text-foreground">{cardName}</h3>
        </div>

        {/* Card description */}
        <div className="text-center">
          <p className="text-lg text-muted-foreground leading-relaxed">{cardDescription}</p>
        </div>
      </div>
    </div>
  )
}
