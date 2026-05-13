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
let isPaused = false;
let audioRecordBlob = null;
let mediaStream = null;

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
function saveDiscsToCache() { localStorage.setItem('megane_discsMap', JSON.stringify(discsMap)); }
function saveUsersToCache() { localStorage.setItem('megane_allUsers', JSON.stringify(allUsers)); }

function loadCache() {
    const savedDiscs = localStorage.getItem('megane_discsMap');
    if (savedDiscs) { discsMap = JSON.parse(savedDiscs); renderDiscs(); }
    const savedUsers = localStorage.getItem('megane_allUsers');
    if (savedUsers) { allUsers = JSON.parse(savedUsers); }
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
    } catch (err) { console.error("Erreur chargement profil:", err); }
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

function saveVolume(value) { volumePercent = value; localStorage.setItem('volumePercent', value); const el = document.getElementById('volumeValue'); if (el) el.textContent = value + '%'; }
function saveVibration(value) { vibrationPercent = value; localStorage.setItem('vibrationPercent', value); const el = document.getElementById('vibrationValue'); if (el) el.textContent = value + '%'; }

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
    } catch(e) {}
}

function vibrate() { if (vibrationPercent > 0 && navigator.vibrate) navigator.vibrate(Math.floor(200 * (vibrationPercent / 100))); }

function getCurrentTime() { return new Date().toLocaleTimeString('fr-FR', { hour12: false }); }

let barreClockInterval = null;
function startBarreClock() {
    if (barreClockInterval) clearInterval(barreClockInterval);
    const update = () => {
        const clockElement = document.getElementById('footerClock');
        const footerBar = document.getElementById('footerBar');
        if (clockElement && footerBar && !footerBar.classList.contains('temp-mode')) clockElement.textContent = getCurrentTime();
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
    if (badgeEl) { badgeEl.style.display = total === 0 ? 'none' : 'flex'; badgeEl.textContent = total; }
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
                if (isFirstMessage) { isFirstMessage = false; return; }
                const msg = msgSnap.val();
                if (!msg || msg.senderId === me.uid || document.hidden || currentConvId === convId) return;
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
    setTimeout(() => { banner.style.display = 'none'; }, 3000);
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

// ==================== UPLOAD FICHIERS ====================
async function uploadFile(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("https://0x0.st", { method: "POST", body: fd });
    const url = (await res.text()).trim();
    if (!url.startsWith("https://")) throw new Error("Upload échoué");
    return url;
}

// ==================== GESTION AVATAR ====================
async function updateAvatar(file) {
    if (!me) return;
    try {
        showBanner("📤 Upload de la photo...", "progress");
        const photoURL = await uploadFile(file);
        await db.ref(`users/${me.uid}/photoURL`).set(photoURL);
        me.photoURL = photoURL;
        localStorage.setItem('megane_photoURL', photoURL);
        const avatarBtn = document.getElementById('avatarBtn');
        if (avatarBtn) avatarBtn.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        renderDiscs();
        showBanner("✅ Photo mise à jour !", "success");
    } catch (err) { showBanner("❌ Erreur upload", "error"); }
}

function showAvatarSelector() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 350px;">
            <h3 style="margin-bottom: 16px;">Photo de profil</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
                ${predefinedAvatars.map(av => `<div class="avatar-option" data-avatar-emoji="${av.emoji}" data-avatar-color="${av.color}" style="cursor: pointer; text-align: center; padding: 10px; border-radius: 50%; background: ${av.color}; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; font-size: 30px;">${av.emoji}</div>`).join('')}
            </div>
            <button id="avatarUploadBtn" class="btn-primary" style="width: 100%; margin-bottom: 8px;"><i class="fas fa-camera"></i> Prendre une photo</button>
            <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
            <button id="avatarCancelBtn" class="btn-secondary" style="width: 100%;">Annuler</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const emoji = opt.dataset.avatarEmoji;
            const color = opt.dataset.avatarColor;
            const avatarUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='${color.replace('#', '%23')}'/%3E%3Ctext x='50' y='67' text-anchor='middle' fill='white' font-size='50'%3E${emoji}%3C/text%3E%3C/svg%3E`;
            updateAvatarFromUrl(avatarUrl);
            modal.remove();
        });
    });
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => document.getElementById('avatarFileInput').click());
    document.getElementById('avatarFileInput')?.addEventListener('change', (e) => { if (e.target.files[0]) { updateAvatar(e.target.files[0]); modal.remove(); } });
    document.getElementById('avatarCancelBtn')?.addEventListener('click', () => modal.remove());
}

