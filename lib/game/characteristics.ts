/**
 * Все возможные характеристики для игры "Бункер"
 * Разделены по категориям для удобства использования
 */

// Пол
export const GENDERS = ["М", "Ж", "А"] as const
export type Gender = typeof GENDERS[number]

// Модификаторы пола
export const GENDER_MODIFIERS = ["", "(с)", "(а)"] as const
export type GenderModifier = typeof GENDER_MODIFIERS[number]

// Возраст (генерируется случайно от 18 до 80)
export const AGE_RANGE = { min: 18, max: 80 }

// Профессии
export const PROFESSIONS = [
  "Пожарный",
  "Адвокат",
  "Этнограф",
  "Робототехник",
  "Строитель",
  "Переводчик",
  "Браконьер",
  "Продавец",
  "Полицейский",
  "Детектив",
  "Автомеханик",
  "Биолог",
  "Хакер",
  "Экстрасенс",
  "Сексолог",
  "Историк",
  "Повар",
  "Модель",
  "Физик",
  "Коуч",
  "Химик",
  "Журналист",
  "Философ",
  "Медсестра",
  "Эколог",
  "Тату-мастер",
  "Дизайнер",
  "Электрик",
  "Видеоинженер",
  "Фермер",
  "Экскурсовод",
  "Маркетолог",
  "Гомеопат",
  "Судья",
  "Грабитель",
  "Программист",
  "Разнорабочий",
  "Писатель",
  "Папарацци",
  "Знахарь",
  "Лесник",
  "Домохозяйка",
  "Психолог",
  "Летчик-инженер",
  "Военный",
  "Вирусолог",
  "Спецагент",
  "Стоматолог",
  "Хирург",
  "Археолог",
  "Врач",
  "Учитель",
  "Инженер",
  "Архитектор",
] as const

// Состояние здоровья
export const HEALTH_CONDITIONS = [
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
] as const

// Хобби
export const HOBBIES = [
  "Краеведение",
  "Гвоздестояние",
  "Гадание на таро",
  "Уфология и мистика",
  "Кино и сериалы",
  "Спорт.Танцы",
  "Современное искусство",
  "Флудить в чатах",
  "Свинг вечеринки",
  "Паркур",
  "Охота и рыбалка",
  "Нетрадиционная медицина",
  "Медитация",
  "Любительская радиосвязь",
  "Компьютерные игры",
  "Гидропоника",
  "Черная магия",
  "Боевые искусства",
  "Алхимия",
  "Сплетни",
  "Робототехника",
  "Пиротехника",
  "Раскашивание мандал",
  "Дачник",
  "Стриптиз",
  "ЗОЖ",
  "Холодное оружие",
  "Пивоварение",
  "Эротический массаж",
  "Вуайеризм",
  "Настольные игры",
  "Грибы и гомеопатия",
  "Паралимпийские игры",
  "Котята",
  "Йога",
  "Шахматы",
  "Охота",
  "Программирование",
  "Садоводство",
  "Кулинария",
] as const

// Фобии
export const PHOBIAS = [
  "Андрофобия (боится мужчин)",
  "Клаустрофобия",
  "Арахнофобия",
  "Агорафобия",
  "Никтофобия (боится темноты)",
  "Гемофобия (боится крови)",
  "Аэрофобия",
  "Социофобия",
] as const

// Багаж
export const BAGGAGE = [
  "Снайперская винтовка",
  "Коза и козел",
  "Котята",
  "Миллион долларов",
  "Кукла вуду",
  "Шапочка из фольги",
  "ПНВ",
  "Энциклопедия грибника",
  "Чемоданчик фельдшера",
  "Яйца и инкубатор",
  "Антибиотики и обезболивающее",
  "Столярные инструменты",
  "Надувная кукла",
  "Саженцы фруктовых деревьев",
  "Ноут и набор хакера",
  "Мешок картошки",
  "Пистолет",
  "Переносная электростанция",
  "Дефибрилятор",
  "Набор отмычек",
  "Ножи для метания",
  "Мешок зерна",
  "Лук и стрелы",
  "Компас и карта",
  "Капканы и набор ядов",
  "Инструменты электрика",
  "Настолки",
  "Дилдо",
  "Запас виагры",
  "Спиритическая доска",
  "Гитара",
  "Звуковая отвертка",
  "Набор инструментов",
  "Аптечка",
  "Радиостанция",
  "Генератор",
  "Палатка",
] as const

