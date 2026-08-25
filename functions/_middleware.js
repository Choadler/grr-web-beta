const publicHostname = 'www.grassrootsracing.org'
const adminHostname = 'grassrootsracing.org'

const isAdminPath = (pathname) => pathname === '/admin' || pathname.startsWith('/admin/')
const isStaticAssetPath = (pathname) => pathname.startsWith('/assets/')
const legacyRedirects = new Map([
  ['/driver-comparison', '/driver-history'],
  ['/pages/gt-league-team-standings', '/pages/gt-standings'],
  ['/pages/gt-team-standings', '/pages/gt-standings'],
  ['/pages/gt-records', '/pages/gt-stats?view=records'],
])
const publicPagePaths = new Set([
  '/', '/gallery', '/driver-history',
  '/pages/grr-cup-series', '/pages/cup-series-sporting-code', '/pages/cupstandings',
  '/pages/cup-series-schedule', '/pages/cup-latest-race-results', '/pages/cup-stats',
  '/pages/cup-archive', '/pages/broadcast', '/cup/penalties', '/pages/gt-league', '/pages/gt-rules',
  '/pages/gt-schedule', '/pages/gt-standings', '/pages/gt-race-results', '/pages/gt-stats',
  '/pages/gt-archive', '/pages/indycar', '/pages/indycar-sporting-code',
  '/pages/indycar-standings', '/pages/indycar-schedule', '/pages/indycar-results',
])

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const adminPath = isAdminPath(url.pathname)

  const legacyTarget = legacyRedirects.get(url.pathname)
  if (legacyTarget) {
    const target = new URL(legacyTarget, `https://${publicHostname}`)
    return Response.redirect(target.toString(), 308)
  }

  if (adminPath && url.hostname === publicHostname) {
    url.hostname = adminHostname
    return Response.redirect(url.toString(), 308)
  }

  // Access protects the canonical admin hostname, but Pages also serves the
  // same Functions from its public pages.dev hostname. Never allow an admin
  // request to reach a Function through an unprotected deployment hostname.
  if (adminPath && url.hostname !== adminHostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return new Response('Not found.', { status: 404 })
  }

  // The www hostname is the canonical public origin. Keep administration on
  // the bare hostname, where Cloudflare Access protects the dashboard and API.
  if (url.hostname === adminHostname && !adminPath && !isStaticAssetPath(url.pathname)) {
    url.hostname = publicHostname
    return Response.redirect(url.toString(), 308)
  }

  const response = await context.next()
  if (adminPath || url.pathname.startsWith('/api/')) {
    const headers = new Headers(response.headers)
    headers.set('X-Robots-Tag', 'noindex, nofollow')
    if (adminPath) headers.set('Referrer-Policy', 'no-referrer')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }

  const acceptsHtml = context.request.method === 'GET' && (context.request.headers.get('Accept') ?? '').includes('text/html')
  if (acceptsHtml && !publicPagePaths.has(url.pathname) && response.status === 200) {
    return new Response(response.body, { status: 404, statusText: 'Not Found', headers: response.headers })
  }
  return response
}
