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
})(window);
