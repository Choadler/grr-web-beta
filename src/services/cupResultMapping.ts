type ResultMappedRace = { round: number; resultId?: number }

export function scheduledRacePairs<T extends ResultMappedRace>(ids: number[], schedule: T[]) {
  const available = new Set(ids)
  const explicitlyMapped = new Set(
    schedule.map((event) => event.resultId).filter((id): id is number => Boolean(id)),
  )
  const unmatchedIds = ids.filter((id) => !explicitlyMapped.has(id))
  let unmatchedIndex = 0
  return schedule
    .filter((event) => event.round > 0)
    .map((scheduled) => {
      const raceId = scheduled.resultId && available.has(scheduled.resultId)
        ? scheduled.resultId
        : scheduled.resultId
          ? 0
          : (unmatchedIds[unmatchedIndex++] ?? 0)
      return { raceId, scheduled }
    })
    .filter((pair) => pair.raceId)
}
