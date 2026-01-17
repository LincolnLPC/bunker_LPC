"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface CatastropheIntroScreenProps {
  catastrophe: string
  bunkerDescription: string
  roundMode: "manual" | "automatic"
  isHost: boolean
  onContinue: () => void
}

// Функция для получения описания катастрофы
function getCatastropheDescription(catastrophe: string): string {
  const descriptions: Record<string, string> = {
    "Ядерная война": "Массовые ядерные удары уничтожили большинство городов. Радиация делает поверхность Земли непригодной для жизни на долгие годы. Необходимо найти убежище с защитой от радиации и запасами еды и воды.",
    "Зомби-апокалипсис": "Неизвестный вирус превращает людей в зомби. Почти всё население погибнет, но часть выживет, превратившись в агрессивных мутантов. Отдельным группам людей удастся выжить в укрепленных территориях. После выхода из бункера вам нужно будет постоянно отбиваться от атак зомби и найти способ защиты от вируса.",
    "Падение астероида": "Огромный астероид столкнулся с Землей, вызвав катастрофические изменения климата. Пыль закрыла солнце, температура резко упала. Растительность погибла, животные вымерли. Нужно пережить долгую зиму в защищенном месте.",
    "Глобальная пандемия": "Смертельный вирус распространился по всему миру. Больницы переполнены, правительства пали. Выжили только те, кто успел изолироваться. Необходимо избегать контактов с зараженными и найти безопасное место для длительного карантина.",
    "Вторжение инопланетян": "Инопланетные захватчики атакуют Землю. Технологии превосходят человеческие. Города уничтожены, армии разгромлены. Нужно спрятаться от захватчиков и разработать стратегию сопротивления.",
    "Восстание машин": "Искусственный интеллект восстал против человечества. Роботы и машины захватили контроль над инфраструктурой. Технологии стали врагом. Необходимо найти убежище без подключения к сетям и выжить в мире, где техника охотится на людей.",
    "Ледниковый период": "Глобальное похолодание наступило внезапно. Температура упала до критических значений, лед покрыл большую часть планеты. Растения и животные погибли. Нужно найти теплое убежище с запасами еды и топлива для отопления.",
    "Глобальное потепление": "Климат изменился катастрофически. Температуры поднялись до невыносимых значений, ледники растаяли, прибрежные города затоплены. Пустыни расширились. Необходимо найти прохладное убежище с запасами воды.",
    "Солнечная вспышка": "Мощная солнечная вспышка уничтожила всю электронику на Земле. Мир погрузился в хаос - нет связи, электричества, транспорта. Вернулись в доиндустриальную эру. Нужно научиться жить без технологий и найти безопасное место.",
    "Извержение супервулкана": "Пробудился супервулкан, выбросив в атмосферу огромное количество пепла. Солнце закрыто, температура упала. Кислотные дожди отравляют почву и воду. Необходимо найти убежище с фильтрацией воздуха и запасами воды.",
    "Массовое вымирание": "По неизвестной причине началось массовое вымирание всех живых организмов. Растения гибнут, животные дохнут. Экосистема рухнула. Нужно найти место с сохраненными запасами и возможностью выращивания пищи.",
    "Аннигиляция магнитосферы": "Земное магнитное поле исчезло. Космическая радиация проникает на поверхность, делая её смертельно опасной. Озоновый слой разрушен. Необходимо найти глубокое подземное убежище с защитой от радиации.",
    "Кибератака мирового масштаба": "Глобальная кибератака уничтожила все цифровые системы. Энергосети отключены, банковская система рухнула, инфраструктура разрушена. Мир погрузился в анархию. Нужно пережить хаос и найти безопасное место.",
    "Химическая война": "Массовое использование химического оружия отравило атмосферу и почву. Токсичные облака покрывают большую часть планеты. Поверхность непригодна для жизни. Необходимо найти герметичное убежище с системами очистки воздуха.",
    "Биологическое оружие": "Выпущено биологическое оружие, создающее смертоносные патогены. Заболевания мутируют, вакцины бесполезны. Большая часть населения погибла. Нужно найти изолированное убежище и избегать контактов с зараженными.",
    "Космическая радиация": "Солнечная буря невероятной силы обрушилась на Землю. Радиация уничтожила всё живое на поверхности. Лишь глубокие подземные убежища могут защитить. Необходимо найти безопасное место под землей.",
    "Столкновение с кометой": "Комета столкнулась с Землей, вызвав глобальные катаклизмы. Цунами, землетрясения, климатические изменения. Поверхность планеты стала опасной. Нужно пережить последствия катастрофы в защищенном месте.",
    "Отключение всей электроники": "Неизвестная причина отключила всю электронику на планете. Магнитный импульс или кибератака - не важно. Мир вернулся в каменный век. Нужно научиться выживать без технологий и найти безопасное убежище.",
  }
  
  return descriptions[catastrophe] || `Катастрофа "${catastrophe}" обрушилась на мир. Поверхность Земли стала опасной для жизни. Вам нужно найти убежище и выжить в этом новом мире.`
}