async function updateAvatarFromUrl(avatarUrl) {
    if (!me) return;
    await db.ref(`users/${me.uid}/photoURL`).set(avatarUrl);
    me.photoURL = avatarUrl;
    localStorage.setItem('megane_photoURL', avatarUrl);
    const avatarBtn = document.getElementById('avatarBtn');
    if (avatarBtn) avatarBtn.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    renderDiscs();
    showBanner("✅ Avatar mis à jour !", "success");
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
    if (avatarEl) avatarEl.innerHTML = photoURL ? `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : `<span>${initial(name)}</span>`;
    const nameEl = document.getElementById('userInfoName');
    if (nameEl) nameEl.textContent = name;
    const emailEl = document.getElementById('userInfoEmail');
    if (emailEl) emailEl.textContent = email;
    const statusEl = document.getElementById('userInfoStatus');
    if (statusEl) { statusEl.textContent = online ? "🟢 En ligne" : "⚫ Hors ligne"; statusEl.className = online ? "userinfo-status online" : "userinfo-status offline"; }
    showView('userInfoView');
}

function initUserInfoView() {
    document.getElementById('backFromUserInfoBtn').onclick = () => showView(previousViewId || 'chatView');
    document.getElementById('userInfoChatBtn').onclick = () => { if (currentInfoUserId) startOrOpenChat(currentInfoUserId); };
}

// ==================== RÉPONDRE PAR GLISSEMENT ====================
function getCleanMessageText(element) {
    const replyNew = element.querySelector('.reply-new-message');
    if (replyNew) return replyNew.textContent.trim();
    const img = element.querySelector('.msg-image img, .bubble img');
    if (img) return '';
    const audio = element.querySelector('.bubble audio');
    if (audio) return '';
    const bubble = element.querySelector('.bubble');
    if (bubble) return bubble.textContent.trim() || '';
    return element.textContent.trim();
}

function getReplyMediaData(element) {
    const img = element.querySelector('.msg-image img, .bubble img');
    if (img) return { type: 'image', url: img.src };
    const audio = element.querySelector('.bubble audio');
    if (audio) return { type: 'audio', url: audio.src };
    return null;
}

function showReplyQuote(data) {
    let quoteBar = document.getElementById('replyQuoteBar');
    const inputArea = document.querySelector('.input-area');

    if (!quoteBar) {
        quoteBar = document.createElement('div');
        quoteBar.id = 'replyQuoteBar';
        quoteBar.className = 'reply-quote-bar';
        inputArea.parentNode.insertBefore(quoteBar, inputArea);
    }

    let previewHtml = '';
    if (data.type === 'image') {
        previewHtml = `<img src="${data.url}" style="max-width:60px; max-height:60px; border-radius:8px; object-fit:cover;">`;
    } else if (data.type === 'audio') {
        previewHtml = `<i class="fas fa-microphone" style="color:#f87171; font-size:1.2rem;"></i> Message vocal`;
    }
    const displayText = data.type === 'text' ? esc(data.text) : previewHtml;

    quoteBar.innerHTML = `
        <div class="reply-quote-content">
            <span class="reply-quote-message">${displayText}</span>
        </div>
        <button class="reply-quote-close">✕</button>
    `;
    quoteBar.style.display = 'flex';
    quoteBar.querySelector('.reply-quote-close').addEventListener('click', () => {
        replyToMessageData = null;
        quoteBar.style.display = 'none';
        quoteBar.innerHTML = '';
    });
}

function initSwipeToReply() {
    let touchStartX = null;
    let touchStartY = null;
    let currentSwipeMsgElement = null;
    const msgsArea = document.getElementById('msgsArea');
    if (!msgsArea) return;

    msgsArea.addEventListener('touchstart', (e) => {
        const target = e.target.closest('.msg-row');
        if (!target || target.classList.contains('sent')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        currentSwipeMsgElement = target;
    });

    msgsArea.addEventListener('touchmove', (e) => {
        if (!touchStartX || !currentSwipeMsgElement) return;
        const diffX = e.touches[0].clientX - touchStartX;
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
        const diffX = e.changedTouches[0].clientX - touchStartX;
        if (diffX > 80) {
            const mediaData = getReplyMediaData(currentSwipeMsgElement);
            const cleanText = getCleanMessageText(currentSwipeMsgElement);
            if (mediaData) {
                replyToMessageData = { type: mediaData.type, url: mediaData.url, text: cleanText };
                showReplyQuote({ type: mediaData.type, url: mediaData.url });
            } else if (cleanText) {
                replyToMessageData = { type: 'text', text: cleanText };
                showReplyQuote({ type: 'text', text: cleanText });
            }
        }
        currentSwipeMsgElement.style.transform = '';
        currentSwipeMsgElement.style.opacity = '';
        touchStartX = null;
        currentSwipeMsgElement = null;
    });
}

// ==================== ENVOI DE MESSAGE TEXTE ====================
async function sendMessage() {
    const input = document.getElementById('msgInput');
    let text = input.value?.trim();
    if (!text && !replyToMessageData) return;
    if (!currentConvId) return;

    let msgText = text || '';
    let msgImageUrl = null;
    let msgAudioUrl = null;

    if (replyToMessageData) {
        if (replyToMessageData.type === 'image') {
            msgImageUrl = replyToMessageData.url;
            msgText = `[Rép: "📷 Photo"] ${msgText || "(suite)"}`;
        } else if (replyToMessageData.type === 'audio') {
            msgAudioUrl = replyToMessageData.url;
            msgText = `[Rép: "🎤 Message vocal"] ${msgText || "(suite)"}`;
        } else {
            const quoted = replyToMessageData.text.replace(/"/g, '\\"');
            msgText = `[Rép: "${quoted}"] ${msgText || "(suite)"}`;
        }
        replyToMessageData = null;
        const quoteBar = document.getElementById('replyQuoteBar');
        if (quoteBar) { quoteBar.style.display = 'none'; quoteBar.innerHTML = ''; }
    }

    input.value = '';
    input.style.height = 'auto';
    if (typingTimer) clearTimeout(typingTimer);
    if (!meSettings.disableTyping && currentConvId) db.ref(`typing/${currentConvId}/${me.uid}`).remove();

    const tempMsg = {
        senderId: me.uid,
        text: msgText,
        imageUrl: msgImageUrl || null,
        audioUrl: msgAudioUrl || null,
        timestamp: Date.now(),
        pending: true
    };

    appendMessageToDOM(tempMsg);
    saveMessageToCache(currentConvId, tempMsg);

    try {
        const newMsgRef = await db.ref(`messages/${currentConvId}`).push({
            senderId: me.uid,
            text: msgText,
            imageUrl: msgImageUrl || null,
            audioUrl: msgAudioUrl || null,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        const newMsgSnap = await newMsgRef.once('value');
        const newMsg = newMsgSnap.val();
        updateMessageInCache(currentConvId, tempMsg.timestamp, { id: newMsgRef.key, timestamp: newMsg.timestamp, pending: false });

        await db.ref(`conversations/${currentConvId}`).update({ lastMessage: msgText, lastMessageTime: newMsg.timestamp });
        if (discsMap[currentConvId]) {
            discsMap[currentConvId].lastMsg = msgText;
            discsMap[currentConvId].lastTime = newMsg.timestamp;
            discsMap[currentConvId].lastMsgSender = me.uid;
            discsMap[currentConvId].lastSentRead = false;
            renderDiscs();
            saveDiscsToCache();
        }
        const snap = await db.ref(`conversations/${currentConvId}/lastRead/${currentOtherUid}`).once('value');
        if ((snap.val() || 0) < Date.now() - 5000) sendPush(currentOtherUid, msgText);
    } catch (e) {
        console.error(e);
        markMessageError(currentConvId, tempMsg.timestamp);
    }
}

// ==================== ENVOI D'IMAGES ====================
async function sendImageMessage(file) {
    const convId = currentConvId;
    if (!convId || !me) return;

    showBanner("📤 Upload de l'image...", "info");

    try {
        const imageUrl = await uploadFile(file);

        await db.ref(`messages/${convId}`).push({
            senderId: me.uid,
            text: "📷 Photo",
            imageUrl: imageUrl,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        await db.ref(`conversations/${convId}`).update({
            lastMessage: "📷 Photo",
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP
        });

        showBanner("✅ Image envoyée !", "success");

    } catch (error) {
        console.error("❌ Erreur upload:", error);
        showBanner("❌ Erreur: " + error.message, "error");
    }
}
// ==================== ENREGISTREMENT AUDIO ====================
async function startRecordingFlow() {
    if (isRecording) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { showBanner("Enregistrement non supporté", "error"); return; }
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startNewChunk();
        updateRecordingUI('recording');
        showBanner("Enregistrement...", "info");
    } catch (e) { showBanner("Accès micro refusé", "error"); }
}

function startNewChunk() {
    if (!mediaStream) return;
    let mimeType = '';
    ['audio/webm', 'audio/mp4', 'audio/ogg'].forEach(t => { if (MediaRecorder.isTypeSupported(t) && !mimeType) mimeType = t; });
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : {});
    const chunkContainer = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunkContainer.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunkContainer, { type: mimeType || 'audio/webm' });
        audioChunks = [...audioChunks, blob];
    };
    mediaRecorder.start(1000);
    isRecording = true;
    recordingStartTime = recordingStartTime || Date.now();
    startRecordingTimer();
}

function stopRecordingChunk() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        stopRecordingTimer();
    }
}

function pauseRecording() {
    stopRecordingChunk();
    audioRecordBlob = new Blob(audioChunks, { type: 'audio/webm' });
    isPaused = true;
    updateRecordingUI('paused');
}

function resumeRecording() {
    if (!isPaused) return;
    isPaused = false;
    startNewChunk();
    updateRecordingUI('recording');
}

function cancelRecording() {
    stopRecordingChunk();
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    audioChunks = [];
    audioRecordBlob = null;
    isRecording = false;
    isPaused = false;
    recordingStartTime = 0;
    stopRecordingTimer();
    updateRecordingUI('idle');
}

function playPreview() {
    if (!audioRecordBlob) return;
    const url = URL.createObjectURL(audioRecordBlob);
    const a = new Audio(url);
    a.play();
}

async function sendAudioFromRecording() {
    if (!audioRecordBlob && audioChunks.length === 0) return;
    stopRecordingChunk();
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    
    const finalBlob = audioRecordBlob || new Blob(audioChunks, { type: 'audio/webm' });
    const convId = currentConvId;
    if (!convId || !me) { updateRecordingUI('idle'); return; }

    const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
    
    updateRecordingUI('idle');
    audioChunks = [];
    audioRecordBlob = null;
    isPaused = false;
    recordingStartTime = 0;

    showBanner("📤 Upload du message vocal...", "info");

    try {
        const file = new File([finalBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        const audioUrl = await uploadFile(file);

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
function updateRecordingUI(state) {
    const audioBtn = document.getElementById('attachAudioBtn');
    const stopBtn = document.getElementById('attachAudioStopBtn');
    const sendBtn = document.getElementById('sendBtn');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingTimer = document.getElementById('recordingTimer');
    const previewBtns = document.getElementById('recordingPreviewBtns');
    const inputArea = document.querySelector('.input-area');

    // Créer les boutons de preview si pas encore là
    if (!previewBtns && state === 'paused') {
        const div = document.createElement('div');
        div.id = 'recordingPreviewBtns';
        div.style.cssText = 'display:flex; gap:6px; align-items:center;';
        div.innerHTML = `
            <button id="attachAudioCancelBtn" class="attach-btn" style="color:#f87171; border-color:#f87171;"><i class="fas fa-trash"></i></button>
            <button id="attachAudioPlayBtn" class="attach-btn" style="color:#5eead4; border-color:#5eead4;"><i class="fas fa-play"></i></button>
            <button id="attachAudioResumeBtn" class="attach-btn" style="color:#f59e0b; border-color:#f59e0b;"><i class="fas fa-microphone"></i></button>
        `;
        inputArea.insertBefore(div, sendBtn);
        document.getElementById('attachAudioCancelBtn').addEventListener('click', cancelRecording);
        document.getElementById('attachAudioPlayBtn').addEventListener('click', playPreview);
        document.getElementById('attachAudioResumeBtn').addEventListener('click', resumeRecording);
    }

    if (state === 'recording') {
        if (audioBtn) audioBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'flex';
        if (sendBtn) sendBtn.style.display = 'none';
        if (recordingIndicator) recordingIndicator.style.display = 'flex';
        if (previewBtns) previewBtns.style.display = 'none';
        if (recordingTimer) recordingTimer.textContent = '0:00';
    } else if (state === 'paused') {
        if (stopBtn) stopBtn.style.display = 'none';
        if (sendBtn) sendBtn.style.display = 'flex';
        if (recordingIndicator) recordingIndicator.style.display = 'flex';
        if (previewBtns) previewBtns.style.display = 'flex';
    } else {
        if (audioBtn) audioBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'none';
        if (sendBtn) sendBtn.style.display = 'flex';
        if (recordingIndicator) recordingIndicator.style.display = 'none';
        if (previewBtns) { previewBtns.remove(); }
    }
}

function startRecordingTimer() {
    const timer = document.getElementById('recordingTimer');
    if (!timer) return;
    recordingTimerInterval = setInterval(() => {
        if (!isRecording && !isPaused) return;
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        timer.textContent = `${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}`;
    }, 1000);
}

function stopRecordingTimer() {
    if (recordingTimerInterval) { clearInterval(recordingTimerInterval); recordingTimerInterval = null; }
}

// ==================== GESTION CACHE MESSAGES ====================
function saveMessageToCache(convId, msg) {
    const cached = JSON.parse(localStorage.getItem(`megane_messages_${convId}`) || '[]');
    cached.push(msg);
    localStorage.setItem(`megane_messages_${convId}`, JSON.stringify(cached));
}

function updateMessageInCache(convId, timestamp, updates) {
    const cached = JSON.parse(localStorage.getItem(`megane_messages_${convId}`) || '[]');
    const idx = cached.findIndex(m => m.timestamp === timestamp);
    if (idx !== -1) {
        Object.assign(cached[idx], updates);
        localStorage.setItem(`megane_messages_${convId}`, JSON.stringify(cached));
    }
}

function markMessageError(convId, timestamp) {
    updateMessageInCache(convId, timestamp, { error: true, pending: false });
    if (currentConvId === convId) {
        const container = document.getElementById('msgsArea');
        if (container) {
            const rows = container.querySelectorAll('.msg-row');
            rows.forEach(row => {
                const timeEl = row.querySelector('.msg-time');
                if (timeEl && parseInt(timeEl.getAttribute('data-timestamp')) === timestamp) {
                    row.style.opacity = '0.6';
                    let errEl = row.querySelector('.msg-error');
                    if (!errEl) {
                        errEl = document.createElement('div');
                        errEl.className = 'msg-error';
                        errEl.style.cssText = 'font-size:0.55rem; color:#f87171; text-align:right;';
                        errEl.textContent = '❌';
                        row.appendChild(errEl);
                    }
                }
            });
        }
    }
}

function appendMessageToDOM(msg) {
    const container = document.getElementById('msgsArea');
    if (!container || currentConvId === null) return;
    const temp = document.createElement('div');
    displayMessagesList([msg], temp, true);
    const row = temp.firstChild;
    if (row) container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

// ==================== NOTIFICATIONS PUSH ====================
async function sendPush(targetUid, messageText) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    try {
        const senderName = me.displayName || (me.email ? me.email.split('@')[0] : 'Utilisateur');
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: senderName,
            body: messageText.length > 200 ? messageText.slice(0, 200) + '…' : messageText,
            icon: '/assets/logo.png',
            badge: '/assets/badge.png',
            data: { userId: targetUid, senderName, messageText }
        });
    } catch (e) {}
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
        setTimeout(() => { if (typeof startOrOpenChat === 'function') startOrOpenChat(directUserId); }, 50);
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
    db.ref('users').on('value', snap => { allUsers = snap.val() || {}; saveUsersToCache(); });
}

// ==================== CONVERSATIONS ====================
async function updateLastMsgStatus(convId) {
    if (!discsMap[convId]) return;
    const convSnap = await db.ref(`conversations/${convId}`).once('value');
    const c = convSnap.val();
    if (!c) return;
    const otherId = c.participants.find(id => id !== me.uid);
    const lastMsgSnap = await db.ref(`messages/${convId}`).orderByChild('timestamp').limitToLast(1).once('value');
    let lastMsg = null;
    lastMsgSnap.forEach(msg => { lastMsg = msg.val(); });
    if (!lastMsg) return;
    const lastReadOther = c.lastRead?.[otherId] || 0;
    const lastReadMe = c.lastRead?.[me.uid] || 0;
    discsMap[convId].lastMsgSender = lastMsg.senderId;
    discsMap[convId].lastSentRead = lastMsg.senderId === me.uid ? lastMsg.timestamp <= lastReadOther : false;
    discsMap[convId].lastReceivedRead = lastMsg.senderId !== me.uid ? lastMsg.timestamp <= lastReadMe : false;
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
            const lastMsgSnap = await db.ref(`messages/${convId}`).orderByChild('timestamp').limitToLast(1).once('value');
            let lastMsgObj = null;
            lastMsgSnap.forEach(msg => { lastMsgObj = msg.val(); });
            newMap[convId] = {
                convId, otherId, name: u.username || u.email || '...',
                photo: u.photoURL || null, online: u.online || false,
                lastMsg: lastMsgObj ? lastMsgObj.text : (c.lastMessage || 'Nouvelle conversation'),
                lastTime: lastMsgObj ? lastMsgObj.timestamp : (c.lastMessageTime || c.createdAt || 0),
                unread, isTyping: false,
                lastMsgSender: lastMsgObj ? lastMsgObj.senderId : null,
                lastSentRead: false, lastReceivedRead: false
            };
            if (typingListeners[convId]) typingListeners[convId]();
            const callback = db.ref(`typing/${convId}/${otherId}`).on('value', snap => {
                newMap[convId].isTyping = snap.val() || false;
                if (discsMap[convId]) { discsMap[convId].isTyping = newMap[convId].isTyping; renderDiscs(); }
            });
            typingListeners[convId] = () => db.ref(`typing/${convId}/${otherId}`).off('value', callback);
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
    if (!arr.length) { container.innerHTML = '<div class="empty"><i class="fas fa-comments"></i>Aucune discussion</div>'; return; }

    container.innerHTML = arr.map(d => {
        let borderClass = '';
        let textColorClass = '';
        const isReply = d.lastMsg && d.lastMsg.startsWith('[Rép:');

        if (d.lastMsgSender === me.uid) {
            borderClass = d.lastSentRead ? 'sent-read' : 'sent-unread';
            textColorClass = 'text-sent';
        } else {
            if (d.unread > 0) {
                textColorClass = isReply ? 'text-reply-unread' : 'text-received-unread';
            } else {
                textColorClass = 'text-read';
            }
            if (d.lastReceivedRead) borderClass = 'received-read';
        }

        let lastMsgDisplay = d.lastMsg;
        if (d.lastMsg === "🎤 Message vocal") lastMsgDisplay = '<i class="fas fa-microphone"></i> Message vocal';
        else if (d.lastMsg === "📷 Photo") lastMsgDisplay = '<i class="fas fa-image"></i> Photo';
        else if (isReply) {
            const match = d.lastMsg.match(/^\[Rép: "([^"]+)"\] (.*)/);
            lastMsgDisplay = match ? esc(match[2]) : esc(d.lastMsg);
        }

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
                <div class="disc-last ${textColorClass}">${(!meSettings.disableTyping && d.isTyping) ? '...' : lastMsgDisplay}</div>
            </div>
            <div class="disc-time">${fmtDate(d.lastTime)}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.disc-card').forEach(el => {
        const convId = el.dataset.convId, otherId = el.dataset.otherId;
        let pressTimer = null;
        const startPress = () => { pressTimer = setTimeout(() => { pendingDeleteConvId = convId; document.getElementById('deleteModal').style.display = 'flex'; }, 500); };
        const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        el.addEventListener('click', (e) => {
            if (e.target.closest('.avatar')) { e.stopPropagation(); showUserInfo(otherId, 'chatView'); return; }
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

// ==================== OUVERTURE DE DISCUSSION ====================
async function startOrOpenChat(otherId) {
    for (const [cid, d] of Object.entries(discsMap)) if (d.otherId === otherId) { openChat(cid, otherId); return; }
    const snap = await db.ref('conversations').once('value');
    const convs = snap.val() || {};
    for (const cid in convs) {
        if (convs[cid].participants?.includes(me.uid) && convs[cid].participants?.includes(otherId)) { openChat(cid, otherId); return; }
    }
    const ref = db.ref('conversations').push();
    await ref.set({ participants: [me.uid, otherId], createdAt: firebase.database.ServerValue.TIMESTAMP });
    openChat(ref.key, otherId);
}

async function openChat(convId, otherId) {
    cleanupChat();
    currentConvId = convId;
    currentOtherUid = otherId;
    if (navigator.onLine && me) await db.ref(`conversations/${convId}/lastRead/${me.uid}`).set(firebase.database.ServerValue.TIMESTAMP);

    const u = allUsers[otherId] || {};
    const name = u.username || u.email || '...';
    const av = document.getElementById('chatAvatar');
    if (av) { av.innerHTML = u.photoURL ? `<img src="${esc(u.photoURL)}">` : initial(name); av.onclick = () => showUserInfo(otherId, 'discView'); }
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
    }
    loadMessages(convId);
    showView('discView');
}

function setOnlineStatus(isOnline, otherId) {
    const metaDiv = document.querySelector('.chat-header .chat-meta');
    if (metaDiv) metaDiv.classList.toggle('online', isOnline && !meSettings.hidePresence);
    if (meSettings.disableReadReceipt) { document.getElementById('onlineStatus').innerText = ''; return; }
    const otherSettings = allUsers[otherId]?.settings || {};
    if (otherSettings.hidePresence) { document.getElementById('onlineStatus').innerText = ''; return; }
    const el = document.getElementById('onlineStatus');
    if (el) el.innerHTML = isOnline ? '<span style="color:#34d399; font-weight:bold;">En ligne</span>' : '<span style="color:#f87171; font-weight:bold;">Hors ligne</span>';
}

function startTypingListener(convId, otherId) {
    if (typingRef) typingRef.off();
    typingRef = db.ref(`typing/${convId}/${otherId}`);
    typingRef.on('value', snap => {
        if (meSettings.disableTyping) return;
        const isTyping = snap.val();
        const indicator = document.getElementById('typingIndicator');
        const onlineStatus = document.getElementById('onlineStatus');
        if (isTyping) {
            if (indicator && !indicator._interval) {
                indicator.textContent = 'Écrit...';
                indicator.style.color = '#3b8bff';
                indicator.style.fontWeight = 'bold';
                let visible = true;
                indicator._interval = setInterval(() => { visible = !visible; indicator.style.opacity = visible ? '1' : '0.4'; }, 500);
            }
            if (onlineStatus) onlineStatus.style.display = 'none';
        } else {
            if (indicator && indicator._interval) { clearInterval(indicator._interval); indicator._interval = null; }
            if (indicator) { indicator.textContent = ''; indicator.style.opacity = '1'; }
            if (onlineStatus) onlineStatus.style.display = 'inline';
        }
    });
}

async function updateReadStatusOnly(convId) {
    if (meSettings.disableReadReceipt || !currentOtherUid) return;
    const snap = await db.ref(`conversations/${convId}/lastRead/${currentOtherUid}`).once('value');
    const otherLastRead = snap.val() || 0;
    document.querySelectorAll('.msg-row.sent').forEach(row => {
        const footer = row.querySelector('.message-footer');
        if (!footer) return;
        let statusSpan = footer.querySelector('.read-status');
        const timeEl = footer.querySelector('.msg-time');
        if (!timeEl) return;
        const msgTime = parseInt(timeEl.getAttribute('data-timestamp') || '0');
        if (!statusSpan) { statusSpan = document.createElement('span'); statusSpan.className = 'read-status'; footer.appendChild(statusSpan); }
        statusSpan.textContent = msgTime <= otherLastRead ? '✔️✔️' : '✔️';
        statusSpan.className = msgTime <= otherLastRead ? 'read-status read' : 'read-status delivered';
    });
}

// ==================== CHARGEMENT DES MESSAGES ====================
function loadMessages(convId) {
    if (msgsRef) { msgsRef.off(); msgsRef = null; }
    const container = document.getElementById('msgsArea');
    if (!container) return;

    const cached = JSON.parse(localStorage.getItem(`megane_messages_${convId}`) || '[]');
    if (cached.length) {
        displayMessagesList(cached, container, true);
        initSwipeToReply();
    } else {
        container.innerHTML = '<div class="empty"><i class="fas fa-comment-dots"></i>Commencez la conversation !</div>';
    }

    if (!navigator.onLine) return;

    msgsRef = db.ref(`messages/${convId}`).orderByChild('timestamp');
    msgsRef.on('value', async snap => {
        const data = snap.val();
        if (!data) { container.innerHTML = '<div class="empty"><i class="fas fa-comment-dots"></i>Commencez la conversation !</div>'; return; }
        if (currentConvId === convId && me) await db.ref(`conversations/${convId}/lastRead/${me.uid}`).set(firebase.database.ServerValue.TIMESTAMP);

        let msgs = Object.entries(data).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        localStorage.setItem(`megane_messages_${convId}`, JSON.stringify(msgs));
        displayMessagesList(msgs, container, true);
        initSwipeToReply();
        if (currentConvId === convId && discsMap[convId]?.unread) { discsMap[convId].unread = 0; updateFooterTotalBadge(); renderDiscs(); }
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
        if (ds !== lastDate) { html += `<div class="date-sep">${ds}</div>`; lastDate = ds; }

        let statusHtml = '';
        if (canShowReceipt && isMe) {
            const cachedLastRead = localStorage.getItem(`megane_lastread_${currentConvId}_${currentOtherUid}`);
            const otherLastRead = cachedLastRead ? parseInt(cachedLastRead) : 0;
            statusHtml = m.timestamp <= otherLastRead
                ? '<span class="read-status read">✔️✔️</span>'
                : '<span class="read-status delivered">✔️</span>';
        }

        let errorHtml = m.error ? '<div style="font-size:0.55rem; color:#f87171; text-align:right;">❌</div>' : '';
        let pendingHtml = m.pending ? '<div style="font-size:0.55rem; color:#f59e0b; text-align:right;">⏳</div>' : '';

        let imageHtml = '';
        if (m.imageUrl) {
            const src = m.pending ? (localStorage.getItem(`megane_local_${m.timestamp}`) || m.imageUrl) : m.imageUrl;
            imageHtml = `<img src="${src}" onclick="window.showFullImage('${src}')" style="max-width:200px; max-height:200px; border-radius:12px; margin-bottom:4px; cursor:pointer; display:block;">`;
        }

        let audioHtml = '';
        if (m.audioUrl) {
            const src = m.pending ? (localStorage.getItem(`megane_local_${m.timestamp}`) || m.audioUrl) : m.audioUrl;
            audioHtml = `<audio controls src="${src}" style="max-width:200px; margin-bottom:4px;"></audio>`;
        }

        const replyMatch = m.text ? m.text.match(/^\[Rép: "([^"]+)"\] (.*)/) : null;

        if (replyMatch) {
            html += `
                <div class="msg-row ${isMe ? 'sent' : 'recv'}">
                    <div class="reply-bubble">
                        <div class="reply-quoted-text">${esc(replyMatch[1])}</div>
                        ${imageHtml}
                        ${audioHtml}
                        <div class="reply-new-message">${esc(replyMatch[2] || '')}</div>
                    </div>
                    <div class="message-footer">
                        <div class="msg-time" data-timestamp="${m.timestamp || 0}">${fmtTime(m.timestamp)}</div>
                        ${statusHtml}
                    </div>
                    ${errorHtml}
                    ${pendingHtml}
                </div>
            `;
        } else if (m.imageUrl || m.audioUrl) {
            html += `
                <div class="msg-row ${isMe ? 'sent' : 'recv'}">
                    <div class="bubble" style="padding:4px; background:${isMe ? 'var(--sent)' : 'var(--s2)'};">
                        ${imageHtml}
                        ${audioHtml}
                    </div>
                    <div class="message-footer">
                        <div class="msg-time" data-timestamp="${m.timestamp || 0}">${fmtTime(m.timestamp)}</div>
                        ${statusHtml}
                    </div>
                    ${errorHtml}
                    ${pendingHtml}
                </div>
            `;
        } else {
            html += `
                <div class="msg-row ${isMe ? 'sent' : 'recv'}">
                    <div class="bubble">${esc(m.text)}</div>
                    <div class="message-footer">
                        <div class="msg-time" data-timestamp="${m.timestamp || 0}">${fmtTime(m.timestamp)}</div>
                        ${statusHtml}
                    </div>
                    ${errorHtml}
                    ${pendingHtml}
                </div>
            `;
        }
    });

    // Si c'est un append (un seul message), ne pas vider le conteneur
    if (msgs.length === 1 && container.children.length > 0) {
        container.innerHTML += html;
    } else {
        container.innerHTML = html;
    }
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

window.openChatDirectly = (userId) => {
    if (me && me.uid) startOrOpenChat(userId);
    else setTimeout(() => { if (me && me.uid) startOrOpenChat(userId); }, 500);
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
    currentConvId = null;
    currentOtherUid = null;
    replyToMessageData = null;
    const quoteBar = document.getElementById('replyQuoteBar');
    if (quoteBar) { quoteBar.style.display = 'none'; quoteBar.innerHTML = ''; }
}

function closeChat() { cleanupChat(); showView('chatView'); }

function showView(viewId) {
    const currentActive = document.querySelector('.view.active');
    const nextView = document.getElementById(viewId);
    if (currentActive && currentActive.id === viewId) return;
    if (currentActive) { currentActive.classList.add('exit'); setTimeout(() => { currentActive.classList.remove('exit', 'active'); }, 250); }
    if (nextView) nextView.classList.add('active');
}

async function logout() {
    cleanupChat();
    if (me) await db.ref(`users/${me.uid}/online`).set(false);
    ['megane_logged_in', 'megane_uid', 'megane_discsMap', 'megane_allUsers'].forEach(k => localStorage.removeItem(k));
    await auth.signOut();
    window.location.href = 'auth.html';
}

async function deleteConversation(convId) {
    if (!convId) return;
    await db.ref(`messages/${convId}`).remove();
    await db.ref(`conversations/${convId}`).remove();
    localStorage.removeItem(`megane_messages_${convId}`);
    document.getElementById('deleteModal').style.display = 'none';
    pendingDeleteConvId = null;
    if (currentConvId === convId) closeChat();
}

// ==================== VUE FIND USER ====================
let findCurrentMode = "username";

function initFindUserView() {
    const findSearchInput = document.getElementById('findSearchInput');
    const findActionBtn = document.getElementById('findActionBtn');
    const findResultArea = document.getElementById('findResultArea');
    const modeBtns = document.querySelectorAll('#findUserView .mode-btn');
    if (!findSearchInput) return;

    modeBtns.forEach(btn => btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        findCurrentMode = btn.dataset.mode;
        findSearchInput.placeholder = findCurrentMode === 'username' ? "Nom d'utilisateur (ex: Jean)" : "Email exact (ex: jean@exemple.com)";
        findResultArea.innerHTML = "";
        findSearchInput.value = "";
    }));

    async function searchByUsername(query) {
        if (!query.trim()) { findResultArea.innerHTML = ""; return; }
        const usersSnap = await db.ref('users').once('value');
        const users = usersSnap.val() || {};
        const results = [];
        for (const uid in users) {
            if (uid === me?.uid) continue;
            const user = users[uid];
            if (user.settings?.findable === false) continue;
            if ((user.username || '').toLowerCase().includes(query.toLowerCase())) {
                results.push({ uid, username: user.username, email: user.email, online: user.online || false, photoURL: user.photoURL || null });
            }
        }
        if (!results.length) { findResultArea.innerHTML = '<div class="error-message"><i class="fas fa-user-slash"></i> Aucun utilisateur trouvé</div>'; return; }
        findResultArea.innerHTML = results.map(u => `
            <div class="result-item" data-user-id="${u.uid}">
                <div class="result-avatar" style="cursor:pointer;" data-user-id="${u.uid}">${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : u.username.charAt(0).toUpperCase()}</div>
                <div class="result-info" style="cursor:pointer;" data-user-id="${u.uid}">
                    <div class="result-name">${esc(u.username)}</div>
                    <div class="result-status"><span class="${u.online ? 'status-online' : 'status-offline'}">${u.online ? '🟢 En ligne' : '⚫ Hors ligne'}</span></div>
                </div>
                <button class="chat-mini-btn" data-uid="${u.uid}">Chat</button>
            </div>
        `).join('');
        document.querySelectorAll('#findResultArea .chat-mini-btn').forEach(b => b.addEventListener('click', () => startOrOpenChat(b.dataset.uid)));
        document.querySelectorAll('#findResultArea .result-avatar, #findResultArea .result-info').forEach(el => el.addEventListener('click', () => showUserInfo(el.dataset.userId, 'findUserView')));
    }

    async function searchByEmail(email) {
        if (!email.trim()) { findResultArea.innerHTML = '<div class="error-message">Veuillez entrer un email</div>'; return; }
        const usersSnap = await db.ref('users').once('value');
        const users = usersSnap.val() || {};
        let found = null;
        for (const uid in users) {
            if (users[uid].email?.toLowerCase() === email.toLowerCase() && users[uid].settings?.findable !== false) { found = { uid, ...users[uid] }; break; }
        }
        if (!found) { findResultArea.innerHTML = '<div class="error-message"><i class="fas fa-user-slash"></i> Aucun utilisateur trouvé</div>'; return; }
        findResultArea.innerHTML = `
            <div class="profile-card" data-user-id="${found.uid}">
                <div class="profile-avatar" style="cursor:pointer;" data-user-id="${found.uid}">${found.photoURL ? `<img src="${found.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (found.username?.charAt(0)?.toUpperCase() || '?')}</div>
                <div class="profile-info" style="cursor:pointer;" data-user-id="${found.uid}">
                    <div class="profile-name">${esc(found.username || found.email)}</div>
                    <div class="profile-email">${esc(found.email)}</div>
                    <div class="profile-status ${found.online ? 'status-online' : 'status-offline'}">${found.online ? '🟢 En ligne' : '⚫ Hors ligne'}</div>
                </div>
                <button class="chat-btn" data-uid="${found.uid}">Chat</button>
            </div>
        `;
        document.querySelector('#findResultArea .chat-btn')?.addEventListener('click', () => startOrOpenChat(found.uid));
        document.querySelectorAll('#findResultArea .profile-avatar, #findResultArea .profile-info').forEach(el => el.addEventListener('click', () => showUserInfo(el.dataset.userId, 'findUserView')));
    }

    let findTimeout;
    findSearchInput.addEventListener('input', (e) => {
        if (findCurrentMode === 'username') { clearTimeout(findTimeout); findTimeout = setTimeout(() => searchByUsername(e.target.value), 200); }
    });
    findActionBtn.addEventListener('click', () => findCurrentMode === 'email' ? searchByEmail(findSearchInput.value) : searchByUsername(findSearchInput.value));
}

