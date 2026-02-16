"use client"

import { X } from "lucide-react"

interface MediaErrorBannerProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
}

export function MediaErrorBanner({ message, onRetry, onDismiss }: MediaErrorBannerProps) {
  return (
    <div className="bg-destructive/20 border-b border-destructive/50 px-4 py-2 text-sm text-destructive">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <span className="flex-1 min-w-0">{message}</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-destructive/20 hover:bg-destructive/30 rounded text-xs font-medium"
          >
            Попробовать снова
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded hover:bg-destructive/30 transition-colors"
            title="Закрыть"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
