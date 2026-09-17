/* ===========================================================================
   Net & Care — comportements de la page (hors simulateur).
   Volontairement minimal : aucune bibliothèque, aucun effet qui retarde
   l'affichage. Tout ce qui est ici est une amélioration — la page reste
   entièrement lisible et utilisable si ce fichier ne se charge pas.
   =========================================================================== */

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* --- En-tête : ombre portée dès que la page défile --------------------- */
  var header = document.getElementById('header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-stuck', window.pageYOffset > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Menu mobile : se referme après un clic sur un lien ---------------- */
  var menu = document.querySelector('.menu');
  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) menu.removeAttribute('open');
    });
    document.addEventListener('click', function (e) {
      if (menu.hasAttribute('open') && !menu.contains(e.target)) menu.removeAttribute('open');
    });
  }

  /* --- Apparition au défilement ------------------------------------------ */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* --- Comparateurs avant / après ---------------------------------------
     Un <input type="range"> pilote le curseur : la manipulation au clavier,
     la lecture par un lecteur d'écran et le glisser tactile fonctionnent
     sans code supplémentaire.                                              */
  $$('[data-ba]').forEach(function (viewer) {
    var range = viewer.querySelector('.ba__range');
    var overlay = viewer.querySelector('.ba__overlay');
    var handle = viewer.querySelector('.ba__handle');
    if (!range || !overlay || !handle) return;

    var apply = function () {
      var v = range.value;
      overlay.style.width = v + '%';
      // L'image intérieure garde sa largeur d'origine pour que le côté
      // « avant » ne se déforme pas quand le calque rétrécit.
      overlay.style.setProperty('--ba-w', (10000 / Math.max(v, 0.001)) + '%');
      handle.style.left = v + '%';
    };
    range.addEventListener('input', apply);
    apply();
  });

  /* --- Barre d'action mobile : effacée devant le simulateur --------------
     Proposer « Obtenir mon devis » à quelqu'un qui remplit déjà le devis est
     au mieux inutile, au pire déroutant — et la barre masque une partie du
     formulaire.                                                            */
  var dock = document.querySelector('.dock');
  var sim = document.querySelector('[data-sim]');
  if (dock && sim && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { dock.classList.toggle('is-hidden', en.isIntersecting); });
    }, { threshold: 0.12 }).observe(sim);
  }

  /* --- FAQ : une seule réponse ouverte à la fois ------------------------- */
  var faqs = $$('.faq details');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqs.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });

  /* --- Mesure des intentions (GA4 / Meta via dataLayer) ------------------ */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-track]') : null;
    if (!el) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'clic_contact',
      intention: el.getAttribute('data-track'),
      page: location.pathname
    });
  });

  /* --- Année courante dans le pied de page ------------------------------ */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
