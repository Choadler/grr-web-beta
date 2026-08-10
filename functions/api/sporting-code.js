const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' },
})

export async function onRequestGet({ request, env }) {
  const league = new URL(request.url).searchParams.get('league')
  if (league !== 'cup' && league !== 'gt') return json({ error: 'Unknown league.' }, 400)
  if (!env.INDYCAR_DB) return json({ error: 'Sporting codes are not configured.' }, 503)
  const row = await env.INDYCAR_DB
    .prepare('SELECT published_json FROM sporting_code_documents WHERE league=?')
    .bind(league)
    .first()
  if (!row?.published_json) return json({ error: 'No published sporting code.' }, 404)
  try {
    return json(JSON.parse(row.published_json))
  } catch {
    return json({ error: 'The published sporting code is invalid.' }, 500)
  }
}
