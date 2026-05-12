// ==================== ÉTAT GLOBAL ====================
let me = null;
let meSettings = { findable: true, hidePresence: false, disableReadReceipt: false, disableTyping: false };
let allUsers = {};
let discsMap = {};
let convListenerCb = null;
let msgsRef = null;
let onlineRef = null;
let typingRef = null;
let typingTimer = null;
let currentConvId = null;
let currentOtherUid = null;
let typingListeners = {};
let pendingDeleteConvId = null;
let lastReadListener = null;
let replyToMessageData = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingTimerInterval = null;
let isRecording = false;

// ==================== AVATARS PRÉDÉFINIS ====================
const predefinedAvatars = [
    { name: "Default", color: "#3b8bff", emoji: "😀" },
    { name: "Chat", color: "#10b981", emoji: "💬" },
    { name: "Star", color: "#f59e0b", emoji: "⭐" },
    { name: "Heart", color: "#ef4444", emoji: "❤️" },
    { name: "Robot", color: "#8b5cf6", emoji: "🤖" },
    { name: "User", color: "#06b6d4", emoji: "👤" },
    { name: "Smile", color: "#ec4899", emoji: "😊" },
    { name: "Fire", color: "#f97316", emoji: "🔥" }
];

// ==================== CACHE LOCAL ====================
function saveDiscsToCache() {
    localStorage.setItem('megane_discsMap', JSON.stringify(discsMap));
}

function saveUsersToCache() {
    localStorage.setItem('megane_allUsers', JSON.stringify(allUsers));
}

function loadCache() {
    const savedDiscs = localStorage.getItem('megane_discsMap');
    if (savedDiscs) {
        discsMap = JSON.parse(savedDiscs);
        renderDiscs();
    }
    const savedUsers = localStorage.getItem('megane_allUsers');
    if (savedUsers) {
        allUsers = JSON.parse(savedUsers);
    }
}

// ==================== CHARGEMENT DU PROFIL ====================
async function loadUserProfile() {
    if (!me) return;
    try {
        const snap = await db.ref(`users/${me.uid}`).once('value');
        const userData = snap.val();
        if (userData) {
            me.displayName = userData.username || '';
            me.email = userData.email || '';
            me.photoURL = userData.photoURL || null;
            localStorage.setItem('megane_username', me.displayName);
            localStorage.setItem('megane_email', me.email);
            if (me.photoURL) localStorage.setItem('megane_photoURL', me.photoURL);

            const usernameInput = document.getElementById('usernameInput');
            const userEmailSpan = document.getElementById('userEmail');
            const avatarInitial = document.getElementById('avatarInitial');
            if (usernameInput) usernameInput.value = me.displayName;
            if (userEmailSpan) userEmailSpan.textContent = me.email;
            if (avatarInitial) avatarInitial.textContent = (me.displayName || me.email || '?').charAt(0).toUpperCase();

            const avatarBtn = document.getElementById('avatarBtn');
            if (avatarBtn && me.photoURL) {
                avatarBtn.innerHTML = `<img src="${me.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else if (avatarBtn) {
                avatarBtn.innerHTML = `<span id="avatarInitial">${(me.displayName || '?').charAt(0).toUpperCase()}</span>`;
            }
        }
    } catch (err) {
        console.error("Erreur chargement profil:", err);
    }
}

// ==================== BARRE FOOTER ====================
let footerTempTimer = null;
let lastTempSenderId = null;
let volumePercent = 50;
let vibrationPercent = 50;

function loadSoundSettings() {
    const savedVolume = localStorage.getItem('volumePercent');
    const savedVibration = localStorage.getItem('vibrationPercent');
    if (savedVolume !== null) volumePercent = parseInt(savedVolume);
    if (savedVibration !== null) vibrationPercent = parseInt(savedVibration);
    const volumeSlider = document.getElementById('volumeSlider');
    const vibrationSlider = document.getElementById('vibrationSlider');
    const volumeValue = document.getElementById('volumeValue');
    const vibrationValue = document.getElementById('vibrationValue');
    if (volumeSlider) volumeSlider.value = volumePercent;
    if (vibrationSlider) vibrationSlider.value = vibrationPercent;
    if (volumeValue) volumeValue.textContent = volumePercent + '%';
    if (vibrationValue) vibrationValue.textContent = vibrationPercent + '%';
}

function saveVolume(value) {
    volumePercent = value;
    localStorage.setItem('volumePercent', value);
    const volumeValue = document.getElementById('volumeValue');
    if (volumeValue) volumeValue.textContent = value + '%';
}

function saveVibration(value) {
    vibrationPercent = value;
    localStorage.setItem('vibrationPercent', value);
    const vibrationValue = document.getElementById('vibrationValue');
    if (vibrationValue) vibrationValue.textContent = value + '%';
}

function playNotifSound() {
    if (volumePercent === 0) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = volumePercent / 100;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) { console.log("Audio non supporté"); }
}

function vibrate() {
    if (vibrationPercent === 0) return;
    if (navigator.vibrate) {
        const duration = Math.floor(200 * (vibrationPercent / 100));
        navigator.vibrate(duration);
    }
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('fr-FR', { hour12: false });
}

let barreClockInterval = null;
function startBarreClock() {
    if (barreClockInterval) clearInterval(barreClockInterval);
    const update = () => {
        const clockElement = document.getElementById('footerClock');
        const footerBar = document.getElementById('footerBar');
        if (clockElement && footerBar && !footerBar.classList.contains('temp-mode')) {
            clockElement.textContent = getCurrentTime();
        }
        const findClock = document.getElementById('findFooterClock');
        if (findClock) findClock.textContent = getCurrentTime();
        const userInfoClock = document.getElementById('userInfoFooterClock');
        if (userInfoClock) userInfoClock.textContent = getCurrentTime();
    };
    update();
    barreClockInterval = setInterval(update, 1000);
}

function updateFooterTotalBadge() {
    let total = 0;
    for (let convId in discsMap) total += discsMap[convId].unread || 0;
    const badgeEl = document.getElementById('footerBadge');
    if (badgeEl) {
        if (total === 0) badgeEl.style.display = 'none';
        else {
            badgeEl.style.display = 'flex';
            badgeEl.textContent = total;
        }
    }
}

function setFooterNormalMode() {
    if (footerTempTimer) clearTimeout(footerTempTimer);
    const footerBar = document.getElementById('footerBar');
    if (!footerBar) return;
    footerBar.classList.remove('temp-mode');
    let total = 0;
    for (let convId in discsMap) total += discsMap[convId].unread || 0;
    footerBar.innerHTML = `
        <div class="footer-left">
            <span class="app-name">Megane_whois</span>
            <span class="version-badge">v1.0.0</span>
        </div>
        <div class="footer-center" id="footerClock">${getCurrentTime()}</div>
        <div class="footer-right" id="footerBadge" style="${total === 0 ? 'display:none;' : ''}">${total}</div>
    `;
    lastTempSenderId = null;
    startBarreClock();
}

function setFooterTempMode(senderId, senderName, message) {
    if (footerTempTimer) clearTimeout(footerTempTimer);
    lastTempSenderId = senderId;
    const footerBar = document.getElementById('footerBar');
    if (!footerBar) return;
    footerBar.classList.add('temp-mode');
    footerBar.innerHTML = `
        <div class="footer-left">
            <span class="temp-sender">${esc(senderName)}</span>
            <span class="temp-message"> : ${esc(message)}</span>
        </div>
        <div class="footer-right" id="footerBadge" style="display: none;">0</div>
    `;
    footerTempTimer = setTimeout(() => setFooterNormalMode(), 5000);
}

function startBarreListeners() {
    if (!me) return;
    db.ref('conversations').once('value', (snap) => {
        const convs = snap.val() || {};
        for (const convId in convs) {
            const conv = convs[convId];
            if (!conv.participants || !conv.participants.includes(me.uid)) continue;
            let isFirstMessage = true;
            const newMsgListener = db.ref(`messages/${convId}`).orderByChild('timestamp').limitToLast(1);
            newMsgListener.on('child_added', async (msgSnap) => {
                if (isFirstMessage) {
                    isFirstMessage = false;
                    return;
                }
                const msg = msgSnap.val();
                if (!msg) return;
                if (msg.senderId === me.uid) return;
                if (document.hidden) return;
                if (currentConvId === convId) return;
                let senderName = "Utilisateur";
                const userSnap = await db.ref(`users/${msg.senderId}`).once('value');
                const user = userSnap.val();
                if (user && user.username) senderName = user.username;
                setFooterTempMode(msg.senderId, senderName, msg.text);
                playNotifSound();
                vibrate();
            });
        }
    });
}

// ==================== FONCTIONS UTILES ====================
function esc(s) { return (s || '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]); }
function initial(n) { return (n || '?').charAt(0).toUpperCase(); }
function fmtTime(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(ts) { if (!ts) return ''; const d = new Date(ts), t = new Date(), y = new Date(t); y.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return fmtTime(ts); if (d.toDateString() === y.toDateString()) return 'Hier'; return d.toLocaleDateString('fr'); }
function dateSep(ts) { if (!ts) return ''; const d = new Date(ts), t = new Date(), y = new Date(t); y.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return "Aujourd'hui"; if (d.toDateString() === y.toDateString()) return 'Hier'; return d.toLocaleDateString('fr', { day: 'numeric', month: 'long' }); }

function showBanner(message, type = 'info') {
    let banner = document.getElementById('dynamicBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'dynamicBanner';
        banner.className = 'showBanner';
        document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.textContent = message;
    banner.className = `showBanner ${type}`;
    banner.style.display = 'block';
    setTimeout(() => {
        banner.style.display = 'none';
    }, 3000);
}

// ==================== RÉGLAGES ====================
function initToggles() {
    const toggles = [
        { id: 'toggleFindable', key: 'findable' },
        { id: 'toggleHidePresence', key: 'hidePresence' },
        { id: 'toggleDisableReadReceipt', key: 'disableReadReceipt' },
        { id: 'toggleDisableTyping', key: 'disableTyping' }
    ];
    toggles.forEach(t => {
        const el = document.getElementById(t.id);
        if (!el) return;
        el.addEventListener('click', async () => {
            const newValue = !el.classList.contains('active');
            el.classList.toggle('active', newValue);
            await saveSetting(t.key, newValue);
        });
    });
}

async function saveSetting(key, value) {
    if (!me) return;
    meSettings[key] = value;
    await db.ref(`users/${me.uid}/settings/${key}`).set(value);
    if (key === 'hidePresence') await db.ref(`users/${me.uid}/online`).set(!value);
}

// ==================== GESTION AVATAR ====================
async function updateAvatar(avatarUrl) {
    if (!me) return;
    try {
        await db.ref(`users/${me.uid}/photoURL`).set(avatarUrl);
        me.photoURL = avatarUrl;
        localStorage.setItem('megane_photoURL', avatarUrl);
        
        const avatarBtn = document.getElementById('avatarBtn');
        if (avatarBtn) {
            avatarBtn.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
        renderDiscs();
        showBanner("✅ Avatar mis à jour !", "success");
    } catch (err) {
        console.error("Erreur mise à jour avatar:", err);
        showBanner("❌ Erreur lors de la mise à jour", "error");
    }
}

function showAvatarSelector() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <h3 style="margin-bottom: 16px;">Choisir un avatar</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
                ${predefinedAvatars.map(av => `
                    <div class="avatar-option" data-avatar-emoji="${av.emoji}" data-avatar-color="${av.color}" style="cursor: pointer; text-align: center; padding: 10px; border-radius: 50%; background: ${av.color}; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 30px;">
                        ${av.emoji}
                    </div>
                `).join('')}
            </div>
            <button id="avatarCancelBtn" class="btn-secondary" style="width: 100%;">Annuler</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const emoji = opt.dataset.avatarEmoji;
            const color = opt.dataset.avatarColor;
            const avatarUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='${color.replace('#', '%23')}'/%3E%3Ctext x='50' y='67' text-anchor='middle' fill='white' font-size='50'%3E${emoji}%3C/text%3E%3C/svg%3E`;
            updateAvatar(avatarUrl);
            modal.remove();
        });
    });
    
    document.getElementById('avatarCancelBtn')?.addEventListener('click', () => modal.remove());
}

