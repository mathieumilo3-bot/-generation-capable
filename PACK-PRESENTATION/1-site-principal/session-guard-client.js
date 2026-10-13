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

  // Fréquence de vérification.
  //
  // Était à 90 secondes, ce qui représentait 40 appels de fonction par heure
  // et par onglet ouvert. Un onglet laissé ouvert toute une journée coûtait à
  // lui seul plusieurs centaines d'appels, pour un événement — un compte
  // utilisé ailleurs — qui survient au mieux quelques fois par mois.
  //
  // 10 minutes suffisent largement : le partage de compte reste détecté, et
  // la vérification au retour sur l'onglet (visibilitychange) couvre le cas
  // qui compte vraiment — quelqu'un qui reprend sa session après que le
  // compte a été utilisé ailleurs.
  var CHECK_INTERVAL_MS = 600000; // 10 minutes

  // Anti-rafale sur le retour d'onglet : basculer entre applications sur
  // mobile déclenche visibilitychange en continu. Sans ce garde-fou, un
  // utilisateur qui jongle entre deux apps générait un appel par bascule.
  var MIN_CHECK_GAP_MS = 120000; // 2 minutes
  var lastCheckAt = 0;

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

  async function checkOnce(force) {
    // Ignore les appels rapprochés (bascules d'application sur mobile), sauf
    // demande explicite au démarrage.
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
    if (document.visibilityState === 'visible') checkOnce(false);
  }

  function init(opts) {
    config = opts || {};
    checkOnce(true);   // premier contrôle immédiat, sans anti-rafale
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
