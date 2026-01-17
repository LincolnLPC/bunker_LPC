"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Home, Users, Clock, Package, Zap, Droplets, Utensils, Shield } from "lucide-react"
import type { BunkerInfo } from "@/types/game"

interface BunkerInfoProps {
  isOpen: boolean
  onClose: () => void
  bunkerInfo: BunkerInfo
}

export function BunkerInfoModal({ isOpen, onClose, bunkerInfo }: BunkerInfoProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[oklch(0.12_0.01_60)] border-[oklch(0.7_0.2_50)] text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[oklch(0.7_0.2_50)] text-xl flex items-center gap-2">
            <Home className="w-5 h-5" />
            Информация о бункере
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {/* Description */}
            <div className="p-4 bg-[oklch(0.15_0.02_60)] rounded-lg border border-[oklch(0.25_0.01_60)]">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{bunkerInfo.description}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[oklch(0.15_0.02_60)] rounded-lg border border-[oklch(0.25_0.01_60)] text-center">
                <Home className="w-5 h-5 mx-auto mb-1 text-[oklch(0.7_0.2_50)]" />
                <p className="text-lg font-bold">{bunkerInfo.area}м²</p>
                <p className="text-xs text-muted-foreground">Площадь</p>
              </div>
              <div className="p-3 bg-[oklch(0.15_0.02_60)] rounded-lg border border-[oklch(0.25_0.01_60)] text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-[oklch(0.7_0.2_50)]" />
                <p className="text-lg font-bold">{bunkerInfo.capacity}</p>
                <p className="text-xs text-muted-foreground">Вместимость</p>
              </div>
              <div className="p-3 bg-[oklch(0.15_0.02_60)] rounded-lg border border-[oklch(0.25_0.01_60)] text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-[oklch(0.7_0.2_50)]" />
                <p className="text-lg font-bold">{bunkerInfo.duration}</p>
                <p className="text-xs text-muted-foreground">Срок</p>
              </div>
            </div>

            {/* Supplies - Show only revealed */}
            {bunkerInfo.revealedCharacteristics && bunkerInfo.revealedCharacteristics.length > 0 && (
              <>
                {bunkerInfo.revealedCharacteristics.filter((c: any) => c.type === "supply").length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-[oklch(0.7_0.2_50)]">Запасы</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {bunkerInfo.revealedCharacteristics
                        .filter((c: any) => c.type === "supply")
                        .map((char: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-[oklch(0.15_0.02_60)] rounded-lg">
                            <Package className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <p className="text-sm">{char.name}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Equipment - Show only revealed */}
                {bunkerInfo.revealedCharacteristics.filter((c: any) => c.type === "equipment").length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-[oklch(0.7_0.2_50)]">Оснащение</h3>
                    <ul className="space-y-1">
                      {bunkerInfo.revealedCharacteristics
                        .filter((c: any) => c.type === "equipment")
                        .map((charItem: any, index: number) => (
                          <li key={index} className="flex items-center gap-2 text-sm p-2 bg-[oklch(0.15_0.02_60)] rounded">
                            <Shield className="w-3 h-3 text-green-400 flex-shrink-0" />
                            {charItem.name}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Show message if no characteristics revealed yet */}
            {(!bunkerInfo.revealedCharacteristics || bunkerInfo.revealedCharacteristics.length === 0) && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Характеристики бункера будут открываться по мере исследования (по одной на каждый раунд)
              </div>
            )}

            {/* Threats */}
            {bunkerInfo.threats && bunkerInfo.threats.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-destructive">Угрозы</h3>
                <ul className="space-y-1">
                  {bunkerInfo.threats.map((threat, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-sm p-2 bg-[oklch(0.15_0.02_60)] rounded text-destructive/80"
                    >
                      <span className="w-2 h-2 bg-destructive rounded-full flex-shrink-0" />
                      {threat}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// Default bunker info
export const DEFAULT_BUNKER_INFO: BunkerInfo = {
  description:
    "Подземный военный бункер, построенный во времена холодной войны. Оборудован системой фильтрации воздуха, автономным электроснабжением и запасами продовольствия. Имеет два выхода на поверхность.",
  area: 200,
  capacity: 6,
  duration: "12 мес",
  supplies: {
    food: "На 8 месяцев",
    water: "Артезианская скважина",
    power: "Дизель-генератор",
    medical: "Полный медблок",
  },
  features: [
    "Система очистки воздуха",
    "Оружейная комната",
    "Радиостанция",
    "Оранжерея для выращивания",
    "Мастерская",
    "Медицинский отсек",
  ],
  threats: ["Возможна утечка радиации", "Один из выходов заблокирован", "Ограниченный запас топлива"],
}
