import { verifyTurnstile } from '../_shared/turnstile.js'

const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const allowedLeagues = new Set(['Cup Series', 'GT League', 'IndyCar', 'Any league'])
const allowedLogoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxLogoCount = 3
const maxLogoBytes = 8 * 1024 * 1024
const text = (form, key, maxLength) => String(form.get(key) || '').trim().slice(0, maxLength)
const extensionFor = (type) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[type]
const hasExpectedSignature = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (file.type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  if (file.type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return false
}

export async function onRequestPost({ request, env }) {
  if (!env.INDYCAR_DB || !env.GALLERY_BUCKET) return json({ error: 'Sponsorship requests are temporarily unavailable.' }, 503)
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > maxLogoBytes + 100_000) return json({ error: 'The attached logos are too large.' }, 413)
  let form
  try { form = await request.formData() } catch { return json({ error: 'The sponsorship form could not be read.' }, 400) }
  if (text(form, 'companyUrl', 10)) return json({ message: 'Thanks! Your sponsorship request has been sent to GRR.' })
  if (!(await verifyTurnstile(request, env, text(form, 'cf-turnstile-response', 2048), 'sponsorship_inquiry')))
    return json({ error: 'The security check failed. Please refresh and try again.' }, 403)

  const details = {
    name: text(form, 'name', 80), email: text(form, 'email', 160), brand: text(form, 'brand', 100),
    brandWebsite: text(form, 'brandWebsite', 300), league: text(form, 'league', 40), race: text(form, 'race', 140),
    bid: text(form, 'bid', 40), brandInfo: text(form, 'brandInfo', 2000),
  }
  if (!details.name || !details.email || !details.brand || !allowedLeagues.has(details.league) || !details.race || !details.bid || details.brandInfo.length < 20)
    return json({ error: 'Please complete every required field.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) return json({ error: 'Please enter a valid email address.' }, 400)
  if (details.brandWebsite) {
    try {
      const website = new URL(details.brandWebsite)
      if (website.protocol !== 'http:' && website.protocol !== 'https:') throw new Error('Invalid protocol')
    } catch { return json({ error: 'Please enter a valid brand website URL.' }, 400) }
  }
  const logos = form.getAll('logos').filter((item) => item instanceof File && item.size > 0)
  if (!logos.length || logos.length > maxLogoCount) return json({ error: 'Attach between 1 and 3 logo files.' }, 400)
  if (logos.some((logo) => !allowedLogoTypes.has(logo.type)) || logos.reduce((sum, logo) => sum + logo.size, 0) > maxLogoBytes)
    return json({ error: 'Logos must be JPEG, PNG, or WebP files totaling no more than 8 MB.' }, 400)
  if ((await Promise.all(logos.map(hasExpectedSignature))).some((valid) => !valid))
    return json({ error: 'One or more logo files do not match their stated image type.' }, 400)

  const inquiryId = crypto.randomUUID()
  const logoRows = logos.map((file, index) => ({ id: crypto.randomUUID(), file, key: `sponsorships/${inquiryId}/${index}-${crypto.randomUUID()}.${extensionFor(file.type)}`, index }))
  const uploaded = []
  try {
    for (const logo of logoRows) {
      await env.GALLERY_BUCKET.put(logo.key, logo.file.stream(), { httpMetadata: { contentType: logo.file.type }, customMetadata: { inquiryId } })
      uploaded.push(logo.key)
    }
    await env.INDYCAR_DB.batch([
      env.INDYCAR_DB.prepare(`INSERT INTO sponsorship_inquiries
        (id,contact_name,contact_email,brand_name,brand_website,league,race_name,bid,brand_info) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(inquiryId, details.name, details.email, details.brand, details.brandWebsite || null, details.league, details.race, details.bid, details.brandInfo),
      ...logoRows.map((logo) => env.INDYCAR_DB.prepare(`INSERT INTO sponsorship_logos
        (id,inquiry_id,object_key,file_name,content_type,file_size,sort_order) VALUES (?,?,?,?,?,?,?)`)
        .bind(logo.id, inquiryId, logo.key, logo.file.name.slice(0, 180), logo.file.type, logo.file.size, logo.index)),
    ])
  } catch (error) {
    if (uploaded.length) await env.GALLERY_BUCKET.delete(uploaded)
    console.error('Sponsorship submission failed.', error)
    return json({ error: 'Your request could not be delivered. Please try again later.' }, 500)
  }
  return json({ message: 'Thanks! Your sponsorship request has been sent to GRR.' })
}