// Факты
export const FACTS = [
  "Победитель паралимпийских игр",
  "Свинг вечеринки",
  "Выжил на необитаемом острове",
  "Маньяк-Убийца",
  "Был в тюрьме",
  "Знает 5 языков",
  "Чемпион по стрельбе",
  "Бывший спецназовец",
] as const

// Особые характеристики
export const SPECIAL = [
  "Бесплодие",
  "Беременность 3-й триместр",
  "Двойняшки",
  "Иммунитет к радиации",
  "Фотографическая память",
  "Гениальность",
] as const

// Биология
export const BIO = [
  "Рост 195 см",
  "Рост 150 см",
  "Вес 120 кг",
  "Атлетическое телосложение",
  "Худощавое телосложение",
] as const

// Навыки
export const SKILLS = [
  "Владение оружием",
  "Первая помощь",
  "Электрик",
  "Механик",
  "Строитель",
  "Выживание в дикой природе",
] as const

// Черты характера
export const TRAITS = [
  "Истеричный",
  "Спокойный",
  "Лидер",
  "Интроверт",
  "Агрессивный",
  "Трусливый",
  "Оптимист",
] as const

// Дополнительные характеристики (для расширения)
export const ADDITIONAL: readonly string[] = [] as const

/**
 * Маппинг категорий к массивам возможных значений
 */
export const CHARACTERISTICS_BY_CATEGORY = {
  gender: GENDERS,
  age: [], // Возраст генерируется случайно
  profession: PROFESSIONS,
  health: HEALTH_CONDITIONS,
  hobby: HOBBIES,
  phobia: PHOBIAS,
  baggage: BAGGAGE,
  fact: FACTS,
  special: SPECIAL,
  bio: BIO,
  skill: SKILLS,
  trait: TRAITS,
  additional: ADDITIONAL,
} as const

/**
 * Получить случайное значение характеристики из категории
 */
export function getRandomCharacteristic(category: keyof typeof CHARACTERISTICS_BY_CATEGORY): string {
  const options = CHARACTERISTICS_BY_CATEGORY[category]
  if (options.length === 0) {
    return ""
  }
  return options[Math.floor(Math.random() * options.length)]
}

/**
 * Получить все возможные значения для категории
 */
export function getCharacteristicsForCategory(
  category: keyof typeof CHARACTERISTICS_BY_CATEGORY,
): readonly string[] {
  return CHARACTERISTICS_BY_CATEGORY[category]
}

/**
 * Проверить, является ли значение валидным для категории
 */
export function isValidCharacteristic(
  category: keyof typeof CHARACTERISTICS_BY_CATEGORY,
  value: string,
): boolean {
  const options = CHARACTERISTICS_BY_CATEGORY[category]
  if (category === "age") {
    // Возраст проверяется отдельно
    const age = parseInt(value, 10)
    return !isNaN(age) && age >= AGE_RANGE.min && age <= AGE_RANGE.max
  }
  return (options as readonly string[]).includes(value)
}

/**
 * Получить случайный возраст в допустимом диапазоне
 */
export function getRandomAge(): number {
  return Math.floor(Math.random() * (AGE_RANGE.max - AGE_RANGE.min + 1)) + AGE_RANGE.min
}

/**
 * Получить случайный пол
 */
export function getRandomGender(): Gender {
  return GENDERS[Math.floor(Math.random() * GENDERS.length)]
}

/**
 * Получить случайный модификатор пола
 */
export function getRandomGenderModifier(): GenderModifier {
  return GENDER_MODIFIERS[Math.floor(Math.random() * GENDER_MODIFIERS.length)]
}

/**
 * Статистика по характеристикам
 */
export const CHARACTERISTICS_STATS = {
  professions: PROFESSIONS.length,
  health: HEALTH_CONDITIONS.length,
  hobbies: HOBBIES.length,
  phobias: PHOBIAS.length,
  baggage: BAGGAGE.length,
  facts: FACTS.length,
  special: SPECIAL.length,
  bio: BIO.length,
  skills: SKILLS.length,
  traits: TRAITS.length,
  total: PROFESSIONS.length +
    HEALTH_CONDITIONS.length +
    HOBBIES.length +
    PHOBIAS.length +
    BAGGAGE.length +
    FACTS.length +
    SPECIAL.length +
    BIO.length +
    SKILLS.length +
    TRAITS.length,
} as const
