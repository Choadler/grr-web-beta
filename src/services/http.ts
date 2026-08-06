const DEFAULT_TIMEOUT = 12_000
// SimRacerHub returns season metadata alongside standings, so its public payload is sizable.
const MAX_RESPONSE_BYTES = 12_000_000

export async function fetchJson(url: string, signal: AbortSignal, timeout = DEFAULT_TIMEOUT) {
  const timeoutController = new AbortController()
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeout)
  const onAbort = () => timeoutController.abort()
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: timeoutController.signal,
    })
    if (!response.ok) throw new Error(`The data service returned HTTP ${response.status}.`)

    const declaredLength = Number(response.headers.get('content-length') || 0)
    if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('The data response was unexpectedly large.')

    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) throw new Error('The data response was unexpectedly large.')
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new Error('The data service returned invalid JSON.')
    }
  } catch (error) {
    if (timeoutController.signal.aborted && !signal.aborted) {
      throw new Error('The data request timed out. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    signal.removeEventListener('abort', onAbort)
  }
}