// ==================== ÉVÉNEMENTS ====================
document.getElementById('plusBtn')?.addEventListener('click', () => { showView('findUserView'); setTimeout(initFindUserView, 50); });
document.getElementById('backFromFindBtn')?.addEventListener('click', () => showView('chatView'));
document.getElementById('settingsBtnHeader')?.addEventListener('click', () => showView('settingsView'));
document.getElementById('backFromSettingsBtn')?.addEventListener('click', () => showView('chatView'));
document.getElementById('backBtn')?.addEventListener('click', closeChat);

document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    const newUsername = document.getElementById('usernameInput')?.value.trim();
    if (newUsername && me) {
        localStorage.setItem('megane_username', newUsername);
        const avatarInitial = document.getElementById('avatarInitial');
        if (avatarInitial) avatarInitial.textContent = newUsername.charAt(0).toUpperCase();
        db.ref(`users/${me.uid}/username`).set(newUsername);
        showBanner("Profil mis à jour !", "success");
    }
});

document.getElementById('avatarBtn')?.addEventListener('click', showAvatarSelector);

document.getElementById('volumeSlider')?.addEventListener('input', (e) => saveVolume(parseInt(e.target.value)));
document.getElementById('vibrationSlider')?.addEventListener('input', (e) => saveVibration(parseInt(e.target.value)));

