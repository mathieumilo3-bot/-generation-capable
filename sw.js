// sw.js — Service Worker du système de notifications Push.
//
// Reçoit les notifications envoyées par le serveur (voir
// netlify/functions/_lib/notifications/webpush.js) même quand l'onglet/app
// est fermé — c'est tout l'intérêt du Web Push : le navigateur réveille ce
// script en arrière-plan à la réception, indépendamment de toute page
// ouverte. Volontairement minimal : aucune mise en cache d'assets ici (ce
// n'est pas un service worker "offline-first", uniquement le canal Push).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Génération Capable', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Génération Capable';
  const options = {
    body: data.body || '',
    tag: data.tag || 'gc-notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    renotify: false,
  };
  // Boutons d'action ("As-tu défini ton objectif aujourd'hui ? Oui / Plus
  // tard") — voir _lib/notifications/send.js pour la catégorie concernée.
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  event.notification.close();

  // "Plus tard" : l'utilisateur a explicitement choisi de reporter, on ne
  // rouvre rien — c'est exactement le comportement demandé par le bouton.
  if (action === 'goal_later') return;

  let targetUrl = (event.notification.data && event.notification.data.url) || '/';
  if (action === 'goal_yes') {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'gcGoal=yes';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
