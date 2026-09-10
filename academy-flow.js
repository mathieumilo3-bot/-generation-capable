// Academy flow: explicit back-to-Academy + previous/next module navigation.
(function (global) {
  'use strict';

  function moduleList() {
    var source = global.MODULES;
    if (!source || typeof source !== 'object') return [];
    return Object.keys(source)
      .filter(function (k) { return /^\d+$/.test(k); })
      .map(function (k) { return source[k]; })
      .filter(Boolean)
      .sort(function (a, b) { return parseInt(a.num, 10) - parseInt(b.num, 10); });
  }

  function installStyles() {
    if (document.getElementById('gc-academy-flow-styles')) return;
    var style = document.createElement('style');
    style.id = 'gc-academy-flow-styles';
    style.textContent = `
      #page-module-detail .gc-flow-back{
        display:inline-flex;align-items:center;gap:7px;margin:0 0 22px;
        border:1px solid var(--b);background:rgba(255,255,255,.04);color:var(--t2);
        border-radius:10px;padding:9px 13px;font:600 12px inherit;cursor:pointer
      }
      #page-module-detail .gc-flow-back:hover{border-color:var(--bh);color:var(--t1)}
      #page-module-detail .gc-flow-nav{
        display:flex;gap:10px;margin-top:34px;padding-top:20px;border-top:1px solid var(--b)
      }
      #page-module-detail .gc-flow-nav button{
        flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;
        border:1px solid var(--b);background:var(--bg1);color:var(--t1);border-radius:11px;
        padding:13px 12px;font:650 12px inherit;cursor:pointer
      }
      #page-module-detail .gc-flow-nav button:hover{border-color:var(--bh);background:var(--bg2)}
      #page-module-detail .gc-flow-nav button:disabled{opacity:.28;cursor:default}
      #page-module-detail .gc-flow-nav .gc-flow-next{border-color:rgba(201,168,76,.28);color:var(--gold2)}
      @media(max-width:640px){
        #page-module-detail .gc-flow-nav button{padding:12px 8px;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  function goAcademy() {
    if (typeof global.go === 'function') global.go('academie', null);
    global.scrollTo(0, 0);
  }

  function renderFlow(num) {
    var page = document.getElementById('mod-detail-content');
    if (!page) return;
    var mods = moduleList();
    var index = mods.findIndex(function (m) { return parseInt(m.num, 10) === Number(num); });
    if (index < 0) return;

    var oldBack = page.querySelector('.gc-flow-back');
    if (oldBack) oldBack.remove();
    var oldNav = page.querySelector('.gc-flow-nav');
    if (oldNav) oldNav.remove();

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'gc-flow-back';
    back.textContent = '‹  Tous les modules';
    back.addEventListener('click', goAcademy);
    page.insertBefore(back, page.firstChild);

    var nav = document.createElement('div');
    nav.className = 'gc-flow-nav';

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.textContent = index > 0 ? '‹  Module ' + mods[index - 1].num : '‹  Début';
    prev.disabled = index === 0;
    prev.addEventListener('click', function () {
      if (index > 0 && typeof global.openModPage === 'function') global.openModPage(parseInt(mods[index - 1].num, 10));
    });

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'gc-flow-next';
    next.textContent = index < mods.length - 1 ? 'Module ' + mods[index + 1].num + '  ›' : 'Fin  ›';
    next.disabled = index === mods.length - 1;
    next.addEventListener('click', function () {
      if (index < mods.length - 1 && typeof global.openModPage === 'function') global.openModPage(parseInt(mods[index + 1].num, 10));
    });

    nav.appendChild(prev);
    nav.appendChild(next);
    page.appendChild(nav);
  }

  function install() {
    installStyles();
    if (typeof global.openModPage !== 'function' || global.openModPage.__gcFlowWrapped) return;
    var original = global.openModPage;
    function openWithFlow(num) {
      var result = original.call(this, num);
      global.setTimeout(function () { renderFlow(num); }, 0);
      return result;
    }
    openWithFlow.__gcFlowWrapped = true;
    global.openModPage = openWithFlow;
  }

  function boot() {
    install();
    global.setTimeout(install, 50);
    global.setTimeout(install, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(window);