const logoutOverlay = document.getElementById('confirmLogoutOverlay');
document.getElementById('logoutBtn')?.addEventListener('click', () => { if (logoutOverlay) logoutOverlay.style.display = 'flex'; });
document.getElementById('confirmLogoutBtn')?.addEventListener('click', async () => { if (logoutOverlay) logoutOverlay.style.display = 'none'; await logout(); });
document.getElementById('cancelLogoutBtn')?.addEventListener('click', () => { if (logoutOverlay) logoutOverlay.style.display = 'none'; });

const deleteModal = document.getElementById('deleteModal');
document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => { if (pendingDeleteConvId) deleteConversation(pendingDeleteConvId); });
document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => { if (deleteModal) deleteModal.style.display = 'none'; pendingDeleteConvId = null; });

document.getElementById('chatSearch')?.addEventListener('input', renderDiscs);
document.getElementById('sendBtn')?.addEventListener('click', sendMessage);

document.getElementById('attachImageBtn')?.addEventListener('click', () => document.getElementById('imageInput').click());
document.getElementById('imageInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { if (file.size > 10*1024*1024) { showBanner("Image trop volumineuse (max 10 Mo)", "error"); return; } sendImageMessage(file); }
    e.target.value = '';
});

document.getElementById('attachAudioBtn')?.addEventListener('click', startRecordingFlow);
document.getElementById('attachAudioStopBtn')?.addEventListener('click', pauseRecording);
document.getElementById('sendBtn')?.addEventListener('click', () => {
    if (isPaused || audioRecordBlob) { sendAudioFromRecording(); return; }
    sendMessage();
});

document.getElementById('footerBar')?.addEventListener('click', async () => {
    if (lastTempSenderId && currentConvId !== lastTempSenderId) {
        let targetConvId = null;
        for (const [cid, disc] of Object.entries(discsMap)) if (disc.otherId === lastTempSenderId) { targetConvId = cid; break; }
        targetConvId ? openChat(targetConvId, lastTempSenderId) : startOrOpenChat(lastTempSenderId);
    }
});

document.getElementById('msgInput')?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    if (!currentConvId || !me || meSettings.disableTyping) return;
    if (typingTimer) clearTimeout(typingTimer);
    db.ref(`typing/${currentConvId}/${me.uid}`).set(true);
    typingTimer = setTimeout(() => db.ref(`typing/${currentConvId}/${me.uid}`).remove(), 2000);
});

startBarreClock();