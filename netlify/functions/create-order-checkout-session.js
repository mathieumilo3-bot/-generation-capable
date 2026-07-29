// netlify/functions/create-order-checkout-session.js
//
// Crée une session Stripe Checkout pour une COMMANDE du CRM vendeur (prix
// libre défini par le vendeur pour un client précis — site internet, IA,
// accompagnement...), distincte de create-checkout-session.js qui ne gère
// que l'abonnement fixe Génération Capable à 67€/mois.
//
// Le vendeur ne peut JAMAIS déclarer un paiement manuellement (voir
// advance_prospect_stage() en base, qui refuse explicitement l'étape
// "paid") : seul le webhook Stripe (stripe-webhook.js), après confirmation
// réelle du paiement, fait passer la commande à "paid".
//
// POST /.netlify/functions/create-order-checkout-session
//   (Authorization: Bearer <session_token> requis)
//   body: { order_id }
//   → { url: 'https://checkout.stripe.com/...' }

const { stripeRequest } = require('./_lib/stripe-rest');
const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

function safeOrigin(event) {
  const candidate = event.headers.origin || `https://${event.headers.host || ''}`;
  try {
    const u = new URL(candidate);
    if (u.hostname === 'generationcapable.fr' || u.hostname.endsWith('.netlify.app') || u.hostname === 'localhost') {
      return u.origin;
    }
  } catch (e) { /* URL invalide → fallback ci-dessous */ }
  return 'https://generationcapable.fr';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.STRIPE_SECRET_KEY) {
    console.error('[create-order-checkout-session] Variables Supabase/Stripe manquantes sur Netlify.');
    return jsonResponse(200, { error: 'SERVER_NOT_CONFIGURED', message: 'Paiement indisponible pour le moment — réessaie plus tard.' });
  }

  const { id: sellerId, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { error: authError });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  const { order_id: orderId } = payload;
  if (!orderId) {
    return jsonResponse(400, { error: 'MISSING_ORDER_ID' });
  }

  try {
    // On lit la commande en service_role plutôt que via le token du vendeur
    // (RLS n'autorise que le SELECT) pour pouvoir ensuite la mettre à jour
    // ici même — mais on vérifie nous-mêmes que le vendeur authentifié est
    // bien le propriétaire, jamais une confiance aveugle dans order_id fourni.
    const orderResp = await supabaseAdminRequest(
      `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,seller_user_id,prospect_id,product_type,price,status,stripe_session_id`
    );
    const orders = await orderResp.json();
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) {
      return jsonResponse(404, { error: 'ORDER_NOT_FOUND' });
    }
    if (order.seller_user_id !== sellerId) {
      console.error('[create-order-checkout-session] Tentative d\'accès à une commande d\'un autre vendeur', { sellerId, orderId });
      return jsonResponse(403, { error: 'FORBIDDEN' });
    }
    // "draft" (premier lien) et "awaiting_payment" (régénération d'un lien —
    // client qui l'a perdu, lien expiré...) sont tous deux acceptés. Au-delà
    // (paid/production/...), la commande est déjà réglée ou verrouillée.
    if (order.status !== 'draft' && order.status !== 'awaiting_payment') {
      return jsonResponse(200, { error: 'ORDER_NOT_PAYABLE', message: `Cette commande n'est plus payable (statut actuel: ${order.status}).` });
    }
    if (!order.price || order.price <= 0) {
      return jsonResponse(200, { error: 'INVALID_PRICE', message: 'Le prix de la commande est invalide.' });
    }

    const prospectResp = await supabaseAdminRequest(
      `/rest/v1/prospects?id=eq.${encodeURIComponent(order.prospect_id)}&select=email,first_name,last_name`
    );
    const prospects = await prospectResp.json();
    const prospect = Array.isArray(prospects) ? prospects[0] : null;

    const origin = safeOrigin(event);
    const productLabels = {
      site_internet: 'Site Internet',
      ia: 'Solution IA',
      generation_capable: 'Génération Capable',
      accompagnement: 'Accompagnement',
      autre: 'Prestation',
    };

    const { ok, status, data } = await stripeRequest('POST', '/checkout/sessions', {
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: productLabels[order.product_type] || 'Prestation Génération Capable' },
          unit_amount: order.price,
        },
        quantity: 1,
      }],
      customer_email: prospect?.email || undefined,
      client_reference_id: orderId,
      success_url: `${origin}/?order_checkout=success&order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?order_checkout=cancelled&order_id=${orderId}`,
      metadata: { order_id: orderId, prospect_id: order.prospect_id, seller_user_id: sellerId },
    });

    if (!ok) {
      console.error('[create-order-checkout-session] Erreur Stripe', status, JSON.stringify(data));
      return jsonResponse(200, { error: 'STRIPE_ERROR', message: data?.error?.message || 'Erreur Stripe' });
    }

    // Réservation immédiate du lien créé : la commande passe en
    // "awaiting_payment" pour apparaître dans "paiements en cours" du
    // wallet, même avant que le client n'ait payé.
    await supabaseAdminRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ stripe_session_id: data.id, status: 'awaiting_payment', updated_at: new Date().toISOString() }),
    });

    return jsonResponse(200, { url: data.url });

  } catch (e) {
    console.error('[create-order-checkout-session] NETWORK_ERROR', e);
    return jsonResponse(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};
