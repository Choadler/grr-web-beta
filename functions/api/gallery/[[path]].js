const json = (value, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })

const leagueKeys = new Set(['cup', 'gt', 'indycar'])
const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])
const maxFileSize = 50 * 1024 * 1024
const maxDisplaySize = 20 * 1024 * 1024
const maxThumbnailSize = 5 * 1024 * 1024

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

  if ((parts[0] === 'photo' || parts[0] === 'thumbnail') && parts[1]) {
    const photo = await env.INDYCAR_DB.prepare(
      `SELECT object_key AS originalKey,content_type AS originalType,
      optimized_object_key AS optimizedKey,thumbnail_object_key AS thumbnailKey
      FROM gallery_photos WHERE id=? AND status='approved'`,
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
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
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
      thumbnailUrl: `/api/gallery/thumbnail/${photo.id}`,
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
    const displayPhoto = form.get('displayPhoto')
    const thumbnail = form.get('thumbnail')
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

    const hasVariants = displayPhoto instanceof File && thumbnail instanceof File
    let displayBytes = null
    let thumbnailBytes = null
    if (hasVariants) {
      if (displayPhoto.type !== 'image/webp' || thumbnail.type !== 'image/webp')
        return json({ error: 'Optimized gallery images must use WebP.' }, 415)
      if (!displayPhoto.size || displayPhoto.size > maxDisplaySize)
        return json({ error: 'The optimized display image is too large.' }, 413)
      if (!thumbnail.size || thumbnail.size > maxThumbnailSize)
        return json({ error: 'The gallery thumbnail is too large.' }, 413)
      displayBytes = new Uint8Array(await displayPhoto.arrayBuffer())
      thumbnailBytes = new Uint8Array(await thumbnail.arrayBuffer())
      if (
        !hasExpectedSignature('image/webp', displayBytes) ||
        !hasExpectedSignature('image/webp', thumbnailBytes)
      )
        return json({ error: 'An optimized gallery image is not a valid WebP file.' }, 415)
    }

    const id = crypto.randomUUID()
    const objectKey = `gallery/${league}/${id}.${extension}`
    const optimizedObjectKey = hasVariants ? `gallery/${league}/${id}-display.webp` : null
    const thumbnailObjectKey = hasVariants ? `gallery/${league}/${id}-thumbnail.webp` : null
    try {
      await env.GALLERY_BUCKET.put(objectKey, photoBytes, {
        httpMetadata: { contentType: photo.type, cacheControl: 'public, max-age=300' },
        customMetadata: { galleryId: id, league },
      })
      if (hasVariants) {
        await env.GALLERY_BUCKET.put(optimizedObjectKey, displayBytes, {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=86400' },
          customMetadata: { galleryId: id, league, variant: 'display' },
        })
        await env.GALLERY_BUCKET.put(thumbnailObjectKey, thumbnailBytes, {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=86400' },
          customMetadata: { galleryId: id, league, variant: 'thumbnail' },
        })
      }
      await env.INDYCAR_DB.prepare(
        `INSERT INTO gallery_photos(
          id,photographer_name,league,object_key,content_type,file_size,
          optimized_object_key,optimized_file_size,thumbnail_object_key,thumbnail_file_size
        ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
        .bind(
          id,
          photographer,
          league,
          objectKey,
          photo.type,
          photo.size,
          optimizedObjectKey,
          hasVariants ? displayPhoto.size : null,
          thumbnailObjectKey,
          hasVariants ? thumbnail.size : null,
        )
        .run()
    } catch (error) {
      await env.GALLERY_BUCKET.delete(
        [objectKey, optimizedObjectKey, thumbnailObjectKey].filter(Boolean),
      )
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
