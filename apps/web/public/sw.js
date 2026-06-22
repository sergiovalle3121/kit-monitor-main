/* AXOS OS service worker — SOLO Web Push.
 *
 * A propósito NO registra un handler de `fetch`: no cachea ni intercepta
 * navegación/recursos, así que no puede servir assets obsoletos ni romper la
 * app. Su único trabajo es mostrar la notificación que empuja el servidor y,
 * al hacer clic, enfocar (o abrir) la pestaña en el `href` del aviso.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'AXOS OS' };
  }
  const title = data.title || 'AXOS OS';
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.kind || undefined,
    data: { href: data.href || '/dashboard/notifications' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href =
    (event.notification.data && event.notification.data.href) ||
    '/dashboard/notifications';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            if ('navigate' in client) {
              try {
                client.navigate(href);
              } catch (e) {
                /* algunos navegadores no permiten navigate cross-origin */
              }
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(href);
        return undefined;
      }),
  );
});
