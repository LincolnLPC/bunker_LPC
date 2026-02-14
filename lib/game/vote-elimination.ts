/**
 * Определяет игрока для изгнания по результатам голосования.
 * При равном количестве голосов у нескольких игроков выбирает случайным образом одного из тех,
 * кто набрал максимальное число голосов (и не имеет иммунитета).
 */
export function pickEliminatedByVotes(
  voteCounts: Record<string, number>,
  players: Array<{ id: string; metadata?: any }>,
  currentRound: number,
  hasImmunity: (player: any, round: number) => boolean
): { eliminatedPlayerId: string | null; savedByImmunityPlayer: any } {
  const sortedByVotes = Object.entries(voteCounts)
    .map(([playerId, votes]) => ({
      playerId,
      votes,
      player: players.find((p: any) => p.id === playerId),
    }))
    .sort((a, b) => b.votes - a.votes)

  if (sortedByVotes.length === 0) {
    return { eliminatedPlayerId: null, savedByImmunityPlayer: null }
  }

  const maxVotes = sortedByVotes[0].votes
  const topVotersWithImmunity = sortedByVotes.filter(
    (e) => e.votes === maxVotes && e.player && hasImmunity(e.player, currentRound)
  )
  const topVotersWithoutImmunity = sortedByVotes.filter(
    (e) => e.votes === maxVotes && e.player && !hasImmunity(e.player, currentRound)
  )

  // Если среди лидеров есть игроки с иммунитетом — уведомление
  const savedByImmunityPlayer = topVotersWithImmunity[0]?.player ?? null

  if (topVotersWithoutImmunity.length === 0) {
    // Все лидеры с иммунитетом — ищем следующий уровень голосов
    const nextTier = sortedByVotes.filter((e) => e.votes < maxVotes && e.player && !hasImmunity(e.player, currentRound))
    if (nextTier.length === 0) return { eliminatedPlayerId: null, savedByImmunityPlayer }
    const nextMaxVotes = nextTier[0].votes
    const tiedAtNext = nextTier.filter((e) => e.votes === nextMaxVotes)
    const picked = tiedAtNext[Math.floor(Math.random() * tiedAtNext.length)]
    return { eliminatedPlayerId: picked.playerId, savedByImmunityPlayer }
  }

  // Среди лидеров есть игроки без иммунитета — случайный выбор при ничьей
  const picked = topVotersWithoutImmunity[Math.floor(Math.random() * topVotersWithoutImmunity.length)]
  return { eliminatedPlayerId: picked.playerId, savedByImmunityPlayer }
}
