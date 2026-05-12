// ===============================================
// AUTH.JS - VERSION FINALE COMPLÈTE
// ===============================================

// État
let currentTab = 'login';
let currentStep = 1;
let userData = {
    email: '',
    password: '',
    username: '',
    profilePic: null
};
let pendingUser = null;
let isLoginFlow = false;

// Éléments DOM
const loginTab = document.querySelector('[data-tab="login"]');
const registerTab = document.querySelector('[data-tab="register"]');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotForm = document.getElementById('forgotForm');
const registerNav = document.getElementById('registerNav');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const infoBanner = document.getElementById('infoBanner');
const bannerMessage = document.getElementById('bannerMessage');
const progressBar = document.getElementById('progressBar');
const progressFill = document.querySelector('.progress-fill');
const loadingModal = document.getElementById('loadingModal');
const successOverlay = document.getElementById('successOverlay');
const usernameOverlay = document.getElementById('usernameOverlay');
const acceptNotifs = document.getElementById('acceptNotifs');
const acceptTerms = document.getElementById('acceptTerms');
const cancelOverlayBtn = document.getElementById('cancelOverlayBtn');
const continueOverlayBtn = document.getElementById('continueOverlayBtn');
const usernameInput = document.getElementById('usernameInput');
const usernameError = document.getElementById('usernameError');
const cancelUsernameBtn = document.getElementById('cancelUsernameBtn');
const confirmUsernameBtn = document.getElementById('confirmUsernameBtn');

// ===============================================
// BANDE D'INFORMATION
// ===============================================
function showBanner(message, type = 'info', showProgress = false, progress = 0) {
    bannerMessage.textContent = message;
    infoBanner.className = `info-banner ${type} show`;
    if (showProgress && progressBar) {
        progressBar.style.display = 'block';
        if (progressFill) progressFill.style.width = `${progress}%`;
    } else if (progressBar) {
        progressBar.style.display = 'none';
    }
    if (type === 'error' || type === 'success') {
        setTimeout(() => {
            if (infoBanner.classList.contains('show')) {
                infoBanner.classList.remove('show');
            }
        }, 5000);
    }
}

function updateStepProgress() {
    const stepNames = ['Email', 'Mot de passe', 'Profil', 'Récapitulatif', 'Bienvenue'];
    const progressPercent = (currentStep / 5) * 100;
    showBanner(`Étape ${currentStep}/5 : ${stepNames[currentStep - 1]}`, 'progress', true, progressPercent);
}

// ===============================================
// SAUVEGARDE LOCALE (état de l'UI)
// ===============================================
function saveState() {
    localStorage.setItem('megane_state_tab', currentTab);
    localStorage.setItem('megane_state_step', currentStep);
    localStorage.setItem('megane_state_email', userData.email || '');
    localStorage.setItem('megane_state_username', userData.username || '');
}

function restoreState() {
    const savedTab = localStorage.getItem('megane_state_tab');
    const savedStep = localStorage.getItem('megane_state_step');
    const savedEmail = localStorage.getItem('megane_state_email');
    const savedUsername = localStorage.getItem('megane_state_username');

    if (savedTab) switchTab(savedTab);
    if (savedStep && savedTab === 'register') {
        currentStep = parseInt(savedStep);
        showStep(currentStep);
    }
    if (savedEmail) {
        document.getElementById('regEmail').value = savedEmail;
        userData.email = savedEmail;
    }
    if (savedUsername) {
        document.getElementById('regUsername').value = savedUsername;
        userData.username = savedUsername;
    }
}

// ===============================================
// MOT DE PASSE
// ===============================================
function initPasswordButtons() {
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// ===============================================
// ONGLETS
// ===============================================
function switchTab(tab) {
    currentTab = tab;
    loginTab.classList.toggle('active', tab === 'login');
    registerTab.classList.toggle('active', tab === 'register');

    if (tab === 'login') {
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
        forgotForm.classList.remove('active');
        showBanner('Bienvenue sur Megane_whois. Connectez-vous.', 'info');
    } else {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        forgotForm.classList.remove('active');
        showBanner('Création de compte - Étape 1/5 : Renseignez votre email', 'progress', true, 20);
    }

    registerNav.style.display = tab === 'register' ? 'flex' : 'none';
    if (tab === 'register') resetRegistration();
    saveState();
}

// ===============================================
// ÉTAPES INSCRIPTION
// ===============================================
function showStep(step) {
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`step${i}`)?.classList.toggle('active', i === step);
    }
    if (prevBtn) prevBtn.style.display = step > 1 ? 'block' : 'none';
    if (nextBtn) {
        if (step === 4) {
            nextBtn.textContent = 'Créer';
        } else if (step === 5) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.textContent = 'Suivant';
            nextBtn.style.display = 'block';
        }
    }
    updateStepProgress();
    saveState();
}

