/**
 * Типы спецкарт, выдаваемых игрокам при старте игры.
 * Исключены: exchange-skill, reshuffle (общая «Давайте на чистоту»).
 */

export const SPECIAL_CARD_TYPES = [
  "exchange-gender",
  "exchange-age",
  "exchange-profession",
  "exchange-bio",
  "exchange-health",
  "exchange-hobby",
  "exchange-phobia",
  "exchange-baggage",
  "exchange-fact",
  "exchange-special",
  "exchange-trait",
  "exchange-additional",
  "exchange",
  "peek",
  "immunity",
  "reroll",
  "reveal",
  "steal",
  "double-vote",
  "no-vote-against",
  "reshuffle-health",
  "reshuffle-bio",
  "reshuffle-fact",
  "reshuffle-baggage",
  "reshuffle-hobby",
  "revote",
  "replace-profession",
  "replace-health",
] as const

export type SpecialCardType = (typeof SPECIAL_CARD_TYPES)[number]

/** Максимальное количество типов спецкарт (для настройки «спецкарт на игрока»). */
export const SPECIAL_CARD_TYPES_COUNT = SPECIAL_CARD_TYPES.length

/**
 * Маппинг спецкарт к категориям характеристик.
 * Спецкарты типа "Обмен хобби", "Давайте на чистоту Хобби" выдаются только
 * если соответствующая характеристика включена в настройках игры.
 * null = карта не привязана к характеристике, всегда разрешена.
 */
export const SPECIAL_CARD_TO_CATEGORY: Record<SpecialCardType, string | null> = {
  "exchange-gender": "gender",
  "exchange-age": "age",
  "exchange-profession": "profession",
  "exchange-bio": "bio",
  "exchange-health": "health",
  "exchange-hobby": "hobby",
  "exchange-phobia": "phobia",
  "exchange-baggage": "baggage",
  "exchange-fact": "fact",
  "exchange-special": "special",
  "exchange-trait": "trait",
  "exchange-additional": "additional",
  exchange: null,
  peek: null,
  immunity: null,
  reroll: null,
  reveal: null,
  steal: null,
  "double-vote": null,
  "no-vote-against": null,
  "reshuffle-health": "health",
  "reshuffle-bio": "bio",
  "reshuffle-fact": "fact",
  "reshuffle-baggage": "baggage",
  "reshuffle-hobby": "hobby",
  revote: null,
  "replace-profession": "profession",
  "replace-health": "health",
}

/**
 * Возвращает типы спецкарт, разрешённые при текущих настройках характеристик.
 * Спецкарты, связанные с отключёнными характеристиками, исключаются.
 *
 * @param characteristicsSettings - room.settings.characteristics { [category]: { enabled: boolean } }
 */
export function getAllowedSpecialCardTypes(
  characteristicsSettings: Record<string, { enabled?: boolean }> = {}
): readonly SpecialCardType[] {
  return SPECIAL_CARD_TYPES.filter((cardType) => {
    const category = SPECIAL_CARD_TO_CATEGORY[cardType]
    if (category === null) return true // карта не привязана к характеристике
    const setting = characteristicsSettings[category]
    return setting?.enabled !== false
  })
}
