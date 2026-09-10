// tutorial.js
// Academy compatibility + condensed four-chapter flow.
(function(global){
  'use strict';

  global.GCTuto={start:function(){},startIfFirstVisit:function(){},hasSeen:function(){return true;},reset:function(){},close:function(){}};

  function getModules(){try{if(typeof MODULES!=='undefined'&&MODULES)return MODULES;}catch(e){}return global.MODULES||{};}
  function getState(){try{if(typeof STATE!=='undefined'&&STATE)return STATE;}catch(e){}return global.STATE||{};}
  function esc(v){if(typeof global.escapeHtml==='function')return global.escapeHtml(String(v==null?'':v));return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[c];});}

  // Temporary curriculum: the former Modules 04-06 are hidden, not deleted.
  // Former Module 07 becomes visible Chapter 04 so the learner sees one coherent 4-step path.
  var ACTIVE=[1,2,3,7];
  var DISPLAY={
    1:{num:'01',title:'Décision & Engagement'},
    2:{num:'02',title:'Mental & Discipline'},
    3:{num:'03',title:'Communication & Impact'},
    7:{num:'04',title:'Closing & Certitude'}
  };
  function activeModules(){var src=getModules();return ACTIVE.map(function(id){return src[id]||src[String(id)];}).filter(Boolean);}

  function addStyles(){
    if(document.getElementById('gc-academy-simple-styles'))return;
    var s=document.createElement('style');s.id='gc-academy-simple-styles';s.textContent=`
      #page-academie .gc-ac-wrap,#page-module-detail .gc-simple-wrap{max-width:860px;margin:0 auto;padding:28px 20px 80px}
      #page-academie .gc-ac-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:26px}
      #page-academie .gc-ac-kicker,#page-module-detail .gc-simple-ey{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:7px}
      #page-academie .gc-ac-title{font-size:32px;line-height:1.12;font-weight:800;letter-spacing:-.035em;color:var(--t1)}
      #page-academie .gc-ac-progress{min-width:170px;text-align:right;color:var(--t3);font-size:12px;font-weight:600}
      #page-academie .gc-ac-progressbar{height:4px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;margin-top:8px}.gc-ac-progressbar>span{display:block;height:100%;background:var(--gold);border-radius:999px}
      #page-academie .gc-ac-list{border-top:1px solid var(--b)}.gc-ac-row{width:100%;display:flex;align-items:center;gap:14px;padding:18px 2px;border:0;border-bottom:1px solid var(--b);background:transparent;color:inherit;text-align:left;cursor:pointer;font-family:inherit}.gc-ac-row:hover{background:rgba(255,255,255,.025)}.gc-ac-row:disabled{cursor:default;opacity:.42}
      .gc-ac-num{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:0 0 36px;border:1px solid var(--b);color:var(--t2);font-size:12px;font-weight:800}.gc-ac-row.is-done .gc-ac-num{border-color:rgba(48,209,88,.45);color:var(--green)}.gc-ac-copy{min-width:0;flex:1}.gc-ac-name{font-size:16px;font-weight:750;color:var(--t1);line-height:1.25}.gc-ac-sub{font-size:12px;color:var(--t3);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gc-ac-meter{height:3px;max-width:260px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden;margin-top:9px}.gc-ac-meter>span{display:block;height:100%;background:var(--gold);border-radius:999px}.gc-ac-meta{display:flex;align-items:center;gap:8px;flex:0 0 auto;color:var(--t3);font-size:12px;font-weight:650}.gc-ac-chevron{font-size:20px;color:var(--t3)}
      #page-module-detail .gc-simple-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:28px}.gc-simple-title{font-size:30px;font-weight:800;letter-spacing:-.035em;line-height:1.15}.gc-simple-badge{font-size:11px;font-weight:750;color:var(--green);white-space:nowrap}.gc-simple-section{margin-top:28px}.gc-simple-section-title{font-size:18px;font-weight:800;margin-bottom:12px}.gc-video-list{display:flex;flex-direction:column;gap:10px}
      .gc-flow-back{display:inline-flex;align-items:center;gap:7px;margin:0 0 22px;border:1px solid var(--b);background:rgba(255,255,255,.04);color:var(--t2);border-radius:10px;padding:9px 13px;font:600 12px inherit;cursor:pointer}.gc-video-row{display:flex;align-items:center;gap:13px;width:100%;padding:14px 15px;border:1px solid var(--b);border-radius:12px;background:var(--bg1);cursor:pointer;text-align:left;color:inherit;font-family:inherit}.gc-video-play{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:0 0 38px;background:rgba(41,151,255,.12);border:1px solid rgba(41,151,255,.25);color:var(--blue)}.gc-video-row.is-done .gc-video-play{background:rgba(48,209,88,.12);border-color:rgba(48,209,88,.28);color:var(--green)}.gc-video-copy{min-width:0;flex:1}.gc-video-title{font-size:14px;font-weight:750}.gc-video-desc{font-size:11.5px;color:var(--t3);margin-top:4px}.gc-video-state{font-size:11px;color:var(--t3);white-space:nowrap}
      .gc-resource{display:flex;align-items:center;gap:12px;width:100%;padding:14px 15px;border:1px solid var(--b);border-radius:12px;background:var(--bg1);color:inherit;cursor:pointer;text-align:left;font-family:inherit}.gc-resource-icon{font-size:20px}.gc-resource-copy{min-width:0;flex:1}.gc-resource-title{font-size:13px;font-weight:750}.gc-resource-desc{font-size:11px;color:var(--t3);margin-top:3px}.gc-resource-action{font-size:11px;font-weight:700;color:var(--gold);white-space:nowrap}.gc-empty{font-size:13px;color:var(--t3);padding:16px 0}
      #page-module-detail .gc-flow-nav{display:flex;gap:10px;margin-top:34px;padding-top:20px;border-top:1px solid var(--b)}.gc-flow-nav button{flex:1;border:1px solid var(--b);background:var(--bg1);color:var(--t1);border-radius:11px;padding:13px 12px;font:650 12px inherit;cursor:pointer}.gc-flow-nav button:disabled{opacity:.28;cursor:default}.gc-flow-nav .gc-flow-next{border-color:rgba(201,168,76,.28);color:var(--gold2)}
      @media(max-width:640px){#page-academie .gc-ac-wrap,#page-module-detail .gc-simple-wrap{padding:22px 16px 64px}.gc-ac-head{align-items:flex-start!important;flex-direction:column}.gc-ac-progress{width:100%;text-align:left!important}.gc-ac-title{font-size:30px!important}.gc-video-state{display:none}.gc-flow-nav button{padding:12px 8px;font-size:11px}}
    `;document.head.appendChild(s);
  }

  function renderAcademy(){
    var page=document.getElementById('page-academie'),mods=activeModules();if(!page||!mods.length)return false;
    var done=mods.filter(function(m){return m.status==='done'||Number(m.pct)>=100;}).length;
    var total=Math.round(mods.reduce(function(a,m){return a+Math.max(0,Math.min(100,Number(m.pct)||0));},0)/mods.length);
    var unlocked=!!getState().module1Validated;
    var rows=mods.map(function(m,i){var id=ACTIVE[i],d=DISPLAY[id],p=Math.max(0,Math.min(100,Number(m.pct)||0)),isDone=m.status==='done'||p>=100,locked=id!==1&&!unlocked;var label=locked?'Verrouillé':isDone?'Terminé':p?'En cours':'À commencer';return '<button class="gc-ac-row '+(isDone?'is-done':'')+'" type="button" '+(locked?'disabled':'')+' data-gc-module="'+id+'"><span class="gc-ac-num">'+(isDone?'✓':d.num)+'</span><span class="gc-ac-copy"><span class="gc-ac-name">'+esc(d.title)+'</span><span class="gc-ac-sub">'+esc(m.mission||'')+'</span><span class="gc-ac-meter"><span style="width:'+p+'%"></span></span></span><span class="gc-ac-meta">'+label+' <span class="gc-ac-chevron">›</span></span></button>';}).join('');
    page.innerHTML='<div class="gc-ac-wrap"><div class="gc-ac-head"><div><div class="gc-ac-kicker">Académie</div><div class="gc-ac-title">Ton parcours</div></div><div class="gc-ac-progress"><div>'+done+' / 4 chapitres terminés</div><div class="gc-ac-progressbar"><span style="width:'+total+'%"></span></div></div></div><div class="gc-ac-list">'+rows+'</div></div>';
    page.querySelectorAll('[data-gc-module]').forEach(function(b){b.onclick=function(){openModule(Number(b.dataset.gcModule));};});return true;
  }

  function openModule(id){
    var src=getModules(),m=src[id]||src[String(id)];if(!m||ACTIVE.indexOf(Number(id))<0)return;
    if(id!==1&&!getState().module1Validated){if(typeof global.openGateModal==='function')global.openGateModal();if(typeof global.toast==='function')global.toast('🔑 Termine le Module 01 pour débloquer la suite');return;}
    var d=DISPLAY[id],title=document.getElementById('mod-detail-title'),sub=document.getElementById('mod-detail-sub'),badge=document.getElementById('mod-detail-badge');
    if(title)title.textContent='Chapitre '+d.num;if(sub)sub.textContent='— '+d.title;if(badge)badge.textContent='';
    renderDetail(id,m,d);if(typeof global.go==='function')global.go('module-detail',null);global.scrollTo(0,0);
  }

  function renderDetail(id,m,d){
    var page=document.getElementById('mod-detail-content');if(!page)return;var vids=Array.isArray(m.videos)?m.videos:[],fiches=Array.isArray(m.fiches)?m.fiches:[];
    var vhtml=vids.map(function(v,i){var source=!!v.yt||!!v.dur;return '<button type="button" class="gc-video-row '+(v.done?'is-done':'')+'" data-v="'+i+'"><span class="gc-video-play">'+(source?'▶':'—')+'</span><span class="gc-video-copy"><span class="gc-video-title">'+esc(v.t||'Vidéo')+'</span><span class="gc-video-desc">'+esc(v.desc||'')+'</span></span><span class="gc-video-state">'+(v.done?'Vu ✓':source?'Regarder':'Bientôt')+'</span></button>';}).join('');
    var rhtml=fiches.map(function(f){return '<button type="button" class="gc-resource" data-r-url="'+esc(f.url||'')+'" data-r-name="'+esc(f.t||'Ressource')+'"><span class="gc-resource-icon">'+esc(f.ico||'📄')+'</span><span class="gc-resource-copy"><span class="gc-resource-title">'+esc(f.t||'Ressource')+'</span><span class="gc-resource-desc">'+esc(f.d||'')+'</span></span><span class="gc-resource-action">'+(f.url?'Ouvrir →':'Bientôt')+'</span></button>';}).join('');
    page.innerHTML='<button type="button" class="gc-flow-back" id="gc-flow-back">‹  Tous les chapitres</button><div class="gc-simple-wrap"><div class="gc-simple-head"><div><div class="gc-simple-ey">Chapitre '+d.num+'</div><div class="gc-simple-title">'+esc(d.title)+'</div></div><div class="gc-simple-badge">'+vids.filter(function(v){return v.done;}).length+'/'+vids.length+' vus</div></div><div class="gc-simple-section"><div class="gc-simple-section-title">Vidéos</div><div class="gc-video-list">'+(vhtml||'<div class="gc-empty">Aucune vidéo.</div>')+'</div></div>'+(fiches.length?'<div class="gc-simple-section"><div class="gc-simple-section-title">Ressource essentielle</div><div class="gc-video-list">'+rhtml+'</div></div>':'')+'</div>';
    document.getElementById('gc-flow-back').onclick=function(){if(typeof global.go==='function')global.go('academie',null);};
    page.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(){var i=Number(b.dataset.v),v=vids[i];if(!v)return;if(v.yt&&typeof global.openYouTubePlayer==='function')return global.openYouTubePlayer(v.yt,v.t,v.dur||'',id,i);if(v.dur&&typeof global.openVideo==='function')return global.openVideo(id,i);if(typeof global.toast==='function')global.toast('Cette vidéo n’a pas encore de source de lecture.');};});
    page.querySelectorAll('[data-r-url]').forEach(function(b){b.onclick=function(){var u=b.dataset.rUrl;if(u&&typeof global.openPDF==='function')global.openPDF(u,(b.dataset.rName||'Ressource')+'.pdf');else if(typeof global.toast==='function')global.toast('Ressource disponible prochainement');};});
    var idx=ACTIVE.indexOf(id),nav=document.createElement('div');nav.className='gc-flow-nav';var prev=document.createElement('button');prev.textContent=idx>0?'‹  Chapitre '+DISPLAY[ACTIVE[idx-1]].num:'‹  Début';prev.disabled=idx===0;prev.onclick=function(){if(idx>0)openModule(ACTIVE[idx-1]);};var next=document.createElement('button');next.className='gc-flow-next';next.textContent=idx<ACTIVE.length-1?'Chapitre '+DISPLAY[ACTIVE[idx+1]].num+'  ›':'Fin';next.disabled=idx===ACTIVE.length-1;next.onclick=function(){if(idx<ACTIVE.length-1)openModule(ACTIVE[idx+1]);};nav.appendChild(prev);nav.appendChild(next);page.appendChild(nav);
  }

  function install(){addStyles();global.renderGameMap=function(){renderAcademy();};global.openModPage=function(id){if(ACTIVE.indexOf(Number(id))!==-1)openModule(Number(id));};renderAcademy();}
  function boot(){install();var n=0,t=global.setInterval(function(){renderAcademy();if(++n>=120)global.clearInterval(t);},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
