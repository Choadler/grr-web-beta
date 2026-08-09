/**
 * Admin requests must never reload an Access callback URL. Cloudflare Access
 * login codes are single-use, so reloading that URL can produce a misleading
 * "code already used" error, especially on mobile browsers.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)

  if (
    response.redirected &&
    typeof window !== 'undefined' &&
    new URL(response.url).origin !== window.location.origin
  ) {
    throw new Error('Your administrator session has expired. Open the Admin page to sign in again.')
  }

  return response
}
