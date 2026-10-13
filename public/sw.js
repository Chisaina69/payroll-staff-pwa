const CACHE_NAME = 'payday-shell-v1'
const APP_SHELL = ['/', '/index.html', '/payday-icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL)
      const manifestResponse = await fetch('/precache-manifest.json')
      if (manifestResponse.ok) {
        const assets = await manifestResponse.clone().json()
        if (!Array.isArray(assets) || !assets.every((asset) => typeof asset === 'string')) {
          throw new Error('The PWA precache manifest has an invalid format.')
        }
        await cache.put('/precache-manifest.json', manifestResponse)
        await cache.addAll(assets)
      } else if (manifestResponse.status === 404) {
        const index = await cache.match('/index.html')
        const html = await index.text()
        const appAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
        await cache.addAll(appAssets)
      } else {
        throw new Error(`Unable to load the PWA precache manifest: ${manifestResponse.status}`)
      }
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('payday-shell-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error()),
    )
    return
  }

  if (requestUrl.pathname.startsWith('/api/')) return

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(async (cachedResponse) => {
      if (cachedResponse) return cachedResponse
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    }),
  )
})
