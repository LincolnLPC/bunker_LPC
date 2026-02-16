"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"

interface RoundTimerProps {
  duration: number // in seconds
  isActive: boolean
  onTimeUp?: () => void
  className?: string
  startedAt?: string // ISO timestamp when round started (for server-side sync)
  /** Periodic server sync: when set, overrides local countdown to avoid drift */
  serverTimeRemaining?: number | null
}

export function RoundTimer({ duration, isActive, onTimeUp, className, startedAt, serverTimeRemaining }: RoundTimerProps) {
  const calculateTimeRemaining = useCallback(() => {
    if (startedAt) {
      const startTime = new Date(startedAt).getTime()
      const now = new Date().getTime()
      const elapsed = Math.floor((now - startTime) / 1000)
      return Math.max(0, duration - elapsed)
    }
    return duration
  }, [startedAt, duration])

  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining)

  useEffect(() => {
    setTimeRemaining(calculateTimeRemaining())
  }, [calculateTimeRemaining])

  // Sync with server when serverTimeRemaining is provided (periodic check)
  useEffect(() => {
    if (isActive && typeof serverTimeRemaining === "number" && serverTimeRemaining >= 0) {
      setTimeRemaining(serverTimeRemaining)
    }
  }, [isActive, serverTimeRemaining])

  useEffect(() => {
    if (!isActive) {
      setTimeRemaining(calculateTimeRemaining())
      return
    }

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining()
      setTimeRemaining(remaining)
      
      if (remaining <= 0) {
        clearInterval(interval)
        onTimeUp?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, onTimeUp, calculateTimeRemaining])

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  const isLow = timeRemaining <= 30
  const isCritical = timeRemaining <= 10

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-lg transition-colors",
        isCritical
          ? "bg-destructive/20 text-destructive animate-pulse"
          : isLow
            ? "bg-[oklch(0.7_0.2_50/0.2)] text-[oklch(0.7_0.2_50)]"
            : "bg-secondary text-foreground",
        className,
      )}
    >
      <Clock className="w-4 h-4" />
      <span>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  )
}
