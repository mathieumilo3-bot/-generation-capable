// ai-report-client.js
// Pont discret entre les outils IA du site et la boîte de suivi admin.
// Il intercepte uniquement les réponses réussies de /.netlify/functions/ai-proxy.
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
    if (!box) {
      box = document.createElement('div');
      box.id = 'gc-ai-send-box';
      box.style.cssText = 'position:fixed;right:18px;bottom:82px;z-index:10000;background:#17171c;border:1px solid rgba(255,194,0,.45);border-radius:14px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.35);font-family:system-ui,sans-serif;color:#fff;max-width:290px';
      document.body.appendChild(box);
    }
    box.innerHTML = '<div style="font-size:12px;font-weight:700;margin-bottom:7px">🤖 Résultat IA transmis à Enzo</div>' +
      '<button id="gc-ai-add-note" style="border:0;border-radius:9px;padding:8px 10px;background:#2389ff;color:#fff;font-weight:700;cursor:pointer;width:100%">💬 Ajouter un message à Enzo</button>';
    document.getElementById('gc-ai-add-note').onclick = async function () {
      const note = window.prompt('Ajoute un message ou une question pour Enzo (facultatif) :');
      if (note === null) return;
      const session = await getSession();
      if (!session) return;
      const r = await fetch('/.netlify/functions/ai-report-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          result_text: 'Message complémentaire du membre :\n' + String(note).slice(0, 5000),
          tool: 'Message membre → Enzo',
          source: 'manual_share',
          metadata: { linked_report_id: reportId }
        })
      }).catch(() => null);
      if (r && r.ok) {
        box.innerHTML = '<div style="font-size:12px;font-weight:700">✅ Message envoyé à Enzo</div>';
        setTimeout(() => box.remove(), 3000);
      }
    };
  }

  async function sendReport(resultText, requestBody) {
    if (!resultText || resultText.length < 2) return;
    const session = await getSession();
    if (!session) return;
    const tool = classify(extractPrompt(requestBody));
    const body = {
      result_text: resultText.slice(0, 30000),
      prompt_excerpt: extractPrompt(requestBody),
      tool,
      user_name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || '',
      source: 'ai_tool',
      metadata: { page: location.pathname, captured_at: new Date().toISOString() }
    };
    const r = await fetch('/.netlify/functions/ai-report-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(body)
    }).catch(() => null);
    if (r && r.ok) {
      let data = null;
      try { data = await r.json(); } catch (_) {}
      if (data?.report_id) showAction(data.report_id);
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/.netlify/functions/ai-proxy')) {
        const requestBody = init?.body || '';
        const copy = response.clone();
        copy.json().then(data => {
          const text = data?.content?.find(x => x?.type === 'text')?.text || '';
          if (text && !data?.error) sendReport(text, requestBody);
        }).catch(() => {});
      }
    } catch (_) {}
    return response;
  };
})();
