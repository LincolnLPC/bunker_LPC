export type Gender = "М" | "Ж" | "А"
export type GenderModifier = "" | "(с)" | "(а)"

export interface Characteristic {
  id: string
  name: string
  value: string
  isRevealed: boolean
  category:
    | "gender"
    | "age"
    | "profession"
    | "bio"
    | "health"
    | "hobby"
    | "phobia"
    | "baggage"
    | "fact"
    | "special"
    | "skill"
    | "trait"
    | "additional"
  sortOrder?: number
}

export interface Player {
  id: string
  userId?: string // User ID from auth.users
  slot: number
  name: string
  gender: Gender
  genderModifier: GenderModifier
  age: number
  profession: string
  characteristics: Characteristic[]
  isEliminated: boolean
  isHost: boolean
  isReady?: boolean
  videoEnabled: boolean
  audioEnabled: boolean
  stream?: MediaStream
}

export interface Vote {
  id: string
  voterId: string
  targetId: string
  round: number
}

export interface ChatMessage {
  id: string
  playerId?: string
  playerName?: string
  message: string
  type: "chat" | "system" | "vote" | "reveal"
  timestamp: Date
}

export interface GameState {
  id: string
  roomCode: string
  phase: "waiting" | "playing" | "voting" | "results" | "finished"
  currentRound: number
  maxPlayers: 8 | 12 | 16 | 20
  catastrophe: string
  bunkerDescription: string
  players: Player[]
  hostId: string
  votes: Vote[]
  chatMessages: ChatMessage[]
  roundTimerSeconds: number
  roundStartedAt?: string // ISO timestamp when current round started
  createdAt: string
  settings?: {
    hostRole?: "host_and_player" | "host_only"
    autoReveal?: boolean
    spectators?: boolean
    roundMode?: "manual" | "automatic"
    discussionTime?: number // Время на обсуждение (секунды)
    votingTime?: number // Время на голосование (секунды)
    [key: string]: any
  }
}

export interface CharacteristicCard {
  label: string
  value: string
  color: "orange" | "cyan" | "default"
}

export const SAMPLE_PROFESSIONS = [
  "Пожарный",
  "Программист",
  "Вирусолог",
  "Видеоинженер",
  "Экстрасенс",
  "Физик",
  "Грабитель",
  "Врач",
  "Учитель",
  "Полицейский",
  "Повар",
  "Инженер",
  "Военный",
  "Медсестра",
  "Архитектор",
  "Психолог",
]

export const SAMPLE_HEALTH_CONDITIONS = [
  "Идеально здоров",
  "Алкоголизм",
  "ЗОЖ",
  "Тремор рук",
  "Не обследовался",
  "ВИЧ",
  "Грибы и гомеопатия",
  "Диабет",
  "Астма",
  "Близорукость",
  "Глухота на одно ухо",
  "Аллергия на пыль",
]

export const SAMPLE_HOBBIES = [
  "Медитация",
  "Современное искусство",
  "Пиротехника",
  "Паралимпийские игры",
  "Котята",
  "Йога",
  "Шахматы",
  "Охота",
  "Программирование",
  "Садоводство",
  "Кулинария",
]

export const SAMPLE_PHOBIAS = [
  "Андрофобия (боится мужчин)",
  "Клаустрофобия",
  "Арахнофобия",
  "Агорафобия",
  "Никтофобия (боится темноты)",
  "Гемофобия (боится крови)",
  "Аэрофобия",
  "Социофобия",
]

export const SAMPLE_BAGGAGE = [
  "Мешок зерна",
  "Снайперская винтовка",
  "Чемоданчик фельдшера",
  "Запас виагры",
  "ПНВ",
  "Набор инструментов",
  "Аптечка",
  "Радиостанция",
  "Генератор",
  "Палатка",
]

export const SAMPLE_FACTS = [
  "Победитель паралимпийских игр",
  "Свинг вечеринки",
  "Выжил на необитаемом острове",
  "Маньяк-Убийца",
  "Был в тюрьме",
  "Знает 5 языков",
  "Чемпион по стрельбе",
  "Бывший спецназовец",
]

export const SAMPLE_SPECIAL = [
  "Бесплодие",
  "Беременность 3-й триместр",
  "Двойняшки",
  "Иммунитет к радиации",
  "Фотографическая память",
  "Гениальность",
]

export const SAMPLE_BIO = [
  "Рост 195 см",
  "Рост 150 см",
  "Вес 120 кг",
  "Атлетическое телосложение",
  "Худощавое телосложение",
]

export const SAMPLE_SKILLS = [
  "Владение оружием",
  "Первая помощь",
  "Электрик",
  "Механик",
  "Строитель",
  "Выживание в дикой природе",
]

export const SAMPLE_TRAITS = ["Истеричный", "Спокойный", "Лидер", "Интроверт", "Агрессивный", "Трусливый", "Оптимист"]

export const SAMPLE_CATASTROPHES = [
  "Ядерная война",
  "Зомби-апокалипсис",
  "Падение астероида",
  "Глобальная пандемия",
  "Вторжение инопланетян",
  "Восстание машин",
  "Ледниковый период",
  "Глобальное потепление",
]

export const SAMPLE_BUNKERS = [
  "Подземный бункер на 6 месяцев. Площадь 120м². Запасы еды и воды ограничены.",
  "Военный бункер на 1 год. Площадь 200м². Есть оружейная и медицинский отсек.",
  "Научная станция на 8 месяцев. Площадь 150м². Лаборатория и оранжерея.",
  "Подводная база на 10 месяцев. Площадь 180м². Система регенерации воздуха.",
]
