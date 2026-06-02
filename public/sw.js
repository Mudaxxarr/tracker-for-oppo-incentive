const CACHE_NAME = "alhamd-shell-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
];

// Install — cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API routes: network-only (never cache)
// - Static assets (_next/static): cache-first
// - Navigation: network-first, fallback to offline page
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API routes — always network
  if (url.pathname.startsWith("/api/")) return;

  // Static next.js assets — cache first (production only; dev chunks are mutable so skip cache)
  if (url.pathname.startsWith("/_next/static/") && !url.pathname.includes("/_next/dev/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests — network first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
});

// Background sync for offline activation queue
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-activations") {
    event.waitUntil(syncOfflineActivations());
  }
});

async function syncOfflineActivations() {
  // Broadcast to all clients to trigger the sync
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "SYNC_ACTIVATIONS" });
  }
}
