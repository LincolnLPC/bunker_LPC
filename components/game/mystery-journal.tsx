"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import type { Player, GameState } from "@/types/game"

interface MysteryJournalProps {
  isOpen: boolean
  onClose: () => void
  gameState: GameState
  players: Player[]
}

export function MysteryJournal({ isOpen, onClose, gameState, players }: MysteryJournalProps) {
  const [currentPage, setCurrentPage] = useState(0)

  if (!isOpen) return null

  const pages = [
    {
      title: "Катастрофа",
      content: (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <h3 className="text-lg font-bold text-destructive mb-2">Угроза</h3>
            <p className="text-foreground">{gameState.catastrophe}</p>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <h3 className="text-lg font-bold text-primary mb-2">Бункер</h3>
            <p className="text-foreground">{gameState.bunkerDescription}</p>
          </div>
        </div>
      ),
    },
    {
      title: "Выжившие",
      content: (
        <div className="space-y-3">
          {players
            .filter((p) => !p.isEliminated)
            .map((player) => (
              <div key={player.id} className="p-3 rounded-lg bg-card/50 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">{player.name}</span>
                  {/* Show gender and age only if revealed */}
                  {(() => {
                    const genderChar = player.characteristics.find(c => c.category === 'gender' && c.isRevealed)
                    const ageChar = player.characteristics.find(c => c.category === 'age' && c.isRevealed)
                    return (genderChar || ageChar) ? (
                      <span className="text-sm text-muted-foreground">
                        {genderChar?.value} {ageChar?.value}
                      </span>
                    ) : null
                  })()}
                </div>
                {/* Show profession only if revealed */}
                {(() => {
                  const professionChar = player.characteristics.find(c => c.category === 'profession' && c.isRevealed)
                  return professionChar ? (
                    <div className="text-sm text-primary mb-1">{professionChar.value}</div>
                  ) : null
                })()}
                <div className="space-y-1">
                  {player.characteristics
                    .filter((c) => c.isRevealed && !['gender', 'age', 'profession'].includes(c.category))
                    .map((char) => (
                      <div key={char.id} className="text-xs text-muted-foreground">
                        {char.name}: {char.value}
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      ),
    },
    {
      title: "Выбывшие",
      content: (
        <div className="space-y-3">
          {players.filter((p) => p.isEliminated).length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Пока никто не выбыл</div>
          ) : (
            players
              .filter((p) => p.isEliminated)
              .map((player) => (
                <div
                  key={player.id}
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 opacity-70"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold line-through">{player.name}</span>
                    {/* Show gender and age from characteristics (eliminated players have all revealed) */}
                    {(() => {
                      const genderChar = player.characteristics.find(c => c.category === 'gender')
                      const ageChar = player.characteristics.find(c => c.category === 'age')
                      return (genderChar || ageChar) ? (
                        <span className="text-sm text-muted-foreground">
                          {genderChar?.value} {ageChar?.value}
                        </span>
                      ) : null
                    })()}
                  </div>
                  {/* Show profession from characteristics */}
                  {(() => {
                    const professionChar = player.characteristics.find(c => c.category === 'profession')
                    return professionChar ? (
                      <div className="text-sm text-destructive mb-1">{professionChar.value}</div>
                    ) : null
                  })()}
                  <div className="space-y-1">
                    {player.characteristics
                      .filter(c => !['gender', 'age', 'profession'].includes(c.category))
                      .map((char) => (
                        <div key={char.id} className="text-xs text-muted-foreground">
                          {char.name}: {char.value}
                        </div>
                      ))}
                  </div>
                </div>
              ))
          )}
        </div>
      ),
    },
    {
      title: "Статистика",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-card/50 border border-border/50 text-center">
              <div className="text-3xl font-bold text-primary">{gameState.currentRound}</div>
              <div className="text-sm text-muted-foreground">Раунд</div>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50 text-center">
              <div className="text-3xl font-bold text-foreground">{players.filter((p) => !p.isEliminated).length}</div>
              <div className="text-sm text-muted-foreground">Выжившие</div>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50 text-center">
              <div className="text-3xl font-bold text-destructive">{players.filter((p) => p.isEliminated).length}</div>
              <div className="text-sm text-muted-foreground">Выбывшие</div>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/50 text-center">
              <div className="text-3xl font-bold text-muted-foreground">{gameState.maxPlayers}</div>
              <div className="text-sm text-muted-foreground">Макс. мест</div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Загадочный журнал</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Page tabs */}
        <div className="flex border-b border-border">
          {pages.map((page, index) => (
            <button
              key={page.title}
              onClick={() => setCurrentPage(index)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                currentPage === index
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {page.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">{pages[currentPage].content}</div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/50">
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage + 1} / {pages.length}
          </span>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
            disabled={currentPage === pages.length - 1}
          >
            Далее
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
