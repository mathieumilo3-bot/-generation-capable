/* ============================================================================
   Hair Master — site vitrine (maquette de démonstration)

   Principes tenus dans tout ce fichier :
   • Aucune dépendance, aucun tiers, aucune requête réseau — y compris le
     calendrier de réservation, entièrement simulé côté client.
   • Aucune photo de patient : le visuel comparatif du hero est un diagramme
     de densité capillaire généré en SVG, purement abstrait.
   • Tout est facultatif : sans JavaScript la page reste entièrement lisible,
     et un message de repli remplace le calendrier interactif.
   ========================================================================= */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hachage déterministe (FNV-1a) partagé par le diagramme et le calendrier :
     même chaîne ⇒ toujours le même nombre entre 0 et 1. */
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  }

  /* ---------------------------------------------------------------- scroll */
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

  (function readingProgress() {
    var bar = $('#reading-progress-bar');
    if (!bar) return;
    scrollTasks.push(function (y) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = 'scaleX(' + ratio + ')';
    });
  })();

  (function stickyNav() {
    var nav = $('#nav');
    if (!nav) return;
    scrollTasks.push(function (y) { nav.classList.toggle('is-scrolled', y > 24); });
  })();

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

  /* -------------------------------------------------- diagramme comparatif
     Deux SVG superposés : « after » (dense) en fond, « before » (clairsemé)
     au-dessus, découpé par clip-path selon la position du curseur. Aucune
     photo — uniquement des points générés, à l'intérieur d'un dôme abstrait
     représentant le cuir chevelu vu de face. */
  (function compareDiagram() {
    var panel = $('#compare');
    var range = $('#compare-range', panel || document);
    var afterSvg = $('#diagram-after');
    var beforeSvg = $('#diagram-before');
    if (!panel || !range || !afterSvg || !beforeSvg) return;

    var NS = 'http://www.w3.org/2000/svg';
    var DOME_D = 'M20,258 C20,120 60,20 160,20 C260,20 300,120 300,258 Z';

    // Points clé (x,y) définissant la ligne de la chevelure : avant = ligne
    // reculée façon golfes temporaux, après = ligne plus basse et régulière.
    var BEFORE_POINTS = [[26, 58], [90, 96], [160, 118], [230, 96], [294, 58]];
    var AFTER_POINTS = [[26, 142], [80, 178], [160, 198], [240, 178], [294, 142]];

    function hairlineY(points, x) {
      for (var i = 0; i < points.length - 1; i++) {
        var a = points[i], b = points[i + 1];
        if (x >= a[0] && x <= b[0]) {
          var t = (x - a[0]) / (b[0] - a[0]);
          return a[1] + (b[1] - a[1]) * t;
        }
      }
      return points[points.length - 1][1];
    }

    function hairlinePathD(points) {
      return points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');
    }

    function buildDiagram(svg, points, rowGap, seedPrefix, gapProbability, dotClass) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var defs = document.createElementNS(NS, 'defs');
      var clip = document.createElementNS(NS, 'clipPath');
      clip.id = seedPrefix + '-clip';
      var clipShape = document.createElementNS(NS, 'path');
      clipShape.setAttribute('d', DOME_D);
      clip.appendChild(clipShape);
      defs.appendChild(clip);
      svg.appendChild(defs);

      var dome = document.createElementNS(NS, 'path');
      dome.setAttribute('d', DOME_D);
      dome.setAttribute('class', 'diagram-dome');
      svg.appendChild(dome);

      var g = document.createElementNS(NS, 'g');
      g.setAttribute('clip-path', 'url(#' + seedPrefix + '-clip)');
      if (dotClass) g.setAttribute('class', dotClass);

      for (var x = 28; x <= 292; x += 9) {
        var hy = hairlineY(points, x);
        for (var y = 26; y <= hy; y += rowGap) {
          var key = seedPrefix + ':' + x + ':' + y;
          if (gapProbability && seeded(key + ':gap') < gapProbability) continue;
          var jx = x + (seeded(key + ':x') - 0.5) * 3;
          var jy = y + (seeded(key + ':y') - 0.5) * 3;
          var c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', jx.toFixed(1));
          c.setAttribute('cy', jy.toFixed(1));
          c.setAttribute('r', '1.3');
          g.appendChild(c);
        }
      }
      svg.appendChild(g);

      var hairline = document.createElementNS(NS, 'path');
      hairline.setAttribute('d', hairlinePathD(points));
      hairline.setAttribute('class', 'diagram-hairline');
      svg.appendChild(hairline);
    }

    buildDiagram(afterSvg, AFTER_POINTS, 8, 'after', 0, null);
    buildDiagram(beforeSvg, BEFORE_POINTS, 15, 'before', 0.22, null);

    function sync() { panel.style.setProperty('--pos', range.value + '%'); }
    range.addEventListener('input', sync);
    sync();
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
    function go(dir) { track.scrollBy({ left: dir * step(), behavior: reduceMotion ? 'auto' : 'smooth' }); }

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
    track.addEventListener('scroll', function () { requestAnimationFrame(syncButtons); }, { passive: true });
    window.addEventListener('resize', syncButtons, { passive: true });
    syncButtons();
  })();

  /* ------------------------------------------------------ barre CTA mobile */
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

  /* ------------------------------------------------ calendrier de réservation
     Simulation complète côté client : calendrier, créneaux, formulaire et
     confirmation. Rien n'est envoyé nulle part — les créneaux « déjà pris »
     viennent d'un hachage déterministe de la date, pas d'un vrai planning. */
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
    var lastMonth = addMonths(viewMonth, 1);

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

    function buildMonthCells(month) {
      var first = new Date(month.getFullYear(), month.getMonth(), 1);
      var offset = (first.getDay() + 6) % 7;
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

        var disabled = date < today || date.getDay() === 0;
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
      var hours = isSaturday ? [9, 10, 11] : [9, 10, 11, 14, 15, 16, 17];
      var isToday = sameDay(date, today);
      var nowHour = new Date().getHours();

      var list = hours
        .filter(function (h) { return !isToday || h > nowHour; })
        .map(function (h) { return { hour: h, label: pad2(h) + 'h00', taken: seeded(dateKey(date) + '-' + h) < 0.22 }; });

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
