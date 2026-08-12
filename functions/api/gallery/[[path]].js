import { hashClientIp, verifyGalleryTurnstile } from '../../_shared/turnstile.js'

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
const maxRequestSize = 80 * 1024 * 1024
const leagueLabels = { cup: 'Cup Series', gt: 'GT League', indycar: 'IndyCar' }

const notifyGalleryModerators = async ({ webhookUrl, count, photographer, league, batchId }) => {
  if (!webhookUrl) return
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'GRR Gallery',
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `📸 ${count} new ${count === 1 ? 'photo is' : 'photos are'} awaiting approval`,
            color: 0x37ae0f,
            fields: [
              { name: 'Submitted by', value: photographer, inline: true },
              { name: 'League', value: leagueLabels[league] || league, inline: true },
            ],
            url: 'https://grassrootsracing.org/admin/gallery',
            footer: { text: `Submission ${batchId}` },
          },
        ],
      }),
    })
    if (!response.ok) {
      console.error('Discord gallery notification failed.', response.status)
    }
  } catch (error) {
    console.error('Discord gallery notification failed.', error)
  }
}

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

  if ((parts[0] === 'photo' || parts[0] === 'display' || parts[0] === 'thumbnail') && parts[1]) {
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
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', objectKey === photo.originalKey ? photo.originalType : 'image/jpeg')
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
      imageUrl: `/api/gallery/display/${photo.id}`,
      thumbnailUrl: `/api/gallery/thumbnail/${photo.id}`,
    })),
  })
}

