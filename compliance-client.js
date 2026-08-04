// compliance-client.js — "Mon dossier administratif" + back-office "Contrats
// à valider", partagés entre index.html (role='vendeur') et ambassadors.html
// (role='ambassadeur'). Widget auto-porté, injecté dans un conteneur fourni
// par la page hôte — aucune dépendance sur le CSS/JS existant de la page,
// pour ne fragiliser ni index.html (477 Ko) ni ambassadors.html.
//
// Usage :
//   window.GCCompliance.mount(containerEl, { role, getSession, apiCall })
//   window.GCCompliance.mountAdmin(containerEl, { getSession, apiCall })
//
// `getSession()` doit renvoyer { access_token, user:{ id, email } } ou null.
// `apiCall(path, session, options)` doit appeler
// /.netlify/functions/<path> avec l'Authorization Bearer et renvoyer
// { ok, status, data }. Un helper par défaut est fourni si la page hôte n'en
// passe pas (voir defaultApiCall ci-dessous).

(function () {
  'use strict';

  const STYLE = `
  .gcc-root{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",system-ui,sans-serif;color:#f5f0e8;max-width:720px;margin:0 auto;padding:4px 2px 60px}
  .gcc-root *{box-sizing:border-box}
  .gcc-h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .gcc-sub{font-size:13px;color:#a8a090;margin-bottom:20px}
  .gcc-card{background:#0d0d0d;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;margin-bottom:16px}
  .gcc-card h3{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .gcc-tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:16px;padding-bottom:2px}
  .gcc-tab{flex-shrink:0;padding:9px 15px;border-radius:20px;font-size:12.5px;font-weight:600;color:#a8a090;background:rgba(255,255,255,.05);border:1px solid transparent;cursor:pointer;white-space:nowrap}
  .gcc-tab.on{background:linear-gradient(135deg,#F0D080,#C9A84C);color:#1a1400;border-color:transparent}
  .gcc-score-wrap{display:flex;align-items:center;gap:16px;margin-bottom:6px}
  .gcc-score-ring{position:relative;width:64px;height:64px;flex-shrink:0}
  .gcc-score-ring svg{transform:rotate(-90deg)}
  .gcc-score-ring .gcc-score-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#F0D080}
  .gcc-checklist{display:flex;flex-direction:column;gap:2px}
  .gcc-check-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}
  .gcc-check-row:first-child{border-top:none}
  .gcc-check-ico{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
  .gcc-check-ico.on{background:#30d158;color:#04220f}
  .gcc-check-ico.off{background:rgba(255,255,255,.08);color:#6e6860}
  .gcc-check-label{font-size:13px;color:#e8e2d8}
  .gcc-field{margin-bottom:12px}
  .gcc-field label{display:block;font-size:11.5px;color:#a8a090;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
  .gcc-field input,.gcc-field select{width:100%;background:#161616;border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:10px 12px;color:#f5f0e8;font-size:13.5px;font-family:inherit}
  .gcc-field input:focus,.gcc-field select:focus{outline:none;border-color:#C9A84C}
  .gcc-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:480px){.gcc-row2{grid-template-columns:1fr}}
  .gcc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 18px;border-radius:11px;font-size:13.5px;font-weight:700;cursor:pointer;border:none;font-family:inherit;width:100%;transition:transform .15s}
  .gcc-btn:active{transform:scale(.98)}
  .gcc-btn-gold{background:linear-gradient(135deg,#F0D080,#C9A84C);color:#1a1400}
  .gcc-btn-ghost{background:rgba(255,255,255,.06);color:#e8e2d8}
  .gcc-btn:disabled{opacity:.4;cursor:not-allowed}
  .gcc-doc-row{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid rgba(255,255,255,.06)}
  .gcc-doc-row:first-child{border-top:none}
  .gcc-doc-info{flex:1;min-width:0}
  .gcc-doc-name{font-size:13px;color:#e8e2d8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gcc-doc-meta{font-size:11px;color:#6e6860;margin-top:2px}
  .gcc-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
  .gcc-badge.pending{background:rgba(255,159,10,.15);color:#ff9f0a}
  .gcc-badge.validated{background:rgba(48,209,88,.15);color:#30d158}
  .gcc-badge.refused{background:rgba(255,69,58,.15);color:#ff453a}
  .gcc-upload-zone{border:1.5px dashed rgba(255,255,255,.18);border-radius:12px;padding:20px;text-align:center;cursor:pointer;font-size:12.5px;color:#a8a090;margin-bottom:10px}
  .gcc-upload-zone:hover{border-color:#C9A84C}
  .gcc-contract-box{background:#0a0a0a;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:20px;max-height:420px;overflow-y:auto;font-size:12px;line-height:1.7;color:#c8c2b8;white-space:pre-wrap;margin-bottom:14px}
  .gcc-contract-scroll-hint{text-align:center;font-size:11px;color:#6e6860;margin:-6px 0 14px}
  .gcc-checkbox-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;cursor:pointer}
  .gcc-checkbox-row input{margin-top:3px;width:16px;height:16px;flex-shrink:0}
  .gcc-checkbox-row span{font-size:13px;color:#c8c2b8}
  .gcc-sig-pad{background:#fff;border-radius:10px;width:100%;height:160px;touch-action:none;cursor:crosshair;margin-bottom:10px}
  .gcc-sig-actions{display:flex;gap:8px;margin-bottom:16px}
  .gcc-hist-row{display:flex;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12.5px}
  .gcc-hist-row:first-child{border-top:none}
  .gcc-hist-date{color:#6e6860;flex-shrink:0;width:120px}
  .gcc-hist-txt{color:#c8c2b8}
  .gcc-empty{text-align:center;color:#6e6860;font-size:12.5px;padding:26px 10px}
  .gcc-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#161616;border:1px solid rgba(255,255,255,.12);color:#f5f0e8;padding:11px 18px;border-radius:10px;font-size:13px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.5)}
  .gcc-validated-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:99998;text-align:center;padding:24px}
  .gcc-validated-card{max-width:360px}
  .gcc-validated-check{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#F0D080,#C9A84C);display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 18px;animation:gccPop .5s cubic-bezier(.34,1.56,.64,1)}
  @keyframes gccPop{from{transform:scale(0)}to{transform:scale(1)}}
  .gcc-admin-row{display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid rgba(255,255,255,.06);cursor:pointer}
  .gcc-admin-row:first-child{border-top:none}
  .gcc-admin-row:hover{background:rgba(255,255,255,.02)}
  .gcc-admin-avatar{width:36px;height:36px;border-radius:50%;background:rgba(201,168,76,.15);color:#F0D080;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
  .gcc-admin-info{flex:1;min-width:0}
  .gcc-admin-name{font-size:13.5px;font-weight:600;color:#e8e2d8}
  .gcc-admin-meta{font-size:11px;color:#6e6860;margin-top:2px}
  .gcc-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9997;display:flex;align-items:center;justify-content:center;padding:16px}
  .gcc-modal{background:#0d0d0d;border-radius:16px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;padding:22px;position:relative;border:1px solid rgba(255,255,255,.1)}
  .gcc-modal-close{position:absolute;top:14px;right:16px;background:none;border:none;color:#a8a090;font-size:18px;cursor:pointer}
  `;

  function injectStyle() {
    if (document.getElementById('gcc-style')) return;
    const s = document.createElement('style');
    s.id = 'gcc-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'gcc-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  async function defaultApiCall(path, session, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    const resp = await fetch('/.netlify/functions/' + path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await resp.json(); } catch (e) { /* réponse non-JSON */ }
    return { ok: resp.ok, status: resp.status, data };
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const DOC_TYPES = [
    { key: 'identity', label: "Pièce d'identité" },
    { key: 'rib', label: 'RIB (scan)' },
    { key: 'siret_proof', label: "Justificatif SIRET (extrait INPI)" },
    { key: 'urssaf', label: 'Attestation URSSAF' },
    { key: 'vat_cert', label: 'Certificat de TVA' },
  ];

  // Taille maximale par fichier.
  //
  // ⚠️ NE PAS REMONTER SANS CHANGER D'ARCHITECTURE.
  // Les fonctions Netlify refusent toute requête dont le corps dépasse 6 Mo,
  // et le refus a lieu AVANT l'exécution du code : impossible d'afficher un
  // message clair depuis le serveur. Comme le fichier est transporté en
  // base64 (data URL), il pèse ~33 % de plus que l'original. Un fichier de
  // 4,5 Mo dépasse donc déjà la limite une fois encodé.
  //
  // 4 Mo laisse une marge sûre pour l'encodage et le reste du JSON (nom du
  // fichier, type, date d'expiration). La limite est vérifiée ici, dans le
  // navigateur, pour que l'utilisateur reçoive un message compréhensible
  // plutôt qu'une erreur réseau opaque — le serveur la revérifie de son côté,
  // car un contrôle côté navigateur ne protège de rien.
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_UPLOAD_LABEL = '4 Mo';
  const ACCEPTED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

  function humanSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
    return Math.max(1, Math.round(bytes / 1024)) + ' Ko';
  }

  // Contrôle commun à tous les points de dépôt. Renvoie un message d'erreur
  // explicite, ou null si le fichier est acceptable.
  function checkUploadFile(file) {
    if (!file) return 'Fichier illisible.';
    if (file.size === 0) return `« ${file.name} » est vide.`;
    if (file.size > MAX_UPLOAD_BYTES) {
      return `« ${file.name} » fait ${humanSize(file.size)} — maximum ${MAX_UPLOAD_LABEL} par fichier.`;
    }
    // Certains navigateurs mobiles laissent le type vide : on ne bloque alors
    // pas sur ce seul critère, le serveur tranchera à partir du contenu.
    if (file.type && ACCEPTED_MIME.indexOf(file.type) === -1) {
      return `« ${file.name} » n'est pas un PDF, JPG ou PNG.`;
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  DOSSIER — vue utilisateur (vendeur ou ambassadeur)
  // ══════════════════════════════════════════════════════════════════════

  function Dossier(container, opts) {
    const role = opts.role;
    const getSession = opts.getSession;
    const apiCall = opts.apiCall || defaultApiCall;
    const roleLabel = role === 'vendeur' ? 'Vendeur' : 'Ambassadeur';
    let session = null;
    let dossier = null;
    let activeTab = 'checklist';
    let hasScrolledToEnd = false;

    async function init() {
      injectStyle();
      session = await getSession();
      if (!session) {
        container.innerHTML = '<div class="gcc-root"><div class="gcc-card">Connecte-toi pour accéder à ton dossier administratif.</div></div>';
        return;
      }
      await refresh();
    }

    async function refresh() {
      const r = await apiCall(`compliance-dossier?role=${role}`, session, { method: 'GET' });
      dossier = (r.data && r.data.dossier) || null;
      render();
    }

    function checklistItems() {
      if (!dossier) return [];
      return [
        { key: 'contract', label: 'Contrat signé', on: !!(dossier.latest_signature && dossier.latest_signature.id) },
        { key: 'identity', label: 'Identité vérifiée', on: !!dossier.has_identity_doc },
        { key: 'payment', label: 'Paiement configuré', on: !!(dossier.latest_payment_info && dossier.latest_payment_info.admin_status === 'validated') },
        { key: 'siret', label: 'SIRET renseigné', on: !!(dossier.profile && dossier.profile.siret) },
        { key: 'siret_proof', label: 'Justificatif SIRET déposé', on: !!dossier.has_siret_proof },
      ];
    }

    function render() {
      const score = (dossier && dossier.score) || 0;
      const status = (dossier && dossier.status) || 'incomplete';
      const circumference = 2 * Math.PI * 27;
      const offset = circumference * (1 - score / 100);

      container.innerHTML = `
        <div class="gcc-root">
          <div class="gcc-h1">📋 Mon dossier administratif</div>
          <div class="gcc-sub">Espace ${esc(roleLabel)} — signature, identité, paiement, tout au même endroit.</div>

          <div class="gcc-card">
            <div class="gcc-score-wrap">
              <div class="gcc-score-ring">
                <svg width="64" height="64">
                  <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6"/>
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#C9A84C" stroke-width="6" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
                </svg>
                <div class="gcc-score-txt">${score}%</div>
              </div>
              <div>
                <div style="font-size:15px;font-weight:700">${status === 'conforme' ? '✅ Dossier conforme' : 'Dossier incomplet'}</div>
                <div style="font-size:12px;color:#a8a090;margin-top:2px">${status === 'conforme' ? 'Tu peux recevoir tes commissions.' : 'Complète les étapes ci-dessous pour débloquer tes commissions.'}</div>
              </div>
            </div>
            <div class="gcc-checklist" style="margin-top:14px">
              ${checklistItems().map(it => `
                <div class="gcc-check-row">
                  <div class="gcc-check-ico ${it.on ? 'on' : 'off'}">${it.on ? '✓' : ''}</div>
                  <div class="gcc-check-label">${esc(it.label)}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="gcc-tabs">
            ${['checklist', 'infos', 'contrat', 'documents', 'paiement', 'historique'].map(t => `
              <div class="gcc-tab ${activeTab === t ? 'on' : ''}" data-tab="${t}">${tabLabel(t)}</div>
            `).join('')}
          </div>

          <div id="gcc-tab-content"></div>
        </div>
      `;

      container.querySelectorAll('.gcc-tab').forEach(el => {
        el.onclick = () => { activeTab = el.getAttribute('data-tab'); render(); };
      });

      renderTabContent();
    }

    function tabLabel(t) {
      return { checklist: '✅ Résumé', infos: '👤 Informations', contrat: '📄 Contrat', documents: '📎 Documents', paiement: '💳 Paiement', historique: '🕒 Historique' }[t];
    }

    function renderTabContent() {
      const el = container.querySelector('#gcc-tab-content');
      if (!el) return;
      if (activeTab === 'checklist') return renderChecklistTab(el);
      if (activeTab === 'infos') return renderInfosTab(el);
      if (activeTab === 'contrat') return renderContratTab(el);
      if (activeTab === 'documents') return renderDocumentsTab(el);
      if (activeTab === 'paiement') return renderPaiementTab(el);
      if (activeTab === 'historique') return renderHistoriqueTab(el);
    }

    function renderChecklistTab(el) {
      el.innerHTML = `<div class="gcc-card"><h3>Pourquoi ces 5 étapes ?</h3>
        <div style="font-size:13px;color:#c8c2b8;line-height:1.7">
          Ton dossier doit être <strong>signé, vérifié et complet</strong> avant tout versement de commission — c'est ce qui protège aussi bien Génération Capable que toi. Utilise les onglets ci-dessus pour compléter chaque étape ; le score se met à jour automatiquement.
        </div>
      </div>`;
    }

    function renderInfosTab(el) {
      const p = (dossier && dossier.profile) || {};
      el.innerHTML = `
        <div class="gcc-card">
          <h3>Informations personnelles</h3>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Prénom</label><input id="gcc-first-name" value="${esc(p.first_name || '')}"></div>
            <div class="gcc-field"><label>Nom</label><input id="gcc-last-name" value="${esc(p.last_name || '')}"></div>
          </div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Date de naissance</label><input id="gcc-birth-date" type="date" value="${esc(p.birth_date || '')}"></div>
            <div class="gcc-field"><label>Lieu de naissance</label><input id="gcc-birth-place" value="${esc(p.birth_place || '')}"></div>
          </div>
          <div class="gcc-field"><label>Adresse</label><input id="gcc-address" value="${esc(p.address || '')}"></div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Téléphone</label><input id="gcc-phone" value="${esc(p.phone || '')}"></div>
            <div class="gcc-field"><label>Nationalité</label><input id="gcc-nationality" value="${esc(p.nationality || '')}"></div>
          </div>
        </div>
        <div class="gcc-card">
          <h3>Informations professionnelles</h3>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Statut juridique</label><input id="gcc-legal-status" placeholder="Micro-entrepreneur..." value="${esc(p.legal_status || '')}"></div>
            <div class="gcc-field"><label>SIRET</label><input id="gcc-siret" value="${esc(p.siret || '')}"></div>
          </div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Numéro de TVA (si applicable)</label><input id="gcc-vat" value="${esc(p.vat_number || '')}"></div>
            <div class="gcc-field"><label>Nom de l'entreprise</label><input id="gcc-company-name" value="${esc(p.company_name || '')}"></div>
          </div>
          <div class="gcc-field"><label>Date de création de l'entreprise</label><input id="gcc-company-created" type="date" value="${esc(p.company_created_at || '')}"></div>
          <button class="gcc-btn gcc-btn-gold" id="gcc-save-profile">Enregistrer</button>
        </div>
      `;
      el.querySelector('#gcc-save-profile').onclick = async () => {
        const body = {
          role,
          first_name: el.querySelector('#gcc-first-name').value,
          last_name: el.querySelector('#gcc-last-name').value,
          birth_date: el.querySelector('#gcc-birth-date').value,
          birth_place: el.querySelector('#gcc-birth-place').value,
          address: el.querySelector('#gcc-address').value,
          phone: el.querySelector('#gcc-phone').value,
          nationality: el.querySelector('#gcc-nationality').value,
          legal_status: el.querySelector('#gcc-legal-status').value,
          siret: el.querySelector('#gcc-siret').value,
          vat_number: el.querySelector('#gcc-vat').value,
          company_name: el.querySelector('#gcc-company-name').value,
          company_created_at: el.querySelector('#gcc-company-created').value,
        };
        const r = await apiCall('compliance-dossier', session, { method: 'POST', body: JSON.stringify(body) });
        if (r.ok) { toast('✅ Informations enregistrées'); await refresh(); }
        else toast('❌ Erreur lors de l\'enregistrement');
      };
    }

    async function renderContratTab(el) {
      const already = dossier && dossier.latest_signature && dossier.latest_signature.id;
      if (already) {
        const sig = dossier.latest_signature;
        el.innerHTML = `
          <div class="gcc-card">
            <h3>📄 Contrat signé</h3>
            <div style="font-size:13px;color:#c8c2b8;line-height:1.8">
              Version <strong>${esc(sig.contract_version)}</strong> signée le ${new Date(sig.signed_at).toLocaleString('fr-FR')}.<br>
              Statut de validation : <span class="gcc-badge ${sig.admin_status}">${statusLabel(sig.admin_status)}</span>
            </div>
            ${sig.pdf_url ? `<a class="gcc-btn gcc-btn-ghost" style="margin-top:14px;text-decoration:none" href="${sig.pdf_url}" target="_blank" rel="noopener">📥 Télécharger le PDF signé</a>` : ''}
          </div>
        `;
        return;
      }

      el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Chargement du contrat…</div></div>`;
      const r = await apiCall(`compliance-contract-preview?role=${role}`, session, { method: 'GET' });
      if (!r.ok || !r.data || !r.data.text) {
        el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Impossible de charger le contrat pour le moment.</div></div>`;
        return;
      }
      const missing = r.data.missingFields || [];
      if (missing.length > 0) {
        el.innerHTML = `<div class="gcc-card">
          <h3>Complète ton profil avant de signer</h3>
          <div style="font-size:13px;color:#c8c2b8">Rends-toi dans l'onglet <strong>Informations</strong> pour renseigner : ${missing.map(esc).join(', ')}.</div>
        </div>`;
        return;
      }

      hasScrolledToEnd = false;
      el.innerHTML = `
        <div class="gcc-card">
          <h3>📄 ${role === 'vendeur' ? 'Contrat de Vendeur' : "Contrat d'Ambassadeur"}</h3>
          <div class="gcc-contract-box" id="gcc-contract-box">${esc(r.data.text)}</div>
          <div class="gcc-contract-scroll-hint" id="gcc-scroll-hint">⬇ Fais défiler jusqu'en bas pour pouvoir signer</div>
          <label class="gcc-checkbox-row"><input type="checkbox" id="gcc-cb-read" disabled><span>J'ai lu le contrat dans son intégralité</span></label>
          <label class="gcc-checkbox-row"><input type="checkbox" id="gcc-cb-accept" disabled><span>J'accepte les conditions du contrat</span></label>
          <div style="font-size:12px;color:#a8a090;margin-bottom:8px">Signe ci-dessous avec ton doigt (mobile) ou ta souris :</div>
          <canvas class="gcc-sig-pad" id="gcc-sig-pad"></canvas>
          <div class="gcc-sig-actions">
            <button class="gcc-btn gcc-btn-ghost" id="gcc-sig-clear" type="button">Effacer</button>
          </div>
          <button class="gcc-btn gcc-btn-gold" id="gcc-sig-submit" disabled>Signer le contrat</button>
        </div>
      `;

      const box = el.querySelector('#gcc-contract-box');
      const hint = el.querySelector('#gcc-scroll-hint');
      const cbRead = el.querySelector('#gcc-cb-read');
      const cbAccept = el.querySelector('#gcc-cb-accept');
      const submitBtn = el.querySelector('#gcc-sig-submit');

      function checkScrollEnd() {
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 8) {
          hasScrolledToEnd = true;
          cbRead.disabled = false;
          cbAccept.disabled = false;
          hint.textContent = '✓ Tu as lu le contrat jusqu\'au bout';
          hint.style.color = '#30d158';
        }
      }
      box.addEventListener('scroll', checkScrollEnd);
      checkScrollEnd(); // contrat assez court pour tenir sans scroll sur certains écrans

      function updateSubmitState() {
        submitBtn.disabled = !(cbRead.checked && cbAccept.checked && !sigPad.isEmpty());
      }
      cbRead.onchange = updateSubmitState;
      cbAccept.onchange = updateSubmitState;

      const sigPad = new SignaturePad(el.querySelector('#gcc-sig-pad'), updateSubmitState);
      el.querySelector('#gcc-sig-clear').onclick = () => { sigPad.clear(); updateSubmitState(); };

      submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signature en cours…';
        const dataUrl = sigPad.toDataURL();
        const resp = await apiCall('compliance-sign-contract', session, {
          method: 'POST',
          body: JSON.stringify({ role, hasRead: true, hasAccepted: true, signatureImageDataUrl: dataUrl }),
        });
        if (resp.ok && resp.data && resp.data.ok) {
          toast('✅ Contrat signé !');
          await refresh();
          maybeShowValidatedAnimation();
        } else {
          toast('❌ ' + (resp.data && resp.data.message || 'Erreur lors de la signature'));
          submitBtn.disabled = false;
          submitBtn.textContent = 'Signer le contrat';
        }
      };
    }

    function renderDocumentsTab(el) {
      el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Chargement…</div></div>`;
      apiCall(`compliance-documents?role=${role}`, session, { method: 'GET' }).then(r => {
        const docs = (r.data && r.data.documents) || [];
        el.innerHTML = `
          <div class="gcc-card">
            <h3>📎 Documents déposés</h3>
            <div>${docs.length === 0 ? '<div class="gcc-empty">Aucun document déposé pour le moment.</div>' :
              docs.map(d => `
                <div class="gcc-doc-row">
                  <div class="gcc-doc-info">
                    <div class="gcc-doc-name">${esc(d.file_name)}</div>
                    <div class="gcc-doc-meta">${docTypeLabel(d.doc_type)} · déposé le ${new Date(d.uploaded_at).toLocaleDateString('fr-FR')}${d.expires_at ? ' · expire le ' + new Date(d.expires_at).toLocaleDateString('fr-FR') : ''}</div>
                  </div>
                  <span class="gcc-badge ${d.admin_status}">${statusLabel(d.admin_status)}</span>
                  ${d.url ? `<a href="${d.url}" target="_blank" rel="noopener" style="color:#F0D080;font-size:12px;text-decoration:none;margin-left:8px">Voir</a>` : ''}
                  <button type="button" class="gcc-doc-replace" data-id="${d.id}" style="background:none;border:none;color:#a8a090;font-size:12px;cursor:pointer;margin-left:8px">Remplacer</button>
                  <button type="button" class="gcc-doc-delete" data-id="${d.id}" style="background:none;border:none;color:#ff6b6b;font-size:12px;cursor:pointer;margin-left:4px">Supprimer</button>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="gcc-card">
            <h3>Déposer un document</h3>
            <div class="gcc-field"><label>Type de document</label>
              <select id="gcc-doc-type">${DOC_TYPES.map(t => `<option value="${t.key}">${esc(t.label)}</option>`).join('')}</select>
            </div>
            <div class="gcc-field" id="gcc-doc-expiry-wrap" style="display:none">
              <label>Date d'expiration (si applicable)</label>
              <input type="date" id="gcc-doc-expiry">
            </div>
            <div class="gcc-upload-zone" id="gcc-upload-zone">📤 Cliquer ou déposer tes fichiers ici<br><span style="opacity:.65;font-size:.9em">PDF, JPG, PNG — plusieurs fichiers possibles, ${MAX_UPLOAD_LABEL} par fichier</span></div>
            <div id="gcc-upload-report" style="margin-top:10px"></div>
            <input type="file" id="gcc-file-input" accept="application/pdf,image/png,image/jpeg" multiple style="display:none">
            <input type="file" id="gcc-replace-input" accept="application/pdf,image/png,image/jpeg" style="display:none">
          </div>
        `;
        const docTypeSel = el.querySelector('#gcc-doc-type');
        const expiryWrap = el.querySelector('#gcc-doc-expiry-wrap');
        docTypeSel.onchange = () => { expiryWrap.style.display = ['urssaf', 'vat_cert'].includes(docTypeSel.value) ? 'block' : 'none'; };

        const zone = el.querySelector('#gcc-upload-zone');
        const input = el.querySelector('#gcc-file-input');
        const report = el.querySelector('#gcc-upload-report');
        const IDLE_ZONE_HTML = `📤 Cliquer ou déposer tes fichiers ici<br><span style="opacity:.65;font-size:.9em">PDF, JPG, PNG — plusieurs fichiers possibles, ${MAX_UPLOAD_LABEL} par fichier</span>`;

        // Dépôt de PLUSIEURS fichiers en une fois (recto/verso d'une pièce
        // d'identité, justificatifs multi-pages…). Les envois sont faits l'un
        // APRÈS l'autre, jamais en parallèle : chaque fichier voyage en
        // base64 dans le corps de la requête, et lancer cinq envois
        // simultanés depuis un mobile en 4G fait échouer l'ensemble.
        //
        // Un fichier refusé n'interrompt jamais les autres : le rapport final
        // dit précisément lequel est passé et lequel a échoué, plutôt qu'un
        // « erreur » global qui oblige à tout recommencer à l'aveugle.
        let uploading = false;
        async function uploadFiles(fileList) {
          const files = Array.from(fileList || []);
          if (!files.length) return;
          if (uploading) { toast('⏳ Un envoi est déjà en cours'); return; }
          uploading = true;
          report.innerHTML = '';

          const results = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            zone.textContent = `Envoi ${i + 1} / ${files.length} — ${file.name}…`;

            const problem = checkUploadFile(file);
            if (problem) { results.push({ name: file.name, ok: false, msg: problem }); continue; }

            try {
              const dataUrl = await fileToDataUrl(file);
              const resp = await apiCall('compliance-documents', session, {
                method: 'POST',
                body: JSON.stringify({
                  role, doc_type: docTypeSel.value, file_name: file.name, fileDataUrl: dataUrl,
                  expires_at: el.querySelector('#gcc-doc-expiry').value || null,
                }),
              });
              if (resp.ok && resp.data && resp.data.ok) {
                results.push({ name: file.name, ok: true });
              } else {
                results.push({
                  name: file.name, ok: false,
                  msg: (resp.data && resp.data.message) || 'Refusé par le serveur.',
                });
              }
            } catch (e) {
              results.push({ name: file.name, ok: false, msg: 'Lecture ou réseau impossible.' });
            }
          }

          zone.innerHTML = IDLE_ZONE_HTML;
          input.value = '';
          uploading = false;

          const okCount = results.filter(r => r.ok).length;
          const failed = results.filter(r => !r.ok);

          report.innerHTML = results.map(r => `
            <div style="font-size:12.5px;padding:5px 0;color:${r.ok ? '#7fc98f' : '#e08080'}">
              ${r.ok ? '✅' : '❌'} ${esc(r.name)}${r.ok ? '' : ' — ' + esc(r.msg)}
            </div>
          `).join('');

          if (okCount) {
            toast(okCount === 1 ? '✅ Document déposé' : `✅ ${okCount} documents déposés`);
            await refresh();
          }
          if (failed.length && !okCount) {
            toast(`❌ ${failed.length === 1 ? 'Fichier refusé' : failed.length + ' fichiers refusés'}`);
          }
        }

        zone.onclick = () => { if (!uploading) input.click(); };
        input.onchange = () => uploadFiles(input.files);

        // Glisser-déposer, sur ordinateur. Sans preventDefault sur dragover,
        // le navigateur ouvrirait le fichier dans un nouvel onglet au lieu de
        // le confier à la page.
        ['dragenter', 'dragover'].forEach(evt => {
          zone.addEventListener(evt, (e) => {
            e.preventDefault(); e.stopPropagation();
            zone.style.borderColor = 'var(--gold, #C9A84C)';
          });
        });
        ['dragleave', 'drop'].forEach(evt => {
          zone.addEventListener(evt, (e) => {
            e.preventDefault(); e.stopPropagation();
            zone.style.borderColor = '';
          });
        });
        zone.addEventListener('drop', (e) => {
          if (e.dataTransfer && e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
        });

        const replaceInput = el.querySelector('#gcc-replace-input');
        el.querySelectorAll('.gcc-doc-replace').forEach(btn => {
          btn.onclick = () => {
            replaceInput.onchange = async () => {
              const file = replaceInput.files[0];
              if (!file) return;
              const problem = checkUploadFile(file);
              if (problem) { toast('❌ ' + problem); replaceInput.value = ''; return; }
              try {
                const dataUrl = await fileToDataUrl(file);
                const resp = await apiCall('compliance-documents', session, {
                  method: 'PATCH',
                  body: JSON.stringify({ documentId: btn.getAttribute('data-id'), file_name: file.name, fileDataUrl: dataUrl }),
                });
                if (resp.ok && resp.data && resp.data.ok) { toast('✅ Document remplacé'); await refresh(); renderDocumentsTab(el); }
                else toast('❌ ' + (resp.data && resp.data.message || 'Erreur lors du remplacement'));
              } catch (e) { toast('❌ Erreur lors de la lecture du fichier'); }
              replaceInput.value = '';
            };
            replaceInput.click();
          };
        });
        el.querySelectorAll('.gcc-doc-delete').forEach(btn => {
          btn.onclick = async () => {
            if (!confirm('Supprimer définitivement ce document ?')) return;
            const resp = await apiCall('compliance-documents', session, { method: 'DELETE', body: JSON.stringify({ documentId: btn.getAttribute('data-id') }) });
            if (resp.ok && resp.data && resp.data.ok) { toast('✅ Document supprimé'); await refresh(); renderDocumentsTab(el); }
            else toast('❌ Erreur lors de la suppression');
          };
        });
      });
    }

    function renderPaiementTab(el) {
      el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Chargement…</div></div>`;
      apiCall(`compliance-payment-info?role=${role}`, session, { method: 'GET' }).then(r => {
        const current = r.data && r.data.current;
        const history = (r.data && r.data.history) || [];
        el.innerHTML = `
          <div class="gcc-card">
            <h3>💳 Informations de paiement</h3>
            ${current ? `<div style="font-size:13px;color:#c8c2b8;margin-bottom:14px">RIB actuel : <strong>${esc(current.iban)}</strong> · <span class="gcc-badge ${current.admin_status}">${statusLabel(current.admin_status)}</span></div>` : ''}
            <div class="gcc-field"><label>IBAN</label><input id="gcc-iban" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"></div>
            <div class="gcc-row2">
              <div class="gcc-field"><label>BIC / SWIFT</label><input id="gcc-bic" placeholder="XXXXXXXX"></div>
              <div class="gcc-field"><label>Banque</label><input id="gcc-bank-name"></div>
            </div>
            <div class="gcc-field"><label>Titulaire du compte</label><input id="gcc-holder"></div>
            <button class="gcc-btn gcc-btn-gold" id="gcc-save-payment">Enregistrer</button>
          </div>
          <div class="gcc-card">
            <h3>Historique</h3>
            ${history.length === 0 ? '<div class="gcc-empty">Aucun historique.</div>' : history.map(h => `
              <div class="gcc-hist-row"><div class="gcc-hist-date">${new Date(h.created_at).toLocaleDateString('fr-FR')}</div>
              <div class="gcc-hist-txt">${esc(h.iban)} — <span class="gcc-badge ${h.admin_status}">${statusLabel(h.admin_status)}</span></div></div>
            `).join('')}
          </div>
        `;
        el.querySelector('#gcc-save-payment').onclick = async () => {
          const body = {
            role,
            iban: el.querySelector('#gcc-iban').value,
            bic: el.querySelector('#gcc-bic').value,
            bank_name: el.querySelector('#gcc-bank-name').value,
            account_holder: el.querySelector('#gcc-holder').value,
          };
          const resp = await apiCall('compliance-payment-info', session, { method: 'POST', body: JSON.stringify(body) });
          if (resp.ok && resp.data && resp.data.ok) { toast('✅ Coordonnées bancaires enregistrées — en attente de validation'); await refresh(); renderPaiementTab(el); }
          else toast('❌ ' + (resp.data && resp.data.message || 'Erreur'));
        };
      });
    }

    function renderHistoriqueTab(el) {
      el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Chargement…</div></div>`;
      apiCall(`compliance-export?role=${role}`, session, { method: 'GET' }).then(r => {
        const log = (r.data && r.data.audit_log) || [];
        el.innerHTML = `
          <div class="gcc-card">
            <h3>🕒 Historique complet</h3>
            ${log.length === 0 ? '<div class="gcc-empty">Aucun évènement pour le moment.</div>' : log.map(a => `
              <div class="gcc-hist-row"><div class="gcc-hist-date">${new Date(a.created_at).toLocaleString('fr-FR')}</div>
              <div class="gcc-hist-txt">${esc(actionLabel(a.action))}</div></div>
            `).join('')}
          </div>
          <button class="gcc-btn gcc-btn-ghost" id="gcc-export-json">📦 Exporter mon dossier (JSON + liens)</button>
        `;
        el.querySelector('#gcc-export-json').onclick = () => {
          const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `dossier-${role}-${Date.now()}.json`; a.click();
          URL.revokeObjectURL(url);
        };
      });
    }

    function maybeShowValidatedAnimation() {
      if (!dossier || dossier.status !== 'conforme') return;
      const overlay = document.createElement('div');
      overlay.className = 'gcc-validated-overlay';
      overlay.innerHTML = `
        <div class="gcc-validated-card">
          <div class="gcc-validated-check">✓</div>
          <div style="font-size:19px;font-weight:800;margin-bottom:8px">Votre dossier est validé.</div>
          <div style="font-size:13.5px;color:#a8a090;margin-bottom:20px">Vous pouvez désormais exercer votre activité sur Génération Capable.</div>
          <button class="gcc-btn gcc-btn-gold" style="max-width:220px;margin:0 auto">Continuer</button>
        </div>
      `;
      overlay.querySelector('button').onclick = () => overlay.remove();
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      document.body.appendChild(overlay);
    }

    init();
    return { refresh };
  }

  // Petit pad de signature — pointer events (souris + tactile unifiés).
  function SignaturePad(canvas, onChange) {
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let empty = true;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#111';
    }
    resize();

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true; empty = false;
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => {
      canvas.addEventListener(ev, () => { if (drawing) { drawing = false; if (onChange) onChange(); } });
    });

    return {
      isEmpty: () => empty,
      clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; },
      toDataURL: () => canvas.toDataURL('image/png'),
    };
  }

  function statusLabel(s) {
    return { pending: '🟡 En attente', validated: '🟢 Validé', refused: '🔴 Refusé' }[s] || s || '—';
  }
  function docTypeLabel(t) {
    const found = DOC_TYPES.find(d => d.key === t);
    return found ? found.label : t;
  }
  function actionLabel(a) {
    const map = {
      profile_updated: 'Informations du dossier mises à jour',
      contract_signed: 'Contrat signé électroniquement',
      document_uploaded: 'Document déposé',
      payment_info_updated: 'Coordonnées bancaires modifiées',
      contract_validated: 'Contrat validé par l\'administrateur',
      contract_refused: 'Contrat refusé par l\'administrateur',
      document_validated: 'Document validé par l\'administrateur',
      document_refused: 'Document refusé par l\'administrateur',
      payment_info_validated: 'RIB validé par l\'administrateur',
      payment_info_refused: 'RIB refusé par l\'administrateur',
    };
    return map[a] || a;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ADMIN — "Contrats à valider"
  // ══════════════════════════════════════════════════════════════════════

  const ADMIN_TABS = ['verifications', 'contrats', 'documents', 'paiements', 'historique'];
  const ADMIN_TAB_LABELS = { verifications: '👤 Vérifications', contrats: '📄 Contrats', documents: '📎 Documents', paiements: '💳 Paiements', historique: '🕒 Historique' };
  const QUEUE_ACTIONS = { contrats: 'pending_contracts', documents: 'pending_documents', paiements: 'pending_payments' };
  const QUEUE_STATUS_ACTION = { contrats: 'set_contract_status', documents: 'set_document_status', paiements: 'set_payment_status' };

  function AdminPanel(container, opts) {
    const getSession = opts.getSession;
    const apiCall = opts.apiCall || defaultApiCall;
    let session = null;
    let activeTab = 'verifications';

    async function init() {
      injectStyle();
      session = await getSession();
      if (!session) { container.innerHTML = '<div class="gcc-root gcc-empty">Connexion requise.</div>'; return; }
      render();
    }

    function render() {
      container.innerHTML = `
        <div class="gcc-root">
          <div class="gcc-h1">📋 Conformité</div>
          <div class="gcc-sub">Contrats, documents, paiements et historique — vendeurs &amp; ambassadeurs.</div>
          <div class="gcc-tabs">${ADMIN_TABS.map(t => `<div class="gcc-tab ${activeTab === t ? 'on' : ''}" data-tab="${t}">${ADMIN_TAB_LABELS[t]}</div>`).join('')}</div>
          <div id="gcc-admin-tab-content"><div class="gcc-card"><div class="gcc-empty">Chargement…</div></div></div>
        </div>
      `;
      container.querySelectorAll('.gcc-tab').forEach(el => { el.onclick = () => { activeTab = el.getAttribute('data-tab'); render(); }; });
      const contentEl = container.querySelector('#gcc-admin-tab-content');
      if (activeTab === 'verifications') renderVerificationsTab(contentEl);
      else if (activeTab === 'historique') renderHistoriqueTabAdmin(contentEl);
      else renderQueueTab(contentEl, activeTab);
    }

    async function renderVerificationsTab(el) {
      const r = await apiCall('admin-compliance?action=list', session, { method: 'GET' });
      const rows = (r.data && r.data.dossiers) || [];
      el.innerHTML = `
        <div class="gcc-sub">${rows.length} dossier(s)</div>
        <div class="gcc-card">
          ${rows.length === 0 ? '<div class="gcc-empty">Aucun dossier pour le moment.</div>' : rows.map(row => `
            <div class="gcc-admin-row" data-user="${esc(row.user_id)}" data-role="${esc(row.role)}">
              <div class="gcc-admin-avatar">${esc((row.first_name || row.email || '?')[0] || '?').toUpperCase()}</div>
              <div class="gcc-admin-info">
                <div class="gcc-admin-name">${esc(row.first_name || '')} ${esc(row.last_name || '')} ${!row.first_name ? esc(row.email || '') : ''}</div>
                <div class="gcc-admin-meta">${row.role === 'vendeur' ? 'Vendeur' : 'Ambassadeur'} · ${esc(row.email || '')} · score ${row.score}%</div>
              </div>
              <span class="gcc-badge ${row.dossier_status === 'conforme' ? 'validated' : 'pending'}">${row.dossier_status === 'conforme' ? '🟢 Dossier validé' : '🟡 Dossier incomplet'}</span>
            </div>
          `).join('')}
        </div>
      `;
      el.querySelectorAll('.gcc-admin-row').forEach(rowEl => {
        rowEl.onclick = () => openDetail(rowEl.getAttribute('data-user'), rowEl.getAttribute('data-role'));
      });
    }

    async function renderQueueTab(el, tab) {
      const r = await apiCall(`admin-compliance?action=${QUEUE_ACTIONS[tab]}`, session, { method: 'GET' });
      const items = (r.data && r.data.items) || [];
      el.innerHTML = `
        <div class="gcc-sub">${items.length} en attente de validation</div>
        <div class="gcc-card">
          ${items.length === 0 ? '<div class="gcc-empty">Rien à valider pour le moment. 🎉</div>' : items.map(item => queueRowHtml(tab, item)).join('')}
        </div>
      `;
      el.querySelectorAll('.gcc-queue-open').forEach(btn => {
        btn.onclick = () => openDetail(btn.getAttribute('data-user'), btn.getAttribute('data-role'));
      });
      el.querySelectorAll('.gcc-queue-action').forEach(btn => {
        btn.onclick = async () => {
          btn.disabled = true;
          const resp = await apiCall('admin-compliance', session, {
            method: 'POST',
            body: JSON.stringify({ action: QUEUE_STATUS_ACTION[tab], id: btn.getAttribute('data-id'), status: btn.getAttribute('data-status') }),
          });
          if (resp.ok && resp.data && resp.data.ok) { toast('✅ Mis à jour'); renderQueueTab(el, tab); }
          else { toast('❌ Erreur'); btn.disabled = false; }
        };
      });
    }

    function queueRowHtml(tab, item) {
      const name = item.first_name ? `${esc(item.first_name)} ${esc(item.last_name || '')}` : esc(item.email || 'Utilisateur');
      const roleLabel = item.role === 'vendeur' ? 'Vendeur' : 'Ambassadeur';
      let detail = '';
      if (tab === 'contrats') detail = `${esc(item.contract_version)} · signé le ${new Date(item.signed_at).toLocaleString('fr-FR')}`;
      else if (tab === 'documents') detail = `${docTypeLabel(item.doc_type)} · ${esc(item.file_name)}`;
      else if (tab === 'paiements') detail = `${esc(item.iban)} · ${esc(item.account_holder)}`;
      const link = item.pdf_url ? `<a href="${item.pdf_url}" target="_blank" rel="noopener" style="color:#F0D080;font-size:12px;margin-right:8px">PDF</a>`
        : item.url ? `<a href="${item.url}" target="_blank" rel="noopener" style="color:#F0D080;font-size:12px;margin-right:8px">Voir</a>` : '';
      return `
        <div class="gcc-admin-row">
          <div class="gcc-admin-avatar">${esc((item.first_name || item.email || '?')[0] || '?').toUpperCase()}</div>
          <div class="gcc-admin-info">
            <div class="gcc-admin-name">${name} <span style="color:#6e6860;font-weight:400">· ${roleLabel}</span></div>
            <div class="gcc-admin-meta">${detail}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin:0 0 14px 46px">
          ${link}
          <button type="button" class="gcc-btn gcc-btn-gold gcc-queue-action" data-id="${item.id}" data-status="validated" style="padding:7px 12px;width:auto">Valider</button>
          <button type="button" class="gcc-btn gcc-btn-ghost gcc-queue-action" data-id="${item.id}" data-status="refused" style="padding:7px 12px;width:auto">Refuser</button>
          <button type="button" class="gcc-btn gcc-btn-ghost gcc-queue-open" data-user="${esc(item.user_id)}" data-role="${esc(item.role)}" style="padding:7px 12px;width:auto">Voir la fiche</button>
        </div>
      `;
    }

    async function renderHistoriqueTabAdmin(el) {
      const r = await apiCall('admin-compliance?action=global_history', session, { method: 'GET' });
      const items = (r.data && r.data.items) || [];
      el.innerHTML = `
        <div class="gcc-sub">${items.length} évènement(s) récents</div>
        <div class="gcc-card">
          ${items.length === 0 ? '<div class="gcc-empty">Aucun évènement.</div>' : items.map(a => `
            <div class="gcc-hist-row">
              <div class="gcc-hist-date">${new Date(a.created_at).toLocaleString('fr-FR')}</div>
              <div class="gcc-hist-txt">${actionLabel(a.action)} — ${esc(a.first_name || a.email || 'Utilisateur')} (${a.role === 'vendeur' ? 'Vendeur' : 'Ambassadeur'})</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    async function openDetail(userId, role) {
      const overlay = document.createElement('div');
      overlay.className = 'gcc-modal-overlay';
      overlay.innerHTML = `<div class="gcc-modal"><button class="gcc-modal-close">✕</button><div class="gcc-empty">Chargement…</div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('.gcc-modal-close').onclick = () => overlay.remove();
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

      const r = await apiCall(`admin-compliance?action=detail&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`, session, { method: 'GET' });
      const d = r.data && r.data.dossier;
      const modal = overlay.querySelector('.gcc-modal');
      if (!d) { modal.innerHTML = '<button class="gcc-modal-close">✕</button><div class="gcc-empty">Dossier introuvable.</div>'; overlay.querySelector('.gcc-modal-close').onclick = () => overlay.remove(); return; }

      const p = d.profile || {};
      // "Date de validation" — pas un champ stocké séparément (le dossier
      // devient conforme dès que le dernier item requis est validé) : on la
      // déduit du plus récent admin_reviewed_at parmi les éléments requis,
      // uniquement affichée si le dossier est effectivement conforme.
      let validatedAt = null;
      if (d.status === 'conforme') {
        const dates = [
          ...(d.signatures || []).map(s => s.admin_reviewed_at),
          ...(d.payment_history || []).map(pay => pay.admin_reviewed_at),
        ].filter(Boolean).map(x => new Date(x).getTime());
        if (dates.length > 0) validatedAt = new Date(Math.max(...dates));
      }
      modal.innerHTML = `
        <button class="gcc-modal-close">✕</button>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
          <div class="gcc-admin-avatar" style="width:44px;height:44px;font-size:16px">${esc((p.first_name || 'U')[0] || 'U').toUpperCase()}</div>
          <div>
            <h3 style="font-size:17px">${esc(p.first_name || '')} ${esc(p.last_name || '')}</h3>
            <div style="font-size:12px;color:#a8a090">${role === 'vendeur' ? 'Vendeur' : 'Ambassadeur'} · score ${d.score}% · ${d.status === 'conforme' ? '🟢 Dossier validé' : '🟡 Dossier incomplet'}</div>
          </div>
        </div>
        ${validatedAt ? `<div style="font-size:11.5px;color:#30d158;margin-bottom:12px">Conforme depuis le ${validatedAt.toLocaleString('fr-FR')}</div>` : ''}

        <div style="font-size:12.5px;color:#c8c2b8;line-height:1.9;margin-bottom:16px">
          Né(e) le ${p.birth_date ? new Date(p.birth_date).toLocaleDateString('fr-FR') : '—'} à ${esc(p.birth_place || '—')}<br>
          Adresse : ${esc(p.address || '—')}<br>
          Statut : ${esc(p.legal_status || '—')} · SIRET : ${esc(p.siret || '—')}
        </div>

        <h4 style="font-size:12.5px;color:#a8a090;text-transform:uppercase;margin-bottom:8px">Contrats</h4>
        ${(d.signatures || []).length === 0 ? '<div class="gcc-empty">Aucune signature.</div>' : (d.signatures || []).map(s => `
          <div class="gcc-doc-row">
            <div class="gcc-doc-info"><div class="gcc-doc-name">${esc(s.contract_version)}</div><div class="gcc-doc-meta">${new Date(s.signed_at).toLocaleString('fr-FR')} · IP ${esc(s.ip_address || '—')}</div></div>
            <span class="gcc-badge ${s.admin_status}">${statusLabel(s.admin_status)}</span>
            ${s.pdf_url ? `<a href="${s.pdf_url}" target="_blank" rel="noopener" style="color:#F0D080;font-size:12px;margin-left:8px">PDF</a>` : ''}
          </div>
          <div style="display:flex;gap:8px;margin:8px 0 14px">
            <button class="gcc-btn gcc-btn-gold gcc-admin-action" data-action="set_contract_status" data-id="${s.id}" data-status="validated" style="padding:8px">Valider</button>
            <button class="gcc-btn gcc-btn-ghost gcc-admin-action" data-action="set_contract_status" data-id="${s.id}" data-status="refused" style="padding:8px">Refuser</button>
          </div>
        `).join('')}

        <h4 style="font-size:12.5px;color:#a8a090;text-transform:uppercase;margin-bottom:8px">Documents</h4>
        ${(d.documents || []).length === 0 ? '<div class="gcc-empty">Aucun document.</div>' : (d.documents || []).map(doc => `
          <div class="gcc-doc-row">
            <div class="gcc-doc-info"><div class="gcc-doc-name">${esc(doc.file_name)}</div><div class="gcc-doc-meta">${docTypeLabel(doc.doc_type)}</div></div>
            <span class="gcc-badge ${doc.admin_status}">${statusLabel(doc.admin_status)}</span>
            ${doc.url ? `<a href="${doc.url}" target="_blank" rel="noopener" style="color:#F0D080;font-size:12px;margin-left:8px">Voir</a>` : ''}
          </div>
          <div style="display:flex;gap:8px;margin:8px 0 14px">
            <button class="gcc-btn gcc-btn-gold gcc-admin-action" data-action="set_document_status" data-id="${doc.id}" data-status="validated" style="padding:8px">Valider</button>
            <button class="gcc-btn gcc-btn-ghost gcc-admin-action" data-action="set_document_status" data-id="${doc.id}" data-status="refused" style="padding:8px">Refuser</button>
          </div>
        `).join('')}

        <h4 style="font-size:12.5px;color:#a8a090;text-transform:uppercase;margin-bottom:8px">RIB</h4>
        ${(d.payment_history || []).length === 0 ? '<div class="gcc-empty">Aucun RIB renseigné.</div>' : (d.payment_history || []).slice(0, 1).map(pay => `
          <div class="gcc-doc-row">
            <div class="gcc-doc-info"><div class="gcc-doc-name">${esc(pay.iban)}</div><div class="gcc-doc-meta">${esc(pay.account_holder)} · ${esc(pay.bic)}</div></div>
            <span class="gcc-badge ${pay.admin_status}">${statusLabel(pay.admin_status)}</span>
          </div>
          <div style="display:flex;gap:8px;margin:8px 0 4px">
            <button class="gcc-btn gcc-btn-gold gcc-admin-action" data-action="set_payment_status" data-id="${pay.id}" data-status="validated" style="padding:8px">Valider</button>
            <button class="gcc-btn gcc-btn-ghost gcc-admin-action" data-action="set_payment_status" data-id="${pay.id}" data-status="refused" style="padding:8px">Refuser</button>
          </div>
        `).join('')}
      `;
      modal.querySelector('.gcc-modal-close').onclick = () => overlay.remove();
      modal.querySelectorAll('.gcc-admin-action').forEach(btn => {
        btn.onclick = async () => {
          btn.disabled = true;
          const resp = await apiCall('admin-compliance', session, {
            method: 'POST',
            body: JSON.stringify({ action: btn.getAttribute('data-action'), id: btn.getAttribute('data-id'), status: btn.getAttribute('data-status') }),
          });
          if (resp.ok && resp.data && resp.data.ok) {
            toast('✅ Mis à jour');
            overlay.remove();
            openDetail(userId, role);
          } else {
            toast('❌ Erreur');
            btn.disabled = false;
          }
        };
      });
    }

    init();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ADMIN — "Informations légales" (Administration → Informations légales)
  //  Remplit automatiquement tous les contrats générés (voir
  //  _lib/compliance/contracts.js) — c'est ici qu'on fait disparaître les
  //  marqueurs "[À CONFIGURER]". Inclut aussi la gestion des versions de
  //  contrat (v1, v2, v3... — "publier une nouvelle version validée").
  // ══════════════════════════════════════════════════════════════════════

  function LegalInfoPage(container, opts) {
    const getSession = opts.getSession;
    const apiCall = opts.apiCall || defaultApiCall;
    let session = null;
    let templateRole = 'vendeur';

    async function init() {
      injectStyle();
      session = await getSession();
      if (!session) { container.innerHTML = '<div class="gcc-root gcc-empty">Connexion requise.</div>'; return; }
      await renderAll();
    }

    async function renderAll() {
      container.innerHTML = `
        <div class="gcc-root">
          <div class="gcc-h1">⚖️ Informations légales</div>
          <div class="gcc-sub">Remplit automatiquement tous les contrats générés — aucune valeur codée en dur.</div>
          <div id="gcc-legal-form"></div>
          <div class="gcc-h1" style="margin-top:28px;font-size:18px">📄 Versions de contrat</div>
          <div class="gcc-sub">Publier une nouvelle version validée par un juriste, sans déploiement.</div>
          <div id="gcc-template-manager"></div>
        </div>
      `;
      await renderLegalForm(container.querySelector('#gcc-legal-form'));
      await renderTemplateManager(container.querySelector('#gcc-template-manager'));
    }

    async function renderLegalForm(el) {
      el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Chargement…</div></div>`;
      const r = await apiCall('admin-legal-info', session, { method: 'GET' });
      const info = (r.data && r.data.info) || {};
      const logoUrl = r.data && r.data.logoUrl;
      const signatureUrl = r.data && r.data.signatureUrl;

      el.innerHTML = `
        <div class="gcc-card">
          <h3>Identité de la Société</h3>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Nom de la société</label><input id="gli-company-name" value="${esc(info.company_name || '')}"></div>
            <div class="gcc-field"><label>Nom du représentant légal</label><input id="gli-rep-name" value="${esc(info.legal_rep_name || '')}"></div>
          </div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Qualité du représentant</label><input id="gli-rep-title" placeholder="Fondateur, Président..." value="${esc(info.legal_rep_title || '')}"></div>
            <div class="gcc-field"><label>SIRET</label><input id="gli-siret" value="${esc(info.siret || '')}"></div>
          </div>
          <div class="gcc-field"><label>Adresse complète</label><input id="gli-address" value="${esc(info.address || '')}"></div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Code postal</label><input id="gli-postal" value="${esc(info.postal_code || '')}"></div>
            <div class="gcc-field"><label>Ville</label><input id="gli-city" value="${esc(info.city || '')}"></div>
          </div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Pays</label><input id="gli-country" value="${esc(info.country || 'France')}"></div>
            <div class="gcc-field"><label>Numéro de TVA</label><input id="gli-vat" value="${esc(info.vat_number || '')}"></div>
          </div>
          <div class="gcc-row2">
            <div class="gcc-field"><label>Email</label><input id="gli-email" type="email" value="${esc(info.email || '')}"></div>
            <div class="gcc-field"><label>Téléphone</label><input id="gli-phone" value="${esc(info.phone || '')}"></div>
          </div>

          <div class="gcc-row2">
            <div>
              <label style="display:block;font-size:11.5px;color:#a8a090;margin-bottom:5px;font-weight:600;text-transform:uppercase">Logo</label>
              ${logoUrl ? `<img src="${logoUrl}" style="max-width:120px;max-height:60px;display:block;margin-bottom:8px;border-radius:6px">` : ''}
              <div class="gcc-upload-zone" id="gli-logo-zone" style="padding:14px">📤 ${logoUrl ? 'Remplacer le logo' : 'Ajouter un logo'}</div>
              <input type="file" id="gli-logo-input" accept="image/png,image/jpeg,image/svg+xml" style="display:none">
            </div>
            <div>
              <label style="display:block;font-size:11.5px;color:#a8a090;margin-bottom:5px;font-weight:600;text-transform:uppercase">Signature officielle</label>
              ${signatureUrl ? `<img src="${signatureUrl}" style="max-width:120px;max-height:60px;display:block;margin-bottom:8px;border-radius:6px;background:#fff">` : ''}
              <div class="gcc-upload-zone" id="gli-sig-zone" style="padding:14px">📤 ${signatureUrl ? 'Remplacer la signature' : 'Ajouter une signature'}</div>
              <input type="file" id="gli-sig-input" accept="image/png,image/jpeg" style="display:none">
            </div>
          </div>

          <button class="gcc-btn gcc-btn-gold" id="gli-save" style="margin-top:14px">Enregistrer</button>
        </div>
      `;

      let pendingLogoDataUrl = null;
      let pendingSignatureDataUrl = null;
      const logoZone = el.querySelector('#gli-logo-zone');
      const logoInput = el.querySelector('#gli-logo-input');
      logoZone.onclick = () => logoInput.click();
      logoInput.onchange = async () => {
        const file = logoInput.files[0];
        if (!file) return;
        pendingLogoDataUrl = await fileToDataUrl(file);
        logoZone.textContent = `✓ ${file.name} (sera enregistré)`;
      };
      const sigZone = el.querySelector('#gli-sig-zone');
      const sigInput = el.querySelector('#gli-sig-input');
      sigZone.onclick = () => sigInput.click();
      sigInput.onchange = async () => {
        const file = sigInput.files[0];
        if (!file) return;
        pendingSignatureDataUrl = await fileToDataUrl(file);
        sigZone.textContent = `✓ ${file.name} (sera enregistrée)`;
      };

      el.querySelector('#gli-save').onclick = async () => {
        const body = {
          company_name: el.querySelector('#gli-company-name').value,
          legal_rep_name: el.querySelector('#gli-rep-name').value,
          legal_rep_title: el.querySelector('#gli-rep-title').value,
          siret: el.querySelector('#gli-siret').value,
          address: el.querySelector('#gli-address').value,
          postal_code: el.querySelector('#gli-postal').value,
          city: el.querySelector('#gli-city').value,
          country: el.querySelector('#gli-country').value,
          vat_number: el.querySelector('#gli-vat').value,
          email: el.querySelector('#gli-email').value,
          phone: el.querySelector('#gli-phone').value,
        };
        if (pendingLogoDataUrl) body.logoDataUrl = pendingLogoDataUrl;
        if (pendingSignatureDataUrl) body.signatureDataUrl = pendingSignatureDataUrl;
        const resp = await apiCall('admin-legal-info', session, { method: 'POST', body: JSON.stringify(body) });
        if (resp.ok && resp.data && resp.data.ok) { toast('✅ Informations légales enregistrées'); await renderLegalForm(el); }
        else toast('❌ Erreur lors de l\'enregistrement');
      };
    }

    async function renderTemplateManager(el) {
      el.innerHTML = `<div class="gcc-card"><div class="gcc-empty">Chargement…</div></div>`;
      const r = await apiCall(`admin-contract-templates?role=${templateRole}`, session, { method: 'GET' });
      const templates = (r.data && r.data.templates) || [];
      const current = templates.find(t => t.is_current) || templates[0];

      el.innerHTML = `
        <div class="gcc-card">
          <div class="gcc-tabs">
            <div class="gcc-tab ${templateRole === 'vendeur' ? 'on' : ''}" data-role="vendeur">Vendeur</div>
            <div class="gcc-tab ${templateRole === 'ambassadeur' ? 'on' : ''}" data-role="ambassadeur">Ambassadeur</div>
          </div>
          <h3>Historique des versions</h3>
          ${templates.length === 0 ? '<div class="gcc-empty">Aucune version publiée.</div>' : templates.map(t => `
            <div class="gcc-doc-row">
              <div class="gcc-doc-info">
                <div class="gcc-doc-name">${esc(t.version)} ${t.is_current ? '· en vigueur' : ''}</div>
                <div class="gcc-doc-meta">Publiée le ${new Date(t.published_at).toLocaleString('fr-FR')}${t.change_notes ? ' — ' + esc(t.change_notes) : ''}</div>
              </div>
              ${t.is_current ? '<span class="gcc-badge validated">Courante</span>' : ''}
            </div>
          `).join('')}

          <h3 style="margin-top:18px">Publier une nouvelle version</h3>
          <div style="font-size:12px;color:#a8a090;margin-bottom:10px">⚠️ Comme l'exige le document original, toute nouvelle version doit être relue et validée par un avocat/juriste avant publication.</div>
          <textarea id="gcc-template-body" style="width:100%;min-height:260px;background:#161616;border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:12px;color:#f5f0e8;font-size:12px;font-family:monospace;margin-bottom:10px">${esc((current && current.body) || '')}</textarea>
          <div class="gcc-field"><label>Notes de version (visibles en interne uniquement)</label><input id="gcc-template-notes" placeholder="Ex: clause de résiliation mise à jour suite à relecture juridique"></div>
          <button class="gcc-btn gcc-btn-gold" id="gcc-template-publish">Publier comme nouvelle version</button>
        </div>
      `;

      el.querySelectorAll('.gcc-tab').forEach(tab => {
        tab.onclick = () => { templateRole = tab.getAttribute('data-role'); renderTemplateManager(el); };
      });

      el.querySelector('#gcc-template-publish').onclick = async () => {
        const body = el.querySelector('#gcc-template-body').value;
        const notes = el.querySelector('#gcc-template-notes').value;
        if (!confirm(`Publier une nouvelle version du contrat ${templateRole} ? Elle s'appliquera immédiatement à toute nouvelle signature.`)) return;
        const resp = await apiCall('admin-contract-templates', session, {
          method: 'POST',
          body: JSON.stringify({ role: templateRole, body, change_notes: notes }),
        });
        if (resp.ok && resp.data && resp.data.ok) { toast(`✅ Version ${resp.data.version} publiée`); await renderTemplateManager(el); }
        else toast('❌ ' + (resp.data && resp.data.message || 'Erreur lors de la publication'));
      };
    }

    init();
  }

  window.GCCompliance = {
    mount: (container, opts) => Dossier(container, opts),
    mountAdmin: (container, opts) => AdminPanel(container, opts),
    mountLegalInfo: (container, opts) => LegalInfoPage(container, opts),
  };
})();
