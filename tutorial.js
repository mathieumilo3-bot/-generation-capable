// tutorial.js
//
// Les guides pas-à-pas ne doivent plus s'afficher sur les pages d'accueil.
// Le fichier reste présent pour ne pas casser les anciens appels à GCTuto
// éventuellement encore présents dans le code : ils deviennent simplement
// des no-op.
(function (global) {
  'use strict';

  global.GCTuto = {
    start: function () {},
    startIfFirstVisit: function () {},
    hasSeen: function () { return true; },
    reset: function () {},
    close: function () {}
  };

  // Une vidéo déjà validée reste consultable à volonté.
  // L'ancien openVideo() refusait explicitement l'ouverture quand v.done=true.
  // On neutralise uniquement ce verrou au moment de l'ouverture, puis on
  // restaure immédiatement l'état "vu" afin de ne rien casser dans la
  // progression du module.
  function enableVideoReplay() {
    if (typeof global.openVideo !== 'function') return false;
    if (global.openVideo.__gcReplayPatched) return true;

    var originalOpenVideo = global.openVideo;

    function openVideoReplay(modNum, vidIdx) {
      try {
        var moduleData = MODULES && MODULES[modNum];
        var video = moduleData && moduleData.videos && moduleData.videos[vidIdx];

        if (video && video.done) {
          var wasDone = video.done;
          video.done = false;
          try {
            return originalOpenVideo.call(this, modNum, vidIdx);
          } finally {
            video.done = wasDone;
          }
        }
      } catch (e) {
        console.warn('[GC video replay] fallback:', e);
      }

      return originalOpenVideo.call(this, modNum, vidIdx);
    }

    openVideoReplay.__gcReplayPatched = true;
    global.openVideo = openVideoReplay;
    return true;
  }

  // tutorial.js est chargé en defer, après le gros script inline de l'académie.
  // Le délai 0 garantit que la fonction est bien disponible même si le chargement
  // de la page évolue à nouveau.
  if (!enableVideoReplay()) {
    global.setTimeout(enableVideoReplay, 0);
  }
})(window);
