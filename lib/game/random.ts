/**
 * Криптографически стойкая рандомизация для характеристик.
 * Снижает вероятность повторения одних и тех же значений у одного игрока в разных играх.
 */
import crypto from "crypto"

/**
 * Случайное целое в диапазоне [0, max) (max не включается).
 * Использует crypto.randomInt для лучшего распределения.
 */
export function secureRandomInt(max: number): number {
  if (max <= 0) return 0
  return crypto.randomInt(max)
}

/**
 * Случайный элемент массива с криптостойким выбором.
 */
export function secureRandomItem<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error("secureRandomItem: empty array")
  return arr[secureRandomInt(arr.length)]
}

/**
 * Fisher-Yates shuffle с crypto — равномерное перемешивание.
 */
export function secureShuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Выбор значения с предпочтением недавно неиспользованных.
 * Если есть варианты, которых не было в usedRecently, выбираем среди них.
 * Иначе — из всех доступных.
 */
export function pickPreferringUnused(
  options: string[],
  usedRecently: Set<string>,
): string {
  const unused = options.filter((opt) => !usedRecently.has(opt))
  const pool = unused.length > 0 ? unused : options
  return secureRandomItem(pool)
}
