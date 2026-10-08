// tutorial.js
//
// Visite guidée pas-à-pas, partagée par les trois espaces (site vendeur,
// espace ambassadeur, back-office). Met en surbrillance un élément réel de
// la page, pointe une flèche dessus et explique à quoi il sert.
//
// POURQUOI UN FICHIER PARTAGÉ
//   Les trois interfaces ont des styles très différents mais le même besoin.
//   Dupliquer le mécanisme trois fois aurait garanti trois comportements
//   divergents au premier correctif. Ici chaque page ne fournit que le
//   CONTENU de ses étapes ; toute la mécanique (positionnement, découpe,
//   navigation, mémorisation) est commune.
//
// UTILISATION
//   GCTuto.start({
//     id: 'ambassadeur',                  // clé de mémorisation
//     steps: [
//       { el: '[data-tuto="lien"]',       // sélecteur CSS (ou null = centré)
//         title: 'Ton lien',
//         text: 'Partage-le dans ta bio.',
//         before: () => goScreen('today') // optionnel : préparer la page
//       },
//     ]
//   });
//
//   GCTuto.startIfFirstVisit({...})  → ne s'ouvre qu'une fois, au premier
//                                       passage (mémorisé en localStorage)
//   GCTuto.reset('ambassadeur')      → permet de le rejouer

