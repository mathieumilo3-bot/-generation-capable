/* ============================================================================
   Tech Piscine — site vitrine (maquette de démonstration)

   Principes tenus dans tout ce fichier :
   • Aucune dépendance. Le seul tiers chargé est le widget Calendly, et il ne
     l'est qu'au moment où le visiteur approche de la section « devis ».
   • Tout est facultatif : sans JavaScript la page reste entièrement lisible,
     la galerie ouvre les photos normalement et le lien Calendly reste direct.
   • Les écritures de style pendant le scroll passent uniquement par des
     transform / opacity, jamais par des propriétés qui déclenchent un reflow.
   ========================================================================= */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- scroll
     Un seul écouteur pour toute la page, dégroupé en rAF : les lecteurs
     ci-dessous sont appelés une fois par frame au maximum. */
  var scrollTasks = [];
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      for (var i = 0; i < scrollTasks.length; i++) scrollTasks[i](y);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ------------------------------------------------- barre de progression */
  (function readingProgress() {
    var bar = $('#reading-progress-bar');
    if (!bar) return;
    scrollTasks.push(function (y) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = 'scaleX(' + ratio + ')';
    });
  })();

  /* -------------------------------------------------------- barre de nav */
  (function stickyNav() {
    var nav = $('#nav');
    if (!nav) return;
    scrollTasks.push(function (y) { nav.classList.toggle('is-scrolled', y > 24); });
  })();

  /* ------------------------------------------------- révélation au scroll
     Une fois l'élément apparu on cesse de l'observer : l'animation ne se
     rejoue jamais en remontant la page. */
  (function reveals() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------ visionneuse de photos
     Chaque vignette est un <a> vers l'image : sans JavaScript le clic
     l'ouvre normalement. Ici on intercepte pour l'afficher dans un <dialog>,
     qui fournit nativement le piégeage du focus et la fermeture par Échap. */
  (function lightbox() {
    var dialog = $('#lightbox');
    var gallery = $('#gallery');
    if (!dialog || !gallery || typeof dialog.showModal !== 'function') return;

    var tiles = $$('.tile', gallery);
    var img = $('#lightbox-img');
    var caption = $('#lightbox-caption');
    var index = 0;

    function show(i) {
      index = (i + tiles.length) % tiles.length;
      var tile = tiles[index];
      var thumb = $('img', tile);
      img.src = tile.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      caption.textContent = tile.getAttribute('data-caption') || '';
    }

    tiles.forEach(function (tile, i) {
      tile.addEventListener('click', function (e) {
        // Laisse passer les clics « ouvrir dans un nouvel onglet ».
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        show(i);
        dialog.showModal();
      });
    });

    $('#lightbox-close').addEventListener('click', function () { dialog.close(); });
    $('#lightbox-prev').addEventListener('click', function () { show(index - 1); });
    $('#lightbox-next').addEventListener('click', function () { show(index + 1); });

    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });

    // Clic en dehors de l'image : ferme la visionneuse.
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });

    // Rend le focus à la vignette d'où l'on vient.
    dialog.addEventListener('close', function () {
      if (tiles[index]) tiles[index].focus({ preventScroll: true });
    });
  })();

  /* ----------------------------------------------------- carrousel d'avis */
  (function carousel() {
    var track = $('#avis-carousel');
    if (!track) return;

    var prev = $('[data-carousel-prev]');
    var next = $('[data-carousel-next]');
    var card = $('.avis-card', track);
    if (!prev || !next || !card) return;

    function step() {
      var gap = parseFloat(getComputedStyle($('.carousel-track', track)).gap) || 20;
      return card.getBoundingClientRect().width + gap;
    }

    function go(dir) {
      track.scrollBy({ left: dir * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });

    function syncButtons() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
    }
    track.addEventListener('scroll', function () {
      requestAnimationFrame(syncButtons);
    }, { passive: true });
    window.addEventListener('resize', syncButtons, { passive: true });
    syncButtons();
  })();

  /* ------------------------------------------------------ barre CTA mobile
     Visible une fois le hero passé, masquée quand la section « devis » est
     elle-même à l'écran (le bouton ferait doublon). */
  (function mobileBar() {
    var bar = $('#mobile-bar');
    var booking = $('#devis');
    if (!bar || !booking) return;

    var bookingVisible = false;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        bookingVisible = entries[0].isIntersecting;
        update(window.pageYOffset);
      }, { threshold: 0.12 }).observe(booking);
    }

    function update(y) {
      bar.hidden = false;
      bar.classList.toggle('is-visible', y > window.innerHeight * 0.7 && !bookingVisible);
    }

    scrollTasks.push(update);
  })();

  /* ------------------------------------------------------------- Calendly
     ~100 Ko de script tiers : chargés uniquement quand la section approche,
     avec un repli explicite si le réseau ou un bloqueur les empêche. */
  (function calendly() {
    var host = $('#calendly-embed');
    var state = $('#calendly-state');
    var fallback = $('#calendly-fallback');
    if (!host) return;

    var url = host.getAttribute('data-calendly-url');
    var started = false;
    var settled = false;

    function showFallback() {
      if (settled) return;
      settled = true;
      if (state) state.hidden = true;
      if (fallback) fallback.hidden = false;
    }

    function showWidget() {
      if (settled) return;
      settled = true;
      if (state) state.hidden = true;
    }

    function loadAsset(tag, attrs) {
      return new Promise(function (resolve, reject) {
        var el = document.createElement(tag);
        Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
        el.onload = resolve;
        el.onerror = function () { reject(new Error('Ressource Calendly indisponible')); };
        document.head.appendChild(el);
      });
    }

    function init() {
      if (started) return;
      started = true;

      loadAsset('link', {
        rel: 'stylesheet',
        href: 'https://assets.calendly.com/assets/external/widget.css'
      }).catch(function () { /* la feuille tierce n'est pas bloquante */ });

      loadAsset('script', {
        src: 'https://assets.calendly.com/assets/external/widget.js',
        async: 'async'
      }).then(function () {
        if (!window.Calendly) throw new Error('Calendly absent après chargement');
        window.Calendly.initInlineWidget({
          url: url + '?hide_gdpr_banner=1&background_color=ffffff&text_color=0b2433&primary_color=0b7099',
          parentElement: host
        });
        // Le widget ne signale sa disponibilité que par postMessage : filet de
        // sécurité si aucun message n'arrive.
        setTimeout(function () {
          if (host.querySelector('iframe')) showWidget();
          else showFallback();
        }, 6000);
      }).catch(showFallback);
    }

    window.addEventListener('message', function (e) {
      if (typeof e.origin !== 'string' || e.origin.indexOf('calendly.com') === -1) return;
      var data = e.data;
      if (!data || typeof data.event !== 'string' || data.event.indexOf('calendly.') !== 0) return;
      showWidget();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        init();
      }, { rootMargin: '600px 0px' }).observe(host);
    } else {
      init();
    }

    // Un clic sur un CTA doit garantir que le calendrier est déjà en route,
    // même si le visiteur saute directement en bas de page.
    $$('a[href="#devis"]').forEach(function (a) { a.addEventListener('click', init); });
  })();

  /* ----------------------------------------------------------------- divers */
  (function misc() {
    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    // Une seule question ouverte à la fois — comportement attendu d'un
    // accordéon, que <details> ne fournit pas seul sans attribut `name`.
    var faq = $$('.faq-item');
    faq.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        faq.forEach(function (other) { if (other !== item) other.open = false; });
      });
    });
  })();

  onScroll();
})();
