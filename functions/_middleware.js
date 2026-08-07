const publicHostname = 'www.grassrootsracing.org'
const adminHostname = 'grassrootsracing.org'

const isAdminPath = (pathname) => pathname === '/admin' || pathname.startsWith('/admin/')

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const adminPath = isAdminPath(url.pathname)

  // The www hostname is the canonical public origin. Keep administration on
  // the bare hostname, where Cloudflare Access protects the dashboard and API.
  if (url.hostname === adminHostname && !adminPath) {
    url.hostname = publicHostname
    return Response.redirect(url.toString(), 308)
  }

  if (url.hostname === publicHostname && adminPath) {
    url.hostname = adminHostname
    return Response.redirect(url.toString(), 308)
  }

  return context.next()
}
