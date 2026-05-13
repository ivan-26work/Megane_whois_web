// ============================================
// FIREBASE CONFIGURATION
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

firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db = firebase.database();
window.storage = firebase.storage();
window.messaging = firebase.messaging();

// ============================================
// 🔥 RÉCUPÉRATION ET ENREGISTREMENT DU TOKEN FCM
// ============================================

const VAPID_KEY = "BEERdguMh1ryvlgKUM7QVf0heP2pFVMArUvuMeeOtEobmg4vHf9NWwem6EP6seh5Sf0tJrqdH5P2ZXCY2iMUmGU";

async function saveFCMToken(userId) {
    if (!window.messaging) {
        console.warn("⚠️ Firebase Messaging non disponible");
        return null;
    }

    try {
        const token = await window.messaging.getToken({ vapidKey: VAPID_KEY });
        
        if (!token) {
            console.warn("⚠️ Aucun token FCM obtenu");
            return null;
        }

        console.log("✅ Token FCM récupéré :", token);

        await window.db.ref(`fcmTokens/${userId}/${token}`).set(true);
        console.log("✅ Token FCM enregistré dans Firebase");

        return token;
    } catch (error) {
        console.error("❌ Erreur FCM :", error);
        return null;
    }
}

// ============================================
// LANCEMENT APRÈS CONNEXION
// ============================================
window.auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("👤 Utilisateur connecté :", user.uid);
        await saveFCMToken(user.uid);
    } else {
        console.log("👤 Aucun utilisateur connecté");
    }
});

// ============================================
// FONCTIONS AUTH (compatibilité)
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

console.log("✅ firebase-config.js chargé (avec ta clé VAPID)");