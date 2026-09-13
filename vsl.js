// vsl.js — Génération Capable
//
// Tunnel : Hero → VSL (déblocage à 100%) → candidature en 5 questions
// (une à la fois) → Calendly inline (moteur de réservation officiel,
// inchangé) → confirmation.
//
// Tout l'état visible (réponses, progression vidéo, étape courante, UTM,
// réservation) est persisté dans localStorage pour survivre à un rechargement
// ou un retour sur la page. Aucune donnée sensible n'est envoyée ailleurs
// qu'à nos propres fonctions Netlify et à Calendly (widget officiel).

(function () {
  'use strict';

  var STORAGE_KEY = 'gc_vsl_state_v1';
  var CALENDLY_URL = 'https://calendly.com/ledorvenenzo50/appel-decouverte-generation-capable';

  var QUESTIONS = [
    {
      key: 'q1',
      type: 'single',
      title: "Aujourd'hui, où en es-tu dans la vente de ton offre ?",
      options: [
        { value: 'no_sale', label: "Je n'ai encore fait aucune vente" },
        { value: 'few_sales', label: 'Je fais quelques ventes' },
        { value: 'regular_sales', label: 'Je vends régulièrement' },
        { value: 'daily_sales', label: 'Je vends tous les jours' },
        { value: 'no_offer', label: "Je n'ai pas encore d'offre à vendre" },
      ],
    },
    {
      key: 'q2',
      type: 'multi',
      title: 'Comment trouves-tu actuellement tes clients ?',
      options: [
        { value: 'prospecting_physical', label: 'Prospection physique' },
        { value: 'network_wom', label: 'Réseau / bouche-à-oreille' },
        { value: 'instagram_tiktok', label: 'Instagram / TikTok' },
        { value: 'dm', label: 'Messages privés / DM' },
        { value: 'email', label: 'Email' },
        { value: 'phone_calls', label: 'Appels téléphoniques' },
        { value: 'sales_meetings', label: 'Rendez-vous / appels de vente' },
        { value: 'ads', label: 'Publicité' },
        { value: 'freelance_platforms', label: 'Plateformes freelance' },
      ],
    },
    {
      key: 'q3',
      type: 'text',
      title: "Qu'est-ce que tu vends actuellement ? Décris-moi ton offre en quelques mots.",
      placeholder: "Ex : j'accompagne des artisans à obtenir des chantiers par recommandation...",
      maxLength: 600,
    },
    {
      key: 'q4',
      type: 'multi',
      title: "Aujourd'hui, qu'est-ce que tu veux principalement améliorer dans ta capacité à vendre ?",
      options: [
        { value: 'more_leads_rdv', label: 'Trouver plus de prospects et obtenir plus de rendez-vous' },
        { value: 'better_at_meetings', label: 'Devenir meilleur pour vendre mon offre pendant mes rendez-vous' },
        { value: 'handle_objections', label: 'Mieux gérer les objections et les hésitations' },
        { value: 'close_with_confidence', label: "Apprendre à closer avec beaucoup plus d'assurance" },
        { value: 'become_top_performer', label: 'Je vends déjà, mais je veux passer un cap et devenir un vrai performer de la vente' },
      ],
    },
    {
      key: 'q5',
      type: 'text',
      title: 'Si tu devenais un véritable performer en vente et en closing, qu\'est-ce que tu voudrais être capable d\'accomplir ?',
      placeholder: 'Décris ta vision en quelques phrases...',
      maxLength: 800,
    },
  ];

  // ------------------------------------------------------------------ utils

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function formatTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------------ state

  function defaultState() {
    return {
      id: makeId(),
      step: -1,
      answers: { q1: null, q2: [], q3: '', q4: [], q5: '' },
      videoCompleted: false,
      videoProgressSeconds: 0,
      videoMilestones: [],
      applicationStarted: false,
      submitted: false,
      calendlyReached: false,
      booked: false,
      bookedAt: null,
      utm: {},
    };
  }

  var state = loadState();

  function loadState() {
    var base = defaultState();
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        base.id = typeof saved.id === 'string' ? saved.id : base.id;
        base.step = typeof saved.step === 'number' ? saved.step : base.step;
        base.answers = Object.assign(base.answers, saved.answers || {});
        base.videoCompleted = !!saved.videoCompleted;
        base.videoProgressSeconds = Number(saved.videoProgressSeconds) || 0;
        base.videoMilestones = Array.isArray(saved.videoMilestones) ? saved.videoMilestones : [];
        base.applicationStarted = !!saved.applicationStarted;
        base.submitted = !!saved.submitted;
        base.calendlyReached = !!saved.calendlyReached;
        base.booked = !!saved.booked;
        base.bookedAt = saved.bookedAt || null;
        base.utm = saved.utm && typeof saved.utm === 'object' ? saved.utm : {};
      }
    } catch (e) { /* localStorage indisponible (navigation privée...) : on repart de zéro */ }
    return base;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* non bloquant */ }
  }

  function captureUtm() {
    var params = new URLSearchParams(location.search);
    var keys = ['source', 'medium', 'campaign', 'content', 'term'];
    var changed = false;
    keys.forEach(function (k) {
      var v = params.get('utm_' + k);
      if (v) { state.utm[k] = v.slice(0, 150); changed = true; }
    });
    if (changed) saveState();
  }

  // ------------------------------------------------------------------ tracking

  function trackEvent(name, props) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: 'gc_' + name }, props || {}));
    } catch (e) { /* GTM absent, sans conséquence */ }
    try { if (typeof window.gtag === 'function') window.gtag('event', name, props || {}); } catch (e) {}
    try { if (typeof window.fbq === 'function') window.fbq('trackCustom', name, props || {}); } catch (e) {}
    try {
      var body = JSON.stringify({
        id: state.id,
        name: name,
        props: props || {},
        utm: state.utm || {},
        pageUrl: location.href,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/.netlify/functions/track-funnel-event', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/.netlify/functions/track-funnel-event', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true,
        }).catch(function () {});
      }
    } catch (e) { /* le tracking ne doit jamais casser le tunnel */ }
  }

  function submitApplication() {
    var body = JSON.stringify({
      id: state.id,
      q1: state.answers.q1,
      q2: state.answers.q2,
      q3: state.answers.q3,
      q4: state.answers.q4,
      q5: state.answers.q5,
      videoCompleted: state.videoCompleted,
      utm: state.utm || {},
      pageUrl: location.href,
    });
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 6000) : null;
    fetch('/.netlify/functions/submit-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function () {
      state.submitted = true;
      saveState();
    }).catch(function (e) {
      console.warn('[vsl] Enregistrement de la candidature différé (réseau) — le tunnel continue.', e);
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  // ------------------------------------------------------------------ video

  function initVideo() {
    var frame = qs('#video-frame');
    var video = qs('#vsl-video');
    var overlay = qs('#video-overlay');
    var playBtn = qs('#video-play-btn');
    var controls = qs('#video-controls');
    var playPauseBtn = qs('#vc-playpause');
    var icPlay = qs('.ic-play', playPauseBtn);
    var icPause = qs('.ic-pause', playPauseBtn);
    var timeLabel = qs('#vc-time');
    var bar = qs('#vc-bar');
    var barBuffered = qs('#vc-bar-buffered');
    var barProgress = qs('#vc-bar-progress');
    var barKnob = qs('#vc-bar-knob');
    var muteBtn = qs('#vc-mute');
    var icUnmuted = qs('.ic-unmuted', muteBtn);
    var icMuted = qs('.ic-muted', muteBtn);
    var fullscreenBtn = qs('#vc-fullscreen');
    if (!video) return;

    var started = false;
    var lastSave = 0;
    var scrubbing = false;

    function setOverlayVisible(visible) {
      overlay.dataset.hidden = visible ? 'false' : 'true';
    }

    function togglePlay() {
      if (video.ended || video.currentTime >= (video.duration || 0) - 0.05) {
        video.currentTime = 0;
      }
      if (video.paused) video.play().catch(function () {}); else video.pause();
    }

    function updatePlayIcon() {
      var playing = !video.paused && !video.ended;
      icPlay.hidden = playing;
      icPause.hidden = !playing;
      setOverlayVisible(!playing);
    }

    function updateProgressUi() {
      var dur = video.duration || 0;
      var pct = dur > 0 ? clamp(video.currentTime / dur, 0, 1) : 0;
      if (!scrubbing) {
        barProgress.style.width = (pct * 100) + '%';
        barKnob.style.left = (pct * 100) + '%';
      }
      bar.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
      timeLabel.textContent = formatTime(video.currentTime) + ' / ' + formatTime(dur);
      try {
        if (video.buffered && video.buffered.length) {
          var end = video.buffered.end(video.buffered.length - 1);
          barBuffered.style.width = (dur > 0 ? clamp(end / dur, 0, 1) * 100 : 0) + '%';
        }
      } catch (e) {}
      return pct;
    }

    function maybeSaveProgress(force) {
      var now = Date.now();
      if (!force && now - lastSave < 1000) return;
      lastSave = now;
      state.videoProgressSeconds = video.currentTime || 0;
      saveState();
    }

    function checkMilestonesAndCompletion(pct) {
      [25, 50, 75, 90].forEach(function (m) {
        if (pct * 100 >= m && state.videoMilestones.indexOf(m) === -1) {
          state.videoMilestones.push(m);
          trackEvent('video_progress', { percent: m });
        }
      });
      var isComplete = video.ended || (video.duration > 0 && pct >= 0.985);
      if (isComplete && !state.videoCompleted) {
        state.videoCompleted = true;
        saveState();
        trackEvent('video_completed');
        pulseCtaCard();
      }
    }

    video.addEventListener('loadedmetadata', function () {
      if (!state.videoCompleted && state.videoProgressSeconds > 1 && state.videoProgressSeconds < video.duration - 1) {
        try { video.currentTime = state.videoProgressSeconds; } catch (e) {}
      }
      updateProgressUi();
    });

    video.addEventListener('play', function () {
      if (!started) { started = true; trackEvent('video_start'); }
      updatePlayIcon();
    });
    video.addEventListener('pause', updatePlayIcon);
    video.addEventListener('ended', function () {
      updatePlayIcon();
      var pct = updateProgressUi();
      checkMilestonesAndCompletion(pct);
      maybeSaveProgress(true);
    });
    video.addEventListener('timeupdate', function () {
      var pct = updateProgressUi();
      checkMilestonesAndCompletion(pct);
      maybeSaveProgress(false);
    });

    playBtn.addEventListener('click', togglePlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) togglePlay();
    });
    playPauseBtn.addEventListener('click', togglePlay);

    frame.addEventListener('keydown', function (e) {
      if (e.target === bar) return;
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); togglePlay(); }
    });

    muteBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      icUnmuted.hidden = video.muted;
      icMuted.hidden = !video.muted;
    });

    fullscreenBtn.addEventListener('click', function () {
      if (frame.requestFullscreen) frame.requestFullscreen().catch(function () {});
      else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS Safari
    });

    function seekFromClientX(clientX) {
      var rect = bar.getBoundingClientRect();
      var ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      var dur = video.duration || 0;
      barProgress.style.width = (ratio * 100) + '%';
      barKnob.style.left = (ratio * 100) + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      if (dur > 0) video.currentTime = ratio * dur;
    }

    bar.addEventListener('pointerdown', function (e) {
      scrubbing = true;
      bar.setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX);
    });
    bar.addEventListener('pointermove', function (e) {
      if (scrubbing) seekFromClientX(e.clientX);
    });
    ['pointerup', 'pointercancel'].forEach(function (evt) {
      bar.addEventListener(evt, function () { scrubbing = false; });
    });
    bar.addEventListener('keydown', function (e) {
      var dur = video.duration || 0;
      if (e.key === 'ArrowRight') { video.currentTime = clamp(video.currentTime + 5, 0, dur); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { video.currentTime = clamp(video.currentTime - 5, 0, dur); e.preventDefault(); }
    });

    updatePlayIcon();
  }

  // ------------------------------------------------------------------ cta card
  //
  // Réserver un appel ne dépend plus d'avoir terminé la vidéo : le bouton est
  // actif dès l'arrivée sur la page. On garde juste un petit clin d'œil
  // visuel quand la vidéo se termine.

  function pulseCtaCard() {
    var card = qs('#unlock-card');
    if (!card) return;
    card.classList.add('just-unlocked');
    setTimeout(function () { card.classList.remove('just-unlocked'); }, 650);
  }

  // ------------------------------------------------------------------ application funnel

  function currentAnswerFor(q) {
    return state.answers[q.key];
  }

  function renderStep(index, direction) {
    state.step = index;
    saveState();

    var progressFill = qs('#ap-bar-fill');
    var progressLabel = qs('#ap-bar-label');
    progressFill.style.width = (((index + 1) / QUESTIONS.length) * 100) + '%';
    progressLabel.textContent = 'Question ' + (index + 1) + '/' + QUESTIONS.length;

    var container = qs('#application-steps');
    var q = QUESTIONS[index];
    var isLast = index === QUESTIONS.length - 1;

    var html = '<div class="q-step" data-step="' + index + '">';
    if (index > 0) {
      html += '<button type="button" class="btn-ghost q-back" data-back>← Retour</button>';
    }
    html += '<h3 class="q-title">' + q.title + '</h3>';

    if (q.type === 'single' || q.type === 'multi') {
      var current = currentAnswerFor(q);
      html += '<div class="choice-list">';
      q.options.forEach(function (opt, i) {
        var checked = q.type === 'single' ? current === opt.value : (current || []).indexOf(opt.value) !== -1;
        var id = 'opt-' + q.key + '-' + i;
        html += '<label class="choice-option' + (checked ? ' selected' : '') + '" data-type="' + q.type + '">' +
          '<input class="choice-input visually-hidden" type="' + (q.type === 'single' ? 'radio' : 'checkbox') +
            '" name="q-' + q.key + '" id="' + id + '" value="' + opt.value + '"' + (checked ? ' checked' : '') + '>' +
          '<span class="choice-mark" aria-hidden="true"><svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M6.2 11.2 2.8 7.8l1.1-1.1 2.3 2.3 5.6-5.6 1.1 1.1z"/></svg></span>' +
          '<span class="choice-label">' + opt.label + '</span>' +
        '</label>';
      });
      html += '</div>';
      html += '<div class="field-error" data-error hidden>Sélectionne ' + (q.type === 'single' ? 'une réponse' : 'au moins une réponse') + ' pour continuer.</div>';
    } else if (q.type === 'text') {
      var val = currentAnswerFor(q) || '';
      html += '<label class="visually-hidden" for="field-' + q.key + '">' + q.title + '</label>' +
        '<textarea class="field-textarea" id="field-' + q.key + '" placeholder="' + escapeHtml(q.placeholder || '') + '" maxlength="' + q.maxLength + '">' + escapeHtml(val) + '</textarea>' +
        '<div class="field-meta"><span></span><span class="char-count" data-char-count>' + val.length + ' / ' + q.maxLength + '</span></div>' +
        '<div class="field-error" data-error hidden>Merci de détailler ta réponse (quelques mots suffisent).</div>';
    }

    html += '<div class="q-actions"><button type="button" class="btn-primary btn-gold" data-continue>' +
      (isLast ? 'Voir mon créneau →' : 'Continuer') + '</button></div>';
    html += '</div>';

    container.innerHTML = html;

    var stepEl = qs('.q-step', container);
    if (!prefersReducedMotion() && direction) {
      stepEl.style.animation = 'none';
      // force reflow to restart animation
      void stepEl.offsetWidth;
      stepEl.style.animation = '';
    }

    wireStepEvents(index, q, stepEl);

    // Focus la question pour les lecteurs d'écran / navigation clavier.
    var heading = qs('.q-title', stepEl);
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }

  function wireStepEvents(index, q, stepEl) {
    var backBtn = qs('[data-back]', stepEl);
    if (backBtn) {
      backBtn.addEventListener('click', function () { goToStep(index - 1); });
    }

    if (q.type === 'single' || q.type === 'multi') {
      qsa('.choice-input', stepEl).forEach(function (input) {
        input.addEventListener('change', function () {
          var label = input.closest('.choice-option');
          if (q.type === 'single') {
            qsa('.choice-option', stepEl).forEach(function (l) { l.classList.remove('selected'); });
            label.classList.add('selected');
            state.answers[q.key] = input.value;
          } else {
            label.classList.toggle('selected', input.checked);
            var arr = state.answers[q.key].slice();
            var i = arr.indexOf(input.value);
            if (input.checked && i === -1) arr.push(input.value);
            if (!input.checked && i !== -1) arr.splice(i, 1);
            state.answers[q.key] = arr;
          }
          saveState();
          hideError(stepEl);
        });
      });
    } else if (q.type === 'text') {
      var textarea = qs('.field-textarea', stepEl);
      var counter = qs('[data-char-count]', stepEl);
      textarea.addEventListener('input', function () {
        state.answers[q.key] = textarea.value;
        counter.textContent = textarea.value.length + ' / ' + q.maxLength;
        saveState();
        hideError(stepEl);
      });
    }

    qs('[data-continue]', stepEl).addEventListener('click', function () {
      if (!validateStep(q)) { showError(stepEl); return; }
      trackEvent('question_' + (index + 1) + '_completed');
      if (index < QUESTIONS.length - 1) {
        goToStep(index + 1);
      } else {
        finalizeApplication();
      }
    });
  }

  function validateStep(q) {
    var val = state.answers[q.key];
    if (q.type === 'single') return !!val;
    if (q.type === 'multi') return Array.isArray(val) && val.length > 0;
    if (q.type === 'text') return typeof val === 'string' && val.trim().length >= 3;
    return true;
  }

  function showError(stepEl) {
    var err = qs('[data-error]', stepEl);
    if (err) err.hidden = false;
  }
  function hideError(stepEl) {
    var err = qs('[data-error]', stepEl);
    if (err) err.hidden = true;
  }

  function goToStep(index) {
    renderStep(index, true);
  }

  function revealApplicationSection(silent) {
    var section = qs('#application-section');
    section.hidden = false;
    if (!silent) scrollToId('application-section');
  }

  function startApplication() {
    if (!state.applicationStarted) {
      state.applicationStarted = true;
      saveState();
      trackEvent('application_start');
    }
    revealApplicationSection(false);
    renderStep(Math.max(state.step, 0), false);
  }

  function finalizeApplication() {
    saveState();
    submitApplication();

    qs('#application-section').hidden = true;
    var transition = qs('#transition-section');
    transition.hidden = false;
    scrollToId('transition-section');

    setTimeout(function () {
      transition.hidden = true;
      showCalendlyStep();
    }, prefersReducedMotion() ? 200 : 1400);
  }

  // ------------------------------------------------------------------ calendly

  var calendlyScriptPromise = null;

  function loadCalendlyScript() {
    if (window.Calendly) return Promise.resolve();
    if (calendlyScriptPromise) return calendlyScriptPromise;
    calendlyScriptPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var s = document.createElement('script');
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      s.onload = function () {
        if (settled) return;
        if (window.Calendly) { settled = true; resolve(); }
        else { settled = true; reject(new Error('Calendly global manquant après chargement du script')); }
      };
      s.onerror = function () {
        if (settled) return;
        settled = true; reject(new Error('Échec de chargement du script Calendly'));
      };
      document.head.appendChild(s);
      setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('Timeout de chargement Calendly'));
      }, 8000);
    });
    return calendlyScriptPromise;
  }

  function buildCalendlyUrl() {
    var params = new URLSearchParams({
      hide_event_type_details: '1',
      hide_gdpr_banner: '1',
      primary_color: 'af8642',
      text_color: '15130f',
      background_color: 'fbf8f2',
    });
    return CALENDLY_URL + '?' + params.toString();
  }

  function initCalendlyWidget() {
    loadCalendlyScript().then(function () {
      var embedEl = qs('#calendly-embed');
      window.Calendly.initInlineWidget({
        url: buildCalendlyUrl(),
        parentElement: embedEl,
        utm: {
          utmCampaign: state.utm.campaign || undefined,
          utmSource: state.utm.source || undefined,
          utmMedium: state.utm.medium || undefined,
          // Ne jamais écraser un utm_content réel (attribution publicitaire) :
          // on ne s'en sert comme identifiant de candidature que s'il est vide.
          utmContent: state.utm.content || state.id,
          utmTerm: state.utm.term || undefined,
        },
      });
      qs('#calendly-loading').hidden = true;
    }).catch(function (e) {
      console.error('[vsl] Calendly indisponible', e);
      qs('#calendly-loading').hidden = true;
      qs('#calendly-fallback').hidden = false;
      qs('#calendly-fallback-link').href = buildCalendlyUrl();
    });
  }

  function showCalendlyStep() {
    if (!state.calendlyReached) {
      state.calendlyReached = true;
      saveState();
    }
    qs('#calendly-section').hidden = false;
    scrollToId('calendly-section');
    trackEvent('calendly_shown');
    initCalendlyWidget();
  }

  function showConfirmation() {
    qs('#calendly-section').hidden = true;
    var confirmation = qs('#confirmation-section');
    confirmation.hidden = false;
    scrollToId('confirmation-section');
  }

  function isCalendlyOrigin(origin) {
    try {
      var host = new URL(origin).hostname;
      return host === 'calendly.com' || (host.length > 13 && host.slice(-13) === '.calendly.com');
    } catch (e) { return false; }
  }

  function listenToCalendly() {
    window.addEventListener('message', function (e) {
      if (!isCalendlyOrigin(e.origin)) return;
      if (!e.data || typeof e.data !== 'object') return;
      var evt = e.data.event;
      if (typeof evt !== 'string' || evt.indexOf('calendly.') !== 0) return;

      if (evt === 'calendly.event_type_viewed') {
        trackEvent('calendly_event_type_viewed');
      } else if (evt === 'calendly.date_and_time_selected') {
        trackEvent('calendly_slot_selected');
      } else if (evt === 'calendly.event_scheduled') {
        state.booked = true;
        state.bookedAt = new Date().toISOString();
        saveState();
        trackEvent('booking_completed');
        showConfirmation();
      }
    });
  }

  // ------------------------------------------------------------------ restore on load

  function restoreUi() {
    if (state.booked) {
      qs('#confirmation-section').hidden = false;
      return;
    }
    if (state.calendlyReached) {
      qs('#calendly-section').hidden = false;
      trackEvent('calendly_shown');
      initCalendlyWidget();
      return;
    }
    if (state.applicationStarted && state.step >= 0) {
      revealApplicationSection(true);
      renderStep(Math.min(state.step, QUESTIONS.length - 1), false);
    }
  }

  // ------------------------------------------------------------------ misc UI

  function wireNav() {
    qsa('[data-scroll-to]').forEach(function (el) {
      el.addEventListener('click', function () { scrollToId(el.getAttribute('data-scroll-to')); });
    });
    qs('#start-application-btn').addEventListener('click', startApplication);
    var yearEl = qs('#footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  // ------------------------------------------------------------------ init

  function init() {
    captureUtm();
    trackEvent('page_view');
    wireNav();
    initVideo();
    listenToCalendly();
    restoreUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
