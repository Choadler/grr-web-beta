export const selectGtDropWeeks = (completedEvents, pointsByEvent, dropWeeks, dropStartRound) => {
  const enabled = Number(dropWeeks) > 0 && completedEvents.some((event) => Number(event.round) >= Number(dropStartRound))
  if (!enabled) return []
  return completedEvents
    .map((event) => ({ round: Number(event.round), points: Number(pointsByEvent.get(event.id)) || 0 }))
    .sort((a, b) => a.points - b.points || a.round - b.round)
    .slice(0, Math.min(Number(dropWeeks), completedEvents.length))
}