function nextStep() {
    if (currentStep === 1) {
        const email = document.getElementById('regEmail').value;
        if (!email || !email.includes('@')) {
            showBanner('Email invalide.', 'error');
            return;
        }
        userData.email = email;
        showBanner('Email valide ! Étape 2/5 : Choisissez un mot de passe.', 'success', true, 40);
    }
    else if (currentStep === 2) {
        const pwd = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        const strength = checkPasswordStrength(pwd);
        if (!strength.valid) {
            showBanner('Mot de passe trop faible (8+ caractères, majuscule, minuscule, chiffre).', 'error');
            return;
        }
        if (pwd !== confirm) {
            showBanner('Les mots de passe ne correspondent pas.', 'error');
            return;
        }
        userData.password = pwd;
        showBanner('Mot de passe sécurisé ! Étape 3/5 : Choisissez votre pseudo.', 'success', true, 60);
    }
    else if (currentStep === 3) {
        const username = document.getElementById('regUsername').value;
        if (!username || username.trim() === '') {
            showBanner('Pseudo requis.', 'error');
            return;
        }
        userData.username = username;
        document.getElementById('recapEmail').textContent = userData.email;
        document.getElementById('recapUsername').textContent = userData.username;
        const recapCircle = document.getElementById('recapCircle');
        if (userData.profilePic) {
            const reader = new FileReader();
            reader.onload = (e) => {
                recapCircle.innerHTML = `<img src="${e.target.result}">`;
            };
            reader.readAsDataURL(userData.profilePic);
        } else {
            recapCircle.innerHTML = '';
        }
        showBanner('Étape 4/5 : Vérifiez vos informations.', 'progress', true, 80);
    }
    else if (currentStep === 4) {
        createAccount();
        return;
    }
    currentStep++;
    showStep(currentStep);
    saveState();
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
        saveState();
    }
}

function resetRegistration() {
    currentStep = 1;
    userData = { email: '', password: '', username: '', profilePic: null };
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regConfirmPassword').value = '';
    document.getElementById('regUsername').value = '';
    document.getElementById('profileCircle').innerHTML = '<span>+</span>';
    document.getElementById('recapCircle').innerHTML = '';
    document.getElementById('passwordStrength').innerHTML = '';
    showStep(1);
    saveState();
}

function checkPasswordStrength(password) {
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const valid = hasMinLength && hasUpperCase && hasLowerCase && hasNumbers;
    const strengthDiv = document.getElementById('passwordStrength');
    if (strengthDiv && password.length > 0) {
        if (!hasMinLength) strengthDiv.innerHTML = '❌ Minimum 8 caractères';
        else if (!hasUpperCase) strengthDiv.innerHTML = '❌ Ajoutez une majuscule';
        else if (!hasLowerCase) strengthDiv.innerHTML = '❌ Ajoutez une minuscule';
        else if (!hasNumbers) strengthDiv.innerHTML = '❌ Ajoutez un chiffre';
        else strengthDiv.innerHTML = '✅ Mot de passe solide';
    }
    return { valid };
}

// ===============================================
// BRIDGE ANDROID — ENREGISTREMENT TOKEN FCM
// ===============================================
function notifyAndroidUserLoggedIn(userId) {
    if (!window.AndroidBridge || typeof window.AndroidBridge.onUserLoggedIn !== 'function') {
        console.warn('⚠️ Bridge Android non disponible (normal hors app)');
        return;
    }
    window.AndroidBridge.onUserLoggedIn(userId);
    console.log('✅ UID envoyé au bridge Android:', userId);
}

// ===============================================
// MISE À JOUR USERNAME
// ===============================================
async function updateUsernameAndRedirect(user) {
    const newUsername = usernameInput.value.trim();
    if (newUsername.length < 2) {
        if (usernameError) usernameError.style.display = 'block';
        return false;
    }
    if (usernameError) usernameError.style.display = 'none';

    try {
        await window.firebaseUpdateProfile(user, { displayName: newUsername });
        await window.firebaseSet(window.firebaseRef(window.db, `users/${user.uid}/username`), newUsername);
        userData.username = newUsername;

        localStorage.setItem('megane_username', newUsername);
        localStorage.setItem('megane_logged_in', 'true');
        localStorage.setItem('megane_uid', user.uid);

        return true;
    } catch (err) {
        console.error('Erreur mise à jour username:', err);
        showBanner('Erreur lors de la mise à jour du pseudo.', 'error');
        return false;
    }
}

