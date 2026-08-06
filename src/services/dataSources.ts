import { publicEndpoints } from '../config/integrations'
import { cupSchedule as cupCalendar, indycarSchedule as indyCalendar } from '../config/schedules'
import type { DataLoader, RaceEventsLoader } from '../types/league'
import { adaptGtRaceEvents, adaptGtResults, adaptGtSchedule, adaptGtStandings, adaptRecentResults, adaptSimRacerEvents, adaptSimRacerLatestResults, adaptSimRacerSchedule, adaptSimRacerStandings } from './adapters'
import { fetchJson } from './http'

export const cupStandings: DataLoader = async (signal) => adaptSimRacerStandings(await fetchJson(publicEndpoints.cup.standings, signal))
export const cupRecentResults: DataLoader = async (signal) => adaptRecentResults(await fetchJson(publicEndpoints.cup.recentResults, signal))
export const indyStandings: DataLoader = async (signal) => adaptSimRacerStandings(await fetchJson(publicEndpoints.indycar.standings, signal))
export const cupSchedule: DataLoader = async (signal) => adaptSimRacerSchedule(await fetchJson(publicEndpoints.cup.standings, signal), cupCalendar, true)
export const cupDetailedResults: DataLoader = async (signal) => adaptSimRacerLatestResults(await fetchJson(publicEndpoints.cup.standings, signal))
export const indySchedule: DataLoader = async (signal) => adaptSimRacerSchedule(await fetchJson(publicEndpoints.indycar.standings, signal), indyCalendar)
export const indyDetailedResults: DataLoader = async (signal) => adaptSimRacerLatestResults(await fetchJson(publicEndpoints.indycar.standings, signal))
export const cupRaceEvents: RaceEventsLoader = async (signal) => adaptSimRacerEvents(await fetchJson(publicEndpoints.cup.standings, signal), cupCalendar, true)
export const indyRaceEvents: RaceEventsLoader = async (signal) => adaptSimRacerEvents(await fetchJson(publicEndpoints.indycar.standings, signal), indyCalendar)
export const gtRaceEvents: RaceEventsLoader = async (signal) => adaptGtRaceEvents(await fetchJson(publicEndpoints.gt.raceBreakdown, signal))

export const gtStandings = (classKey: 'am' | 'pro' | 'gtp'): DataLoader => async (signal) => adaptGtStandings(await fetchJson(publicEndpoints.gt.standings[classKey], signal))
export const gtTeamStandings = (classKey: 'am' | 'pro' | 'gtp'): DataLoader => async (signal) => adaptGtStandings(await fetchJson(publicEndpoints.gt.teamStandings[classKey], signal))
export const gtSchedule: DataLoader = async (signal) => adaptGtSchedule(await fetchJson(publicEndpoints.gt.raceBreakdown, signal))
export const gtResults = (classKey: 'am' | 'pro' | 'gtp'): DataLoader => async (signal) => adaptGtResults(await fetchJson(publicEndpoints.gt.raceBreakdown, signal), classKey)
