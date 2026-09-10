// ai-report-client.js
// Pont entre les outils IA du site, la boîte admin et les retours humains.
(function () {
  'use strict';
  if (window.__GCAIReportBridgeInstalled) return;
  window.__GCAIReportBridgeInstalled = true;

  function getSession() {
    if (!window.supa || !window.supa.auth) return Promise.resolve(null);
    return window.supa.auth.getSession().then(r => r?.data?.session || null).catch(() => null);
  }
  function classify(text) {
    const s = String(text || '').toLowerCase();
    if (s.includes('scan vendeur') || s.includes('scan commercial')) return 'Scan Vendeur';
    if (s.includes('feedback') || s.includes('retour') || s.includes('évaluation')) return 'Feedback IA';
    if (s.includes('conseil') || s.includes('coaching')) return 'Coaching & Conseils IA';
    if (s.includes('rapport du soir') || s.includes('bilan du soir')) return 'Rapport du soir';
    if (s.includes('plan du jour') || s.includes('objectif du jour')) return 'Plan du jour IA';
    return 'Outil IA';
  }
  function extractPrompt(body) {
    try {
      const p = typeof body === 'string' ? JSON.parse(body) : body;
      const messages = Array.isArray(p?.messages) ? p.messages : [];
      return messages.map(m => typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || '')).join('\n').slice(0, 4000);
    } catch (_) { return ''; }
  }

  function showAction(reportId) {
    let box = document.getElementById('gc-ai-send-box');
    if (!box) { box = document.createElement('div'); box.id = 'gc-ai-send-box'; box.style.cssText = 'position:fixed;right:18px;bottom:82px;z-index:10000;background:#17171c;border:1px solid rgba(255,194,0,.45);border-radius:14px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif;color:#fff;max-width:290px'; document.body.appendChild(box); }
    box.innerHTML = '<div style="font-size:12px;font-weight:700;margin-bottom:7px">🤖 Résultat IA transmis à Enzo</div><button id="gc-ai-add-note" style="border:0;border-radius:9px;padding:8px 10px;background:#2389ff;color:#fff;font-weight:700;cursor:pointer;width:100%">💬 Ajouter un message à Enzo</button>';
    document.getElementById('gc-ai-add-note').onclick = async function () {
      const note = window.prompt('Ajoute un message ou une question pour Enzo (facultatif) :');
      if (note === null) return;
      const session = await getSession(); if (!session) return;
      const r = await fetch('/.netlify/functions/ai-report-submit', { method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token}, body:JSON.stringify({result_text:'Message complémentaire du membre :\n'+String(note).slice(0,5000),tool:'Message membre → Enzo',source:'manual_share',metadata:{linked_report_id:reportId}}) }).catch(()=>null);
      if (r && r.ok) { box.innerHTML='<div style="font-size:12px;font-weight:700">✅ Message envoyé à Enzo</div>'; setTimeout(()=>box.remove(),3000); }
    };
  }

  async function sendReport(resultText, requestBody) {
    if (!resultText || resultText.length < 2) return;
    const session = await getSession(); if (!session) return;
    const body={result_text:resultText.slice(0,30000),prompt_excerpt:extractPrompt(requestBody),tool:classify(extractPrompt(requestBody)),user_name:session.user?.user_metadata?.full_name||session.user?.user_metadata?.name||'',source:'ai_tool',metadata:{page:location.pathname,captured_at:new Date().toISOString()}};
    const r=await fetch('/.netlify/functions/ai-report-submit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)}).catch(()=>null);
    if(r&&r.ok){let data=null;try{data=await r.json()}catch(_){}if(data?.report_id)showAction(data.report_id);}
  }

  function showHumanReply(reply) {
    let box=document.getElementById('gc-ai-human-reply');
    if(!box){box=document.createElement('div');box.id='gc-ai-human-reply';box.style.cssText='position:fixed;left:18px;right:18px;bottom:82px;z-index:10001;background:#15151a;border:1px solid rgba(48,209,88,.45);border-radius:16px;padding:16px;box-shadow:0 10px 35px rgba(0,0,0,.45);font-family:system-ui,sans-serif;color:#fff';document.body.appendChild(box)}
    box.innerHTML='<div style="font-size:13px;font-weight:800;margin-bottom:7px">💬 Retour d’Enzo</div><div style="font-size:14px;line-height:1.5;white-space:pre-wrap">'+escapeHtml(reply.message)+'</div><button id="gc-ai-human-reply-ok" style="margin-top:12px;border:0;border-radius:9px;padding:8px 12px;background:#30d158;color:#07120a;font-weight:800">J’ai lu</button>';
    document.getElementById('gc-ai-human-reply-ok').onclick=async()=>{const s=await getSession();if(s){await fetch('/.netlify/functions/ai-report-replies',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({id:reply.id})}).catch(()=>{})}box.remove()};
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function checkHumanReplies(){
    const s=await getSession(); if(!s)return;
    const r=await fetch('/.netlify/functions/ai-report-replies',{headers:{Authorization:'Bearer '+s.access_token}}).catch(()=>null); if(!r||!r.ok)return;
    const d=await r.json().catch(()=>({})); const unread=(d.replies||[]).find(x=>!x.read_at); if(unread)showHumanReply(unread);
  }

  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    try{const url=typeof input==='string'?input:input?.url||'';if(url.includes('/.netlify/functions/ai-proxy')){const requestBody=init?.body||'';response.clone().json().then(data=>{const text=data?.content?.find(x=>x?.type==='text')?.text||'';if(text&&!data?.error)sendReport(text,requestBody)}).catch(()=>{})}}catch(_){ }
    return response;
  };

  setTimeout(checkHumanReplies,1200);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkHumanReplies()});
})();
