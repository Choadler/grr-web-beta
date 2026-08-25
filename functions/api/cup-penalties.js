import { cupPenaltyReport, selectedCupSeason } from '../_shared/cupPenalties.js'

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } })

export async function onRequestGet({ env, request }) {
  if (!env.INDYCAR_DB) return json({ error: 'Cup penalty data is not configured.' }, 503)
  try {
    const season = await selectedCupSeason(env.INDYCAR_DB, new URL(request.url).searchParams.get('season'))
    if (!season) return json({ error: 'No public Cup season is available.' }, 404)
    return json(await cupPenaltyReport(env.INDYCAR_DB, season))
  } catch (error) {
    console.error(JSON.stringify({ message: 'Cup penalty report failed.', error: error instanceof Error ? error.message : String(error) }))
    return json({ error: 'The Cup Penalty Report is temporarily unavailable.' }, 500)
  }
}
