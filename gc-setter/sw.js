// Service worker de l'espace admin GC Setter.
//
// Stratégie volontairement minimale : on ne met en cache QUE la coque de
// l'application (HTML/CSS/JS/icônes). Les candidatures ne sont jamais mises en
// cache — ce sont des données personnelles, et un dashboard qui affiche une
// liste périmée est pire qu'un dashboard qui affiche une erreur réseau.
const SHELL = 'gc-setter-shell-v1';

const SHELL_FILES = [
  '/admin.html',
  '/admin.css',
  '/admin.js',
  '/gc-config.js',
  '/vendor/supabase.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Tout ce qui n'est pas servi par ce site (Supabase, CDN) passe directement au réseau.
  if (url.origin !== self.location.origin) return;

  // Navigation vers /admin : réseau d'abord, coque en secours hors ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/admin.html')),
    );
    return;
  }

  // Ressources de la coque : cache d'abord, rafraîchi en arrière-plan.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
