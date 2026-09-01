/* GenDefense - SURVEN · service worker */
var VERSION = "gends-2026-08-26";             // build id
var SHELL = VERSION + "-shell";
var RUNTIME = VERSION + "-runtime";           // cache tiers
var RUNTIME_MAX = 60;

var ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./core.js", "./manifest.webmanifest",
  "./pwa.js", "./data/sites.js", "./data/geo.js", "./data/tox.js",
  "./vendor/leaflet.js", "./vendor/leaflet.css",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k !== SHELL && k !== RUNTIME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trim(cacheName, max) {
  caches.open(cacheName).then(function (c) {
    c.keys().then(function (keys) { if (keys.length > max) c.delete(keys[0]).then(function () { trim(cacheName, max); }); });
  });
}

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);

  // Tierces origines
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(RUNTIME).then(function (c) { c.put(e.request, copy); trim(RUNTIME, RUNTIME_MAX); }); }
        return res;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(SHELL).then(function (c) { c.put(e.request, copy); }); }
        return res;
      }).catch(function () { return cached || caches.match("./index.html"); });
      return cached || net;
    })
  );
});
