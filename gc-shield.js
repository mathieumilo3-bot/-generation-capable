(function(){
  'use strict';

  const CONFIG = {
    signatureMetaName: 'gc-signature-id',
    verificationEndpoint: '/.netlify/functions/gc-shield-signature',
    paymentEndpoint: '/.netlify/functions/gc-shield-payment'
  };

  function getSignatureId(){
    const meta = document.querySelector(`meta[name="${CONFIG.signatureMetaName}"]`);
    return meta ? meta.getAttribute('content') : null;
  }

  async function verifySignature(signatureId){
    if(!signatureId) return { valid:false, reason:'missing_signature' };
    const response = await fetch(`${CONFIG.verificationEndpoint}?id=${encodeURIComponent(signatureId)}`);
    return response.json();
  }

  async function startPayment(payload){
    try{
      const response = await fetch(CONFIG.paymentEndpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload || {})
      });
      const data = await response.json();
      if(!response.ok || data.error) throw new Error(data.error || 'PAYMENT_ENDPOINT_FAILED');
      return data.checkout_url || null;
    }catch(error){
      console.warn('[GC Shield] Paiement centralisé indisponible, repli legacy:', error.message);
      return null;
    }
  }

  async function mountBadge(){
    const signatureId = getSignatureId();
    if(!signatureId) return;
    const badge = document.createElement('a');
    badge.href = `/verify.html?id=${encodeURIComponent(signatureId)}`;
    badge.textContent = '🛡️ Site vérifié GC Shield';
    badge.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9998;background:rgba(0,0,0,.82);border:1px solid rgba(229,185,74,.45);color:#f2cd73;padding:8px 11px;border-radius:999px;font:700 11px system-ui;text-decoration:none;backdrop-filter:blur(12px)';
    document.addEventListener('DOMContentLoaded', async function(){
      document.body.appendChild(badge);
      try{
        const result = await verifySignature(signatureId);
        if(!result.valid){ badge.textContent = '⚠️ Signature GC non vérifiée'; badge.style.color = '#ff9f0a'; }
      }catch(_){ badge.textContent = '🛡️ Vérification GC Shield'; }
    });
  }

  window.GCShield = { getSignatureId, verifySignature, startPayment };
  mountBadge();
})();
