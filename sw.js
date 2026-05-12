self.addEventListener('install', () => {
    console.log('✅ SW installé');
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    console.log('✅ SW activé');
});

self.addEventListener('message', event => {
    console.log('📩 Message reçu par SW :', event.data);
    
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: event.data.icon || '/assets/logo.png',
            badge: event.data.badge || '/assets/badge.png'
        }).then(() => {
            console.log('✅ Notification affichée par SW');
        }).catch(err => {
            console.error('❌ Erreur SW showNotification :', err);
        });
    }
});