const json = (value, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

const leagueKeys = new Set(['cup', 'gt', 'indycar'])
const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])
const maxFileSize = 50 * 1024 * 1024

const hasExpectedSignature = (type, bytes) => {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png')
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  if (type === 'image/webp')
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  return false
}

const pathParts = (params) => {
  const value = params.path
  return Array.isArray(value) ? value : value ? [value] : []
}

const bindings = (env) => {
  if (!env.INDYCAR_DB) return 'Gallery metadata storage is not configured.'
  if (!env.GALLERY_BUCKET) return 'Gallery photo storage is not configured.'
  return ''
}

export async function onRequestGet({ request, env, params }) {
  const missing = bindings(env)
  if (missing) return json({ error: missing }, 503)
  const parts = pathParts(params)

  if (parts[0] === 'photo' && parts[1]) {
    const photo = await env.INDYCAR_DB.prepare(
      "SELECT object_key AS objectKey,content_type AS contentType FROM gallery_photos WHERE id=? AND status='approved'",
    )
      .bind(parts[1])
      .first()
    if (!photo) return new Response('Photo not found.', { status: 404 })
    const object = await env.GALLERY_BUCKET.get(photo.objectKey)
    if (!object) return new Response('Photo file not found.', { status: 404 })
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Content-Type', photo.contentType)
    headers.set('Cache-Control', 'public, max-age=300')
    headers.set('ETag', object.httpEtag)
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(object.body, { headers })
  }

  if (parts.length) return json({ error: 'Gallery route not found.' }, 404)
  const url = new URL(request.url)
  const league = url.searchParams.get('league') || ''
  if (league && !leagueKeys.has(league)) return json({ error: 'Unknown league.' }, 400)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 60))
  const showcaseOnly = url.searchParams.get('showcase') === '1'
  const showcaseClause = showcaseOnly ? ' AND showcase_enabled=1' : ''
  const statement = league
    ? env.INDYCAR_DB.prepare(
        `SELECT id,photographer_name AS photographer,league,submitted_at AS submittedAt,showcase_enabled AS showcaseEnabled FROM gallery_photos WHERE status='approved' AND league=?${showcaseClause} ORDER BY submitted_at DESC LIMIT ?`,
      ).bind(league, limit)
    : env.INDYCAR_DB.prepare(
        `SELECT id,photographer_name AS photographer,league,submitted_at AS submittedAt,showcase_enabled AS showcaseEnabled FROM gallery_photos WHERE status='approved'${showcaseClause} ORDER BY submitted_at DESC LIMIT ?`,
      ).bind(limit)
  const result = await statement.all()
  return json({
    photos: result.results.map((photo) => ({
      ...photo,
      showcaseEnabled: Boolean(photo.showcaseEnabled),
      imageUrl: `/api/gallery/photo/${photo.id}`,
    })),
  })
}

export async function onRequestPost({ request, env, params }) {
  const missing = bindings(env)
  if (missing) return json({ error: missing }, 503)
  if (pathParts(params).length) return json({ error: 'Gallery route not found.' }, 404)

  try {
    const form = await request.formData()
    if (String(form.get('website') || '')) return json({ submitted: true }, 201)
    const photographer = String(form.get('photographer') || '').trim()
    const league = String(form.get('league') || '')
    const photo = form.get('photo')
    if (photographer.length < 2 || photographer.length > 80)
      return json({ error: 'Enter your name (2 to 80 characters).' }, 400)
    if (!leagueKeys.has(league)) return json({ error: 'Select a league.' }, 400)
    if (!(photo instanceof File)) return json({ error: 'Choose a photo to upload.' }, 400)
    const extension = imageTypes.get(photo.type)
    if (!extension) return json({ error: 'Upload a JPEG, PNG, or WebP image.' }, 415)
    if (!photo.size || photo.size > maxFileSize)
      return json({ error: 'Photos must be no larger than 50 MB.' }, 413)
    const photoBytes = new Uint8Array(await photo.arrayBuffer())
    if (!hasExpectedSignature(photo.type, photoBytes))
      return json({ error: 'The uploaded file is not a valid image.' }, 415)

    const id = crypto.randomUUID()
    const objectKey = `gallery/${league}/${id}.${extension}`
    await env.GALLERY_BUCKET.put(objectKey, photoBytes, {
      httpMetadata: { contentType: photo.type, cacheControl: 'public, max-age=300' },
      customMetadata: { galleryId: id, league },
    })
    try {
      await env.INDYCAR_DB.prepare(
        'INSERT INTO gallery_photos(id,photographer_name,league,object_key,content_type,file_size) VALUES(?,?,?,?,?,?)',
      )
        .bind(id, photographer, league, objectKey, photo.type, photo.size)
        .run()
    } catch (error) {
      await env.GALLERY_BUCKET.delete(objectKey)
      throw error
    }
    return json({ submitted: true, message: 'Photo submitted for administrator approval.' }, 201)
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'The photo could not be submitted.' },
      400,
    )
  }
}
