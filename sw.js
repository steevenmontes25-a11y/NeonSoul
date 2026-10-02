/* NEON SOUL - service worker (offline app shell) */
var CACHE = "neon-soul-v1.0.0";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./css/menu.css",
  "./css/game.css",
  "./js/utils.js",
  "./js/storage.js",
  "./js/audio.js",
  "./js/input.js",
  "./js/particles.js",
  "./js/characters.js",
  "./js/upgrades.js",
  "./js/levels.js",
  "./js/combat.js",
  "./js/enemies.js",
  "./js/boss.js",
  "./js/procedural.js",
  "./js/player.js",
  "./js/meta.js",
  "./js/missions.js",
  "./js/achievements.js",
  "./js/shop.js",
  "./js/render.js",
  "./js/ui.js",
  "./js/game.js",
  "./js/main.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () { /* ignore a missing optional asset */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // refresh in the background
        fetch(e.request).then(function (res) {
          if (res && res.status === 200) {
            caches.open(CACHE).then(function (c) { c.put(e.request, res.clone()); });
          }
        }).catch(function () { });
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return caches.match("./index.html");
      });
    })
  );
});
