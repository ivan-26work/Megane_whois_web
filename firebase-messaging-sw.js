// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyB2ZhldZcUH0HZHJxe-21EiXVMiPKFSqyg",
    authDomain: "livechat-4dd07.firebaseapp.com",
    databaseURL: "https://livechat-4dd07-default-rtdb.firebaseio.com/",
    projectId: "livechat-4dd07",
    storageBucket: "livechat-4dd07.firebasestorage.app",
    messagingSenderId: "276812426291",
    appId: "1:276812426291:web:c4688a1ec5c06161d20746"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    console.log('📩 Message reçu en arrière-plan:', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Megane_whois';
    const notificationBody = payload.notification?.body || payload.data?.body || 'Nouveau message';
    
    self.registration.showNotification(notificationTitle, {
        body: notificationBody,
        icon: '/assets/logo.png',
        badge: '/assets/badge.png'
    });
});