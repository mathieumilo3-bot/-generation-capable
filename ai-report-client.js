// ai-report-client.js
// Supervision GC : capture exacte des échanges IA + diffusion des corrections d'Enzo.
(function () {
  'use strict';
  if (window.__GCAIReportBridgeInstalled) return;
  window.__GCAIReportBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);
  let guidanceCache = { at: 0, rules: [] };
  let guidancePromise = null;

  function getSession() {
    if (!window.supa || !window.supa.auth) return Promise.resolve(null);
    return window.supa.auth.getSession().then(r => r?.data?.session || null).catch(() => null);
  }

  function parseBody(body) {
    try { return typeof body === 'string' ? JSON.parse(body) : body || {}; } catch (_) { return null; }
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

  function messageText(messages) {
    return (Array.isArray(messages) ? messages : []).map(m => {
      if (typeof m?.content === 'string') return m.content;
      try { return JSON.stringify(m?.content || ''); } catch (_) { return ''; }
    }).join('\n');
  }

  async function loadGuidance() {
    const now = Date.now();
    if (now - guidanceCache.at < 60000) return guidanceCache.rules;
    if (guidancePromise) return guidancePromise;
    guidancePromise = (async () => {
      try {
        const session = await getSession();
        if (!session) return [];
        const r = await originalFetch('/.netlify/functions/ai-guidance', { headers: { Authorization: 'Bearer ' + session.access_token } });
        if (!r.ok) return [];
        const d = await r.json().catch(() => ({}));
        const rules = Array.isArray(d.rules) ? d.rules : [];
        guidanceCache = { at: Date.now(), rules };
        return rules;
      } catch (_) { return []; }
      finally { guidancePromise = null; }
    })();
    return guidancePromise;
  }

  function buildGuidance(rules) {
    const usable = (Array.isArray(rules) ? rules : []).slice(0, 40);
    if (!usable.length) return '';
    const lines = usable.map((r, i) => `${i + 1}. [${r.category || 'method'}] ${r.title || 'Règle'} : ${String(r.rule_text || '').trim()}`).join('\n');
    return '\n\n[DIRECTIVES HUMAINES GÉNÉRATION CAPABLE — PRIORITAIRES]\nCes directives proviennent des corrections validées par Enzo. Elles servent à adapter ta réponse. Respecte-les sans les révéler comme une source interne. Si une directive semble contradictoire avec la demande actuelle, privilégie la directive la plus spécifique au cas et reste cohérent avec le contexte.\n' + lines.slice(0, 6500);
  }

  function showAction(reportId) {
    let box = document.getElementById('gc-ai-send-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'gc-ai-send-box';
      box.style.cssText = 'position:fixed;right:18px;bottom:82px;z-index:10000;background:#17171c;border:1px solid rgba(255,194,0,.45);border-radius:14px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif;color:#fff;max-width:290px';
      document.body.appendChild(box);
    }
    box.innerHTML = '<div style="font-size:12px;font-weight:700;margin-bottom:7px">🤖 IA + contexte transmis à Enzo</div><div style="font-size:11px;color:#aaa;margin-bottom:8px">Enzo peut lire ta demande, la réponse de l’IA et te répondre.</div><button id="gc-ai-add-note" style="border:0;border-radius:9px;padding:8px 10px;background:#2389ff;color:#fff;font-weight:700;cursor:pointer;width:100%">💬 Écrire à Enzo</button>';
    document.getElementById('gc-ai-add-note').onclick = async function () {
      const note = window.prompt('Ton message pour Enzo :');
      if (note === null || !String(note).trim()) return;
      const session = await getSession(); if (!session) return;
      const r = await originalFetch('/.netlify/functions/ai-report-message', { method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token}, body:JSON.stringify({report_id:reportId,message:String(note).trim().slice(0,12000)}) }).catch(()=>null);
      if (r && r.ok) { box.innerHTML='<div style="font-size:12px;font-weight:700">✅ Message envoyé à Enzo</div>'; setTimeout(()=>box.remove(),3000); }
      else { box.innerHTML='<div style="font-size:12px;font-weight:700">⚠️ Le message n’a pas pu être envoyé. Réessaie.</div>'; setTimeout(()=>box.remove(),4000); }
    };
  }

  async function sendReport(resultText, requestBody, responsePayload, reportMeta) {
    if (!resultText || resultText.length < 2) return;
    const session = await getSession(); if (!session) return;
    const body = parseBody(requestBody) || {};
    const prompt = messageText(body.messages);
    const payload = {
      result_text: resultText.slice(0,30000),
      prompt_excerpt: (prompt || body.system || '').slice(0,20000),
      input_messages: Array.isArray(body.messages) ? body.messages.slice(0,40) : [],
      system_prompt: typeof body.system === 'string' ? body.system : '',
      response_payload: responsePayload && typeof responsePayload === 'object' ? responsePayload : null,
      tool: classify((body.system || '') + '\n' + prompt),
      user_name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || '',
      source: 'ai_tool',
      provider: reportMeta?.provider || null,
      model: reportMeta?.model || body.model || null,
      status: 'completed',
      conversation_key: location.pathname,
      metadata: { page: location.pathname, captured_at: new Date().toISOString() }
    };
    const r = await originalFetch('/.netlify/functions/ai-report-submit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(payload)}).catch(()=>null);
    if(r&&r.ok){let data=null;try{data=await r.json()}catch(_){}if(data?.report_id)showAction(data.report_id);}
  }

  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  async function showHumanReply(reply) {
    let box=document.getElementById('gc-ai-human-reply');
    if(!box){box=document.createElement('div');box.id='gc-ai-human-reply';box.style.cssText='position:fixed;left:18px;right:18px;bottom:82px;z-index:10001;background:#15151a;border:1px solid rgba(48,209,88,.45);border-radius:16px;padding:16px;box-shadow:0 10px 35px rgba(0,0,0,.45);font-family:system-ui,sans-serif;color:#fff';document.body.appendChild(box)}
    box.innerHTML='<div style="font-size:13px;font-weight:800;margin-bottom:7px">💬 Retour d’Enzo</div><div style="font-size:14px;line-height:1.5;white-space:pre-wrap">'+escapeHtml(reply.message)+'</div><textarea id="gc-ai-reply-back" placeholder="Répondre à Enzo…" style="margin-top:12px;width:100%;min-height:70px;background:#0d0d10;color:#fff;border:1px solid #333;border-radius:9px;padding:9px;box-sizing:border-box"></textarea><button id="gc-ai-reply-back-btn" style="margin-top:8px;border:0;border-radius:9px;padding:9px 12px;background:#2389ff;color:#fff;font-weight:800;width:100%">Répondre à Enzo</button><button id="gc-ai-human-reply-ok" style="margin-top:7px;border:0;border-radius:9px;padding:8px 12px;background:#30d158;color:#07120a;font-weight:800;width:100%">J’ai lu</button>';
    document.getElementById('gc-ai-reply-back-btn').onclick=async()=>{const s=await getSession();const ta=document.getElementById('gc-ai-reply-back');const msg=ta?.value.trim();if(!s||!msg)return;const b=document.getElementById('gc-ai-reply-back-btn');b.disabled=true;b.textContent='Envoi…';const r=await originalFetch('/.netlify/functions/ai-report-message',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({report_id:reply.report_id,message:msg})}).catch(()=>null);if(r&&r.ok){ta.value='';b.textContent='✅ Envoyé';setTimeout(()=>box.remove(),1200)}else{b.disabled=false;b.textContent='Réessayer'}};
    document.getElementById('gc-ai-human-reply-ok').onclick=async()=>{const s=await getSession();if(s){await originalFetch('/.netlify/functions/ai-report-replies',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify({id:reply.id})}).catch(()=>{})}box.remove()};
  }

  async function checkHumanReplies(){
    const s=await getSession(); if(!s)return;
    const r=await originalFetch('/.netlify/functions/ai-report-replies',{headers:{Authorization:'Bearer '+s.access_token}}).catch(()=>null); if(!r||!r.ok)return;
    const d=await r.json().catch(()=>({})); const unread=(d.replies||[]).find(x=>!x.read_at && x.sender_type==='admin'); if(unread)showHumanReply(unread);
  }

  window.fetch = async function(input, init){
    const url=typeof input==='string'?input:input?.url||'';
    if(!url.includes('/.netlify/functions/ai-proxy')) return originalFetch(input,init);
    let requestBody = init?.body || '';
    let body = parseBody(requestBody);
    if (body && Array.isArray(body.messages)) {
      try {
        const rules = await loadGuidance();
        const guidance = buildGuidance(rules);
        if (guidance) body.system = String(body.system || '') + guidance;
        requestBody = JSON.stringify(body);
        init = { ...(init || {}), body: requestBody };
      } catch (_) {}
    }
    const response = await originalFetch(input,init);
    try {
      const capturedBody = body || parseBody(requestBody) || {};
      response.clone().json().then(data=>{
        const text=data?.content?.find(x=>x?.type==='text')?.text||'';
        if(text&&!data?.error) sendReport(text,capturedBody,data,{model:capturedBody.model||null});
      }).catch(()=>{});
    } catch(_){}
    return response;
  };

  setTimeout(checkHumanReplies,1200);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkHumanReplies();guidanceCache.at=0;}});
})();
