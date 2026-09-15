/* ============================================================================
   Tech Piscine — site vitrine (maquette de démonstration)

   Principes tenus dans tout ce fichier :
   • Aucune dépendance, aucun tiers, aucune requête réseau — y compris le
     calendrier de réservation, entièrement simulé côté client (voir plus
     bas) : pratique pour une démonstration, rien à configurer côté serveur.
   • Tout est facultatif : sans JavaScript la page reste entièrement lisible,
     la galerie ouvre les photos normalement et un message de repli remplace
     le calendrier interactif.
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

  /* ------------------------------------------------ calendrier de réservation
     Simulation complète côté client : calendrier, créneaux, formulaire et
     confirmation. Rien n'est envoyé nulle part — les créneaux « déjà pris »
     viennent d'un hachage déterministe de la date (même jour ⇒ mêmes
     créneaux à chaque rechargement), pas d'un vrai planning. */
  (function booker() {
    var root = $('#booker');
    if (!root) return;

    var calGrid = $('#cal-grid', root);
    var calMonth = $('#cal-month', root);
    var prevBtn = $('#cal-prev', root);
    var nextBtn = $('#cal-next', root);
    var slotsGrid = $('#slots-grid', root);
    var slotsLabel = $('#slots-label', root);
    var pickPanel = $('#booker-pick', root);
    var formPanel = $('#booker-form', root);
    var donePanel = $('#booker-done', root);
    var formSummary = $('#booker-form-summary', root);
    var backBtn = $('#booker-back', root);
    var submitBtn = $('#booker-submit', root);
    var submitSpinner = $('#booker-submit-spinner', root);
    var submitLabel = $('#booker-submit-label', root);
    var againBtn = $('#booker-again', root);
    var nameInput = $('#bk-name', root);
    var doneName = $('#done-name', root);
    var doneSummary = $('#done-summary', root);
    var tabs = $$('.booker-step', root);

    var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
      'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

    var today = startOfDay(new Date());
    var viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    var lastMonth = addMonths(startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)), 1);

    var selectedDate = null;
    var selectedSlot = null;

    function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function sameDay(a, b) {
      return !!a && !!b && a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }
    function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function dateKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    // Hachage déterministe (FNV-1a) : même chaîne ⇒ toujours le même nombre
    // entre 0 et 1. Sert uniquement à simuler des créneaux déjà pris, de façon
    // stable — pas un générateur cryptographique, ce n'en est pas l'usage.
    function seeded(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 1000) / 1000;
    }

    function buildMonthCells(month) {
      var first = new Date(month.getFullYear(), month.getMonth(), 1);
      var offset = (first.getDay() + 6) % 7; // semaine commençant le lundi
      var daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      var cells = [];
      for (var i = 0; i < offset; i++) cells.push(null);
      for (var d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
      return cells;
    }

    function renderCalendar() {
      calMonth.textContent = MONTHS[viewMonth.getMonth()] + ' ' + viewMonth.getFullYear();
      calGrid.innerHTML = '';

      buildMonthCells(viewMonth).forEach(function (date) {
        if (!date) {
          var pad = document.createElement('span');
          pad.className = 'cal-day cal-day-pad';
          pad.setAttribute('aria-hidden', 'true');
          calGrid.appendChild(pad);
          return;
        }

        var disabled = date < today || date.getDay() === 0; // passé, ou dimanche (fermé)
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cal-day' + (sameDay(date, today) ? ' is-today' : '');
        cell.textContent = date.getDate();
        cell.disabled = disabled;
        cell.setAttribute('aria-pressed', String(sameDay(date, selectedDate)));
        cell.setAttribute('aria-label', WEEKDAYS_LONG[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()]);
        if (!disabled) cell.addEventListener('click', function () { selectDate(date); });
        calGrid.appendChild(cell);
      });

      prevBtn.disabled = viewMonth.getTime() <= new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      nextBtn.disabled = viewMonth.getTime() >= lastMonth.getTime();
    }

    function slotsFor(date) {
      var isSaturday = date.getDay() === 6;
      var hours = isSaturday ? [8, 9, 10, 11] : [8, 9, 10, 11, 14, 15, 16];
      var isToday = sameDay(date, today);
      var nowHour = new Date().getHours();

      var list = hours
        .filter(function (h) { return !isToday || h > nowHour; })
        .map(function (h) { return { hour: h, label: pad2(h) + 'h00', taken: seeded(dateKey(date) + '-' + h) < 0.22 }; });

      // Évite qu'une journée paraisse entièrement complète (ce qui ressemblerait
      // à un bug plutôt qu'à un vrai planning chargé) : deux créneaux au moins
      // restent ouverts quand la journée en propose.
      var free = list.filter(function (s) { return !s.taken; });
      for (var i = 0; free.length < 2 && i < list.length; i++) {
        if (list[i].taken) { list[i].taken = false; free = list.filter(function (s) { return !s.taken; }); }
      }
      return list;
    }

    function renderSlots() {
      slotsGrid.innerHTML = '';

      if (!selectedDate) {
        slotsLabel.textContent = 'Choisissez d’abord une date.';
        return;
      }

      slotsLabel.textContent = capitalize(WEEKDAYS_LONG[selectedDate.getDay()]) + ' ' + selectedDate.getDate() +
        ' ' + MONTHS[selectedDate.getMonth()] + ' — créneaux disponibles';

      var list = slotsFor(selectedDate);
      if (!list.length) {
        var empty = document.createElement('p');
        empty.className = 'booker-slots-empty';
        empty.textContent = 'Plus de créneau ce jour-là — choisissez une autre date.';
        slotsGrid.appendChild(empty);
        return;
      }

      list.forEach(function (s) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.textContent = s.label;
        btn.disabled = s.taken;
        btn.setAttribute('aria-pressed', String(s.label === selectedSlot));
        if (!s.taken) btn.addEventListener('click', function () { selectSlot(s.label); });
        slotsGrid.appendChild(btn);
      });
    }

    function selectDate(date) {
      selectedDate = date;
      selectedSlot = null;
      renderCalendar();
      renderSlots();
    }

    function selectSlot(label) {
      selectedSlot = label;
      renderSlots();
      // Léger délai : le visiteur voit son créneau se surligner avant que la
      // vue ne change, plutôt qu'un remplacement instantané et déroutant.
      window.setTimeout(function () { showStep('form'); }, 320);
    }

    function summaryText() {
      return capitalize(WEEKDAYS_LONG[selectedDate.getDay()]) + ' ' + selectedDate.getDate() + ' ' +
        MONTHS[selectedDate.getMonth()] + ' à ' + selectedSlot + '.';
    }

    function showStep(name) {
      pickPanel.hidden = name !== 'pick';
      formPanel.hidden = name !== 'form';
      donePanel.hidden = name !== 'done';
      tabs.forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-step') === name); });

      if (name === 'form') {
        formSummary.textContent = 'Rendez-vous le ' + summaryText();
        if (nameInput) nameInput.focus({ preventScroll: true });
      }
      if (name === 'done') donePanel.focus({ preventScroll: true });
    }

    prevBtn.addEventListener('click', function () { viewMonth = addMonths(viewMonth, -1); renderCalendar(); });
    nextBtn.addEventListener('click', function () { viewMonth = addMonths(viewMonth, 1); renderCalendar(); });
    backBtn.addEventListener('click', function () { showStep('pick'); });

    formPanel.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!selectedDate || !selectedSlot) return;

      var name = nameInput.value.trim();
      var phone = $('#bk-phone', root).value.trim();
      if (!name || !phone) {
        (name ? $('#bk-phone', root) : nameInput).focus();
        return;
      }

      submitBtn.disabled = true;
      submitSpinner.hidden = false;
      submitLabel.textContent = 'Confirmation…';

      // Simule le court aller-retour d'une vraie prise de rendez-vous, sans
      // aucune requête réelle : rien n'est transmis.
      window.setTimeout(function () {
        doneName.textContent = name.split(' ')[0];
        doneSummary.textContent = 'Rendez-vous confirmé — ' + summaryText() +
          ' Notre équipe vous rappelle pour valider les derniers détails.';
        showStep('done');
        submitBtn.disabled = false;
        submitSpinner.hidden = true;
        submitLabel.textContent = 'Confirmer le rendez-vous';
      }, 650);
    });

    againBtn.addEventListener('click', function () {
      selectedSlot = null;
      formPanel.reset();
      renderSlots();
      showStep('pick');
    });

    renderCalendar();
    renderSlots();
    showStep('pick');
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
