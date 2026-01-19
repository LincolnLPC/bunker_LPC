"use client"

import { Eye, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Spectator } from "@/types/game"

interface SpectatorsListProps {
  spectators: Spectator[]
}

export function SpectatorsList({ spectators }: SpectatorsListProps) {
  if (!spectators || spectators.length === 0) {
    return null
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Зрители
          <Badge variant="secondary" className="ml-auto">
            {spectators.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {spectators.map((spectator) => (
            <div
              key={spectator.id}
              className="px-2 py-1 rounded-md bg-background/50 border border-border/50 text-xs"
            >
              {spectator.userName}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
