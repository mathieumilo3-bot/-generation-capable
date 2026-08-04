// session-guard-client.js
//
// Côté navigateur de la limitation "un seul appareil à la fois"
// (voir netlify/functions/session-guard.js et migration 0022).
//
// Partagé par l'espace vendeur et l'espace ambassadeur : deux copies de cette
// logique auraient divergé, et un compte partagé serait passé par la page la
// moins bien gardée.
//
// Ce fichier ne DÉCIDE de rien : c'est le serveur qui détient l'appareil
// autorisé. Le navigateur se contente de dire « voici qui je suis » et
// d'obéir à la réponse. Neutraliser ce script depuis la console ne donne donc
// aucun accès supplémentaire aux données — chaque appel de données reste
// vérifié séparément côté serveur.

(function (global) {
  'use strict';

  var DEVICE_KEY = 'gc_device_id';
  var CHECK_INTERVAL_MS = 90000; // 1 min 30
  var timer = null;
  var config = null; // { getSession, onDisplaced }

  // Identifiant d'appareil : aléatoire, propre au navigateur, sans aucune
  // donnée personnelle. Sert uniquement à distinguer deux navigateurs.
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
      // Hors ligne ou fonction indisponible : on ne déconnecte jamais sur un
      // problème réseau. Le pire cas est un partage qui dure quelques minutes
      // de plus ; déconnecter à tort coûterait bien plus cher.
      console.error('[session-guard] appel impossible', e);
      return null;
    }
  }

  // À appeler juste après une connexion réussie : cet appareil devient
  // l'appareil autorisé, et le précédent sera déconnecté à sa prochaine
  // vérification.
  async function claim() {
    await call('claim');
    start();
  }

  async function checkOnce() {
    var res = await call('check');
    if (res && res.displaced === true) {
      stop();
      if (typeof config.onDisplaced === 'function') config.onDisplaced();
    }
  }

  function start() {
    stop();
    timer = setInterval(checkOnce, CHECK_INTERVAL_MS);
    // Une vérification au retour sur l'onglet : c'est le moment où un compte
    // partagé se manifeste le plus souvent, et cela évite d'attendre le
    // prochain tour de minuterie.
    document.addEventListener('visibilitychange', onVisible);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener('visibilitychange', onVisible);
  }

  function onVisible() {
    if (document.visibilityState === 'visible') checkOnce();
  }

  function init(opts) {
    config = opts || {};
    checkOnce();
    start();
  }

  global.GCSessionGuard = {
    init: init,
    claim: claim,
    check: checkOnce,
    stop: stop,
    deviceId: deviceId
  };
})(window);