export function CatastropheIntroScreen({
  catastrophe,
  bunkerDescription,
  roundMode,
  isHost,
  onContinue,
}: CatastropheIntroScreenProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const fullDescription = getCatastropheDescription(catastrophe)

  // Typewriter effect
  useEffect(() => {
    if (!isTyping) return

    let currentIndex = 0
    const typingInterval = setInterval(() => {
      if (currentIndex < fullDescription.length) {
        setDisplayedText(fullDescription.substring(0, currentIndex + 1))
        currentIndex++
      } else {
        setIsTyping(false)
        clearInterval(typingInterval)
      }
    }, 30) // 30ms per character for smooth typing

    return () => clearInterval(typingInterval)
  }, [fullDescription, isTyping])

  // Auto-advance timer for automatic mode
  useEffect(() => {
    if (roundMode === "automatic" && !isTyping) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            onContinue()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [roundMode, isTyping, onContinue])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Затемненное фоновое изображение */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: "url('/apocalyptic-bunker-dark-texture.jpg')",
        }}
      />
      
      {/* Дополнительное затемнение */}
      <div className="absolute inset-0 bg-black/60" />
      
      {/* Контент */}
      <div className="relative z-10 max-w-4xl mx-4 px-8 py-12 space-y-8">
        {/* Название катастрофы */}
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
          <h1 className="text-5xl font-bold text-red-400 drop-shadow-lg">
            {catastrophe}
          </h1>
        </div>

        {/* Описание с эффектом печатания */}
        <div className="bg-black/70 border-2 border-red-500/50 rounded-lg p-6 min-h-[200px]">
          <p className="text-lg text-white leading-relaxed whitespace-pre-wrap">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-2 h-6 bg-red-500 ml-1 animate-pulse" />
            )}
          </p>
        </div>

        {/* Информация о бункере (появляется после завершения печатания) */}
        {!isTyping && (
          <div 
            className="bg-black/70 border-2 border-blue-500/50 rounded-lg p-6 space-y-3 animate-in fade-in duration-500"
          >
            <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Ваше убежище
            </h3>
            <p className="text-white leading-relaxed">{bunkerDescription}</p>
          </div>
        )}

        {/* Кнопки управления */}
        <div className="flex items-center justify-center gap-4">
          {roundMode === "manual" && isHost ? (
            <Button
              onClick={onContinue}
              disabled={isTyping}
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white text-lg px-8 py-6"
            >
              Начать игру
            </Button>
          ) : roundMode === "automatic" ? (
            <div className="text-center space-y-2">
              <div className="text-white text-xl">
                Автоматический переход через: <span className="font-bold text-red-400">{timeRemaining}</span> сек
              </div>
              {isHost && (
                <Button
                  onClick={onContinue}
                  disabled={isTyping}
                  variant="outline"
                  size="lg"
                  className="border-red-500 text-red-400 hover:bg-red-500/10 text-lg px-8 py-6"
                >
                  Начать сейчас
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
