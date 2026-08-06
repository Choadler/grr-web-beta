const DEFAULT_TIMEOUT = 12_000
// SimRacerHub returns season metadata alongside standings, so its public payload is sizable.
const MAX_RESPONSE_BYTES = 12_000_000
const DATA_CACHE_NAME = 'grr-last-known-good-v1'

const memoryCache = new Map<string, unknown>()
const inFlightRequests = new Map<string, Promise<unknown>>()

function parsePayload(text: string) {
  if (text.length > MAX_RESPONSE_BYTES) throw new Error('The data response was unexpectedly large.')

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('The data service returned invalid JSON.')
  }
}

async function storeLastKnownGood(url: string, text: string, payload: unknown) {
  memoryCache.set(url, payload)
  if (!('caches' in window)) return

  try {
    const cache = await window.caches.open(DATA_CACHE_NAME)
    await cache.put(
      url,
      new Response(text, {
        headers: {
          'Content-Type': 'application/json',
          'X-GRR-Cached-At': new Date().toISOString(),
        },
      }),
    )
  } catch {
    // A browser may disable Cache Storage. The in-memory fallback still protects this page load.
  }
}

async function readLastKnownGood(url: string) {
  if (memoryCache.has(url)) return memoryCache.get(url)
  if (!('caches' in window)) return undefined

  try {
    const response = await (await window.caches.open(DATA_CACHE_NAME)).match(url)
    if (!response) return undefined
    const payload = parsePayload(await response.text())
    memoryCache.set(url, payload)
    return payload
  } catch {
    try {
      await (await window.caches.open(DATA_CACHE_NAME)).delete(url)
    } catch {
      // Ignore cache cleanup failures and surface the original request error instead.
    }
    return undefined
  }
}

async function requestJson(url: string, timeout: number) {
  const timeoutController = new AbortController()
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeout)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal,
    })
    if (!response.ok) throw new Error(`The data service returned HTTP ${response.status}.`)

    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > MAX_RESPONSE_BYTES)
      throw new Error('The data response was unexpectedly large.')

    const text = await response.text()
    const payload = parsePayload(text)
    await storeLastKnownGood(url, text, payload)
    return payload
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw new Error('The data request timed out. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function waitForRequest(request: Promise<unknown>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason)

  return new Promise<unknown>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    request.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

export async function fetchJson(url: string, signal: AbortSignal, timeout = DEFAULT_TIMEOUT) {
  const requestKey = `${timeout}:${url}`
  let request = inFlightRequests.get(requestKey)

  if (!request) {
    request = requestJson(url, timeout)
    inFlightRequests.set(requestKey, request)
    void request.finally(() => inFlightRequests.delete(requestKey)).catch(() => undefined)
  }

  try {
    return await waitForRequest(request, signal)
  } catch (error) {
    if (signal.aborted) throw error
    const cached = await readLastKnownGood(url)
    if (cached !== undefined) return cached
    throw error
  }
}