// ==================== VUE INFO USER ====================
let currentInfoUserId = null;
let previousViewId = null;

function showUserInfo(userId, fromViewId) {
    previousViewId = fromViewId;
    currentInfoUserId = userId;
    
    const user = allUsers[userId] || {};
    const name = user.username || user.email || "Utilisateur";
    const email = user.email || "Email non renseigné";
    const online = user.online || false;
    const photoURL = user.photoURL || null;
    
    const avatarEl = document.getElementById('userInfoAvatar');
    const nameEl = document.getElementById('userInfoName');
    const emailEl = document.getElementById('userInfoEmail');
    const statusEl = document.getElementById('userInfoStatus');
    
    if (avatarEl) {
        if (photoURL) {
            avatarEl.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
            avatarEl.innerHTML = `<span id="userInfoAvatarText">${initial(name)}</span>`;
        }
    }
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (statusEl) {
        statusEl.textContent = online ? "🟢 En ligne" : "⚫ Hors ligne";
        statusEl.className = online ? "userinfo-status online" : "userinfo-status offline";
    }
    
    showView('userInfoView');
}

function initUserInfoView() {
    const backBtn = document.getElementById('backFromUserInfoBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            if (previousViewId) {
                showView(previousViewId);
            } else {
                showView('chatView');
            }
        };
    }
    
    const chatBtn = document.getElementById('userInfoChatBtn');
    if (chatBtn) {
        chatBtn.onclick = () => {
            if (currentInfoUserId) {
                startOrOpenChat(currentInfoUserId);
            }
        };
    }
}

// ==================== RÉPONDRE PAR GLISSEMENT ====================
function formatReplyMessage(text) {
    const replyPattern = /📎 \[Rép: "([^"]+)"\]\n([\s\S]*)/;
    const match = text.match(replyPattern);
    
    if (match) {
        return {
            isReply: true,
            quotedText: match[1],
            replyText: match[2].trim() || "(suite)"
        };
    }
    return { isReply: false, originalText: text };
}

let touchStartX = null;
let touchStartY = null;
let currentSwipeMsgElement = null;

