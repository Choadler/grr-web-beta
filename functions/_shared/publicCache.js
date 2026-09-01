const cacheKey = (request) => new Request(new URL(request.url).toString(), { method: 'GET' })

export async function cachedPublicGet({ request, waitUntil }, ttlSeconds, load) {
  if (request.method !== 'GET' || typeof caches === 'undefined' || !caches.default) return load()

  const key = cacheKey(request)
  try {
    const cached = await caches.default.match(key)
    if (cached) return cached
  } catch (error) {
    console.warn('Public API cache lookup failed.', error instanceof Error ? error.message : String(error))
  }

  const response = await load()
  if (!response.ok) return response

  const stored = new Response(response.clone().body, response)
  const directives = stored.headers.get('Cache-Control') || 'public, max-age=30'
  stored.headers.set('Cache-Control', `${directives}, s-maxage=${ttlSeconds}`)
  const write = caches.default.put(key, stored.clone()).catch((error) => {
    console.warn('Public API cache write failed.', error instanceof Error ? error.message : String(error))
  })
  if (typeof waitUntil === 'function') waitUntil(write)
  else await write
  return response
}
