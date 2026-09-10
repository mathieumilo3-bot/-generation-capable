// tutorial.js
// Compatibility layer + Academy classic UI + reliable video replay.
(function (global) {
  'use strict';

  global.GCTuto = {
    start: function () {},
    startIfFirstVisit: function () {},
    hasSeen: function () { return true; },
    reset: function () {},
    close: function () {}
  };

  function addAcademyStyles() {
    if (document.getElementById('gc-academy-classic-styles')) return;
    var style = document.createElement('style');
    style.id = 'gc-academy-classic-styles';
    style.textContent = `
      #page-academie .gc-ac-wrap{max-width:860px;margin:0 auto;padding:28px 20px 80px}
      #page-academie .gc-ac-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:28px}
      #page-academie .gc-ac-kicker{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:7px}
      #page-academie .gc-ac-title{font-size:32px;line-height:1.12;font-weight:800;letter-spacing:-.035em;color:var(--t1)}
      #page-academie .gc-ac-progress{min-width:160px;text-align:right;color:var(--t3);font-size:12px;font-weight:600}
      #page-academie .gc-ac-progressbar{height:5px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:9px}
      #page-academie .gc-ac-progressbar>span{display:block;height:100%;background:var(--gold);border-radius:999px}
      #page-academie .gc-ac-list{border-top:1px solid var(--b)}
      #page-academie .gc-ac-row{width:100%;display:flex;align-items:center;gap:16px;padding:19px 2px;border:0;border-bottom:1px solid var(--b);background:transparent;color:inherit;text-align:left;cursor:pointer}
      #page-academie .gc-ac-row:hover{background:rgba(255,255,255,.025)}
      #page-academie .gc-ac-row:disabled{cursor:default;opacity:.42}
      #page-academie .gc-ac-num{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:0 0 38px;border:1px solid var(--b);color:var(--t2);font-size:12px;font-weight:800}
      #page-academie .gc-ac-row.is-done .gc-ac-num{border-color:rgba(48,209,88,.45);color:var(--green)}
      #page-academie .gc-ac-copy{min-width:0;flex:1}
      #page-academie .gc-ac-name{font-size:16px;font-weight:750;color:var(--t1);line-height:1.25}
      #page-academie .gc-ac-sub{font-size:12px;color:var(--t3);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #page-academie .gc-ac-meter{height:4px;max-width:260px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden;margin-top:9px}
      #page-academie .gc-ac-meter>span{display:block;height:100%;background:var(--gold);border-radius:999px}
      #page-academie .gc-ac-meta{display:flex;align-items:center;gap:10px;flex:0 0 auto;color:var(--t3);font-size:12px;font-weight:650}
      #page-academie .gc-ac-status{white-space:nowrap}
      #page-academie .gc-ac-chevron{font-size:20px;font-weight:300;color:var(--t3);line-height:1}
      #page-module-detail .mod-video-wrap{border-radius:14px;border-color:var(--b);margin-bottom:14px;background:var(--bg1);box-shadow:none}
      #page-module-detail .mod-video-wrap:hover{border-color:var(--bh);transform:none}
      #page-module-detail .mod-video-wrap .mod-video-thumb{position:relative}
      #page-module-detail .step-list{margin-top:24px}
      @media (max-width:640px){
        #page-academie .gc-ac-wrap{padding:22px 16px 64px}
        #page-academie .gc-ac-head{align-items:flex-start;flex-direction:column;margin-bottom:22px}
        #page-academie .gc-ac-progress{width:100%;text-align:left}
        #page-academie .gc-ac-title{font-size:30px}
        #page-academie .gc-ac-row{gap:12px;padding:17px 0}
        #page-academie .gc-ac-num{width:34px;height:34px;flex-basis:34px}
        #page-academie .gc-ac-name{font-size:15px}
        #page-academie .gc-ac-meta{gap:7px}
        #page-academie .gc-ac-status{font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function moduleList() {
    if (!global.MODULES) return [];
    return Object.keys(global.MODULES)
      .filter(function (k) { return /^\d+$/.test(k); })
      .map(function (k) { return global.MODULES[k]; })
      .filter(Boolean)
      .sort(function (a,b) { return parseInt(a.num,10) - parseInt(b.num,10); });
  }

  function esc(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function renderAcademyClassic() {
    var page = document.getElementById('page-academie');
    var mods = moduleList();
    if (!page || !mods.length) return false;

    var completed = mods.filter(function(m){ return m.status === 'done' || Number(m.pct) >= 100; }).length;
    var totalPct = Math.round(mods.reduce(function(sum,m){ return sum + Math.max(0, Math.min(100, Number(m.pct) || 0)); }, 0) / mods.length);
    var unlocked = !!(global.STATE && global.STATE.module1Validated);

    var rows = mods.map(function(m){
      var n = parseInt(m.num,10);
      var pct = Math.max(0, Math.min(100, Number(m.pct) || 0));
      var locked = n !== 1 && !unlocked;
      var done = m.status === 'done' || pct >= 100;
      var label = locked ? 'Verrouillé' : (done ? 'Terminé' : (pct > 0 ? 'En cours' : 'À commencer'));
      var sub = m.description || m.subtitle || (m.status === 'done' ? 'Module terminé' : 'Formation');
      return '<button class="gc-ac-row ' + (done ? 'is-done' : '') + '" type="button" ' + (locked ? 'disabled' : '') + ' data-gc-module="' + n + '">' +
        '<span class="gc-ac-num">' + (done ? '✓' : String(n).padStart(2,'0')) + '</span>' +
        '<span class="gc-ac-copy">' +
          '<span class="gc-ac-name">' + esc(m.title || ('Module ' + String(n).padStart(2,'0'))) + '</span>' +
          '<span class="gc-ac-sub">' + esc(sub) + '</span>' +
          '<span class="gc-ac-meter"><span style="width:' + pct + '%"></span></span>' +
        '</span>' +
        '<span class="gc-ac-meta"><span class="gc-ac-status">' + label + (pct > 0 && !done ? ' · ' + pct + '%' : '') + '</span><span class="gc-ac-chevron">›</span></span>' +
      '</button>';
    }).join('');

    page.innerHTML = '<div class="gc-ac-wrap">' +
      '<div class="gc-ac-head">' +
        '<div><div class="gc-ac-kicker">Académie</div><div class="gc-ac-title">Ton parcours</div></div>' +
        '<div class="gc-ac-progress"><div>' + completed + ' / ' + mods.length + ' modules terminés</div><div class="gc-ac-progressbar"><span style="width:' + totalPct + '%"></span></div></div>' +
      '</div>' +
      '<div class="gc-ac-list">' + rows + '</div>' +
    '</div>';

    page.querySelectorAll('[data-gc-module]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var n = Number(btn.getAttribute('data-gc-module'));
        if (typeof global.openModPage === 'function') global.openModPage(n);
      });
    });
    return true;
  }

  function cleanModuleDetail() {
    var page = document.getElementById('page-module-detail');
    if (!page) return;
    page.querySelectorAll('.mod-video-wrap').forEach(function(card){
      card.querySelectorAll('div').forEach(function(el){
        if (el.textContent && el.textContent.trim().toLowerCase() === 'undefined') {
          el.textContent = 'Durée non renseignée';
        }
      });
    });
  }

  function installReliableVideoReplay() {
    if (typeof global.openVideo !== 'function' || global.openVideo.__gcReliableReplay) return false;
    var original = global.openVideo;

    function openVideoReplay(modNum, vidIdx) {
      var m = global.MODULES && global.MODULES[modNum];
      var v = m && m.videos && m.videos[vidIdx];
      if (!v) return;

      // A YouTube-backed video has a real player and is always replayable.
      if (v.yt && typeof global.openYouTubePlayer === 'function') {
        return global.openYouTubePlayer(v.yt, v.t, v.dur || '', modNum, vidIdx);
      }

      // The legacy simulated player needs a duration. Never call it with an
      // undefined duration: that is what produced the visible "undefined" /
      // broken replay state in Module 01.
      if (!v.dur) {
        if (typeof global.toast === 'function') global.toast('Cette vidéo n’a pas encore de source de lecture configurée.');
        return;
      }

      var wasDone = !!v.done;
      if (wasDone) v.done = false;
      try {
        return original.call(this, modNum, vidIdx);
      } finally {
        v.done = wasDone;
      }
    }

    openVideoReplay.__gcReliableReplay = true;
    global.openVideo = openVideoReplay;
    return true;
  }

  function boot() {
    addAcademyStyles();
    renderAcademyClassic();
    installReliableVideoReplay();
    var attempts = 0;
    var timer = global.setInterval(function(){
      attempts++;
      var rendered = renderAcademyClassic();
      installReliableVideoReplay();
      cleanModuleDetail();
      if (rendered || attempts >= 10) global.clearInterval(timer);
    }, 500);
    global.setTimeout(function(){ cleanModuleDetail(); }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window);