// ===============================================
// CRÉATION DE COMPTE
// ===============================================
async function uploadProfilePhoto(userId, file) {
    try {
        const storageReference = window.firebaseStorageRef(window.storage, `profile_photos/${userId}`);
        await window.firebaseUploadBytes(storageReference, file);
        const photoURL = await window.firebaseGetDownloadURL(storageReference);
        return photoURL;
    } catch (error) {
        console.error('Erreur upload photo:', error);
        return null;
    }
}

async function createAccount() {
    showBanner('Création du compte en cours...', 'progress', true, 90);
    if (loadingModal) loadingModal.style.display = 'flex';

    try {
        const userCredential = await window.firebaseCreateUser(window.auth, userData.email, userData.password);
        const user = userCredential.user;

        let photoURL = null;
        if (userData.profilePic) {
            photoURL = await uploadProfilePhoto(user.uid, userData.profilePic);
        }

        await window.firebaseUpdateProfile(user, {
            displayName: userData.username,
            photoURL: photoURL || null
        });

        await window.firebaseSet(window.firebaseRef(window.db, `users/${user.uid}`), {
            uid: user.uid,
            email: userData.email,
            username: userData.username,
            pseudo: userData.username,
            pseudoLower: userData.username.toLowerCase(),
            photoURL: photoURL || null,
            createdAt: new Date().toISOString(),
            online: true
        });

        localStorage.setItem('megane_logged_in', 'true');
        localStorage.setItem('megane_uid', user.uid);
        localStorage.setItem('megane_username', userData.username);
        localStorage.setItem('megane_email', userData.email);
        if (photoURL) localStorage.setItem('megane_photoURL', photoURL);
        localStorage.setItem('lastUser', JSON.stringify({ email: userData.email, username: userData.username }));

        if (loadingModal) loadingModal.style.display = 'none';
        showBanner('✅ Compte créé avec succès !', 'success', true, 100);

        pendingUser = user;
        isLoginFlow = false;
        successOverlay.style.display = 'flex';

    } catch (error) {
        if (loadingModal) loadingModal.style.display = 'none';
        console.error('Erreur création:', error);
        if (error.code === 'auth/email-already-in-use') {
            showBanner('Cet email est déjà utilisé.', 'error');
        } else {
            showBanner('Erreur lors de la création du compte.', 'error');
        }
    }
}

// ===============================================
// CONNEXION
// ===============================================
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showBanner('Email et mot de passe requis.', 'error');
        return;
    }

    showBanner('Connexion en cours...', 'progress', true, 50);

    try {
        const userCredential = await window.firebaseSignIn(window.auth, email, password);
        const user = userCredential.user;

        const userSnap = await window.db.ref(`users/${user.uid}`).once('value');
        const userInfo = userSnap.val() || {};
        const username = userInfo.username || user.displayName || email.split('@')[0];

        localStorage.setItem('megane_logged_in', 'true');
        localStorage.setItem('megane_uid', user.uid);
        localStorage.setItem('megane_username', username);
        localStorage.setItem('megane_email', email);
        if (userInfo.photoURL) localStorage.setItem('megane_photoURL', userInfo.photoURL);
        localStorage.setItem('lastUser', JSON.stringify({ email }));

        pendingUser = user;
        isLoginFlow = true;
        successOverlay.style.display = 'flex';

    } catch (error) {
        console.error('Erreur connexion:', error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showBanner('Email ou mot de passe incorrect.', 'error');
        } else {
            showBanner('Erreur de connexion.', 'error');
        }
    }
}

// ===============================================
// OVERLAY 1 : ANNULER / CONTINUER
// ===============================================
if (cancelOverlayBtn) {
    cancelOverlayBtn.addEventListener('click', () => {
        successOverlay.style.display = 'none';
        pendingUser = null;
        isLoginFlow = false;
    });
}

if (continueOverlayBtn) {
    continueOverlayBtn.addEventListener('click', async () => {
        if (!acceptTerms.checked) {
            showBanner("Vous devez accepter les conditions d'utilisation.", 'error');
            return;
        }

        if (acceptNotifs.checked && pendingUser) {
            notifyAndroidUserLoggedIn(pendingUser.uid);
        }

        if (isLoginFlow && pendingUser) {
            const snap = await window.db.ref(`users/${pendingUser.uid}/username`).once('value');
            const currentUsername = snap.val() || pendingUser.displayName || '';
            if (usernameInput) usernameInput.value = currentUsername;
            if (usernameError) usernameError.style.display = 'none';
            successOverlay.style.display = 'none';
            usernameOverlay.style.display = 'flex';
        } else {
            localStorage.setItem('megane_logged_in', 'true');
            if (pendingUser) {
                localStorage.setItem('megane_uid', pendingUser.uid);
                localStorage.setItem('megane_username', userData.username || usernameInput.value);
                localStorage.setItem('megane_email', userData.email || document.getElementById('loginEmail')?.value);
            }
            window.location.href = 'index.html';
        }
    });
}

