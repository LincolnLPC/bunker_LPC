"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface FAQItem {
  id: string
  question: string
  answer: string
  category: "general" | "gameplay" | "technical" | "subscription" | "rating"
}

const faqItems: FAQItem[] = [
  // Общие вопросы
  {
    id: "what-is-bunker",
    question: "Что такое «Бункер Онлайн»?",
    answer:
      "«Бункер Онлайн» — это веб-приложение для игры в «Бункер», популярную социальную игру, где участники должны решить, кто из них достоин попасть в бункер после катастрофы. Игра проходит в реальном времени с видеосвязью между игроками.",
    category: "general",
  },
  {
    id: "how-to-play",
    question: "Как начать играть?",
    answer:
      "Для начала игры необходимо зарегистрироваться или войти в систему. Затем вы можете создать новую комнату или присоединиться к существующей по коду комнаты. После создания комнаты поделитесь кодом с друзьями, и они смогут присоединиться. Когда все готовы, ведущий может начать игру.",
    category: "general",
  },
  {
    id: "minimum-players",
    question: "Сколько игроков нужно для игры?",
    answer:
      "Минимальное количество игроков — 1 (для тестирования). Рекомендуется играть с 4-8 игроками для лучшего игрового опыта. Максимальное количество игроков зависит от вашей подписки: базовый тариф — до 12 игроков, премиум — до 20 игроков.",
    category: "gameplay",
  },
  // Игровой процесс
  {
    id: "characteristics",
    question: "Что такое характеристики игрока?",
    answer:
      "Каждый игрок получает набор характеристик: пол, возраст, профессия, здоровье, хобби, фобия, багаж, факт, особенность, биология, навык и черта характера. Изначально все характеристики скрыты, и игроки могут раскрывать их по ходу игры.",
    category: "gameplay",
  },
  {
    id: "reveal-characteristics",
    question: "Как раскрыть характеристики?",
    answer:
      "Игроки могут раскрывать свои характеристики через кнопку «Раскрыть» в модальном окне «Мои характеристики». Ведущий также может раскрывать характеристики других игроков через панель управления. Раскрытые характеристики видны всем игрокам в комнате.",
    category: "gameplay",
  },
  {
    id: "host-controls",
    question: "Что может делать ведущий?",
    answer:
      "Ведущий может управлять характеристиками игроков (изменять, обменивать, рандомизировать), начинать игру, управлять фазами игры, видеть все характеристики игроков (если выбрана роль «Только ведущий»), а также управлять таймером раундов.",
    category: "gameplay",
  },
  {
    id: "voting",
    question: "Как проходит голосование?",
    answer:
      "После обсуждения игроки голосуют за того, кого они хотят исключить из бункера. Голосование проходит анонимно, и после окончания голосования результаты раскрываются. Игрок с наибольшим количеством голосов исключается. При ничьей выбирается случайный игрок.",
    category: "gameplay",
  },
  {
    id: "whoami-mode",
    question: "Как играть в режиме «Кто Я?»?",
    answer:
      "«Кто Я?» — отдельный режим игры, не связанный с «Бункером». Каждому игроку выдаётся несколько слов (существительные и известные личности). Игрок не видит своё слово — его видят только остальные участники. Задача игрока — задавать вопросы остальным, чтобы отгадать загаданное ему слово. Остальные отвечают на вопросы (да/нет или подсказками). После правильной отгадки можно перейти к следующему слову (кнопка «Следующее слово»). Кто первым отгадает все свои слова — побеждает. Можно включить «Слово по голосованию»: тогда другие игроки подтверждают, что вы правильно отгадали, и только после этого вы переходите к следующему слову.",
    category: "gameplay",
  },
  {
    id: "achievements-whoami",
    question: "Выдаются ли достижения в режиме «Кто Я?»?",
    answer:
      "Да. В режиме «Кто Я?» начисляется отдельная статистика (количество сыгранных игр) и выдаются свои достижения: «Первая игра „Кто я?“», «Знаток „Кто я?“» (10 игр), «Мастер „Кто я?“» (50 игр). Достижения и рейтинг за режим «Бункер» (игры, победы, рейтинг игрока и ведущего) начисляются только за игры в режиме «Бункер».",
    category: "gameplay",
  },
  // Технические вопросы
  {
    id: "camera-microphone",
    question: "Нужна ли камера и микрофон?",
    answer:
      "Камера и микрофон не обязательны, но рекомендуется их использование для полноценного игрового опыта. Если вы не предоставите доступ к камере и микрофону, вы все равно сможете играть, читая сообщения в чате. Вы можете включить камеру и микрофон позже через кнопку «Включить камеру» в игре.",
    category: "technical",
  },
  {
    id: "browser-support",
    question: "Какие браузеры поддерживаются?",
    answer:
      "Приложение поддерживает современные браузеры: Google Chrome (рекомендуется), Mozilla Firefox, Microsoft Edge, Safari. Для работы видеосвязи необходим браузер с поддержкой WebRTC. Убедитесь, что ваш браузер обновлен до последней версии.",
    category: "technical",
  },
  {
    id: "connection-issues",
    question: "Что делать, если возникли проблемы с подключением?",
    answer:
      "Если у вас проблемы с подключением: 1) Проверьте интернет-соединение, 2) Обновите страницу, 3) Проверьте, не блокирует ли браузер или антивирус доступ к камере/микрофону, 4) Попробуйте другой браузер, 5) Очистите кеш браузера. Если проблема сохраняется, обратитесь в поддержку.",
    category: "technical",
  },
  {
    id: "room-code",
    question: "Как работает код комнаты?",
    answer:
      "Код комнаты — это уникальный 6-символьный идентификатор, который создается автоматически при создании комнаты. Вы можете поделиться этим кодом с другими игроками, и они смогут присоединиться к вашей игре, введя код на странице присоединения. Код можно скопировать из модального окна приглашения.",
    category: "technical",
  },
  // Подписки
  {
    id: "subscription-difference",
    question: "В чем разница между базовым и премиум тарифом?",
    answer:
      "Базовый тариф: до 3 комнат в день, до 12 игроков в комнате. Премиум даёт: неограниченное создание комнат; до 20 игроков в комнате; создание кастомных характеристик в игре; сохранение и загрузка шаблонов настроек игры; экспорт результатов игры; расширенные возможности в игре (например, эффекты «дразнить» на камеру); настраиваемый фон блока профиля (картинка в шапке профиля, видна всем). Оплата премиум доступна на странице подписки (ЮKassa).",
    category: "subscription",
  },
  {
    id: "how-to-upgrade",
    question: "Как обновить подписку до премиум?",
    answer:
      "Перейдите на страницу управления подпиской в вашем профиле или через главное меню. Там вы увидите сравнение тарифов и сможете обновить подписку до премиум. Интеграция с платежной системой находится в разработке, но структура API уже готова.",
    category: "subscription",
  },
  {
    id: "subscription-limits",
    question: "Что происходит при достижении лимита комнат?",
    answer:
      "Если вы достигли лимита создания комнат (3 в день для базового тарифа), вы увидите сообщение с предложением обновиться до премиум тарифа. Вы все еще можете присоединяться к существующим комнатам других игроков без ограничений.",
    category: "subscription",
  },
  // Рейтинг
  {
    id: "rating-player",
    question: "Как формируется рейтинг игрока?",
    answer:
      "Рейтинг игрока начисляется за участие в играх в режиме «Бункер»: +5 очков за каждую сыгранную игру, +20 очков за победу. Чем больше вы играете и выигрываете, тем выше рейтинг. Рейтинг отображается в профиле и в таблице лидеров.",
    category: "rating",
  },
  {
    id: "rating-host",
    question: "Как формируется рейтинг ведущего?",
    answer:
      "Рейтинг ведущего начисляется за проведение игр: +20 очков за игру, в которой вы были только ведущим (не игроком), и +10 очков за игру, в которой вы были и ведущим, и игроком. Рейтинг отображается в профиле и в таблице лидеров.",
    category: "rating",
  },
]

