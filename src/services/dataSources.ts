import { publicEndpoints } from '../config/integrations'
import type { DataLoader } from '../types/league'
import { adaptGtResults, adaptGtSchedule, adaptGtStandings, adaptRecentResults, adaptSimRacerStandings } from './adapters'
import { fetchJson } from './http'

export const cupStandings: DataLoader = async (signal) => adaptSimRacerStandings(await fetchJson(publicEndpoints.cup.standings, signal))
export const cupRecentResults: DataLoader = async (signal) => adaptRecentResults(await fetchJson(publicEndpoints.cup.recentResults, signal))
export const indyStandings: DataLoader = async (signal) => adaptSimRacerStandings(await fetchJson(publicEndpoints.indycar.standings, signal))

export const gtStandings = (classKey: 'am' | 'pro' | 'gtp'): DataLoader => async (signal) => adaptGtStandings(await fetchJson(publicEndpoints.gt.standings[classKey], signal))
export const gtTeamStandings = (classKey: 'am' | 'pro' | 'gtp'): DataLoader => async (signal) => adaptGtStandings(await fetchJson(publicEndpoints.gt.teamStandings[classKey], signal))
export const gtSchedule: DataLoader = async (signal) => adaptGtSchedule(await fetchJson(publicEndpoints.gt.raceBreakdown, signal))
export const gtResults = (classKey: 'am' | 'pro' | 'gtp'): DataLoader => async (signal) => adaptGtResults(await fetchJson(publicEndpoints.gt.raceBreakdown, signal), classKey)
