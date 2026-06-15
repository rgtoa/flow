/* Flow service worker — conservative, money-app-safe caching.
 *
 * Goals:
 *  - The app LAUNCHES even on flaky/no network (offline app shell).
 *  - Balances are never stale: when online, navigations always hit the network
 *    first, and Supabase (cross-origin) calls are never cached.
 *  - Updates roll out immediately (skipWaiting + clients.claim).
 *
 * Bump CACHE when you want to drop the old cache on the next activate.
 */
const CACHE = "flow-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle our own origin. Supabase / fonts / other origins pass straight
  // through to the network — never cached, so data is always live.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first (fresh), fall back to cache when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match("/dashboard")) || Response.error();
        }
      })()
    );
    return;
  }

  // Immutable build assets: cache-first (safe — content-hashed filenames).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      })()
    );
    return;
  }

  // Everything else same-origin: network, with cache fallback when offline.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
