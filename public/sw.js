const CACHE_NAME = "pathfind-v1";

// Assets to cache on install
const STATIC_ASSETS = [
    "/",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first for API routes, cache-first for static assets
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and browser extensions
    if (request.method !== "GET" || !url.protocol.startsWith("http")) {
        return;
    }

    // Network-first for API routes (always fresh data)
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: "You are offline" }),
                    { headers: { "Content-Type": "application/json" } }
                );
            })
        );
        return;
    }

    // Cache-first for static assets, fallback to network
    event.respondWith(
        caches.match(request).then((cached) => {
            return (
                cached ||
                fetch(request).then((response) => {
                    // Cache successful responses for static assets
                    if (response.ok && response.type === "basic") {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                })
            );
        })
    );
});

// Push notifications
self.addEventListener("push", (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                url: data.url || "/",
            },
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click: open the app
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || "/")
    );
});
