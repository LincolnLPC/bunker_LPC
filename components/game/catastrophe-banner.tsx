"use client"

import { AlertTriangle } from "lucide-react"

interface CatastropheBannerProps {
  catastrophe: string
  bunkerDescription: string
}

export function CatastropheBanner({ catastrophe, bunkerDescription }: CatastropheBannerProps) {
  return (
    <div className="mx-4 mb-2 p-3 bg-[oklch(0.12_0.03_50/0.8)] border border-[oklch(0.7_0.2_50/0.5)] rounded">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[oklch(0.7_0.2_50)] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[oklch(0.7_0.2_50)]">Катастрофа: {catastrophe}</h3>
          <p className="text-xs text-muted-foreground">{bunkerDescription}</p>
        </div>
      </div>
    </div>
  )
}
