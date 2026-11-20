// Helpers for relaying a call recording through the app. Kept free of imports so tests can load it directly.

// Only simple byte ranges are passed on, so the browser can seek.
export function safeRange(value: string | null): string | null {
  return value && /^bytes=\d{0,15}-\d{0,15}$/.test(value) && value !== 'bytes=-' ? value : null
}

const audioTypes = /^(audio\/[a-z0-9.+-]+|application\/octet-stream)$/i

// Headers for the relayed audio: never cached, never sniffed as anything else, never offered as a download.
export function relayHeaders(upstream: Headers): Headers {
  const headers = new Headers({
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'", 'Referrer-Policy': 'no-referrer'
  })
  const type = (upstream.get('content-type') ?? '').split(';')[0].trim()
  headers.set('Content-Type', audioTypes.test(type) && type !== 'application/octet-stream' ? type : 'audio/wav')
  for (const name of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.get(name)
    if (value && /^[\w\s/=*,-]{1,100}$/.test(value)) headers.set(name, value)
  }
  return headers
}

// Fresh recording links are fetched from Retell at most once a minute per call while someone is listening.
const cache = new Map<string, { url: string; until: number }>()
export function cachedLink(key: string, now = Date.now()): string | null {
  const hit = cache.get(key)
  if (hit && hit.until > now) return hit.url
  cache.delete(key)
  return null
}
export function rememberLink(key: string, url: string, now = Date.now()): void {
  if (cache.size > 500) cache.clear()
  cache.set(key, { url, until: now + 60_000 })
}
