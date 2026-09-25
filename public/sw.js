const CACHE_NAME = 'pour-pos-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)

    const response = await fetch('/index.html', { cache: 'reload' })
    if (!response.ok) throw new Error('Could not load the app shell')
    const html = await response.text()
    const assets = [...html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)].map((match) => match[1])
    await Promise.all(assets.map((asset) => cache.add(asset)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.filter((name) => name.startsWith('pour-pos-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/index.html', response.clone())
        }
        return response
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/'))
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request)
    if (cached) return cached
    const response = await fetch(event.request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(event.request, response.clone())
    }
    return response
  })())
})
