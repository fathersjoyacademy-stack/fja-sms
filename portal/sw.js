const CACHE_NAME = "school-mgt-v62";
const applicationServerPublicKey = "BAtYvIhzrg3wFs8S6Zt-G6MEbOyUNiZ8lkD5rtf__BWLVZFcraDmmBD4qN1knxkQLf_PRxhuJxnIoiXWfNRq7As";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./index.css",
  "./firebase-config.js",
  "./db.js",
  "./api.js",
  "./app.js",
  "./manifest.json",
  "./assets/logo.png"
];

// Install Event - cache core shell assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - clear out old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network-First for dynamic code & navigation with cache fallback
self.addEventListener("fetch", (e) => {
  // Allow caching for same origin and critical CDN scripts (Chart.js and Firebase)
  const isSameOrigin = e.request.url.startsWith(self.location.origin);
  const isCriticalCDN = e.request.url.includes("cdn.jsdelivr.net") || e.request.url.includes("gstatic.com");
  
  if (!isSameOrigin && !isCriticalCDN) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === "opaque")
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is unavailable (offline mode)
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});

// Handle Background Sync for offline attendance & grades submissions
self.addEventListener("sync", (e) => {
  if (e.tag === "sync-attendance") {
    e.waitUntil(triggerSync("attendance"));
  } else if (e.tag === "sync-grades") {
    e.waitUntil(triggerSync("grades"));
  }
});

// Handle push notification messages from PWA push events
self.addEventListener("push", (e) => {
  let data = { title: "School Management System", body: "New update received." };
  try {
    data = e.data.json();
  } catch (err) {
    if (e.data) {
      data.body = e.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "./assets/logo.png",
    badge: "./assets/logo.png",
    vibrate: [100, 50, 100],
    data: { url: e.request ? e.request.url : "/" }
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Notify client windows on sync completion
async function triggerSync(type) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_TRIGGER", syncTarget: type });
  });
}