export async function onRequestPost({ request, env, params, waitUntil }) {
  const missing = bindings(env)
  if (missing) return json({ error: missing }, 503)
  if (pathParts(params).length) return json({ error: 'Gallery route not found.' }, 404)

  try {
    const contentLength = Number(request.headers.get('Content-Length'))
    if (Number.isFinite(contentLength) && contentLength > maxRequestSize)
      return json({ error: 'The gallery upload is too large.' }, 413)

    const batchId = String(request.headers.get('X-Gallery-Batch-Id') || '').trim()
    const batchIndex = Number(request.headers.get('X-Gallery-Batch-Index'))
    const batchSize = Number(request.headers.get('X-Gallery-Batch-Size'))
    const turnstileToken = String(request.headers.get('X-Turnstile-Token') || '')
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId) ||
      !Number.isInteger(batchIndex) ||
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 10 ||
      batchIndex < 0 ||
      batchIndex >= batchSize
    ) return json({ error: 'Invalid upload batch.' }, 400)

    const db = env.INDYCAR_DB
    const clientIpHash = await hashClientIp(request)
    let batch = await db.prepare(
      'SELECT client_ip_hash AS clientIpHash,batch_size AS batchSize,next_index AS nextIndex,expires_at AS expiresAt FROM gallery_submission_batches WHERE batch_id=?',
    ).bind(batchId).first()
    if (!batch) {
      if (batchIndex !== 0 || !(await verifyGalleryTurnstile(request, env, turnstileToken)))
        return json({ error: 'Complete the security check and try again.' }, 403)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await db.prepare(
        'INSERT INTO gallery_submission_batches(batch_id,client_ip_hash,batch_size,next_index,expires_at) VALUES(?,?,?,?,?)',
      ).bind(batchId, clientIpHash, batchSize, 0, expiresAt).run()
      await db.prepare("DELETE FROM gallery_submission_batches WHERE datetime(expires_at)<CURRENT_TIMESTAMP").run()
      batch = { clientIpHash, batchSize, nextIndex: 0, expiresAt }
    }
    if (
      batch.clientIpHash !== clientIpHash ||
      Number(batch.batchSize) !== batchSize ||
      Number(batch.nextIndex) !== batchIndex ||
      Date.parse(batch.expiresAt) <= Date.now()
    ) return json({ error: 'This upload batch is invalid or has expired.' }, 403)

    const form = await request.formData()
    if (String(form.get('website') || '')) return json({ submitted: true }, 201)
    const photographer = String(form.get('photographer') || '').trim()
    const league = String(form.get('league') || '')
    const photo = form.get('photo')
    const displayPhoto = form.get('displayPhoto')
    const thumbnail = form.get('thumbnail')
    const formBatchId = String(form.get('batchId') || '').trim()
    const formBatchIndex = Number(form.get('batchIndex'))
    const formBatchSize = Number(form.get('batchSize'))
    if (photographer.length < 2 || photographer.length > 80)
      return json({ error: 'Enter your name (2 to 80 characters).' }, 400)
    if (!leagueKeys.has(league)) return json({ error: 'Select a league.' }, 400)
    if (!(photo instanceof File)) return json({ error: 'Choose a photo to upload.' }, 400)
    if (formBatchId !== batchId || formBatchIndex !== batchIndex || formBatchSize !== batchSize)
      return json({ error: 'Upload batch metadata does not match.' }, 400)
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
      if (!imageTypes.has(displayPhoto.type) || !imageTypes.has(thumbnail.type))
        return json({ error: 'Optimized gallery images must use JPEG, PNG, or WebP.' }, 415)
      if (!displayPhoto.size || displayPhoto.size > maxDisplaySize)
        return json({ error: 'The optimized display image is too large.' }, 413)
      if (!thumbnail.size || thumbnail.size > maxThumbnailSize)
        return json({ error: 'The gallery thumbnail is too large.' }, 413)
      displayBytes = new Uint8Array(await displayPhoto.arrayBuffer())
      thumbnailBytes = new Uint8Array(await thumbnail.arrayBuffer())
      if (
        !hasExpectedSignature(displayPhoto.type, displayBytes) ||
        !hasExpectedSignature(thumbnail.type, thumbnailBytes)
      )
        return json({ error: 'An optimized gallery image is not a valid image file.' }, 415)
    }

    const id = crypto.randomUUID()
    const objectKey = `gallery/${league}/${id}.${extension}`
    const optimizedObjectKey = hasVariants
      ? `gallery/${league}/${id}-display.${imageTypes.get(displayPhoto.type)}`
      : null
    const thumbnailObjectKey = hasVariants
      ? `gallery/${league}/${id}-thumbnail.${imageTypes.get(thumbnail.type)}`
      : null
    try {
      await env.GALLERY_BUCKET.put(objectKey, photoBytes, {
        httpMetadata: { contentType: photo.type, cacheControl: 'public, max-age=300' },
        customMetadata: { galleryId: id, league },
      })
      if (hasVariants) {
        await env.GALLERY_BUCKET.put(optimizedObjectKey, displayBytes, {
          httpMetadata: { contentType: displayPhoto.type, cacheControl: 'public, max-age=86400' },
          customMetadata: { galleryId: id, league, variant: 'display' },
        })
        await env.GALLERY_BUCKET.put(thumbnailObjectKey, thumbnailBytes, {
          httpMetadata: { contentType: thumbnail.type, cacheControl: 'public, max-age=86400' },
          customMetadata: { galleryId: id, league, variant: 'thumbnail' },
        })
      }
      await db.prepare(
        `INSERT INTO gallery_photos(
          id,photographer_name,league,object_key,content_type,file_size,
          optimized_object_key,optimized_file_size,thumbnail_object_key,thumbnail_file_size,
          submission_batch_id,submission_batch_index
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
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
          batchId,
          batchIndex,
        )
        .run()
      await db.prepare(
        'UPDATE gallery_submission_batches SET next_index=next_index+1 WHERE batch_id=? AND next_index=?',
      ).bind(batchId, batchIndex).run()
    } catch (error) {
      await env.GALLERY_BUCKET.delete(
        [objectKey, optimizedObjectKey, thumbnailObjectKey].filter(Boolean),
      )
      throw error
    }
    const isFinalBatchPhoto = batchIndex === batchSize - 1
    if (isFinalBatchPhoto) {
      const notification = notifyGalleryModerators({
        webhookUrl: env.DISCORD_GALLERY_WEBHOOK_URL,
        count: batchSize,
        photographer,
        league,
        batchId,
      })
      if (typeof waitUntil === 'function') waitUntil(notification)
      else await notification
    }
    return json({ submitted: true, message: 'Photo submitted for administrator approval.' }, 201)
  } catch (error) {
    console.error(JSON.stringify({
      message: 'Gallery submission failed.',
      error: error instanceof Error ? error.message : String(error),
    }))
    return json(
      { error: 'The photo could not be submitted.' },
      400,
    )
  }
}
