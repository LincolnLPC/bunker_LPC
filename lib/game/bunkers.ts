// Bunker equipment and supplies options

export const BUNKER_EQUIPMENT = [
  "Система фильтрации воздуха",
  "Оружейная комната",
  "Радиостанция",
  "Оранжерея для выращивания",
  "Мастерская",
  "Медицинский отсек",
  "Генератор электричества",
  "Система очистки воды",
  "Холодильные камеры",
  "Библиотека с книгами",
  "Тренажерный зал",
  "Кухня с плитой",
  "Вентиляционная система",
  "Система безопасности",
  "Комната для хранения",
  "Лаборатория",
  "Коммуникационный центр",
  "Система отопления",
  "Комната отдыха",
  "Прачечная",
  "Склад инструментов",
  "Солнечные панели",
  "Ветрогенератор",
  "Система канализации",
  "Бункерная дверь",
  "Система видеонаблюдения",
  "Аккумуляторные батареи",
  "Комната для животных",
  "Центр управления",
  "Система пожаротушения",
  "Морозильные камеры",
  "Система опреснения",
  "Теплица",
  "Серверная комната",
  "Рабочие станции",
  "Спальные помещения",
  "Столовая",
  "Умывальные комнаты",
  "Склад топлива",
  "Комната для хранения лекарств",
  "Убежище для техники",
  "Система кондиционирования",
  "Дизельная электростанция",
]

export const BUNKER_SUPPLIES = [
  "Консервированные продукты на 3 месяца",
  "Сухие продукты на 6 месяцев",
  "Бутилированная вода на 4 месяца",
  "Фильтры для воды",
  "Медикаменты первой необходимости",
  "Перевязочные материалы",
  "Антибиотики",
  "Обезболивающие препараты",
  "Витамины и добавки",
  "Семена для выращивания",
  "Удобрения для растений",
  "Топливо для генератора",
  "Батарейки различных размеров",
  "Фонарики и свечи",
  "Спички и зажигалки",
  "Одежда и обувь",
  "Одеяла и спальные мешки",
  "Гигиенические принадлежности",
  "Мыло и моющие средства",
  "Бумага и ручки",
  "Карты местности",
  "Компасы",
  "Радиоприемники",
  "Инструменты для ремонта",
  "Запасные части для оборудования",
  "Канистры для воды",
  "Пластиковые контейнеры",
  "Веревки и канаты",
  "Скотч и клей",
  "Металлические контейнеры",
  "Защитные костюмы",
  "Респираторы",
  "Противогазы",
  "Средства связи",
  "Аккумуляторы",
  "Зарядные устройства",
  "Книги и учебники",
  "Настольные игры",
  "Музыкальные инструменты",
  "Запасная обувь",
  "Рабочие перчатки",
  "Защитные очки",
  "Солнечные батареи",
  "Инвертор",
  "Различные виды топлива",
  "Средства для выращивания растений",
  "Пестициды",
  "Садовые инструменты",
  "Запасные лампочки",
  "Электрические провода",
]

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
  revealedCharacteristics?: BunkerCharacteristic[] // Characteristics revealed so far
  totalRevealed?: number // Total number of revealed characteristics
}

// Get bunker capacity based on max players
function getBunkerCapacity(maxPlayers: number): number {
  // Define capacity ranges based on max players
  let minCapacity: number
  let maxCapacity: number

  switch (maxPlayers) {
    case 8:
      minCapacity = 2
      maxCapacity = 4
      break
    case 12:
      minCapacity = 3
      maxCapacity = 5
      break
    case 16:
      minCapacity = 3
      maxCapacity = 8
      break
    case 20:
      minCapacity = 4
      maxCapacity = 11
      break
    default:
      // Default range for unknown max players
      minCapacity = 3
      maxCapacity = 6
  }

  // Return random capacity within the range
  return minCapacity + Math.floor(Math.random() * (maxCapacity - minCapacity + 1))
}

// Parse bunker description to extract information
function parseBunkerDescription(description: string, maxPlayers?: number): Partial<BunkerInfo> {
  // Extract area (e.g., "120м²", "200м²")
  const areaMatch = description.match(/(\d+)\s*м²/)
  const area = areaMatch ? parseInt(areaMatch[1], 10) : 150

  // Extract duration (e.g., "6 месяцев", "1 год", "2 года")
  const durationMatch = description.match(/(\d+)\s*(месяц|год|лет|года)/)
  let duration = "6 мес"
  if (durationMatch) {
    const num = parseInt(durationMatch[1], 10)
    const unit = durationMatch[2]
    if (unit.includes("год")) {
      duration = `${num} ${num === 1 ? "год" : num < 5 ? "года" : "лет"}`
    } else {
      duration = `${num} мес`
    }
  }

  // Use maxPlayers-based capacity if provided, otherwise estimate from area
  const capacity = maxPlayers ? getBunkerCapacity(maxPlayers) : Math.floor(area / 18) || 6

  return {
    area,
    capacity,
    duration,
  }
}

// Generate random supplies
function generateRandomSupplies(count: number): string[] {
  if (count === 0) return []
  const shuffled = [...BUNKER_SUPPLIES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Generate random equipment
function generateRandomEquipment(count: number): string[] {
  if (count === 0) return []
  const shuffled = [...BUNKER_EQUIPMENT].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Generate random threats (0-3 items)
const THREAT_TEMPLATES = [
  "Возможна утечка радиации",
  "Один из выходов заблокирован",
  "Ограниченный запас топлива",
  "Система вентиляции повреждена",
  "Часть оборудования не работает",
  "Ограниченный запас медикаментов",
  "Проблемы с водоснабжением",
  "Электроснабжение нестабильно",
  "Повреждена система безопасности",
  "Ограниченный запас еды",
  "Затопленные участки",
  "Грибковые поражения стен",
  "Крысы и грызуны",
  "Токсичные испарения",
  "Нестабильная структура",
]

function generateRandomThreats(count: number = 2): string[] {
  if (count === 0) return []
  const shuffled = [...THREAT_TEMPLATES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Generate full bunker info from description
export function generateBunkerInfo(bunkerDescription: string, maxPlayers?: number): BunkerInfo {
  const parsed = parseBunkerDescription(bunkerDescription, maxPlayers)
  
  // Total must be 5 characteristics: equipment + supplies = 5
  // Random distribution between 1-4 for each category
  const totalCharacteristics = 5
  const equipmentCount = 1 + Math.floor(Math.random() * 4) // 1-4
  const suppliesCount = totalCharacteristics - equipmentCount // 5 - equipmentCount (1-4)
  
  // Generate random supplies
  const supplies = generateRandomSupplies(suppliesCount)
  
  // Generate random equipment
  const equipment = generateRandomEquipment(equipmentCount)
  
  // Generate random threats (1-3 items, 30% chance of 0 threats)
  const hasThreats = Math.random() > 0.3
  const threatsCount = hasThreats ? (1 + Math.floor(Math.random() * 3)) : 0
  const threats = generateRandomThreats(threatsCount)

  // Initially, all characteristics are hidden (revealedCharacteristics is empty)
  return {
    description: bunkerDescription,
    area: parsed.area || 150,
    capacity: parsed.capacity || 6,
    duration: parsed.duration || "6 мес",
    supplies,
    equipment,
    threats,
    revealedCharacteristics: [], // Start with no revealed characteristics
    totalRevealed: 0, // Start at round 0 (before first round)
  }
}
