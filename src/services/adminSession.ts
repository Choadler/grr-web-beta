const pendingNavigation = () => new Promise<never>(() => undefined)

/**
 * Cloudflare Access can expire while the admin SPA remains open. Its login
 * redirect then appears to fetch as a network/CORS failure. Reloading as a
 * top-level navigation lets Access show the login screen and return here.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await fetch(input, init)

    if (
      response.redirected &&
      typeof window !== 'undefined' &&
      new URL(response.url).origin !== window.location.origin
    ) {
      window.location.reload()
      return pendingNavigation()
    }

    return response
  } catch (reason) {
    if (
      reason instanceof TypeError &&
      typeof window !== 'undefined' &&
      window.navigator.onLine
    ) {
      window.location.reload()
      return pendingNavigation()
    }

    throw reason
  }
}
