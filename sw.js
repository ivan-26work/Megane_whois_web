// ============================================
// SERVICE WORKER – Megane_whois
// ============================================

const CACHE_NAME = 'megane-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/auth.html',
  '/splash.html',
  '/css/index.css',
  '/css/auth.css',
  '/js/index.js',
  '/js/auth.js',
  '/js/firebase-config.js',
  '/assets/logo.png',
  '/assets/badge.png'
];

// ============================================
// INSTALLATION – mise en cache des fichiers
// ============================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('❌ Erreur cache:', err))
  );
  self.skipWaiting();
});

// ============================================
// ACTIVATION – nettoyage des anciens caches
// ============================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Ancien cache supprimé:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ============================================
// STRATÉGIE DE CACHE (Network First)
// ============================================
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// ============================================
// 🔥 ÉCOUTE DES MESSAGES DEPUIS index.js
// ============================================
self.addEventListener('message', event => {
  const data = event.data;
  
  if (data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/logo.png',
      badge: data.badge || '/assets/badge.png',
      data: data.data || {},
      vibrate: [200, 100, 200]
    });
    
    console.log('🔔 Notification affichée depuis le Service Worker:', data.title);
  }
});

// ============================================
// NOTIFICATIONS PUSH (FCM)
// ============================================
self.addEventListener('push', event => {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Megane_whois',
        body: event.data.text(),
        icon: '/assets/logo.png',
        badge: '/assets/badge.png'
      };
    }
  }

  const notification = {
    title: data.title || 'Nouveau message',
    body: data.body || 'Vous avez reçu un message',
    icon: data.icon || '/assets/logo.png',
    badge: data.badge || '/assets/badge.png',
    image: data.image || null,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir' },
      { action: 'reply', title: 'Répondre' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      image: notification.image,
      data: notification.data,
      actions: notification.actions,
      vibrate: [200, 100, 200]
    })
  );
});

// ============================================
// CLIC SUR NOTIFICATION
// ============================================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Si une fenêtre existe déjà, on l'utilise
        for (const client of clientList) {
          if (client.url.includes('/index.html') && 'focus' in client) {
            client.focus();
            
            if (action === 'reply' || notificationData.userId) {
              client.postMessage({
                type: 'OPEN_CHAT',
                userId: notificationData.userId || notificationData.userId
              });
            }
            return;
          }
        }
        
        // Sinon, on ouvre une nouvelle fenêtre
        let url = '/index.html';
        if (action === 'reply' || notificationData.userId) {
          url = `/index.html?openChat=${notificationData.userId}`;
        }
        
        return clients.openWindow(url);
      })
  );
});