function initSwipeToReply() {
    const msgsArea = document.getElementById('msgsArea');
    if (!msgsArea) return;
    
    msgsArea.addEventListener('touchstart', (e) => {
        const target = e.target.closest('.msg-row');
        if (!target) return;
        if (target.classList.contains('sent')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        currentSwipeMsgElement = target;
    });
    
    msgsArea.addEventListener('touchmove', (e) => {
        if (!touchStartX || !currentSwipeMsgElement) return;
        const currentX = e.touches[0].clientX;
        const diffX = currentX - touchStartX;
        const diffY = Math.abs(e.touches[0].clientY - touchStartY);
        
        if (diffX > 30 && diffY < 20) {
            e.preventDefault();
            currentSwipeMsgElement.style.transform = `translateX(${Math.min(diffX, 150)}px)`;
            currentSwipeMsgElement.style.transition = 'transform 0.05s linear';
            currentSwipeMsgElement.style.opacity = `${1 - Math.min(diffX / 200, 0.5)}`;
        }
    });
    
    msgsArea.addEventListener('touchend', (e) => {
        if (!touchStartX || !currentSwipeMsgElement) return;
        const endX = e.changedTouches[0].clientX;
        const diffX = endX - touchStartX;
        
        if (diffX > 80) {
            const msgText = currentSwipeMsgElement.querySelector('.bubble')?.textContent || '';
            replyToMessageData = { msgText };
            showReplyQuote(msgText);
        }
        
        currentSwipeMsgElement.style.transform = '';
        currentSwipeMsgElement.style.opacity = '';
        touchStartX = null;
        currentSwipeMsgElement = null;
    });
}

function showReplyQuote(quotedText) {
    let quoteBar = document.getElementById('replyQuoteBar');
    if (!quoteBar) {
        const inputArea = document.querySelector('.input-area');
        quoteBar = document.createElement('div');
        quoteBar.id = 'replyQuoteBar';
        quoteBar.className = 'reply-quote-bar';
        quoteBar.innerHTML = `
            <div class="reply-quote-content">
                <span class="reply-quote-text">⤴️ Réponse à :</span>
                <span class="reply-quote-message">${esc(quotedText)}</span>
            </div>
            <button class="reply-quote-close">✕</button>
        `;
        inputArea.parentNode.insertBefore(quoteBar, inputArea);
        
        quoteBar.querySelector('.reply-quote-close').addEventListener('click', () => {
            replyToMessageData = null;
            quoteBar.remove();
        });
    } else {
        quoteBar.querySelector('.reply-quote-message').textContent = quotedText;
        quoteBar.style.display = 'flex';
    }
}

// ==================== ENVOI D'IMAGES ====================
async function uploadToImageService(file) {
    const services = [
        {
            name: "tmpfiles",
            url: "https://tmpfiles.org/api/v1/upload",
            buildForm: (f) => { const fd = new FormData(); fd.append("file", f); return fd; },
            extractUrl: (data) => data.data.url.replace("tmpfiles.org", "tmpfiles.org/dl"),
            isValid: (data) => data.status === "success"
        },
        {
            name: "0x0.st",
            url: "https://0x0.st",
            buildForm: (f) => { const fd = new FormData(); fd.append("file", f); return fd; },
            extractUrl: (data) => data.trim(),
            isValid: (data) => data.startsWith("https://")
        },
        {
            name: "Pomf2",
            url: "https://pomf2.lain.la/upload.php",
            buildForm: (f) => { const fd = new FormData(); fd.append("files[]", f); return fd; },
            extractUrl: (data) => data.files?.[0]?.url,
            isValid: (data) => data.success === true
        }
    ];
    
    for (const service of services) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(service.url, {
                method: "POST",
                body: service.buildForm(file),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) continue;
            
            let data;
            const text = await response.text();
            try { data = JSON.parse(text); } catch(e) { data = text; }
            
            const url = service.extractUrl(data);
            if (url && service.isValid(data)) {
                console.log(`✅ Upload image réussi avec ${service.name}: ${url}`);
                return url;
            }
        } catch (e) {
            console.warn(`⚠️ Erreur ${service.name}:`, e.message);
        }
    }
    throw new Error("Aucun service d'upload n'a fonctionné");
}