const categories = [
  { id: "all", label: "Все вопросы", icon: HelpCircle },
  { id: "general", label: "Общие", icon: HelpCircle },
  { id: "gameplay", label: "Игровой процесс", icon: HelpCircle },
  { id: "technical", label: "Технические", icon: HelpCircle },
  { id: "subscription", label: "Подписки", icon: HelpCircle },
  { id: "rating", label: "Рейтинг", icon: HelpCircle },
]

export default function FAQPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const filteredItems =
    selectedCategory === "all"
      ? faqItems
      : faqItems.filter((item) => item.category === selectedCategory)

  const toggleItem = (id: string) => {
    const newOpen = new Set(openItems)
    if (newOpen.has(id)) {
      newOpen.delete(id)
    } else {
      newOpen.add(id)
    }
    setOpenItems(newOpen)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-background to-background" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-border/50">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Часто задаваемые вопросы</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-6">
          {/* Introduction */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Как мы можем помочь?</CardTitle>
              <CardDescription>
                Здесь вы найдете ответы на самые часто задаваемые вопросы об игре «Бункер Онлайн».
                Если вы не нашли ответ на свой вопрос, свяжитесь с нами через{" "}
                <Link href="/support" className="text-primary hover:underline">
                  форму обратной связи
                </Link>
                .
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </Button>
              )
            })}
          </div>

          {/* FAQ Items */}
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const isOpen = openItems.has(item.id)
              return (
                <Card
                  key={item.id}
                  className="bg-card/50 border-border/50 transition-all hover:bg-card/70"
                >
                  <CardHeader
                    className="cursor-pointer"
                    onClick={() => toggleItem(item.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle className="text-lg">{item.question}</CardTitle>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  {isOpen && (
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>

          {/* No results */}
          {filteredItems.length === 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">В этой категории пока нет вопросов.</p>
              </CardContent>
            </Card>
          )}

          {/* Contact Support */}
          <Card className="bg-primary/10 border-primary/50">
            <CardHeader>
              <CardTitle>Не нашли ответ?</CardTitle>
              <CardDescription>
                Если у вас остались вопросы, свяжитесь с нашей службой поддержки.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/support">
                <Button variant="default" className="w-full sm:w-auto">
                  Связаться с поддержкой
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