(function (global) {
  'use strict';

  var SEEN_PREFIX = 'gc_tuto_seen_';
  var state = null; // { steps, index, id, onDone }

  // ── Styles injectés une seule fois ────────────────────────────────────
  // Volontairement autonomes : le tutoriel doit s'afficher pareil sur les
  // trois sites, sans dépendre de leurs feuilles de style respectives.
  function injectStyles() {
    if (document.getElementById('gc-tuto-styles')) return;
    var css = [
      '.gc-tuto-mask{position:fixed;inset:0;z-index:99990;pointer-events:auto;',
        'background:rgba(0,0,0,.74);transition:clip-path .3s ease}',
      '.gc-tuto-ring{position:fixed;z-index:99991;border:2px solid #C9A84C;border-radius:12px;',
        'box-shadow:0 0 0 4px rgba(201,168,76,.22);pointer-events:none;transition:all .3s ease}',
      '.gc-tuto-arrow{position:fixed;z-index:99992;font-size:30px;line-height:1;pointer-events:none;',
        'transition:all .3s ease;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));animation:gcTutoBob 1.1s ease-in-out infinite}',
      '@keyframes gcTutoBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
      '.gc-tuto-box{position:fixed;z-index:99993;max-width:330px;width:calc(100vw - 32px);',
        'background:#141414;border:1px solid rgba(201,168,76,.4);border-radius:14px;padding:17px 18px;',
        'box-shadow:0 14px 44px rgba(0,0,0,.66);transition:all .3s ease;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '.gc-tuto-step{font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#8B6914;margin-bottom:7px}',
      '.gc-tuto-title{font-size:16px;font-weight:800;color:#F0D080;margin-bottom:7px;line-height:1.3}',
      '.gc-tuto-text{font-size:13.5px;color:#c9c2b6;line-height:1.55}',
      '.gc-tuto-nav{display:flex;gap:8px;align-items:center;margin-top:15px}',
      '.gc-tuto-btn{border:none;border-radius:9px;padding:10px 15px;font-size:13px;font-weight:700;',
        'cursor:pointer;font-family:inherit;flex:1}',
      '.gc-tuto-next{background:linear-gradient(135deg,#F0D080,#C9A84C);color:#1a1400}',
      '.gc-tuto-prev{background:rgba(255,255,255,.07);color:#a8a090;flex:0 0 auto;padding:10px 13px}',
      '.gc-tuto-skip{background:none;border:none;color:#6e6860;font-size:12px;cursor:pointer;',
        'text-decoration:underline;font-family:inherit;padding:4px;flex:0 0 auto}',
      '.gc-tuto-dots{display:flex;gap:5px;justify-content:center;margin-top:12px}',
      '.gc-tuto-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18)}',
      '.gc-tuto-dot.on{background:#C9A84C;width:16px;border-radius:3px}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'gc-tuto-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function el(id) { return document.getElementById(id); }

  function buildDom() {
    injectStyles();
    if (el('gc-tuto-mask')) return;

    var mask = document.createElement('div');
    mask.id = 'gc-tuto-mask';
    mask.className = 'gc-tuto-mask';
    // Un clic sur le fond ne ferme pas : sur mobile, on ferme trop souvent
    // par accident en visant un bouton.
    mask.addEventListener('click', function (e) { e.stopPropagation(); });

    var ring = document.createElement('div');
    ring.id = 'gc-tuto-ring';
    ring.className = 'gc-tuto-ring';

    var arrow = document.createElement('div');
    arrow.id = 'gc-tuto-arrow';
    arrow.className = 'gc-tuto-arrow';

    var box = document.createElement('div');
    box.id = 'gc-tuto-box';
    box.className = 'gc-tuto-box';

    document.body.appendChild(mask);
    document.body.appendChild(ring);
    document.body.appendChild(arrow);
    document.body.appendChild(box);
  }

  function destroyDom() {
    ['gc-tuto-mask', 'gc-tuto-ring', 'gc-tuto-arrow', 'gc-tuto-box'].forEach(function (id) {
      var n = el(id);
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  // ── Placement ─────────────────────────────────────────────────────────
  // La bulle se met sous la cible s'il y a la place, sinon au-dessus, sinon
  // centrée. La flèche pointe toujours vers la cible depuis le bon côté.
  function positionFor(target) {
    var mask = el('gc-tuto-mask');
    var ring = el('gc-tuto-ring');
    var arrow = el('gc-tuto-arrow');
    var box = el('gc-tuto-box');
    if (!mask || !box) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;

    if (!target) {
      // Étape sans cible : bulle centrée, pas de découpe ni de flèche.
      mask.style.clipPath = '';
      ring.style.opacity = '0';
      arrow.style.opacity = '0';
      box.style.left = Math.max(16, (vw - box.offsetWidth) / 2) + 'px';
      box.style.top = Math.max(16, (vh - box.offsetHeight) / 2) + 'px';
      return;
    }

    var r = target.getBoundingClientRect();
    var pad = 6;
    var x = Math.max(0, r.left - pad);
    var y = Math.max(0, r.top - pad);
    var w = Math.min(vw, r.width + pad * 2);
    var h = Math.min(vh, r.height + pad * 2);

    // Découpe le voile pour laisser l'élément visible en clair.
    mask.style.clipPath =
      'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,' +
      x + 'px ' + y + 'px,' +
      x + 'px ' + (y + h) + 'px,' +
      (x + w) + 'px ' + (y + h) + 'px,' +
      (x + w) + 'px ' + y + 'px,' +
      x + 'px ' + y + 'px)';

    ring.style.opacity = '1';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.width = w + 'px';
    ring.style.height = h + 'px';

    var boxH = box.offsetHeight || 190;
    var boxW = box.offsetWidth || 320;
    var spaceBelow = vh - (y + h);
    var below = spaceBelow > boxH + 70;

    var boxTop = below ? (y + h + 46) : Math.max(12, y - boxH - 46);
    var boxLeft = Math.min(Math.max(16, r.left + r.width / 2 - boxW / 2), vw - boxW - 16);

    box.style.top = boxTop + 'px';
    box.style.left = boxLeft + 'px';

    arrow.style.opacity = '1';
    arrow.textContent = below ? '⬆️' : '⬇️';
    arrow.style.left = Math.min(Math.max(14, r.left + r.width / 2 - 15), vw - 44) + 'px';
    arrow.style.top = (below ? (y + h + 6) : (y - 40)) + 'px';
  }

  function render() {
    if (!state) return;
    var step = state.steps[state.index];
    var box = el('gc-tuto-box');
    if (!box) return;

    var isLast = state.index === state.steps.length - 1;
    var dots = state.steps.map(function (_, i) {
      return '<div class="gc-tuto-dot' + (i === state.index ? ' on' : '') + '"></div>';
    }).join('');

    box.innerHTML =
      '<div class="gc-tuto-step">Étape ' + (state.index + 1) + ' sur ' + state.steps.length + '</div>' +
      '<div class="gc-tuto-title">' + escapeHtml(step.title || '') + '</div>' +
      '<div class="gc-tuto-text">' + escapeHtml(step.text || '') + '</div>' +
      '<div class="gc-tuto-nav">' +
        (state.index > 0 ? '<button class="gc-tuto-btn gc-tuto-prev" id="gc-tuto-prev">←</button>' : '') +
        '<button class="gc-tuto-btn gc-tuto-next" id="gc-tuto-next">' +
          (isLast ? 'C\'est parti 🚀' : 'Suivant') +
        '</button>' +
        (!isLast ? '<button class="gc-tuto-skip" id="gc-tuto-skip">Passer</button>' : '') +
      '</div>' +
      '<div class="gc-tuto-dots">' + dots + '</div>';

    var next = el('gc-tuto-next');
    var prev = el('gc-tuto-prev');
    var skip = el('gc-tuto-skip');
    if (next) next.onclick = function () { go(state.index + 1); };
    if (prev) prev.onclick = function () { go(state.index - 1); };
    if (skip) skip.onclick = function () { finish(); };

    // Prépare l'écran si l'étape le demande (changer d'onglet par exemple),
    // puis attend que le DOM ait bougé avant de mesurer la cible.
    if (typeof step.before === 'function') {
      try { step.before(); } catch (e) { console.error('[tuto] before()', e); }
    }

    setTimeout(function () {
      var target = step.el ? document.querySelector(step.el) : null;
      if (target) {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        catch (e) { target.scrollIntoView(); }
      }
      // Laisse le défilement se terminer avant de figer les positions,
      // sinon la flèche pointe l'ancienne position de l'élément.
      setTimeout(function () { positionFor(target); }, target ? 340 : 0);
    }, step.before ? 130 : 0);
  }

  function go(i) {
    if (!state) return;
    if (i < 0) return;
    if (i >= state.steps.length) return finish();
    state.index = i;
    render();
  }

  function finish() {
    if (!state) return;
    var id = state.id;
    var onDone = state.onDone;
    state = null;
    destroyDom();
    window.removeEventListener('resize', onViewportChange);
    if (id) {
      try { localStorage.setItem(SEEN_PREFIX + id, '1'); } catch (e) {}
    }
    if (typeof onDone === 'function') onDone();
  }

  function onViewportChange() {
    if (!state) return;
    var step = state.steps[state.index];
    positionFor(step && step.el ? document.querySelector(step.el) : null);
  }

  function start(opts) {
    if (!opts || !opts.steps || !opts.steps.length) return;
    // Ne garde que les étapes dont la cible existe réellement : une page qui
    // n'affiche pas encore une section (droits, données absentes) ne doit pas
    // bloquer le tutoriel sur une flèche pointant dans le vide.
    var steps = opts.steps.filter(function (s) {
      return !s.el || document.querySelector(s.el) || s.keepIfMissing;
    });
    if (!steps.length) return;

    buildDom();
    state = { steps: steps, index: 0, id: opts.id || null, onDone: opts.onDone || null };
    window.addEventListener('resize', onViewportChange);
    render();
  }

  function hasSeen(id) {
    try { return localStorage.getItem(SEEN_PREFIX + id) === '1'; }
    catch (e) { return false; }
  }

  function startIfFirstVisit(opts) {
    if (!opts || !opts.id) return;
    if (hasSeen(opts.id)) return;
    start(opts);
  }

  function reset(id) {
    try { localStorage.removeItem(SEEN_PREFIX + id); } catch (e) {}
  }

  global.GCTuto = {
    start: start,
    startIfFirstVisit: startIfFirstVisit,
    hasSeen: hasSeen,
    reset: reset,
    close: finish
  };
})(window);
