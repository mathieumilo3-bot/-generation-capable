// notifications-client.js — Widget de notifications côté navigateur.
//
// Chargé en <script defer> depuis index.html (voir la balise juste avant
// </body>). Volontairement autonome et injecté dynamiquement dans le DOM
// (pas d'édition profonde du gros fichier index.html) : un bouton flottant
// 🔔 apparaît quand l'utilisateur est connecté, ouvre une modale de
// réglages (interrupteur général, horaires, fréquence, catégories — servie
// par notification-preferences.js, qui adapte la liste des catégories au
// rôle admin/vendeur).
//
// Dépend de `window.supa` (client Supabase déjà initialisé par index.html)
// et de `toast()` (déjà défini par index.html) si disponibles ; se dégrade
// silencieusement sinon (site sans notifications configurées, ou page hors
// index.html).

(function () {
  'use strict';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function notify(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
    else console.log('[GCNotif]', msg);
  }

  async function getSession() {
    if (!window.supa) return null;
    try {
      const { data } = await window.supa.auth.getSession();
      return data && data.session ? data.session : null;
    } catch (e) {
      return null;
    }
  }

  async function apiCall(path, session, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    const resp = await fetch('/.netlify/functions/' + path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await resp.json(); } catch (e) { /* réponse non-JSON (ex: page HTML de désinscription) */ }
    return { ok: resp.ok, status: resp.status, data };
  }

  // ── Enregistrement du service worker + abonnement Push ─────────────────

  let swRegistration = null;
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    if (swRegistration) return swRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
      return swRegistration;
    } catch (e) {
      console.warn('[GCNotif] Service worker non enregistré :', e);
      return null;
    }
  }

  async function enablePush(session) {
    if (!('Notification' in window) || !('PushManager' in window)) {
      notify('❌ Les notifications ne sont pas supportées par ce navigateur.');
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      notify('🔕 Notifications refusées — tu peux les réactiver dans les réglages du navigateur.');
      return false;
    }
    const reg = await registerServiceWorker();
    if (!reg) return false;

    const keyResp = await apiCall('vapid-public-key', null, { method: 'GET' });
    const publicKey = keyResp.data && keyResp.data.publicKey;
    if (!publicKey) {
      notify('⚠️ Notifications non configurées côté serveur pour le moment.');
      return false;
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await apiCall('push-subscribe', session, {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return true;
  }

  // ── Modale de réglages ──────────────────────────────────────────────────

  const STYLE = `
    #gcnotif-bell{position:fixed;bottom:20px;right:20px;z-index:9998;width:52px;height:52px;
      border-radius:50%;background:#111;color:#fff;border:none;font-size:22px;cursor:pointer;
      box-shadow:0 4px 16px rgba(0,0,0,.3);display:none;align-items:center;justify-content:center}
    #gcnotif-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:none;
      align-items:center;justify-content:center;padding:16px}
    #gcnotif-modal{background:#181820;color:#eee;border-radius:14px;max-width:420px;width:100%;
      max-height:85vh;overflow:auto;padding:22px;font-family:system-ui,sans-serif}
    #gcnotif-modal h2{margin:0 0 14px;font-size:18px}
    #gcnotif-modal label{display:flex;align-items:center;gap:8px;margin:10px 0;font-size:14px;cursor:pointer}
    #gcnotif-modal .gcnotif-row{display:flex;gap:10px;align-items:center;margin:10px 0}
    #gcnotif-modal select,#gcnotif-modal input[type=number]{background:#222;color:#eee;
      border:1px solid #444;border-radius:6px;padding:6px 8px}
    #gcnotif-modal .gcnotif-cats{border-top:1px solid #333;margin-top:14px;padding-top:10px;
      max-height:220px;overflow:auto}
    #gcnotif-modal button.gcnotif-save{margin-top:16px;width:100%;padding:10px;border-radius:8px;
      border:none;background:#5b5bf6;color:#fff;font-weight:600;cursor:pointer}
    #gcnotif-modal button.gcnotif-close{position:absolute;top:14px;right:16px;background:none;
      border:none;color:#aaa;font-size:18px;cursor:pointer}
    #gcnotif-modal{position:relative}
  `;

  function injectStyle() {
    if (document.getElementById('gcnotif-style')) return;
    const style = document.createElement('style');
    style.id = 'gcnotif-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function buildBellButton() {
    if (document.getElementById('gcnotif-bell')) return document.getElementById('gcnotif-bell');
    const btn = document.createElement('button');
    btn.id = 'gcnotif-bell';
    btn.type = 'button';
    btn.title = 'Notifications';
    btn.textContent = '🔔';
    btn.onclick = openSettingsModal;
    document.body.appendChild(btn);
    return btn;
  }

  function buildOverlay() {
    if (document.getElementById('gcnotif-overlay')) return document.getElementById('gcnotif-overlay');
    const overlay = document.createElement('div');
    overlay.id = 'gcnotif-overlay';
    overlay.onclick = function (e) { if (e.target === overlay) closeSettingsModal(); };
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeSettingsModal() {
    const overlay = document.getElementById('gcnotif-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  async function openSettingsModal() {
    const session = await getSession();
    if (!session) { notify('Connecte-toi pour gérer tes notifications.'); return; }

    injectStyle();
    const overlay = buildOverlay();
    overlay.innerHTML = '<div id="gcnotif-modal">Chargement…</div>';
    overlay.style.display = 'flex';

    const { data } = await apiCall('notification-preferences', session, { method: 'GET' });
    if (!data || !data.preferences) {
      overlay.querySelector('#gcnotif-modal').textContent = 'Notifications indisponibles pour le moment.';
      return;
    }
    renderSettingsForm(overlay, session, data);
  }

  function renderSettingsForm(overlay, session, data) {
    const prefs = data.preferences;
    const categories = data.availableCategories || [];
    const hourOptions = Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === prefs.active_hours_start ? '' : ''}>${String(h).padStart(2, '0')}h</option>`);

    const modal = document.createElement('div');
    modal.id = 'gcnotif-modal';
    modal.innerHTML = `
      <button type="button" class="gcnotif-close" aria-label="Fermer">✕</button>
      <h2>🔔 Notifications</h2>
      <label><input type="checkbox" id="gcnotif-enabled"> Activer les notifications</label>
      <div class="gcnotif-row">
        <span>Entre</span>
        <select id="gcnotif-start">${Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}h</option>`).join('')}</select>
        <span>et</span>
        <select id="gcnotif-end">${Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}h</option>`).join('')}</select>
      </div>
      <div class="gcnotif-row">
        <span>Fréquence</span>
        <select id="gcnotif-frequency">
          <option value="normal">Normale</option>
          <option value="reduced">Réduite</option>
          <option value="minimal">Minimale (jalons uniquement)</option>
        </select>
      </div>
      <div class="gcnotif-cats">
        ${categories.map(c => `<label><input type="checkbox" class="gcnotif-cat" data-key="${c.key}"> ${c.label}</label>`).join('')}
      </div>
      <button type="button" class="gcnotif-save">Enregistrer</button>
    `;
    overlay.innerHTML = '';
    overlay.appendChild(modal);

    modal.querySelector('.gcnotif-close').onclick = closeSettingsModal;
    modal.querySelector('#gcnotif-enabled').checked = prefs.enabled !== false;
    modal.querySelector('#gcnotif-start').value = String(prefs.active_hours_start ?? 8);
    modal.querySelector('#gcnotif-end').value = String(prefs.active_hours_end ?? 20);
    modal.querySelector('#gcnotif-frequency').value = prefs.frequency || 'normal';
    modal.querySelectorAll('.gcnotif-cat').forEach(el => {
      const key = el.getAttribute('data-key');
      el.checked = !(prefs.categories && prefs.categories[key] === false);
    });

    modal.querySelector('.gcnotif-save').onclick = async function () {
      const enabled = modal.querySelector('#gcnotif-enabled').checked;
      if (enabled) {
        const granted = await enablePush(session);
        if (!granted) return; // l'utilisateur a refusé / navigateur non supporté — inutile d'enregistrer un état incohérent
      }
      const categoriesPayload = {};
      modal.querySelectorAll('.gcnotif-cat').forEach(el => {
        categoriesPayload[el.getAttribute('data-key')] = el.checked;
      });
      const payload = {
        enabled,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
        active_hours_start: Number(modal.querySelector('#gcnotif-start').value),
        active_hours_end: Number(modal.querySelector('#gcnotif-end').value),
        frequency: modal.querySelector('#gcnotif-frequency').value,
        categories: categoriesPayload,
      };
      const r = await apiCall('notification-preferences', session, { method: 'POST', body: JSON.stringify(payload) });
      if (r.ok) { notify('✅ Préférences enregistrées'); closeSettingsModal(); }
      else notify('❌ Erreur lors de l\'enregistrement');
    };
  }

  // ── Capture prospect (mission section 3) ────────────────────────────────

  async function captureLead(email, firstName, source) {
    try {
      await fetch('/.netlify/functions/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || '', first_name: firstName || '', source: source || 'signup_modal' }),
      });
    } catch (e) { /* best-effort, ne doit jamais gêner le parcours d'inscription */ }
  }

  // ── Bouton "Oui" de la notification "objectif du jour" ──────────────────

  async function handleGoalActionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gcGoal') !== 'yes') return;
    params.delete('gcGoal');
    const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    const session = await getSession();
    if (!session) return;
    await apiCall('seller-goal', session, { method: 'POST', body: JSON.stringify({}) });
    notify('🎯 Objectif du jour confirmé — bonne prospection !');
  }

  // ── Cycle de vie ─────────────────────────────────────────────────────────

  async function refreshBellVisibility() {
    const session = await getSession();
    const bell = buildBellButton();
    bell.style.display = session ? 'flex' : 'none';
  }

  function init() {
    registerServiceWorker();
    refreshBellVisibility();
    handleGoalActionFromUrl();

    if (window.supa && window.supa.auth && typeof window.supa.auth.onAuthStateChange === 'function') {
      window.supa.auth.onAuthStateChange(() => refreshBellVisibility());
    } else {
      // window.supa peut être initialisé juste après ce script — un court
      // sondage suffit, pas besoin d'une dépendance d'ordre de chargement plus
      // stricte pour un simple affichage/masquage de bouton.
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (window.supa || attempts > 20) {
          clearInterval(poll);
          refreshBellVisibility();
          if (window.supa && window.supa.auth) window.supa.auth.onAuthStateChange(() => refreshBellVisibility());
        }
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.GCNotif = { captureLead, openSettingsModal };
})();
