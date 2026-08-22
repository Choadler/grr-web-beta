const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const statuses = new Set(['new', 'contacted', 'closed', 'declined'])
const parts = (params) => Array.isArray(params.path) ? params.path : params.path ? [params.path] : []

async function listInquiries(db) {
  const [inquiries, logos] = await Promise.all([
    db.prepare(`SELECT id,contact_name AS contactName,contact_email AS contactEmail,brand_name AS brandName,
      brand_website AS brandWebsite,league,race_name AS raceName,bid,brand_info AS brandInfo,
      status,admin_notes AS adminNotes,submitted_at AS submittedAt,reviewed_at AS reviewedAt,
      reviewed_by AS reviewedBy FROM sponsorship_inquiries
      ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END, submitted_at DESC`).all(),
    db.prepare('SELECT id,inquiry_id AS inquiryId,file_name AS fileName FROM sponsorship_logos ORDER BY sort_order').all(),
  ])
  return inquiries.results.map((inquiry) => ({ ...inquiry, logos: logos.results.filter((logo) => logo.inquiryId === inquiry.id).map((logo) => ({ id: logo.id, fileName: logo.fileName, url: `/admin/api/sponsorships/logo/${logo.id}` })) }))
}

export async function onRequestGet({ env, params }) {
  if (!env.INDYCAR_DB || !env.GALLERY_BUCKET) return json({ error: 'Sponsorship storage is not configured.' }, 503)
  const path = parts(params)
  if (path[0] === 'logo' && path[1]) {
    const logo = await env.INDYCAR_DB.prepare('SELECT object_key AS objectKey,content_type AS contentType,file_name AS fileName FROM sponsorship_logos WHERE id=?').bind(path[1]).first()
    if (!logo) return new Response('Logo not found.', { status: 404 })
    const object = await env.GALLERY_BUCKET.get(logo.objectKey)
    if (!object) return new Response('Logo file not found.', { status: 404 })
    return new Response(object.body, { headers: { 'Content-Type': logo.contentType, 'Cache-Control': 'private, no-store', 'Content-Disposition': `inline; filename="${logo.fileName.replace(/["\\]/g, '_')}"`, 'X-Content-Type-Options': 'nosniff' } })
  }
  if (path.length) return json({ error: 'Sponsorship admin route not found.' }, 404)
  return json({ inquiries: await listInquiries(env.INDYCAR_DB) })
}

export async function onRequestPost({ request, env, params }) {
  if (!env.INDYCAR_DB || !env.GALLERY_BUCKET) return json({ error: 'Sponsorship storage is not configured.' }, 503)
  if (parts(params).length) return json({ error: 'Sponsorship admin route not found.' }, 404)
  try {
    const body = await request.json()
    const id = String(body.id || '')
    if (!id) return json({ error: 'An inquiry ID is required.' }, 400)
    if (!await env.INDYCAR_DB.prepare('SELECT id FROM sponsorship_inquiries WHERE id=?').bind(id).first()) return json({ error: 'Sponsorship inquiry not found.' }, 404)
    if (body.action === 'update') {
      const status = String(body.status || '')
      const notes = String(body.adminNotes || '').trim().slice(0, 4000)
      if (!statuses.has(status)) return json({ error: 'Select a valid inquiry status.' }, 400)
      const reviewer = request.headers.get('Cf-Access-Authenticated-User-Email') || 'admin'
      await env.INDYCAR_DB.prepare('UPDATE sponsorship_inquiries SET status=?,admin_notes=?,reviewed_at=CURRENT_TIMESTAMP,reviewed_by=? WHERE id=?').bind(status, notes, reviewer, id).run()
    } else if (body.action === 'delete') {
      const logos = await env.INDYCAR_DB.prepare('SELECT object_key AS objectKey FROM sponsorship_logos WHERE inquiry_id=?').bind(id).all()
      const keys = logos.results.map((logo) => logo.objectKey)
      await env.INDYCAR_DB.prepare('DELETE FROM sponsorship_inquiries WHERE id=?').bind(id).run()
      if (keys.length) await env.GALLERY_BUCKET.delete(keys)
    } else return json({ error: 'Unknown sponsorship action.' }, 400)
    return json({ inquiries: await listInquiries(env.INDYCAR_DB) })
  } catch (error) {
    console.error('Sponsorship admin update failed.', error)
    return json({ error: 'The sponsorship inquiry update failed.' }, 400)
  }
}
