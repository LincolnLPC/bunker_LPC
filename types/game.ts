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
  /** Метаданные для эффектов спецкарт (cannotVoteAgainst и др.) */
  metadata?: { cannotVoteAgainst?: { playerId: string }[] }
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

export interface BunkerCharacteristic {
  name: string
  type: "equipment" | "supply"
  isRevealed: boolean
}

export interface BunkerInfo {
  description: string
  area: number
  capacity: number
  duration: string
  supplies: string[]
  equipment: string[]
  threats: string[]
  revealedCharacteristics?: BunkerCharacteristic[]
  totalRevealed?: number
}

export interface Spectator {
  id: string
  userId: string
  userName?: string
  joinedAt: string
}

export interface GameState {
  id: string
  roomCode: string
  phase: "waiting" | "playing" | "voting" | "results" | "finished"
  currentRound: number
  maxPlayers: 8 | 12 | 16 | 20
  catastrophe: string
  bunkerDescription: string
  bunkerInfo?: BunkerInfo // Full bunker information with equipment and supplies
  players: Player[]
  spectators?: Spectator[] // Users watching the game
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
  "Заражен не известным вирусом",
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
  "Блог",
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
  "Электрика",
  "Механика",
  "Стройка",
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
  "Солнечная вспышка",
  "Извержение супервулкана",
  "Массовое вымирание",
  "Аннигиляция магнитосферы",
  "Кибератака мирового масштаба",
  "Химическая война",
  "Биологическое оружие",
  "Космическая радиация",
  "Столкновение с кометой",
  "Отключение всей электроники",
]

export const SAMPLE_BUNKERS = [
  "Подземный бункер на 6 месяцев. Площадь 120м². Запасы еды и воды ограничены.",
  "Военный бункер на 1 год. Площадь 200м². Есть оружейная и медицинский отсек.",
  "Научная станция на 8 месяцев. Площадь 150м². Лаборатория и оранжерея.",
  "Подводная база на 10 месяцев. Площадь 180м². Система регенерации воздуха.",
  "Заброшенная шахта на 9 месяцев. Площадь 100м². Минимальные условия для жизни.",
  "Бывшая ракетная шахта на 2 года. Площадь 250м². Огромные запасы и защита.",
  "Горное убежище на 7 месяцев. Площадь 140м². Естественная вентиляция и источник воды.",
  "Подземное хранилище на 1 год. Площадь 220м². Система фильтрации и генераторы.",
  "Секретная лаборатория на 8 месяцев. Площадь 160м². Оборудование для исследований.",
  "Тоннель метро на 6 месяцев. Площадь 110м². Ограниченные ресурсы.",
  "Складское помещение на 10 месяцев. Площадь 190м². Большой запас продовольствия.",
  "Подвал многоэтажки на 5 месяцев. Площадь 90м². Минимальные удобства.",
  "Пещера с источниками на 12 месяцев. Площадь 130м². Природная защита и вода.",
  "Старое бомбоубежище на 1 год. Площадь 170м². Базовые системы жизнеобеспечения.",
  "Тюремный блок на 8 месяцев. Площадь 150м². Крепкие стены и ворота.",
  "Церковный подвал на 6 месяцев. Площадь 100м². Символическое укрытие.",
  "Госпиталь в подвале на 9 месяцев. Площадь 180м². Медицинское оборудование.",
  "Бункер под фермой на 1 год. Площадь 200м². Семена и инструменты для сельского хозяйства.",
  "Нефтехранилище на 7 месяцев. Площадь 120м². Опасные условия, но хорошая защита.",
  "Обсерватория в горах на 10 месяцев. Площадь 140м². Высокогорное расположение.",
  "Катакомбы на 8 месяцев. Площадь 160м². Разветвленная система тоннелей.",
  "Бывший банковский сейф на 6 месяцев. Площадь 80м². Максимальная защита, минимум места.",
  "Соляная шахта на 1 год. Площадь 210м². Консервирующие свойства соли.",
  "Старая крепость на 9 месяцев. Площадь 190м². Каменные стены и арсенал.",
  "Подземный гараж на 7 месяцев. Площадь 130м². Парковочное пространство для оборудования.",
  "Ядерное убежище времен холодной войны на 2 года. Площадь 280м². Полная автономия.",
  "Водонапорная башня на 8 месяцев. Площадь 110м². Запас воды, но слабая защита.",
  "Холодильное хранилище на 1 год. Площадь 170м². Длительное хранение продуктов.",
  "Заброшенный завод на 10 месяцев. Площадь 240м². Производственное оборудование.",
  "Подземный музей на 9 месяцев. Площадь 180м². Культурные артефакты и истории.",
  "Морской маяк на 6 месяцев. Площадь 95м². Изолированное расположение у моря.",
  "Склеп на кладбище на 7 месяцев. Площадь 85м². Мрачное, но защищенное место.",
  "Теплица с подвалом на 1 год. Площадь 150м². Возможность выращивания пищи.",
  "Старая канализация на 8 месяцев. Площадь 140м². Система очистки и фильтрации.",
]
