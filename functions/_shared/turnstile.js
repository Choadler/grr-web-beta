const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const defaultHostnames = new Set(['www.grassrootsracing.org'])

const allowedHostnames = (env) => {
  const configured = String(env.TURNSTILE_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
  return configured.length ? new Set(configured) : defaultHostnames
}

export async function verifyTurnstile(request, env, token, expectedAction) {
  if (!env.TURNSTILE_SECRET || typeof token !== 'string' || !token || token.length > 2048)
    return false

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
    idempotency_key: crypto.randomUUID(),
  })
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) body.set('remoteip', clientIp)

  try {
    const response = await fetch(siteverifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return false
    const result = await response.json()
    return (
      result.success === true &&
      result.action === expectedAction &&
      typeof result.hostname === 'string' &&
      allowedHostnames(env).has(result.hostname.toLowerCase())
    )
  } catch (error) {
    console.error(JSON.stringify({
      message: 'Turnstile validation failed.',
      error: error instanceof Error ? error.message : String(error),
    }))
    return false
  }
}

export const verifyGalleryTurnstile = (request, env, token) =>
  verifyTurnstile(request, env, token, 'gallery_upload')

export async function hashClientIp(request) {
  const value = request.headers.get('CF-Connecting-IP') || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
