/* sabine.js — interactions de la maquette. Volontairement minimal :
   un menu mobile, une apparition au scroll, et le marquage du lien actif.
   Aucune dépendance, aucun framework : la page doit rester instantanée
   sur un téléphone en 4G, puisque le trafic vient d'Instagram. */
(function () {
  'use strict';

  /* ---- Menu mobile ---- */
  var burger = document.querySelector('[data-burger]');
  var menu = document.querySelector('[data-menu]');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var ouvert = menu.getAttribute('data-ouvert') === 'true';
      menu.setAttribute('data-ouvert', ouvert ? 'false' : 'true');
      burger.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.setAttribute('data-ouvert', 'false');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- Lien de navigation actif ---- */
  var ici = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a, .menu-mobile a').forEach(function (a) {
    var href = (a.getAttribute('href') || '').split('/').pop();
    if (href && href === ici) a.setAttribute('aria-current', 'page');
  });

  /* ---- Apparition au scroll ---- */
  var cibles = document.querySelectorAll('.reveal');
  if (!cibles.length) return;
  if (!('IntersectionObserver' in window)) {
    cibles.forEach(function (n) { n.classList.add('vu'); });
    return;
  }
  var obs = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('vu'); obs.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  cibles.forEach(function (n) { obs.observe(n); });
})();
