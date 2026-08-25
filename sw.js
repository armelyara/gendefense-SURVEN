/* GenDefense-SURVEN — service worker (offline app shell) */
var CACHE = "gends-surven-2026-08-24";
var ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./data/sites.js", "./data/geo.js", "./data/tox.js",
  "./vendor/leaflet.js", "./vendor/leaflet.css",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).then(function (resp) {
      if (resp.status === 200) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (_) { } });
      }
      return resp;
    }).catch(function () { return caches.match(e.request); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return resp;
    }).catch(function () { return caches.match("./index.html"); });
  }));
});
