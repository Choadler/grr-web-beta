import type { RaceEvent } from '../types/league'

export const isOverallSession = (label: string) => label === 'Overall' || label === 'Overall Race Finish'

export const defaultRaceSessionIndex = (event?: RaceEvent) => {
  if (!event) return 0
  const overallIndex = event.sessions.findIndex((session) => isOverallSession(session.label))
  return overallIndex >= 0 ? overallIndex : 0
}
