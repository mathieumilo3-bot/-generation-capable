// tutorial.js
// Academy compatibility + simple module/video UI.
(function (global) {
  'use strict';

  global.GCTuto = {
    start: function () {},
    startIfFirstVisit: function () {},
    hasSeen: function () { return true; },
    reset: function () {},
    close: function () {}
  };

  function getModules() {
    try {
      if (typeof MODULES !== 'undefined' && MODULES) return MODULES;
    } catch (e) {}
    return global.MODULES || {};
  }

  function getState() {
    try {
      if (typeof STATE !== 'undefined' && STATE) return STATE;
    } catch (e) {}
    return global.STATE || {};
  }

  function esc(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function addStyles() {
    if (document.getElementById('gc-academy-simple-styles')) return;
    var style = document.createElement('style');
    style.id = 'gc-academy-simple-styles';
    style.textContent = `
      #page-academie .gc-ac-wrap{max-width:860px;margin:0 auto;padding:28px 20px 80px}
      #page-academie .gc-ac-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:26px}
      #page-academie .gc-ac-kicker{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:7px}
      #page-academie .gc-ac-title{font-size:32px;line-height:1.12;font-weight:800;letter-spacing:-.035em;color:var(--t1)}
      #page-academie .gc-ac-progress{min-width:170px;text-align:right;color:var(--t3);font-size:12px;font-weight:600}
      #page-academie .gc-ac-progressbar{height:4px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:8px}
      #page-academie .gc-ac-progressbar>span{display:block;height:100%;background:var(--gold);border-radius:999px}
      #page-academie .gc-ac-list{border-top:1px solid var(--b)}
      #page-academie .gc-ac-row{width:100%;display:flex;align-items:center;gap:14px;padding:18px 2px;border:0;border-bottom:1px solid var(--b);background:transparent;color:inherit;text-align:left;cursor:pointer;font-family:inherit}
      #page-academie .gc-ac-row:hover{background:rgba(255,255,255,.025)}
      #page-academie .gc-ac-row:disabled{cursor:default;opacity:.42}
      #page-academie .gc-ac-num{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:0 0 36px;border:1px solid var(--b);color:var(--t2);font-size:12px;font-weight:800}
      #page-academie .gc-ac-row.is-done .gc-ac-num{border-color:rgba(48,209,88,.45);color:var(--green)}
      #page-academie .gc-ac-copy{min-width:0;flex:1}
      #page-academie .gc-ac-name{font-size:16px;font-weight:750;color:var(--t1);line-height:1.25}
      #page-academie .gc-ac-sub{font-size:12px;color:var(--t3);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #page-academie .gc-ac-meter{height:3px;max-width:260px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden;margin-top:9px}
      #page-academie .gc-ac-meter>span{display:block;height:100%;background:var(--gold);border-radius:999px}
      #page-academie .gc-ac-meta{display:flex;align-items:center;gap:8px;flex:0 0 auto;color:var(--t3);font-size:12px;font-weight:650}
      #page-academie .gc-ac-chevron{font-size:20px;font-weight:300;color:var(--t3);line-height:1}

      #page-module-detail .gc-simple-wrap{max-width:860px;margin:0 auto;padding:28px 20px 80px}
      #page-module-detail .gc-simple-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:28px}
      #page-module-detail .gc-simple-ey{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:6px}
      #page-module-detail .gc-simple-title{font-size:30px;font-weight:800;letter-spacing:-.035em;line-height:1.15}
      #page-module-detail .gc-simple-badge{font-size:11px;font-weight:750;color:var(--green);white-space:nowrap}
      #page-module-detail .gc-simple-section{margin-top:28px}
      #page-module-detail .gc-simple-section-title{font-size:18px;font-weight:800;margin-bottom:12px}
      #page-module-detail .gc-video-list{display:flex;flex-direction:column;gap:10px}
      #page-module-detail .gc-video-row{display:flex;align-items:center;gap:13px;width:100%;padding:14px 15px;border:1px solid var(--b);border-radius:12px;background:var(--bg1);cursor:pointer;text-align:left;color:inherit;font-family:inherit}
      #page-module-detail .gc-video-row:hover{border-color:var(--bh)}
      #page-module-detail .gc-video-play{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:0 0 38px;background:rgba(41,151,255,.12);border:1px solid rgba(41,151,255,.25);color:var(--blue);font-size:14px}
      #page-module-detail .gc-video-row.is-done .gc-video-play{background:rgba(48,209,88,.12);border-color:rgba(48,209,88,.28);color:var(--green)}
      #page-module-detail .gc-video-copy{min-width:0;flex:1}
      #page-module-detail .gc-video-title{font-size:14px;font-weight:750;line-height:1.3}
      #page-module-detail .gc-video-desc{font-size:11.5px;color:var(--t3);margin-top:4px;line-height:1.4}
      #page-module-detail .gc-video-state{font-size:11px;color:var(--t3);white-space:nowrap}
      #page-module-detail .gc-resource{display:flex;align-items:center;gap:12px;padding:14px 15px;border:1px solid var(--b);border-radius:12px;background:var(--bg1);text-decoration:none;color:inherit;width:100%;cursor:pointer;text-align:left;font-family:inherit}
      #page-module-detail .gc-resource:hover{border-color:var(--bh)}
      #page-module-detail .gc-resource-icon{font-size:20px;flex:0 0 auto}
      #page-module-detail .gc-resource-copy{min-width:0;flex:1}
      #page-module-detail .gc-resource-title{font-size:13px;font-weight:750}
      #page-module-detail .gc-resource-desc{font-size:11px;color:var(--t3);margin-top:3px}
      #page-module-detail .gc-resource-action{font-size:11px;font-weight:700;color:var(--gold);white-space:nowrap}
      #page-module-detail .gc-empty{font-size:13px;color:var(--t3);padding:16px 0}
      #page-module-detail .gc-flow-back{display:inline-flex;align-items:center;gap:7px;margin:0 0 22px;border:1px solid var(--b);background:rgba(255,255,255,.04);color:var(--t2);border-radius:10px;padding:9px 13px;font:600 12px inherit;cursor:pointer}
      #page-module-detail .gc-flow-back:hover{border-color:var(--bh);color:var(--t1)}
      #page-module-detail .gc-flow-nav{display:flex;gap:10px;margin-top:34px;padding-top:20px;border-top:1px solid var(--b)}
      #page-module-detail .gc-flow-nav button{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--b);background:var(--bg1);color:var(--t1);border-radius:11px;padding:13px 12px;font:650 12px inherit;cursor:pointer}
      #page-module-detail .gc-flow-nav button:hover{border-color:var(--bh);background:var(--bg2)}
      #page-module-detail .gc-flow-nav button:disabled{opacity:.28;cursor:default}
      #page-module-detail .gc-flow-nav .gc-flow-next{border-color:rgba(201,168,76,.28);color:var(--gold2)}
      @media(max-width:640px){
        #page-academie .gc-ac-wrap,#page-module-detail .gc-simple-wrap{padding:22px 16px 64px}
        #page-academie .gc-ac-head{align-items:flex-start;flex-direction:column;margin-bottom:20px}
        #page-academie .gc-ac-progress{width:100%;text-align:left}
        #page-academie .gc-ac-title{font-size:30px}
        #page-academie .gc-ac-row{gap:11px;padding:16px 0}
        #page-academie .gc-ac-name{font-size:15px}
        #page-academie .gc-ac-meta{gap:5px;font-size:11px}
        #page-module-detail .gc-simple-head{align-items:flex-start}
        #page-module-detail .gc-simple-title{font-size:27px}
        #page-module-detail .gc-video-row{padding:13px}
        #page-module-detail .gc-video-state{display:none}
        #page-module-detail .gc-flow-nav button{padding:12px 8px;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function moduleList() {
    var source = getModules();
    if (!source || typeof source !== 'object') return [];
    return Object.keys(source)
      .filter(function (k) { return /^\d+$/.test(k); })
      .map(function (k) { return source[k]; })
      .filter(Boolean)
      .sort(function (a,b) { return parseInt(a.num,10) - parseInt(b.num,10); });
  }

  function renderAcademyClassic() {
    var page = document.getElementById('page-academie');
    var mods = moduleList();
    if (!page || !mods.length) return false;

    var completed = mods.filter(function(m){ return m.status === 'done' || Number(m.pct) >= 100; }).length;
    var totalPct = Math.round(mods.reduce(function(sum,m){ return sum + Math.max(0, Math.min(100, Number(m.pct) || 0)); }, 0) / mods.length);
    var state = getState();
    var unlocked = !!(state && state.module1Validated);

    var rows = mods.map(function(m){
      var n = parseInt(m.num,10);
      var pct = Math.max(0, Math.min(100, Number(m.pct) || 0));
      var locked = n !== 1 && !unlocked;
      var done = m.status === 'done' || pct >= 100;
      var label = locked ? 'Verrouillé' : (done ? 'Terminé' : (pct > 0 ? 'En cours' : 'À commencer'));
      return '<button class="gc-ac-row ' + (done ? 'is-done' : '') + '" type="button" ' + (locked ? 'disabled' : '') + ' data-gc-module="' + n + '">' +
        '<span class="gc-ac-num">' + (done ? '✓' : String(n).padStart(2,'0')) + '</span>' +
        '<span class="gc-ac-copy"><span class="gc-ac-name">' + esc(m.title || ('Module ' + String(n).padStart(2,'0'))) + '</span>' +
        '<span class="gc-ac-sub">' + esc(m.description || m.subtitle || '') + '</span>' +
        '<span class="gc-ac-meter"><span style="width:' + pct + '%"></span></span></span>' +
        '<span class="gc-ac-meta"><span>' + label + (pct > 0 && !done ? ' · ' + pct + '%' : '') + '</span><span class="gc-ac-chevron">›</span></span></button>';
    }).join('');

    page.innerHTML = '<div class="gc-ac-wrap"><div class="gc-ac-head"><div><div class="gc-ac-kicker">Académie</div><div class="gc-ac-title">Ton parcours</div></div>' +
      '<div class="gc-ac-progress"><div>' + completed + ' / ' + mods.length + ' modules terminés</div><div class="gc-ac-progressbar"><span style="width:' + totalPct + '%"></span></div></div></div>' +
      '<div class="gc-ac-list">' + rows + '</div></div>';

    page.querySelectorAll('[data-gc-module]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var n = Number(btn.getAttribute('data-gc-module'));
        if (typeof global.openModPage === 'function') global.openModPage(n);
      });
    });
    return true;
  }

  function renderSimpleModule(num) {
    var page = document.getElementById('mod-detail-content');
    var m = getModules()[num];
    if (!page || !m) return false;

    var videos = Array.isArray(m.videos) ? m.videos : [];
    var fiches = Array.isArray(m.fiches) ? m.fiches : [];
    var seen = videos.filter(function(v){ return !!v.done; }).length;

    var videoHtml = videos.map(function(v, i){
      var hasSource = !!v.yt || !!v.dur;
      return '<button type="button" class="gc-video-row ' + (v.done ? 'is-done' : '') + '" data-gc-video="' + i + '">' +
        '<span class="gc-video-play">' + (hasSource ? '▶' : '—') + '</span>' +
        '<span class="gc-video-copy"><span class="gc-video-title">' + esc(v.t || 'Vidéo') + '</span>' +
        '<span class="gc-video-desc">' + esc(v.desc || '') + '</span></span>' +
        '<span class="gc-video-state">' + (v.done ? 'Vu ✓' : (hasSource ? 'Regarder' : 'Bientôt')) + '</span></button>';
    }).join('');

    var resourceHtml = fiches.map(function(f){
      var hasUrl = !!(f.url && f.url.length);
      return '<button type="button" class="gc-resource" data-gc-resource="' + (hasUrl ? '1' : '0') + '" data-gc-resource-url="' + esc(f.url || '') + '" data-gc-resource-name="' + esc(f.t || 'Ressource') + '">' +
        '<span class="gc-resource-icon">' + esc(f.ico || '📄') + '</span><span class="gc-resource-copy"><span class="gc-resource-title">' + esc(f.t || 'Ressource') + '</span><span class="gc-resource-desc">' + esc(f.d || '') + '</span></span><span class="gc-resource-action">' + (hasUrl ? 'Ouvrir →' : 'Bientôt') + '</span></button>';
    }).join('');

    page.innerHTML = '<div class="gc-simple-wrap">' +
      '<div class="gc-simple-head"><div><div class="gc-simple-ey">Module ' + esc(m.num) + '</div><div class="gc-simple-title">' + esc(m.title) + '</div></div><div class="gc-simple-badge">' + seen + '/' + videos.length + ' vus</div></div>' +
      '<div class="gc-simple-section"><div class="gc-simple-section-title">Vidéos</div><div class="gc-video-list">' + (videoHtml || '<div class="gc-empty">Aucune vidéo pour ce module.</div>') + '</div></div>' +
      (fiches.length ? '<div class="gc-simple-section"><div class="gc-simple-section-title">Ressource essentielle</div><div class="gc-video-list">' + resourceHtml + '</div></div>' : '') +
      '</div>';

    page.querySelectorAll('[data-gc-video]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = Number(btn.getAttribute('data-gc-video'));
        var v = videos[idx];
        if (!v) return;
        if (v.yt && typeof global.openYouTubePlayer === 'function') {
          global.openYouTubePlayer(v.yt, v.t, v.dur || '', num, idx);
          return;
        }
        if (v.dur && typeof global.openVideo === 'function') {
          global.openVideo(num, idx);
          return;
        }
        if (typeof global.toast === 'function') global.toast('Cette vidéo n’a pas encore de source de lecture.');
      });
    });

    page.querySelectorAll('[data-gc-resource]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var url = btn.getAttribute('data-gc-resource-url');
        var name = btn.getAttribute('data-gc-resource-name') || 'Ressource';
        if (url && typeof global.openPDF === 'function') {
          global.openPDF(url, name + '.pdf');
        } else if (typeof global.toast === 'function') {
          global.toast('Ressource disponible prochainement');
        }
      });
    });

    return true;
  }

  function installModulePage() {
    if (typeof global.openModPage !== 'function' || global.openModPage.__gcSimpleModule) return false;
    var original = global.openModPage;

    function simpleOpenModPage(num) {
      var state = getState();
      if (num !== 1 && !state.module1Validated) {
        if (typeof global.openGateModal === 'function') global.openGateModal();
        if (typeof global.toast === 'function') global.toast('🔑 Termine le Module 01 pour débloquer la suite');
        return;
      }
      var m = getModules()[num];
      if (!m) return;
      if (m.locked) {
        return original.call(this, num);
      }
      var title = document.getElementById('mod-detail-title');
      var sub = document.getElementById('mod-detail-sub');
      var badge = document.getElementById('mod-detail-badge');
      if (title) title.textContent = 'Module ' + m.num;
      if (sub) sub.textContent = '— ' + m.title;
      if (badge) badge.textContent = m.status === 'done' ? '✓ Validé' : (m.status === 'cur' ? 'En cours · ' + (m.pct || 0) + '%' : '');
      renderSimpleModule(num);
      if (typeof global.go === 'function') global.go('module-detail', null);
      global.scrollTo(0, 0);
      global.setTimeout(function(){ renderModuleNavigation(num); }, 0);
    }

    simpleOpenModPage.__gcSimpleModule = true;
    global.openModPage = simpleOpenModPage;
    return true;
  }

  function renderModuleNavigation(num) {
    var page = document.getElementById('mod-detail-content');
    if (!page) return;
    var mods = moduleList();
    var index = mods.findIndex(function(m){ return parseInt(m.num,10) === Number(num); });
    if (index < 0) return;

    var oldBack = page.querySelector('.gc-flow-back');
    if (oldBack) oldBack.remove();
    var oldNav = page.querySelector('.gc-flow-nav');
    if (oldNav) oldNav.remove();

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'gc-flow-back';
    back.textContent = '‹  Tous les modules';
    back.addEventListener('click', function(){
      if (typeof global.go === 'function') global.go('academie', null);
      global.scrollTo(0, 0);
    });
    page.insertBefore(back, page.firstChild);

    var nav = document.createElement('div');
    nav.className = 'gc-flow-nav';

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.textContent = index > 0 ? '‹  Module ' + mods[index - 1].num : '‹  Début';
    prev.disabled = index === 0;
    prev.addEventListener('click', function(){
      if (index > 0 && typeof global.openModPage === 'function') global.openModPage(parseInt(mods[index - 1].num,10));
    });

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'gc-flow-next';
    next.textContent = index < mods.length - 1 ? 'Module ' + mods[index + 1].num + '  ›' : 'Fin  ›';
    next.disabled = index === mods.length - 1;
    next.addEventListener('click', function(){
      if (index < mods.length - 1 && typeof global.openModPage === 'function') global.openModPage(parseInt(mods[index + 1].num,10));
    });

    nav.appendChild(prev);
    nav.appendChild(next);
    page.appendChild(nav);
  }

  function installReliableVideoReplay() {
    if (typeof global.openVideo !== 'function' || global.openVideo.__gcReliableReplay) return false;
    var original = global.openVideo;

    function replay(modNum, vidIdx) {
      var m = getModules()[modNum];
      var v = m && m.videos && m.videos[vidIdx];
      if (!v) return;
      if (v.yt && typeof global.openYouTubePlayer === 'function') {
        return global.openYouTubePlayer(v.yt, v.t, v.dur || '', modNum, vidIdx);
      }
      if (!v.dur) {
        if (typeof global.toast === 'function') global.toast('Cette vidéo n’a pas encore de source de lecture.');
        return;
      }
      var wasDone = !!v.done;
      if (wasDone) v.done = false;
      try { return original.call(this, modNum, vidIdx); }
      finally { v.done = wasDone; }
    }

    replay.__gcReliableReplay = true;
    global.openVideo = replay;
    return true;
  }

  function boot() {
    addStyles();
    installModulePage();
    installReliableVideoReplay();

    if (typeof global.renderGameMap === 'function' && !global.renderGameMap.__gcClassicAcademy) {
      global.renderGameMap = function(){ renderAcademyClassic(); };
      global.renderGameMap.__gcClassicAcademy = true;
    }

    renderAcademyClassic();

    var attempts = 0;
    var timer = global.setInterval(function(){
      attempts++;
      installModulePage();
      installReliableVideoReplay();
      var rendered = renderAcademyClassic();
      if (rendered || attempts >= 120) global.clearInterval(timer);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window);
