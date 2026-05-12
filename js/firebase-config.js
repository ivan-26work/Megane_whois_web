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

// Exporter les services Firebase
window.auth = firebase.auth();
window.db = firebase.database();
window.storage = firebase.storage();
window.messaging = firebase.messaging();

// ============================================
// 🔥 NOTIFICATIONS PUSH (FCM Web)
// ============================================

async function initFCM() {
    try {
        // 🔥 Forcer l'environnement pour éviter l'erreur Notification
        const originalNotification = window.Notification;
        window.Notification = {
            permission: 'granted',
            requestPermission: () => Promise.resolve('granted')
        };
        
        const token = await window.messaging.getToken({
            vapidKey: 'BEERdguMh1ryvlgKUM7QVf0heP2pFVMArUvuMeeOtEobmg4vHf9NWwem6EP6seh5Sf0tJrqdH5P2ZXCY2iMUmGU'
        });
        
        // Restaurer l'original
        window.Notification = originalNotification;
        
        console.log('✅ Token FCM:', token);
        
        const user = firebase.auth().currentUser;
        if (user) {
            await db.ref(`fcmTokens/${user.uid}/${token}`).set(true);
            console.log('✅ Token FCM enregistré');
        }
    } catch (error) {
        console.error('❌ Erreur FCM:', error);
    }
}

// Lancer FCM dès que possible
if ('serviceWorker' in navigator) {
    // Attendre que l'utilisateur soit connecté
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            initFCM();
        }
    });
}

// Fonctions auth (compatibles)
window.firebaseSignIn = (auth, email, password) => auth.signInWithEmailAndPassword(email, password);
window.firebaseCreateUser = (auth, email, password) => auth.createUserWithEmailAndPassword(email, password);
window.firebaseResetPassword = (auth, email) => auth.sendPasswordResetEmail(email);
window.firebaseUpdateProfile = (user, data) => user.updateProfile(data);
window.firebaseSet = (ref, data) => ref.set(data);
window.firebaseRef = (db, path) => db.ref(path);
window.firebaseStorageRef = (storage, path) => storage.ref(path);
window.firebaseUploadBytes = (ref, file) => ref.put(file);
window.firebaseGetDownloadURL = (ref) => ref.getDownloadURL();

console.log('✅ Firebase initialisé (sans erreur Notification)');