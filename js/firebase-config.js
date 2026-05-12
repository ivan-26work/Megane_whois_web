// ============================================
// FIREBASE CONFIGURATION (version Web)
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyB2ZhldZcUH0HZHJxe-21EiXVMiPKFSqyg",
    authDomain: "livechat-4dd07.firebaseapp.com",
    databaseURL: "https://livechat-4dd07-default-rtdb.firebaseio.com/",
    projectId: "livechat-4dd07",
    storageBucket: "livechat-4dd07.firebasestorage.app",
    messagingSenderId: "276812426291",
    appId: "1:276812426291:web:c4688a1ec5c06161d20746"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Exporter les services Firebase (accessible globalement)
window.auth = firebase.auth();
window.db = firebase.database();
window.storage = firebase.storage();
window.messaging = firebase.messaging();

// ============================================
// 🔥 NOTIFICATIONS PUSH (FCM Web)
// ============================================
if ('serviceWorker' in navigator && 'Notification' in window) {
    // Demander la permission
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            console.log('✅ Permission notifications accordée');
            initFCM();
        } else {
            console.log('⚠️ Permission notifications refusée');
        }
    });
}

async function initFCM() {
    try {
        // Récupérer le token FCM
        const token = await window.messaging.getToken({
            vapidKey: 'BPB8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8C4X8' // À remplacer par ta clé VAPID
        });
        
        console.log('✅ Token FCM:', token);
        
        // Sauvegarder le token dans Firebase Database
        const user = firebase.auth().currentUser;
        if (user) {
            await db.ref(`fcmTokens/${user.uid}/${token}`).set(true);
            console.log('✅ Token FCM enregistré');
        }
        
        // 🔥 PAS DE onMessage() ici – les notifications natives sont gérées par index.js
        
    } catch (error) {
        console.error('❌ Erreur FCM:', error);
    }
}

// ============================================
// FONCTIONS AUTH (compatibles avec window.*)
// ============================================
window.firebaseSignIn = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
window.firebaseCreateUser = (auth, email, password) => auth.createUserWithEmailAndPassword(email, password);
window.firebaseResetPassword = (auth, email) => auth.sendPasswordResetEmail(email);
window.firebaseUpdateProfile = (user, data) => user.updateProfile(data);
window.firebaseSet = (ref, data) => ref.set(data);
window.firebaseRef = (db, path) => db.ref(path);
window.firebaseStorageRef = (storage, path) => storage.ref(path);
window.firebaseUploadBytes = (ref, file) => ref.put(file);
window.firebaseGetDownloadURL = (ref) => ref.getDownloadURL();

console.log('✅ Firebase initialisé (sans onMessage)');