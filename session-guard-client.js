// session-guard-client.js
//
// Côté navigateur de la limitation "un seul appareil à la fois"
// (voir netlify/functions/session-guard.js et migration 0022).
//
// Le serveur reste l'autorité : à chaque ouverture avec une session valide,
// l'appareil courant reprend explicitement la place. Cela évite le faux positif
// qui survenait après une reconnexion, notamment lorsque le navigateur mobile
// recréait son identifiant local (navigation privée / stockage purgé).

(function (global) {
  'use strict';

  var DEVICE_KEY = 'gc_device_id';

  var CHECK_INTERVAL_MS = 600000; // 10 minutes
  var MIN_CHECK_GAP_MS = 120000; // 2 minutes
  var lastCheckAt = 0;

  var timer = null;
  var config = null; // { getSession, onDisplaced }

  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (id && /^[a-zA-Z0-9-]{8,64}$/.test(id)) return id;

    id = (global.crypto && global.crypto.randomUUID)
      ? global.crypto.randomUUID()
      : 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);

    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    return id;
  }

  async function call(action) {
    if (!config || typeof config.getSession !== 'function') return null;
    var session = await config.getSession();
    if (!session || !session.access_token) return null;

    try {
      var resp = await fetch('/.netlify/functions/session-guard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ action: action, device_id: deviceId() })
      });
      return await resp.json();
    } catch (e) {
      // Hors ligne ou fonction indisponible : ne jamais déconnecter sur une
      // simple panne réseau.
      console.error('[session-guard] appel impossible', e);
      return null;
    }
  }

  async function claim() {
    await call('claim');
    start();
  }

  async function checkOnce(force) {
    var now = Date.now();
    if (!force && now - lastCheckAt < MIN_CHECK_GAP_MS) return;
    lastCheckAt = now;

    var res = await call('check');
    if (res && res.displaced === true) {
      stop();
      if (typeof config.onDisplaced === 'function') config.onDisplaced();
    }
  }

  function start() {
    stop();
    timer = setInterval(checkOnce, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener('visibilitychange', onVisible);
  }

  function onVisible() {
    if (document.visibilityState === 'visible') checkOnce(false);
  }

  async function init(opts) {
    config = opts || {};
    // IMPORTANT : une session déjà valide qui recharge la page doit devenir
    // l'appareil de référence. Avant ce correctif, init() faisait seulement
    // un "check" et pouvait donc rejeter à tort le propriétaire après une
    // reconnexion avec un nouvel identifiant local.
    await claim();
  }

  global.GCSessionGuard = {
    init: init,
    claim: claim,
    check: checkOnce,
    stop: stop,
    deviceId: deviceId
  };
})(window);