// ===============================================
// OVERLAY 2 : USERNAME
// ===============================================
if (cancelUsernameBtn) {
    cancelUsernameBtn.addEventListener('click', () => {
        usernameOverlay.style.display = 'none';
        successOverlay.style.display = 'flex';
    });
}

if (confirmUsernameBtn) {
    confirmUsernameBtn.addEventListener('click', async () => {
        if (!pendingUser) return;
        const success = await updateUsernameAndRedirect(pendingUser);
        if (success) {
            const newUsername = usernameInput.value.trim();
            localStorage.setItem('megane_username', newUsername);
            localStorage.setItem('megane_logged_in', 'true');
            window.location.href = 'index.html';
        }
    });
}

if (usernameInput) {
    usernameInput.addEventListener('input', () => {
        const val = usernameInput.value.trim();
        if (val.length >= 2) {
            if (usernameError) usernameError.style.display = 'none';
            if (confirmUsernameBtn) confirmUsernameBtn.disabled = false;
        } else {
            if (usernameError) usernameError.style.display = 'block';
            if (confirmUsernameBtn) confirmUsernameBtn.disabled = true;
        }
    });
}

// ===============================================
// MOT DE PASSE OUBLIÉ
// ===============================================
async function resetPassword() {
    const email = document.getElementById('forgotEmail').value;
    if (!email || !email.includes('@')) {
        showBanner('Email valide requis.', 'error');
        return;
    }

    try {
        await window.firebaseResetPassword(window.auth, email);
        showBanner(`📧 Lien envoyé à ${email}`, 'success');
        setTimeout(() => {
            forgotForm.classList.remove('active');
            loginForm.classList.add('active');
        }, 1500);
    } catch (error) {
        showBanner("Erreur lors de l'envoi du lien.", 'error');
    }
}

// ===============================================
// PHOTO DE PROFIL
// ===============================================
const choosePhotoBtn = document.getElementById('choosePhotoBtn');
const photoInput = document.getElementById('photoInput');
const profileCircle = document.getElementById('profileCircle');

if (choosePhotoBtn) {
    choosePhotoBtn.addEventListener('click', () => photoInput.click());
}

if (photoInput) {
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                showBanner('Photo trop volumineuse (max 2 Mo).', 'error');
                return;
            }
            userData.profilePic = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                profileCircle.innerHTML = `<img src="${event.target.result}">`;
                showBanner('Photo ajoutée (facultative) !', 'success');
                saveState();
            };
            reader.readAsDataURL(file);
        }
    });
}

// ===============================================
// ÉCOUTEURS
// ===============================================
document.getElementById('regPassword')?.addEventListener('input', (e) => checkPasswordStrength(e.target.value));
document.getElementById('regEmail')?.addEventListener('input', (e) => { userData.email = e.target.value; saveState(); });
document.getElementById('regUsername')?.addEventListener('input', (e) => { userData.username = e.target.value; saveState(); });

loginTab.addEventListener('click', () => switchTab('login'));
registerTab.addEventListener('click', () => switchTab('register'));
prevBtn.addEventListener('click', prevStep);
nextBtn.addEventListener('click', nextStep);

document.getElementById('doLoginBtn')?.addEventListener('click', login);
document.getElementById('resetPasswordBtn')?.addEventListener('click', resetPassword);
document.getElementById('finishBtn')?.addEventListener('click', () => { window.location.href = 'index.html'; });
document.getElementById('createAccountBtn')?.addEventListener('click', createAccount);

document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    forgotForm.classList.add('active');
    registerNav.style.display = 'none';
});

document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    forgotForm.classList.remove('active');
    loginForm.classList.add('active');
});

// ===============================================
// SESSION EXISTANTE
// ===============================================
function loadLastSession() {
    const lastUser = localStorage.getItem('lastUser');
    if (lastUser) {
        const user = JSON.parse(lastUser);
        document.getElementById('sessionInfo').innerHTML = `
            <div style="font-weight:500;">${user.email}</div>
            <div style="font-size:0.7rem; color:#6c757d;">Dernière session</div>
        `;
        const useBtn = document.getElementById('useSessionBtn');
        useBtn.style.display = 'block';
        useBtn.onclick = () => {
            document.getElementById('loginEmail').value = user.email;
            showBanner(`Email pré-rempli : ${user.email}`, 'info');
        };
    }
}

// ===============================================
// INITIALISATION
// ===============================================
initPasswordButtons();
loadLastSession();
restoreState();
showBanner('Bienvenue sur Megane_whois. Connectez-vous ou créez un compte.', 'info');