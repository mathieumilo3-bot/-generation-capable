/* ============================================================================
   Génération Capable — site vitrine (démo)

   Principes tenus dans tout ce fichier :
   • Aucune dépendance. Le seul tiers chargé est le widget Calendly, et il ne
     l'est qu'au moment où le visiteur approche de la section de réservation.
   • Tout est facultatif : sans JavaScript, la page reste entièrement lisible
     et réservable (lien direct vers Calendly en repli).
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
     Un seul écouteur de scroll pour toute la page, dégroupé en rAF : les
     lecteurs ci-dessous sont appelés une fois par frame au maximum. */
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
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = 'scaleX(' + ratio + ')';
    });
  })();

  /* -------------------------------------------------------- barre de nav */
  (function stickyNav() {
    var nav = $('#nav');
    if (!nav) return;

    scrollTasks.push(function (y) {
      nav.classList.toggle('is-scrolled', y > 24);
    });
  })();

  /* ------------------------------------------------- révélation au scroll
     `once: true` — une fois l'élément apparu on cesse de l'observer, la page
     ne rejoue jamais l'animation en remontant. */
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

  /* -------------------------------------------------- compteurs animés */
  (function counters() {
    var nodes = $$('[data-count-to]');
    if (!nodes.length) return;

    // Le HTML contient déjà la valeur finale : sans IntersectionObserver ou en
    // mouvement réduit, on n'y touche simplement pas.
    if (!('IntersectionObserver' in window) || reduceMotion) return;

    function render(el, value) {
      var decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
      var text = value.toFixed(decimals).replace('.', ','); // format français
      el.textContent = (el.getAttribute('data-count-prefix') || '') + text +
                       (el.getAttribute('data-count-suffix') || '');
    }

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count-to'));
      if (isNaN(target)) return;

      var duration = 1100;
      var started = null;

      function frame(now) {
        if (started === null) started = now;
        var t = Math.min(1, (now - started) / duration);
        var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        render(el, target * eased);
        if (t < 1) requestAnimationFrame(frame);
        else render(el, target);
      }
      requestAnimationFrame(frame);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        run(entry.target);
      });
    }, { threshold: 0.5 });

    nodes.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------------- lecteur vidéo */
  (function player() {
    var device = $('#device');
    var video = $('#vsl');
    if (!device || !video) return;

    var playBtn = $('#device-play');
    var hud = $('#device-hud');
    var toggle = $('#hud-toggle');
    var bar = $('#hud-bar');
    var fill = $('#hud-bar-fill');
    var time = $('#hud-time');
    var mute = $('#hud-mute');

    // Sur écran tactile il n'y a pas de survol : les contrôles restent visibles.
    if (window.matchMedia('(hover: none)').matches) device.classList.add('is-touch');

    function fmt(s) {
      if (!isFinite(s)) return '0:00';
      var m = Math.floor(s / 60);
      var r = Math.floor(s % 60);
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function setIcons(el, playing) {
      $('.ic-play', el).hidden = playing;
      $('.ic-pause', el).hidden = !playing;
    }

    // `wanted` distingue « le visiteur veut que ça joue » de l'état réel de
    // l'élément. Sans ce drapeau, la relance en sourdine ci-dessous peut
    // aboutir APRÈS une mise en pause et redémarrer la vidéo toute seule.
    var wanted = false;

    function start() {
      wanted = true;
      hud.hidden = false;
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        // Certains navigateurs refusent la lecture avec son sans geste direct :
        // on rejoue alors en sourdine plutôt que de ne rien faire du tout.
        p.catch(function () {
          if (!wanted) return;
          video.muted = true;
          syncMute();
          video.play().catch(function () {});
        });
      }
    }

    function stop() {
      wanted = false;
      video.pause();
    }

    function syncMute() {
      $('.ic-on', mute).hidden = video.muted;
      $('.ic-off', mute).hidden = !video.muted;
      mute.setAttribute('aria-label', video.muted ? 'Rétablir le son' : 'Couper le son');
    }

    playBtn.addEventListener('click', start);

    // Le bouton « Voir la présentation » du hero amène la vidéo à l'écran
    // avant de la lancer — sur mobile elle est souvent déjà passée au-dessus.
    $$('[data-play-video]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        device.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center'
        });
        start();
      });
    });

    toggle.addEventListener('click', function () {
      if (video.paused) start(); else stop();
    });

    mute.addEventListener('click', function () {
      video.muted = !video.muted;
      syncMute();
    });

    video.addEventListener('play', function () {
      device.classList.add('is-playing');
      hud.hidden = false;
      setIcons(toggle, true);
    });
    video.addEventListener('pause', function () { setIcons(toggle, false); });
    video.addEventListener('ended', function () {
      wanted = false;
      device.classList.remove('is-playing');
      setIcons(toggle, false);
    });

    video.addEventListener('timeupdate', function () {
      var d = video.duration;
      if (!isFinite(d) || d <= 0) return;
      var pct = (video.currentTime / d) * 100;
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
      bar.setAttribute('aria-valuetext', fmt(video.currentTime) + ' sur ' + fmt(d));
      time.textContent = fmt(video.currentTime);
    });

    // Déplacement dans la vidéo — souris, doigt et clavier.
    function seekAt(clientX) {
      var rect = bar.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      if (isFinite(video.duration)) video.currentTime = ratio * video.duration;
    }

    var dragging = false;
    bar.addEventListener('pointerdown', function (e) {
      dragging = true;
      bar.setPointerCapture(e.pointerId);
      seekAt(e.clientX);
    });
    bar.addEventListener('pointermove', function (e) { if (dragging) seekAt(e.clientX); });
    bar.addEventListener('pointerup', function () { dragging = false; });
    bar.addEventListener('pointercancel', function () { dragging = false; });

    bar.addEventListener('keydown', function (e) {
      var step = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0;
      if (!step || !isFinite(video.duration)) return;
      e.preventDefault();
      video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + step));
    });

    // Met la vidéo en pause dès qu'elle quitte l'écran : personne n'a envie
    // d'entendre une voix qui continue après avoir scrollé.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting && !video.paused) stop();
        });
      }, { threshold: 0.25 }).observe(device);
    }

    syncMute();
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

    // Flèches clavier quand le carrousel a le focus.
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
     Visible une fois le hero passé, masquée quand la section de réservation
     est elle-même à l'écran (le bouton ferait doublon). */
  (function mobileBar() {
    var bar = $('#mobile-bar');
    var booking = $('#reserver');
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
          url: url + '?hide_gdpr_banner=1&background_color=ffffff&text_color=1d1d1f&primary_color=1d1d1f',
          parentElement: host
        });
        // Le widget ne signale pas sa disponibilité autrement que par
        // postMessage : filet de sécurité si aucun message n'arrive.
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
    $$('a[href="#reserver"]').forEach(function (a) {
      a.addEventListener('click', init);
    });
  })();

  /* ----------------------------------------------------------------- divers */
  (function misc() {
    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    // Une seule question de FAQ ouverte à la fois — comportement attendu d'un
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
