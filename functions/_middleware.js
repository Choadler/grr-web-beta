const publicHostname = 'www.grassrootsracing.org'
const adminHostname = 'grassrootsracing.org'

const isAdminPath = (pathname) => pathname === '/admin' || pathname.startsWith('/admin/')
const isStaticAssetPath = (pathname) => pathname.startsWith('/assets/')

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const adminPath = isAdminPath(url.pathname)

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

  return context.next()
}