async function sendImageMessage(file, caption = "") {
    const convId = currentConvId;
    if (!convId) {
        showBanner("Aucune discussion ouverte", "error");
        return;
    }
    
    if (!me || !me.uid) {
        showBanner("Utilisateur non connecté", "error");
        return;
    }
    
    showBanner("📤 Upload de l'image...", "progress");
    
    try {
        const imageUrl = await uploadToImageService(file);
        
        await db.ref(`messages/${convId}`).push({
            senderId: me.uid,
            text: caption || "📷 Photo",
            imageUrl: imageUrl,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await db.ref(`conversations/${convId}`).update({
            lastMessage: caption || "📷 Photo",
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showBanner("✅ Image envoyée !", "success");
        
    } catch (error) {
        console.error("❌ Erreur upload:", error);
        showBanner("❌ Erreur: " + error.message, "error");
    }
}

// ==================== ENVOI DE MESSAGE VOCAL ====================
async function uploadToAudioService(file) {
    const services = [
        {
            name: "tmpfiles",
            url: "https://tmpfiles.org/api/v1/upload",
            buildForm: (f) => { const fd = new FormData(); fd.append("file", f); return fd; },
            extractUrl: (data) => data.data.url.replace("tmpfiles.org", "tmpfiles.org/dl"),
            isValid: (data) => data.status === "success"
        },
        {
            name: "0x0.st",
            url: "https://0x0.st",
            buildForm: (f) => { const fd = new FormData(); fd.append("file", f); return fd; },
            extractUrl: (data) => data.trim(),
            isValid: (data) => data.startsWith("https://")
        },
        {
            name: "Pomf2",
            url: "https://pomf2.lain.la/upload.php",
            buildForm: (f) => { const fd = new FormData(); fd.append("files[]", f); return fd; },
            extractUrl: (data) => data.files?.[0]?.url,
            isValid: (data) => data.success === true
        }
    ];
    
    for (const service of services) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(service.url, {
                method: "POST",
                body: service.buildForm(file),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) continue;
            
            let data;
            const text = await response.text();
            try { data = JSON.parse(text); } catch(e) { data = text; }
            
            const url = service.extractUrl(data);
            if (url && service.isValid(data)) {
                console.log(`✅ Upload audio réussi avec ${service.name}: ${url}`);
                return url;
            }
        } catch (e) {
            console.warn(`⚠️ Erreur ${service.name}:`, e.message);
        }
    }
    throw new Error("Aucun service d'upload n'a fonctionné");
}

async function sendAudioMessage(blob, duration = 0) {
    const convId = currentConvId;
    if (!convId) {
        showBanner("Aucune discussion ouverte", "error");
        return;
    }
    
    if (!me || !me.uid) {
        showBanner("Utilisateur non connecté", "error");
        return;
    }
    
    showBanner("📤 Upload du message vocal...", "progress");
    
    try {
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const audioUrl = await uploadToAudioService(file);
        
        await db.ref(`messages/${convId}`).push({
            senderId: me.uid,
            text: "🎤 Message vocal",
            audioUrl: audioUrl,
            audioDuration: duration,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await db.ref(`conversations/${convId}`).update({
            lastMessage: "🎤 Message vocal",
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });
        
        showBanner("✅ Message vocal envoyé !", "success");
        
    } catch (error) {
        console.error("❌ Erreur upload audio:", error);
        showBanner("❌ Erreur: " + error.message, "error");
    }
}

// ==================== ENREGISTREMENT AUDIO ====================
async function startRecording() {
    if (isRecording) {
        showBanner("Enregistrement déjà en cours", "info");
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showBanner("L'enregistrement audio n'est pas supporté", "error");
        return;
    }
    
    if (!window.MediaRecorder) {
        showBanner("MediaRecorder non supporté", "error");
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let mimeType = '';
        const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg'];
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
            }
        }
        
        const options = mimeType ? { mimeType: mimeType } : {};
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
            const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            
            if (mediaRecorder.stream) {
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            
            if (audioBlob.size > 0 && audioBlob.size < 20 * 1024 * 1024) {
                await sendAudioMessage(audioBlob, duration);
            } else if (audioBlob.size === 0) {
                showBanner("Enregistrement vide", "error");
            } else if (audioBlob.size >= 20 * 1024 * 1024) {
                showBanner("Audio trop long (max 20 Mo)", "error");
            }
            
            stopRecordingUI();
        };
        
        mediaRecorder.onerror = (e) => {
            console.error("MediaRecorder error:", e);
            showBanner("Erreur lors de l'enregistrement", "error");
            stopRecordingUI();
        };
        
        mediaRecorder.start(1000);
        isRecording = true;
        recordingStartTime = Date.now();
        
        startRecordingUI();
        
    } catch (error) {
        console.error("Erreur accès micro:", error);
        let errorMessage = "Impossible d'accéder au microphone";
        if (error.name === 'NotAllowedError') {
            errorMessage = "Permission micro refusée";
        } else if (error.name === 'NotFoundError') {
            errorMessage = "Aucun microphone trouvé";
        } else if (error.name === 'NotReadableError') {
            errorMessage = "Micro déjà utilisé par une autre application";
        }
        showBanner(errorMessage, "error");
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
    } else if (mediaRecorder && mediaRecorder.state === 'inactive') {
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        stopRecordingUI();
    }
}

function startRecordingUI() {
    const audioBtn = document.getElementById('attachAudioBtn');
    const stopBtn = document.getElementById('attachAudioStopBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingTimer = document.getElementById('recordingTimer');
    
    if (audioBtn) {
        audioBtn.style.display = 'none';
        audioBtn.classList.add('recording');
    }
    if (stopBtn) stopBtn.style.display = 'flex';
    if (recordingIndicator) recordingIndicator.style.display = 'flex';
    
    recordingTimerInterval = setInterval(() => {
        if (!isRecording) return;
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        if (recordingTimer) {
            recordingTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function stopRecordingUI() {
    const audioBtn = document.getElementById('attachAudioBtn');
    const stopBtn = document.getElementById('attachAudioStopBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingTimer = document.getElementById('recordingTimer');
    
    if (audioBtn) {
        audioBtn.style.display = 'flex';
        audioBtn.classList.remove('recording');
    }
    if (stopBtn) stopBtn.style.display = 'none';
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    if (recordingTimer) recordingTimer.textContent = '0:00';
    
    if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
    }
}

// ==================== ENVOI DE MESSAGE TEXTE ====================
async function sendMessage() {
    const input = document.getElementById('msgInput');
    let text = input.value?.trim();
    if (!text && !replyToMessageData) return;
    
    if (replyToMessageData) {
        const quoted = replyToMessageData.msgText.replace(/"/g, '\\"');
        text = `📎 [Rép: "${quoted}"]\n${text || "(suite)"}`;
        replyToMessageData = null;
        const quoteBar = document.getElementById('replyQuoteBar');
        if (quoteBar) quoteBar.remove();
    }
    
    input.value = '';
    input.style.height = 'auto';
    if (typingTimer) clearTimeout(typingTimer);
    if (!meSettings.disableTyping && currentConvId) {
        await db.ref(`typing/${currentConvId}/${me.uid}`).remove();
    }
    
    if (!currentConvId || !text) return;
    
    try {
        const newMsgRef = await db.ref(`messages/${currentConvId}`).push({
            senderId: me.uid, text, timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        const newMsgSnap = await newMsgRef.once('value');
        const newMsg = newMsgSnap.val();
        await db.ref(`conversations/${currentConvId}`).update({ lastMessage: text, lastMessageTime: newMsg.timestamp });
        if (discsMap[currentConvId]) {
            discsMap[currentConvId].lastSentRead = false;
            discsMap[currentConvId].lastMsg = text;
            discsMap[currentConvId].lastTime = newMsg.timestamp;
            discsMap[currentConvId].lastMsgSender = me.uid;
            renderDiscs();
        }
        const snap = await db.ref(`conversations/${currentConvId}/lastRead/${currentOtherUid}`).once('value');
        const targetLastRead = snap.val() || 0;
        if (targetLastRead < Date.now() - 5000) sendPush(currentOtherUid, text);
    } catch (e) { console.error(e); }
}

// ==================== NOTIFICATIONS PUSH ====================

// ==================== NOTIFICATIONS PUSH ====================
// ==================== NOTIFICATIONS PUSH ====================
async function sendPush(targetUid, messageText) {
    // Vérifier si un Service Worker est actif
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
        console.log("⚠️ Service Worker non disponible");
        return;
    }
    
    try {
        // Récupérer le nom de l'expéditeur
        const senderName = me.displayName || (me.email ? me.email.split('@')[0] : 'Utilisateur');
        
        // Envoyer un message au Service Worker pour afficher la notification
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: senderName,
            body: messageText.length > 200 ? messageText.slice(0, 200) + '…' : messageText,
            icon: '/assets/logo.png',
            badge: '/assets/badge.png',
            data: {
                userId: targetUid,
                senderName: senderName,
                messageText: messageText
            }
        });
        
        console.log("📬 Notification envoyée au Service Worker pour:", targetUid);
        
    } catch (e) { 
        console.error('❌ Erreur:', e); 
    }
}
// ==================== AUTH & DÉMARRAGE ====================
const savedUid = localStorage.getItem('megane_uid');
if (!savedUid) {
    console.log("Utilisateur non connecté");
} else {
    me = { uid: savedUid, displayName: localStorage.getItem('megane_username') || '', email: localStorage.getItem('megane_email') || '', photoURL: localStorage.getItem('megane_photoURL') || null };

    const urlParams = new URLSearchParams(window.location.search);
    const directUserId = urlParams.get('openChat');
    if (directUserId && directUserId !== savedUid) {
        setTimeout(() => {
            if (typeof startOrOpenChat === 'function') {
                startOrOpenChat(directUserId);
            }
        }, 50);
    }

    loadUserProfile();
    loadCache();
    loadSoundSettings();
    initToggles();
    setFooterNormalMode();
    startBarreListeners();
    initUserInfoView();
    initSwipeToReply();

    db.ref(`users/${savedUid}/settings`).once('value').then(snap => {
        const settings = snap.val() || {};
        meSettings.findable = settings.findable !== undefined ? settings.findable : true;
        meSettings.hidePresence = settings.hidePresence || false;
        meSettings.disableReadReceipt = settings.disableReadReceipt || false;
        meSettings.disableTyping = settings.disableTyping || false;
        document.getElementById('toggleFindable')?.classList.toggle('active', meSettings.findable);
        document.getElementById('toggleHidePresence')?.classList.toggle('active', meSettings.hidePresence);
        document.getElementById('toggleDisableReadReceipt')?.classList.toggle('active', meSettings.disableReadReceipt);
        document.getElementById('toggleDisableTyping')?.classList.toggle('active', meSettings.disableTyping);
        db.ref(`users/${me.uid}/online`).set(!meSettings.hidePresence);
        db.ref(`users/${me.uid}/online`).onDisconnect().set(false);
    });

    loadAllUsers();
    listenConversations();
}

function loadAllUsers() {
    db.ref('users').on('value', snap => {
        allUsers = snap.val() || {};
        saveUsersToCache();
    });
}

// ==================== CONVERSATIONS ====================
async function updateLastMsgStatus(convId) {
    if (!discsMap[convId]) return;
    const convRef = db.ref(`conversations/${convId}`);
    const convSnap = await convRef.once('value');
    const c = convSnap.val();
    if (!c) return;
    const otherId = c.participants.find(id => id !== me.uid);
    const lastMsgSnap = await db.ref(`messages/${convId}`).orderByChild('timestamp').limitToLast(1).once('value');
    let lastMsg = null;
    lastMsgSnap.forEach(msg => { lastMsg = msg.val(); });
    if (!lastMsg) return;
    const lastMsgSender = lastMsg.senderId;
    const lastMsgTime = lastMsg.timestamp;
    const lastReadMe = c.lastRead?.[me.uid] || 0;
    const lastReadOther = c.lastRead?.[otherId] || 0;
    let lastSentRead = false, lastReceivedRead = false;
    if (lastMsgSender === me.uid) lastSentRead = lastMsgTime <= lastReadOther;
    else lastReceivedRead = lastMsgTime <= lastReadMe;
    discsMap[convId].lastMsgSender = lastMsgSender;
    discsMap[convId].lastSentRead = lastSentRead;
    discsMap[convId].lastReceivedRead = lastReceivedRead;
    discsMap[convId].lastMsg = lastMsg.text;
    discsMap[convId].lastTime = lastMsg.timestamp;
    renderDiscs();
    saveDiscsToCache();
}

function listenConversations() {
    const convDbRef = db.ref('conversations');
    if (convListenerCb) convDbRef.off('value', convListenerCb);
    convListenerCb = convDbRef.on('value', async snap => {
        const convs = snap.val() || {};
        const newMap = {};
        for (const convId in convs) {
            const c = convs[convId];
            if (!Array.isArray(c.participants) || !c.participants.includes(me.uid)) continue;
            const otherId = c.participants.find(id => id !== me.uid);
            const u = allUsers[otherId] || {};
            const lastRead = c.lastRead?.[me.uid] || 0;
            let unread = 0;
            if (c.lastMessageTime && c.lastMessageTime > lastRead) {
                const msgsSnap = await db.ref(`messages/${convId}`).orderByChild('timestamp').startAfter(lastRead).once('value');
                msgsSnap.forEach(m => { if (m.val().senderId !== me.uid) unread++; });
            }
            let lastMsgSender = null, lastMsgText = c.lastMessage || 'Nouvelle conversation', lastMsgTime = c.lastMessageTime || c.createdAt || 0;
            let lastSentRead = false, lastReceivedRead = false;
            const lastMsgSnap = await db.ref(`messages/${convId}`).orderByChild('timestamp').limitToLast(1).once('value');
            let lastMsgObj = null;
            lastMsgSnap.forEach(msg => { lastMsgObj = msg.val(); });
            if (lastMsgObj) {
                lastMsgSender = lastMsgObj.senderId;
                lastMsgText = lastMsgObj.text;
                lastMsgTime = lastMsgObj.timestamp;
                const lastReadMe = c.lastRead?.[me.uid] || 0;
                const lastReadOther = c.lastRead?.[otherId] || 0;
                if (lastMsgSender === me.uid) lastSentRead = lastMsgTime <= lastReadOther;
                else lastReceivedRead = lastMsgTime <= lastReadMe;
            }
            newMap[convId] = {
                convId, otherId, name: u.username || u.email || '...',
                photo: u.photoURL || null, online: u.online || false,
                lastMsg: lastMsgText, lastTime: lastMsgTime, unread, isTyping: false,
                lastMsgSender, lastSentRead, lastReceivedRead
            };
            if (typingListeners[convId]) typingListeners[convId]();
            const typingRefItem = db.ref(`typing/${convId}/${otherId}`);
            const callback = typingRefItem.on('value', snap => {
                const isTyping = snap.val();
                if (newMap[convId]) newMap[convId].isTyping = isTyping || false;
                if (discsMap[convId]) { discsMap[convId].isTyping = isTyping || false; renderDiscs(); }
            });
            typingListeners[convId] = () => typingRefItem.off('value', callback);
            const lastReadOtherRef = db.ref(`conversations/${convId}/lastRead/${otherId}`);
            const lastReadMeRef = db.ref(`conversations/${convId}/lastRead/${me.uid}`);
            const updateCallback = () => updateLastMsgStatus(convId);
            lastReadOtherRef.on('value', updateCallback);
            lastReadMeRef.on('value', updateCallback);
            if (!typingListeners[`lastRead_${convId}`]) {
                typingListeners[`lastRead_${convId}`] = () => {
                    lastReadOtherRef.off('value', updateCallback);
                    lastReadMeRef.off('value', updateCallback);
                };
            }
        }
        discsMap = newMap;
        updateFooterTotalBadge();
        renderDiscs();
        saveDiscsToCache();
    });
}

function renderDiscs() {
    const container = document.getElementById('discList');
    if (!container) return;
    const q = document.getElementById('chatSearch')?.value.toLowerCase() || '';
    let arr = Object.values(discsMap).sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
    if (q) arr = arr.filter(d => d.name.toLowerCase().includes(q) || d.lastMsg.toLowerCase().includes(q));
    if (!arr.length) {
        container.innerHTML = '<div class="empty"><i class="fas fa-comments"></i>Aucune discussion</div>';
        return;
    }
    container.innerHTML = arr.map(d => {
        let borderClass = '';
        let lastMsgDisplay = d.lastMsg;
        
        if (d.lastMsg === "🎤 Message vocal") {
            lastMsgDisplay = '<span class="disc-audio-icon"><i class="fas fa-microphone"></i> Message vocal</span>';
        } else if (d.lastMsg === "📷 Photo") {
            lastMsgDisplay = '<span class="disc-audio-icon"><i class="fas fa-image"></i> Photo</span>';
        }
        
        if (d.lastMsgSender === me.uid) borderClass = d.lastSentRead ? 'sent-read' : 'sent-unread';
        else if (d.lastReceivedRead) borderClass = 'received-read';
        
        return `
        <div class="disc-card ${d.unread ? 'unread' : ''} ${borderClass}" data-conv-id="${d.convId}" data-other-id="${d.otherId}">
            <div class="avatar" style="cursor:pointer;" data-user-id="${d.otherId}">
                ${d.photo ? `<img src="${esc(d.photo)}">` : initial(d.name)}
            </div>
            <div class="disc-meta">
                <div class="disc-name">
                    ${esc(d.name)}
                    ${d.unread ? `<span class="badge-new">${d.unread}</span>` : ''}
                    ${(!meSettings.disableTyping && d.isTyping) ? '<span style="font-size:0.65rem; color:#5eead4; margin-left:6px;">✏️ écrit...</span>' : ''}
                </div>
                <div class="disc-last">${(!meSettings.disableTyping && d.isTyping) ? '...' : lastMsgDisplay}</div>
            </div>
            <div class="disc-time">${fmtDate(d.lastTime)}</div>
        </div>`;
    }).join('');
    
    container.querySelectorAll('.disc-card').forEach(el => {
        const convId = el.dataset.convId, otherId = el.dataset.otherId;
        let pressTimer = null;
        const startPress = () => { pressTimer = setTimeout(() => { pendingDeleteConvId = convId; document.getElementById('deleteModal').style.display = 'flex'; pressTimer = null; }, 500); };
        const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        el.addEventListener('click', (e) => {
            if (e.target.closest('.avatar')) {
                e.stopPropagation();
                showUserInfo(otherId, 'chatView');
                return;
            }
            cancelPress();
            openChat(convId, otherId);
        });
        el.addEventListener('mousedown', startPress);
        el.addEventListener('mouseup', cancelPress);
        el.addEventListener('mouseleave', cancelPress);
        el.addEventListener('touchstart', startPress, { passive: false });
        el.addEventListener('touchend', cancelPress);
        el.addEventListener('touchcancel', cancelPress);
    });
}

async function deleteConversation(convId) {
    if (!convId) return;
    await db.ref(`messages/${convId}`).remove();
    await db.ref(`conversations/${convId}`).remove();
    document.getElementById('deleteModal').style.display = 'none';
    pendingDeleteConvId = null;
    if (currentConvId === convId) closeChat();
}

async function startOrOpenChat(otherId) {
    for (const [cid, d] of Object.entries(discsMap)) if (d.otherId === otherId) { openChat(cid, otherId); return; }
    const snap = await db.ref('conversations').once('value');
    const convs = snap.val() || {};
    for (const cid in convs) {
        const c = convs[cid];
        if (c.participants?.includes(me.uid) && c.participants?.includes(otherId)) { openChat(cid, otherId); return; }
    }
    const ref = db.ref('conversations').push();
    await ref.set({ participants: [me.uid, otherId], createdAt: firebase.database.ServerValue.TIMESTAMP });
    openChat(ref.key, otherId);
}

// ==================== TYPING & READ STATUS ====================
function startTypingListener(convId, otherId) {
    if (typingRef) typingRef.off();
    typingRef = db.ref(`typing/${convId}/${otherId}`);
    typingRef.on('value', snap => {
        if (meSettings.disableTyping) return;
        const isTyping = snap.val();
        const typingIndicator = document.getElementById('typingIndicator');
        const onlineStatusSpan = document.getElementById('onlineStatus');

        if (isTyping) {
            if (typingIndicator) {
                typingIndicator.style.fontWeight = 'bold';
                typingIndicator.style.color = '#3b8bff';
                typingIndicator.textContent = 'Écrit...';
                let visible = true;
                if (typingIndicator._interval) clearInterval(typingIndicator._interval);
                const interval = setInterval(() => {
                    if (!typingIndicator || !typingIndicator.isConnected) {
                        clearInterval(interval);
                        return;
                    }
                    visible = !visible;
                    typingIndicator.style.opacity = visible ? '1' : '0.4';
                }, 500);
                typingIndicator._interval = interval;
            }
            if (onlineStatusSpan) onlineStatusSpan.style.display = 'none';
        } else {
            if (typingIndicator && typingIndicator._interval) {
                clearInterval(typingIndicator._interval);
                typingIndicator._interval = null;
            }
            if (typingIndicator) {
                typingIndicator.textContent = '';
                typingIndicator.style.opacity = '1';
            }
            if (onlineStatusSpan) onlineStatusSpan.style.display = 'inline';
            setOnlineStatus(allUsers[otherId]?.online, otherId);
        }
    });
}

async function updateReadStatusOnly(convId) {
    if (meSettings.disableReadReceipt) return;
    if (!currentOtherUid) return;
    const snap = await db.ref(`conversations/${convId}/lastRead/${currentOtherUid}`).once('value');
    const otherLastRead = snap.val() || 0;
    document.querySelectorAll('.msg-row.sent').forEach(row => {
        const footer = row.querySelector('.message-footer');
        if (!footer) return;
        let statusSpan = footer.querySelector('.read-status');
        const timeEl = footer.querySelector('.msg-time');
        if (!timeEl) return;
        const msgTime = parseInt(timeEl.getAttribute('data-timestamp') || '0');
        if (!statusSpan) {
            statusSpan = document.createElement('span');
            statusSpan.className = 'read-status';
            footer.appendChild(statusSpan);
        }
        statusSpan.textContent = (msgTime && msgTime <= otherLastRead) ? '✔️✔️' : '✔️';
        statusSpan.className = msgTime <= otherLastRead ? 'read-status read' : 'read-status delivered';
    });
}

// ==================== OUVERTURE DE DISCUSSION ====================
window.openChatDirectly = (userId) => {
    console.log("🔔 Ouverture directe pour:", userId);
    if (me && me.uid) {
        startOrOpenChat(userId);
    } else {
        setTimeout(() => {
            if (me && me.uid) startOrOpenChat(userId);
        }, 500);
    }
};

async function openChat(convId, otherId) {
    cleanupChat();
    currentConvId = convId;
    currentOtherUid = otherId;

    if (navigator.onLine && me) {
        await db.ref(`conversations/${convId}/lastRead/${me.uid}`).set(firebase.database.ServerValue.TIMESTAMP);
    }

    const u = allUsers[otherId] || {};
    const name = u.username || u.email || '...';
    const av = document.getElementById('chatAvatar');
    if (av) {
        av.innerHTML = u.photoURL ? `<img src="${esc(u.photoURL)}">` : initial(name);
        av.style.cursor = 'pointer';
        av.onclick = () => showUserInfo(otherId, 'discView');
    }
    document.getElementById('chatName').innerText = name;

    if (navigator.onLine) {
        setOnlineStatus(u.online, otherId);
        onlineRef = db.ref(`users/${otherId}/online`);
        onlineRef.on('value', s => setOnlineStatus(s.val(), otherId));
        startTypingListener(convId, otherId);
        if (lastReadListener) lastReadListener();
        lastReadListener = db.ref(`conversations/${convId}/lastRead/${otherId}`).on('value', () => {
            if (currentConvId === convId) updateReadStatusOnly(convId);
            updateLastMsgStatus(convId);
        });
    } else {
        document.getElementById('onlineStatus').innerText = 'Hors ligne';
        document.getElementById('onlineStatus').className = 'offline';
    }

    loadMessages(convId);
    showView('discView');
}

function setOnlineStatus(isOnline, otherId) {
    const metaDiv = document.querySelector('.chat-header .chat-meta');
    if (metaDiv) {
        if (isOnline && !meSettings.hidePresence) metaDiv.classList.add('online');
        else metaDiv.classList.remove('online');
    }
    if (meSettings.disableReadReceipt) {
        document.getElementById('onlineStatus').innerText = '';
        return;
    }
    const otherSettings = allUsers[otherId]?.settings || {};
    if (otherSettings.hidePresence) {
        document.getElementById('onlineStatus').innerText = '';
        return;
    }
    const el = document.getElementById('onlineStatus');
    if (el) {
        if (isOnline) {
            el.innerText = 'En ligne';
            el.style.fontWeight = 'bold';
            el.style.color = '#34d399';
        } else {
            el.innerText = 'Hors ligne';
            el.style.fontWeight = 'bold';
            el.style.color = '#f87171';
        }
    }
}

// ==================== CHARGEMENT DES MESSAGES ====================
function loadMessages(convId) {
    if (msgsRef) { msgsRef.off(); msgsRef = null; }
    const container = document.getElementById('msgsArea');
    if (!container) return;

    if (!navigator.onLine) {
        const cachedMessages = localStorage.getItem(`megane_messages_${convId}`);
        if (cachedMessages) {
            try {
                const msgs = JSON.parse(cachedMessages);
                displayMessagesList(msgs, container, false);
            } catch(e) { console.error("Erreur cache", e); }
        } else {
            container.innerHTML = '<div class="empty"><i class="fas fa-wifi-slash"></i> Hors ligne – Discussion non disponible</div>';
        }
        return;
    }

    container.innerHTML = '<div class="loader-row"><div class="spin"></div> Chargement...</div>';
    msgsRef = db.ref(`messages/${convId}`).orderByChild('timestamp');
    msgsRef.on('value', async snap => {
        const data = snap.val();
        if (!data) {
            container.innerHTML = '<div class="empty"><i class="fas fa-comment-dots"></i>Commencez la conversation !</div>';
            return;
        }

        if (currentConvId === convId && me) {
            await db.ref(`conversations/${convId}/lastRead/${me.uid}`).set(firebase.database.ServerValue.TIMESTAMP);
        }

        const otherLastReadSnap = await db.ref(`conversations/${convId}/lastRead/${currentOtherUid}`).once('value');
        const otherLastRead = otherLastReadSnap.val() || 0;

        let msgs = Object.entries(data).map(([id, m]) => ({ id, ...m }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        localStorage.setItem(`megane_messages_${convId}`, JSON.stringify(msgs));
        localStorage.setItem(`megane_lastread_${convId}_${currentOtherUid}`, otherLastRead);

        displayMessagesList(msgs, container, true);
        initSwipeToReply();

        updateLastMsgStatus(convId);
        if (currentConvId === convId && discsMap[convId]?.unread) {
            discsMap[convId].unread = 0;
            updateFooterTotalBadge();
            renderDiscs();
        }
    });
}

function displayMessagesList(msgs, container, isOnline = false) {
    let html = '', lastDate = '';
    const disableReceipt = meSettings.disableReadReceipt;
    const otherSettings = allUsers[currentOtherUid]?.settings || {};
    const otherDisableReceipt = otherSettings.disableReadReceipt || false;
    const canShowReceipt = isOnline && !disableReceipt && !otherDisableReceipt;

    msgs.forEach(m => {
        const isMe = m.senderId === me.uid;
        const ds = dateSep(m.timestamp);
        if (ds !== lastDate) {
            html += `<div class="date-sep">${ds}</div>`;
            lastDate = ds;
        }

        let statusHtml = '';
        if (canShowReceipt && isMe) {
            const cachedLastRead = localStorage.getItem(`megane_lastread_${currentConvId}_${currentOtherUid}`);
            const otherLastRead = cachedLastRead ? parseInt(cachedLastRead) : 0;
            if (m.timestamp <= otherLastRead) {
                statusHtml = '<span class="read-status read">✔️✔️</span>';
            } else {
                statusHtml = '<span class="read-status delivered">✔️</span>';
            }
        }

        let imageHtml = '';
        if (m.imageUrl) {
            imageHtml = `
                <div class="msg-image">
                    <img src="${m.imageUrl}" onclick="window.showFullImage('${m.imageUrl}')" style="max-width: 200px; max-height: 200px; border-radius: 12px; margin-bottom: 6px; cursor: pointer;">
                </div>
            `;
        }

        let audioHtml = '';
        if (m.audioUrl) {
            audioHtml = `
                <div class="msg-audio">
                    <audio controls src="${m.audioUrl}">
                        Votre navigateur ne supporte pas la lecture audio.
                    </audio>
                </div>
            `;
        }

        const formatted = formatReplyMessage(m.text);
        
        if (formatted.isReply) {
            html += `
                <div class="msg-row ${isMe ? 'sent' : 'recv'}" data-msg-id="${m.id}">
                    <div class="reply-bubble">
                        <div class="reply-quoted-header">
                            <span class="reply-icon">⤴️</span>
                            <span class="reply-quoted-label">En réponse à :</span>
                        </div>
                        <div class="reply-quoted-text">
                            "${esc(formatted.quotedText)}"
                        </div>
                        <div class="reply-divider"></div>
                        <div class="reply-new-message">
                            ${imageHtml}
                            ${audioHtml}
                            ${formatted.replyText ? esc(formatted.replyText) : ''}
                        </div>
                    </div>
                    <div class="message-footer">
                        <div class="msg-time" data-timestamp="${m.timestamp || 0}">${fmtTime(m.timestamp)}</div>
                        ${statusHtml}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="msg-row ${isMe ? 'sent' : 'recv'}" data-msg-id="${m.id}">
                    <div class="bubble">
                        ${imageHtml}
                        ${audioHtml}
                        ${formatted.originalText ? esc(formatted.originalText) : ''}
                    </div>
                    <div class="message-footer">
                        <div class="msg-time" data-timestamp="${m.timestamp || 0}">${fmtTime(m.timestamp)}</div>
                        ${statusHtml}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ==================== FONCTIONS GLOBALES ====================
window.showFullImage = function(url) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer;`;
    modal.innerHTML = `<img src="${url}" style="max-width:90%;max-height:90%;object-fit:contain;">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
};

// ==================== NETTOYAGE & NAVIGATION ====================
function cleanupChat() {
    if (msgsRef) { msgsRef.off(); msgsRef = null; }
    if (onlineRef) { onlineRef.off(); onlineRef = null; }
    if (typingRef) { typingRef.off(); typingRef = null; }
    if (lastReadListener && currentConvId && currentOtherUid) {
        db.ref(`conversations/${currentConvId}/lastRead/${currentOtherUid}`).off('value', lastReadListener);
        lastReadListener = null;
    }
    if (typingTimer) clearTimeout(typingTimer);
    if (currentConvId && me && !meSettings.disableTyping) db.ref(`typing/${currentConvId}/${me.uid}`).remove();
    
    // 🔥 Réinitialisation des variables
    currentConvId = null;
    currentOtherUid = null;
    replyToMessageData = null;
    
    const quoteBar = document.getElementById('replyQuoteBar');
    if (quoteBar) quoteBar.remove();
}

function closeChat() {
    cleanupChat();
    
    // 🔥 Réinitialisation supplémentaire
    currentConvId = null;
    currentOtherUid = null;
    
    showView('chatView');
}

function showView(viewId) {
    const currentActive = document.querySelector('.view.active');
    const nextView = document.getElementById(viewId);
    if (currentActive && currentActive.id === viewId) return;
    if (currentActive) {
        currentActive.classList.add('exit');
        setTimeout(() => {
            currentActive.classList.remove('exit');
            currentActive.classList.remove('active');
        }, 250);
    }
    if (nextView) nextView.classList.add('active');
}

async function logout() {
    cleanupChat();
    if (me) await db.ref(`users/${me.uid}/online`).set(false);
    localStorage.removeItem('megane_logged_in');
    localStorage.removeItem('megane_uid');
    localStorage.removeItem('megane_discsMap');
    localStorage.removeItem('megane_allUsers');
    await auth.signOut();
    window.location.href = 'auth.html';
}

// ==================== VUE FIND USER ====================
let findCurrentMode = "username";
let findSearchTimeout = null;

function initFindUserView() {
    const findSearchInput = document.getElementById('findSearchInput');
    const findActionBtn = document.getElementById('findActionBtn');
    const findResultArea = document.getElementById('findResultArea');
    const modeBtns = document.querySelectorAll('#findUserView .mode-btn');
    if (!findSearchInput) return;

    findActionBtn.innerHTML = '<div class="spinner-small"></div>';
    findActionBtn.classList.add('loader');
    findActionBtn.disabled = true;

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            findCurrentMode = btn.dataset.mode;
            if (findCurrentMode === 'username') {
                findSearchInput.placeholder = "Nom d'utilisateur (ex: Jean)";
                findActionBtn.innerHTML = '<div class="spinner-small"></div>';
                findActionBtn.classList.add('loader');
                findActionBtn.disabled = true;
                findSearchInput.value = "";
                findResultArea.innerHTML = "";
            } else {
                findSearchInput.placeholder = "Email exact (ex: jean@exemple.com)";
                findActionBtn.innerHTML = '<i class="fas fa-search"></i> Find';
                findActionBtn.classList.remove('loader');
                findActionBtn.disabled = false;
                findResultArea.innerHTML = "";
            }
        });
    });

    async function searchByUsername(query) {
        if (!query.trim()) { findResultArea.innerHTML = ""; return; }
        const lowerQuery = query.toLowerCase();
        const userId = me?.uid;
        const usersSnap = await db.ref('users').once('value');
        const users = usersSnap.val() || {};
        const results = [];

        for (const uid in users) {
            if (uid === userId) continue;
            const user = users[uid];
            const username = user.username || user.email || "";
            const settings = user.settings || {};
            if (settings.findable === false) continue;
            if (username.toLowerCase().includes(lowerQuery)) {
                results.push({ uid, username, email: user.email, online: user.online || false, photoURL: user.photoURL || null });
            }
        }

        if (results.length === 0) {
            findResultArea.innerHTML = `<div class="error-message"><i class="fas fa-user-slash"></i> Aucun utilisateur trouvé</div>`;
            return;
        }

        let html = `<div class="results-list">`;
        results.forEach(u => {
            const statusClass = u.online ? 'status-online' : 'status-offline';
            const statusText = u.online ? '🟢 En ligne' : '⚫ Hors ligne';
            html += `
                <div class="result-item" data-user-id="${u.uid}">
                    <div class="result-avatar" style="cursor:pointer;" data-user-id="${u.uid}">
                        ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : (u.username.charAt(0).toUpperCase())}
                    </div>
                    <div class="result-info" style="cursor:pointer;" data-user-id="${u.uid}">
                        <div class="result-name">${esc(u.username)}</div>
                        <div class="result-status"><span class="${statusClass}">${statusText}</span></div>
                    </div>
                    <button class="chat-mini-btn" data-uid="${u.uid}">Chat</button>
                </div>
            `;
        });
        html += `</div>`;
        findResultArea.innerHTML = html;

        document.querySelectorAll('#findResultArea .chat-mini-btn').forEach(btn => {
            btn.addEventListener('click', () => startOrOpenChat(btn.dataset.uid));
        });
        document.querySelectorAll('#findResultArea .result-avatar, #findResultArea .result-info').forEach(el => {
            el.addEventListener('click', () => {
                const userId = el.dataset.userId;
                if (userId) showUserInfo(userId, 'findUserView');
            });
        });
    }

    async function searchByEmail(email) {
        if (!email.trim()) {
            findResultArea.innerHTML = `<div class="error-message">Veuillez entrer un email</div>`;
            return;
        }
        const usersSnap = await db.ref('users').once('value');
        const users = usersSnap.val() || {};
        let foundUser = null;

        for (const uid in users) {
            const user = users[uid];
            if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
                const settings = user.settings || {};
                if (settings.findable === false) continue;
                foundUser = { uid, ...user };
                break;
            }
        }

        if (!foundUser) {
            findResultArea.innerHTML = `<div class="error-message"><i class="fas fa-user-slash"></i> Aucun utilisateur ne correspond à cet email</div>`;
            return;
        }

        const statusClass = foundUser.online ? 'status-online' : 'status-offline';
        const statusText = foundUser.online ? '🟢 En ligne' : '⚫ Hors ligne';
        findResultArea.innerHTML = `
            <div class="profile-card" data-user-id="${foundUser.uid}">
                <div class="profile-avatar" style="cursor:pointer;" data-user-id="${foundUser.uid}">
                    ${foundUser.photoURL ? `<img src="${foundUser.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : (foundUser.username?.charAt(0)?.toUpperCase() || '?')}
                </div>
                <div class="profile-info" style="cursor:pointer;" data-user-id="${foundUser.uid}">
                    <div class="profile-name">${esc(foundUser.username || foundUser.email)}</div>
                    <div class="profile-email">${esc(foundUser.email)}</div>
                    <div class="profile-status ${statusClass}">${statusText}</div>
                </div>
                <button class="chat-btn" data-uid="${foundUser.uid}">Chat</button>
            </div>
        `;
        const chatBtn = findResultArea.querySelector('.chat-btn');
        if (chatBtn) chatBtn.addEventListener('click', () => startOrOpenChat(chatBtn.dataset.uid));
        document.querySelectorAll('#findResultArea .profile-avatar, #findResultArea .profile-info').forEach(el => {
            el.addEventListener('click', () => {
                const userId = el.dataset.userId;
                if (userId) showUserInfo(userId, 'findUserView');
            });
        });
    }

    findSearchInput.addEventListener('input', (e) => {
        if (findCurrentMode === 'username') {
            if (findSearchTimeout) clearTimeout(findSearchTimeout);
            findSearchTimeout = setTimeout(() => searchByUsername(e.target.value), 200);
        }
    });

    findActionBtn.addEventListener('click', () => {
        if (findCurrentMode === 'email') searchByEmail(findSearchInput.value);
        else searchByUsername(findSearchInput.value);
    });
}

// ==================== ÉVÉNEMENTS ====================
document.getElementById('plusBtn')?.addEventListener('click', () => { showView('findUserView'); setTimeout(() => initFindUserView(), 50); });
document.getElementById('backFromFindBtn')?.addEventListener('click', () => showView('chatView'));
document.getElementById('settingsBtnHeader')?.addEventListener('click', () => showView('settingsView'));
document.getElementById('backFromSettingsBtn')?.addEventListener('click', () => showView('chatView'));
document.getElementById('backBtn')?.addEventListener('click', closeChat);
document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const newUsername = document.getElementById('usernameInput')?.value.trim();
    if (newUsername && me) {
        localStorage.setItem('megane_username', newUsername);
        document.getElementById('avatarInitial').innerText = newUsername.charAt(0).toUpperCase();
        db.ref(`users/${me.uid}/username`).set(newUsername);
        showBanner("Profil mis à jour !", "success");
    }
});

const avatarBtn = document.getElementById('avatarBtn');
if (avatarBtn) {
    avatarBtn.addEventListener('click', () => showAvatarSelector());
}

const volumeSlider = document.getElementById('volumeSlider');
const vibrationSlider = document.getElementById('vibrationSlider');
if (volumeSlider) volumeSlider.addEventListener('input', (e) => saveVolume(parseInt(e.target.value)));
if (vibrationSlider) vibrationSlider.addEventListener('input', (e) => saveVibration(parseInt(e.target.value)));

const logoutOverlay = document.getElementById('confirmLogoutOverlay');
document.getElementById('logoutBtn')?.addEventListener('click', () => { if (logoutOverlay) logoutOverlay.style.display = 'flex'; });
document.getElementById('confirmLogoutBtn')?.addEventListener('click', async () => { if (logoutOverlay) logoutOverlay.style.display = 'none'; await logout(); });
document.getElementById('cancelLogoutBtn')?.addEventListener('click', () => { if (logoutOverlay) logoutOverlay.style.display = 'none'; });

const deleteModal = document.getElementById('deleteModal');
document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => { if (pendingDeleteConvId) deleteConversation(pendingDeleteConvId); });
document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => { if (deleteModal) deleteModal.style.display = 'none'; pendingDeleteConvId = null; });

document.getElementById('chatSearch')?.addEventListener('input', () => renderDiscs());
document.getElementById('sendBtn')?.addEventListener('click', sendMessage);

// Événements pour l'envoi d'images
const attachImageBtn = document.getElementById('attachImageBtn');
const imageInput = document.getElementById('imageInput');
if (attachImageBtn && imageInput) {
    attachImageBtn.addEventListener('click', () => {
        imageInput.click();
    });
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 10 * 1024 * 1024) {
                showBanner("Image trop volumineuse (max 10 Mo)", "error");
                return;
            }
            sendImageMessage(file);
        }
        imageInput.value = '';
    });
}

// Événements pour l'enregistrement audio
const attachAudioBtn = document.getElementById('attachAudioBtn');
const attachAudioStopBtn = document.getElementById('attachAudioStopBtn');
if (attachAudioBtn) {
    attachAudioBtn.addEventListener('click', startRecording);
}
if (attachAudioStopBtn) {
    attachAudioStopBtn.addEventListener('click', stopRecording);
}

const footerBarElem = document.getElementById('footerBar');
if (footerBarElem) {
    footerBarElem.addEventListener('click', async () => {
        if (lastTempSenderId && currentConvId !== lastTempSenderId) {
            let targetConvId = null;
            for (const [cid, disc] of Object.entries(discsMap)) if (disc.otherId === lastTempSenderId) { targetConvId = cid; break; }
            if (targetConvId) openChat(targetConvId, lastTempSenderId);
            else startOrOpenChat(lastTempSenderId);
        }
    });
}

const msgInputField = document.getElementById('msgInput');
msgInputField?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    if (!currentConvId || !me || meSettings.disableTyping) return;
    if (typingTimer) clearTimeout(typingTimer);
    db.ref(`typing/${currentConvId}/${me.uid}`).set(true);
    typingTimer = setTimeout(() => db.ref(`typing/${currentConvId}/${me.uid}`).remove(), 2000);
});

startBarreClock();