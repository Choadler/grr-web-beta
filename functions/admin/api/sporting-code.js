const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { 'Cache-Control': 'no-store' },
})
const allowedTag = /^<\/?(?:p|h3|h4|ul|ol|li|table|thead|tbody|tr|th|td|div|strong|em|br)(?:\s+id="[a-z0-9-]+")?\s*\/?\s*>$/i

function validateDocument(value, league) {
  if (!value || value.league !== league || !Array.isArray(value.sections)) return 'Invalid sporting-code document.'
  if (value.sections.length < 1 || value.sections.length > 30) return 'A sporting code must contain 1 to 30 sections.'
  const ids = new Set()
  let totalLength = 0
  for (const section of value.sections) {
    if (!section || typeof section.title !== 'string' || typeof section.bodyHtml !== 'string' || typeof section.id !== 'string') return 'Every section needs an ID, title, and content.'
    if (!new RegExp(`^${league}-section-[a-z0-9-]+$`).test(section.id) || ids.has(section.id)) return 'Section IDs must be unique and belong to the selected league.'
    if (!section.title.trim() || section.title.length > 160) return 'Section titles must be between 1 and 160 characters.'
    if (section.bodyHtml.length > 100000) return 'A section is too large.'
    ids.add(section.id)
    totalLength += section.bodyHtml.length
    if (/<!--|<!doctype/i.test(section.bodyHtml)) return 'Comments and document declarations are not supported.'
    const tags = section.bodyHtml.match(/<[^>]*>/g) ?? []
    if (tags.some((tag) => !allowedTag.test(tag))) return 'The section contains unsupported or unsafe markup.'
    if (section.bodyHtml.replace(/<[^>]*>/g, '').includes('<')) return 'The section contains malformed markup.'
  }
  if (totalLength > 500000) return 'The sporting code is too large.'
  return ''
}

function parseDocument(value) {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}

async function state(db, league) {
  const [document, revisions] = await Promise.all([
    db.prepare('SELECT draft_json,published_json FROM sporting_code_documents WHERE league=?').bind(league).first(),
    db.prepare('SELECT id,document_json,published_at,published_by FROM sporting_code_revisions WHERE league=? ORDER BY id DESC LIMIT 20').bind(league).all(),
  ])
  return {
    draft: parseDocument(document?.draft_json),
    published: parseDocument(document?.published_json),
    revisions: revisions.results.map((row) => ({
      ...parseDocument(row.document_json),
      id: row.id,
      publishedAt: row.published_at,
      publishedBy: row.published_by,
    })),
  }
}

function leagueFrom(request) {
  const league = new URL(request.url).searchParams.get('league')
  return league === 'cup' || league === 'gt' ? league : null
}

export async function onRequestGet({ request, env }) {
  const league = leagueFrom(request)
  if (!league) return json({ error: 'Unknown league.' }, 400)
  if (!env.INDYCAR_DB) return json({ error: 'Sporting codes are not configured.' }, 503)
  return json(await state(env.INDYCAR_DB, league))
}

export async function onRequestPost({ request, env }) {
  const league = leagueFrom(request)
  if (!league) return json({ error: 'Unknown league.' }, 400)
  if (!env.INDYCAR_DB) return json({ error: 'Sporting codes are not configured.' }, 503)
  let body
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }
  const db = env.INDYCAR_DB
  const now = new Date().toISOString()
  if (body.action === 'saveDraft' || body.action === 'publish') {
    const error = validateDocument(body.document, league)
    if (error) return json({ error }, 400)
    const document = { league, sections: body.document.sections, updatedAt: now }
    const encoded = JSON.stringify(document)
    if (body.action === 'saveDraft') {
      await db.prepare(`INSERT INTO sporting_code_documents (league,draft_json,draft_updated_at) VALUES (?,?,?)
        ON CONFLICT(league) DO UPDATE SET draft_json=excluded.draft_json,draft_updated_at=excluded.draft_updated_at`).bind(league, encoded, now).run()
    } else {
      const publishedBy = request.headers.get('Cf-Access-Authenticated-User-Email') || 'GRR administrator'
      await db.batch([
        db.prepare(`INSERT INTO sporting_code_documents (league,draft_json,published_json,draft_updated_at,published_at,published_by) VALUES (?,?,?,?,?,?)
          ON CONFLICT(league) DO UPDATE SET draft_json=excluded.draft_json,published_json=excluded.published_json,draft_updated_at=excluded.draft_updated_at,published_at=excluded.published_at,published_by=excluded.published_by`).bind(league, encoded, encoded, now, now, publishedBy),
        db.prepare('INSERT INTO sporting_code_revisions (league,document_json,published_at,published_by) VALUES (?,?,?,?)').bind(league, encoded, now, publishedBy),
      ])
    }
  } else if (body.action === 'restoreRevision') {
    const revisionId = Number(body.revisionId)
    if (!Number.isInteger(revisionId)) return json({ error: 'Invalid revision.' }, 400)
    const revision = await db.prepare('SELECT document_json FROM sporting_code_revisions WHERE id=? AND league=?').bind(revisionId, league).first()
    if (!revision) return json({ error: 'Revision not found.' }, 404)
    await db.prepare(`INSERT INTO sporting_code_documents (league,draft_json,draft_updated_at) VALUES (?,?,?)
      ON CONFLICT(league) DO UPDATE SET draft_json=excluded.draft_json,draft_updated_at=excluded.draft_updated_at`).bind(league, revision.document_json, now).run()
  } else {
    return json({ error: 'Unknown action.' }, 400)
  }
  return json(await state(db, league))
}
