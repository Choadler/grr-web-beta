const json = (value, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

const leagueKeys = new Set(['cup', 'gt', 'indycar'])

const pathParts = (params) => {
  const value = params.path
  return Array.isArray(value) ? value : value ? [value] : []
}

const missingBinding = (env) => {
  if (!env.INDYCAR_DB) return 'Gallery metadata storage is not configured.'
  if (!env.GALLERY_BUCKET) return 'Gallery photo storage is not configured.'
  return ''
}

async function listPhotos(db) {
  const result = await db
    .prepare(
      `SELECT id,photographer_name AS photographer,league,content_type AS contentType,file_size AS fileSize,
      status,submitted_at AS submittedAt,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy,
      showcase_enabled AS showcaseEnabled
      FROM gallery_photos
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, submitted_at DESC`,
    )
    .all()
  return result.results.map((photo) => ({
    ...photo,
    showcaseEnabled: Boolean(photo.showcaseEnabled),
    imageUrl: `/admin/api/gallery/photo/${photo.id}`,
    thumbnailUrl: `/admin/api/gallery/thumbnail/${photo.id}`,
  }))
}

export async function onRequestGet({ env, params }) {
  const missing = missingBinding(env)
  if (missing) return json({ error: missing }, 503)
  const parts = pathParts(params)
  if ((parts[0] === 'photo' || parts[0] === 'thumbnail') && parts[1]) {
    const photo = await env.INDYCAR_DB.prepare(
      `SELECT object_key AS originalKey,content_type AS originalType,
      optimized_object_key AS optimizedKey,thumbnail_object_key AS thumbnailKey
      FROM gallery_photos WHERE id=?`,
    )
      .bind(parts[1])
      .first()
    if (!photo) return new Response('Photo not found.', { status: 404 })
    const objectKey =
      parts[0] === 'thumbnail'
        ? photo.thumbnailKey || photo.optimizedKey || photo.originalKey
        : photo.optimizedKey || photo.originalKey
    const object = await env.GALLERY_BUCKET.get(objectKey)
    if (!object) return new Response('Photo file not found.', { status: 404 })
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Content-Type', objectKey === photo.originalKey ? photo.originalType : 'image/webp')
    headers.set('Cache-Control', 'private, no-store')
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(object.body, { headers })
  }
  if (parts.length) return json({ error: 'Gallery admin route not found.' }, 404)
  return json({ photos: await listPhotos(env.INDYCAR_DB) })
}

export async function onRequestPost({ request, env, params }) {
  const missing = missingBinding(env)
  if (missing) return json({ error: missing }, 503)
  if (pathParts(params).length) return json({ error: 'Gallery admin route not found.' }, 404)
  try {
    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return json({ error: 'A photo ID is required.' }, 400)
    const photo = await env.INDYCAR_DB.prepare(
      `SELECT object_key AS objectKey,optimized_object_key AS optimizedObjectKey,
      thumbnail_object_key AS thumbnailObjectKey FROM gallery_photos WHERE id=?`,
    )
      .bind(id)
      .first()
    if (!photo) return json({ error: 'Photo not found.' }, 404)

    if (body.action === 'approve' || body.action === 'reject') {
      const reviewer = request.headers.get('Cf-Access-Authenticated-User-Email') || 'admin'
      await env.INDYCAR_DB.prepare(
        'UPDATE gallery_photos SET status=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?',
      )
        .bind(body.action === 'approve' ? 'approved' : 'rejected', reviewer, id)
        .run()
    } else if (body.action === 'update') {
      const photographer = String(body.photographer || '').trim()
      const league = String(body.league || '')
      if (photographer.length < 2 || photographer.length > 80)
        return json({ error: 'Author names must be between 2 and 80 characters.' }, 400)
      if (!leagueKeys.has(league)) return json({ error: 'Select a valid league.' }, 400)
      await env.INDYCAR_DB.prepare(
        'UPDATE gallery_photos SET photographer_name=?,league=?,showcase_enabled=? WHERE id=?',
      )
        .bind(photographer, league, body.showcaseEnabled === false ? 0 : 1, id)
        .run()
    } else if (body.action === 'delete') {
      await env.GALLERY_BUCKET.delete(
        [photo.objectKey, photo.optimizedObjectKey, photo.thumbnailObjectKey].filter(Boolean),
      )
      await env.INDYCAR_DB.prepare('DELETE FROM gallery_photos WHERE id=?').bind(id).run()
    } else return json({ error: 'Unknown gallery action.' }, 400)

    return json({ photos: await listPhotos(env.INDYCAR_DB) })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'The gallery update failed.' },
      400,
    )
  }
}
