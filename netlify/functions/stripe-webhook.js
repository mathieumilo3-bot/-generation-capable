// netlify/functions/stripe-webhook.js
//
// Source de vérité pour tout ce qui arrive à un abonnement APRÈS le paiement
// initial : renouvellement, échec de paiement, annulation, remboursement.
// (Le déblocage immédiat post-paiement est géré par verify-checkout-session.js,
// qui ne couvre que le retour synchrone du navigateur.)
//
// Vérifie la signature Stripe (HMAC-SHA256 sur `${timestamp}.${rawBody}`,
// comparaison en temps constant) avant de faire confiance à quoi que ce
// soit dans le corps de la requête — n'importe qui peut poster un JSON qui
// RESSEMBLE à un événement Stripe sur cette URL publique, seule la
// signature prouve que ça vient réellement de Stripe.
//
// Pas de SDK Stripe (voir _lib/stripe-rest.js) : l'algorithme de signature
// est implémenté ici avec le module "crypto" natif de Node, documenté par
// Stripe : https://stripe.com/docs/webhooks#verify-manually
//
// Configuration Stripe Dashboard → Developers → Webhooks → Add endpoint :
//   URL      : https://generationcapable.fr/.netlify/functions/stripe-webhook
//   Events   : checkout.session.completed, customer.subscription.updated,
//              customer.subscription.deleted, invoice.payment_failed,
//              charge.refunded, charge.dispute.created
//   → copier le "Signing secret" (whsec_...) dans STRIPE_WEBHOOK_SECRET (Netlify).
//
// Deux flux distincts partagent ce webhook, différenciés par la présence de
// metadata.order_id (posé uniquement par create-order-checkout-session.js) :
//   1. Abonnement Génération Capable 67€/mois (metadata.offer) — inchangé.
//   2. Commande CRM vendeur (metadata.order_id) — commande → sales → commission
//      → wallet. Le vendeur ne déclare jamais "payé" lui-même : c'est ici,
//      et seulement ici, que orders.status passe à 'paid'.

const crypto = require('crypto');
const { supabaseAdminRequest, jsonResponse, ensureAuthUserForEmail } = require('./_lib/supabase-admin');
const { notifyAdmins, sendToUser, safeNotify, startOfLocalDayUTC, localDateKey } = require('./_lib/notifications/send');
const { referralFieldsForSubscriber } = require('./_lib/referral');

const TOLERANCE_SECONDS = 5 * 60; // rejette les événements trop vieux (anti-rejeu)
const BIG_SALE_THRESHOLD_CENTS = Number(process.env.BIG_SALE_THRESHOLD_CENTS || 100000); // 1000€
const DAILY_SALES_GOAL_CENTS = Number(process.env.DAILY_SALES_GOAL_CENTS || 0); // 0 = désactivé

function formatEuros(amountCents) {
  return ((amountCents || 0) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €';
}

// Best-effort, jamais bloquant : voir safeNotify() dans _lib/notifications/send.js.
async function getEmailByUserId(userId) {
  try {
    const r = await supabaseAdminRequest(`/auth/v1/admin/users/${userId}`);
    if (!r.ok) return null;
    const data = await r.json();
    return data && data.email ? data.email : null;
  } catch (e) {
    return null;
  }
}

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return { valid: false, reason: 'MISSING_SIGNATURE' };

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, v] = p.split('=');
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return { valid: false, reason: 'MALFORMED_SIGNATURE' };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { valid: false, reason: 'TIMESTAMP_OUT_OF_TOLERANCE' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  }
  return { valid: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET absente sur Netlify — impossible de vérifier les événements.');
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  const signatureHeader = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const verification = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.valid) {
    console.error('[stripe-webhook] Signature invalide:', verification.reason);
    return jsonResponse(400, { error: 'INVALID_SIGNATURE' });
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse(400, { error: 'INVALID_JSON' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY absente — événement signature-valide mais non traité.');
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  try {
    await recordAndProcess(stripeEvent);
    return jsonResponse(200, { received: true });
  } catch (e) {
    console.error('[stripe-webhook] Erreur de traitement', stripeEvent?.type, e);
    // Alerte admin "Erreur serveur" — le webhook Stripe est le flux le plus
    // critique du site, une erreur ici mérite une alerte immédiate. Best
    // effort : ne doit jamais empêcher la réponse 500 (qui déclenche le
    // retry Stripe) de partir.
    await safeNotify(() => notifyAdmins({
      category: 'admin.technical.server_error',
      eventKey: `server_error:${stripeEvent?.id || Date.now()}`,
      ctx: { contexte: `stripe-webhook (${stripeEvent?.type || 'type inconnu'})`, message: String(e && e.message || e).slice(0, 200) },
    }));
    // 500 → Stripe réessaiera automatiquement cet événement plus tard.
    return jsonResponse(500, { error: 'PROCESSING_ERROR' });
  }
};

async function recordAndProcess(stripeEvent) {
  // Idempotence en deux temps ("vu" puis "terminé"), pas une seule insertion
  // avant traitement : avec les handlers multi-étapes ci-dessous
  // (handleOrderPaid fait 5 lectures/écritures séquentielles), un échec
  // transitoire à n'importe quelle étape aurait, avec une simple insertion
  // préalable, bloqué DÉFINITIVEMENT tout retry Stripe de cet événement —
  // Stripe réessaie sur une réponse 500, mais le retry aurait été
  // silencieusement ignoré par la déduplication (voir migration 0013).
  const existingResp = await supabaseAdminRequest(
    `/rest/v1/stripe_events_processed?event_id=eq.${encodeURIComponent(stripeEvent.id)}&select=completed_at`
  );
  const existing = existingResp.ok ? await existingResp.json() : [];
  if (Array.isArray(existing) && existing.length > 0 && existing[0].completed_at) {
    console.log('[stripe-webhook] Événement déjà traité avec succès, ignoré:', stripeEvent.id, stripeEvent.type);
    return;
  }
  if (!Array.isArray(existing) || existing.length === 0) {
    await supabaseAdminRequest('/rest/v1/stripe_events_processed', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ event_id: stripeEvent.id, event_type: stripeEvent.type })
    });
  }

  const obj = stripeEvent.data?.object || {};

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      if (obj.metadata?.order_id) {
        await handleOrderPaid(obj, stripeEvent);
        break;
      }

      const email = (obj.customer_details?.email || obj.customer_email || '').toLowerCase();
      const offer = obj.metadata?.offer || 'gc_67';
      if (email) {
        // Le schéma "subscribers" de production est indexé sur user_id, pas
        // email — Stripe ne connaissant que l'email du payeur, on retrouve
        // (ou crée) le compte Supabase Auth correspondant avant d'écrire.
        const user = await ensureAuthUserForEmail(email);

        // Lu AVANT l'upsert : seule façon de savoir si c'est une toute
        // première activation ("Nouveau vendeur inscrit") ou une simple
        // réactivation d'un abonnement déjà connu.
        const existingResp = await supabaseAdminRequest(`/rest/v1/subscribers?user_id=eq.${user.id}&select=is_active`);
        const existingRows = existingResp.ok ? await existingResp.json() : [];
        const wasActiveBefore = !!(existingRows && existingRows[0] && existingRows[0].is_active);

        // ATTRIBUTION AMBASSADEUR.
        // Le slug a été posé dans les metadata Stripe par
        // create-checkout-session.js : on le relit ici depuis l'objet Stripe
        // (donc côté serveur, après vérification de la signature du webhook)
        // et jamais depuis le navigateur. La logique "ne jamais réattribuer un
        // abonné qui a déjà un parrain" vit dans _lib/referral.js, partagée
        // avec verify-checkout-session.js pour que les deux chemins ne
        // puissent pas diverger.
        const referralFields = await referralFieldsForSubscriber(user.id, obj.metadata?.ref);

        await upsertSubscriberByUserId(user.id, {
          is_active: true,
          stripe_customer_id: obj.customer || null,
          ...referralFields,
        });
        await supabaseAdminRequest('/rest/v1/sales', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            stripe_session_id: obj.id || null,
            stripe_payment_intent: obj.payment_intent || null,
            stripe_customer_id: obj.customer || null,
            buyer_user_id: user.id,
            product_id: offer,
            product_name: 'Génération Capable — 67€/mois',
            amount: obj.amount_total ?? 0,
            currency: obj.currency || 'eur',
            status: 'completed',
            stripe_event_id: stripeEvent.id,
            source: 'stripe_webhook',
          })
        });

        // Notifications — jamais bloquantes pour le flux paiement (voir
        // safeNotify). Le lead marketing correspondant (s'il existe, capturé
        // par capture-lead.js au moment de l'inscription) sort de la
        // séquence de relance email dès la conversion.
        await safeNotify(async () => {
          await supabaseAdminRequest(`/rest/v1/marketing_leads?email=eq.${encodeURIComponent(email)}&converted=eq.false`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ converted: true, converted_at: new Date().toISOString() }),
          });
        });
        if (!wasActiveBefore) {
          await safeNotify(() => notifyAdmins({
            category: 'admin.business.new_seller',
            eventKey: `new_seller:${user.id}`,
            ctx: { email },
          }));
        }
        await safeNotify(() => notifyAdmins({
          category: 'admin.business.stripe_payment_received',
          eventKey: `payment_received:${stripeEvent.id}`,
          ctx: { montant: formatEuros(obj.amount_total) },
        }));
      }
      break;
    }

    case 'customer.subscription.updated': {
      const active = ['active', 'trialing'].includes(obj.status);
      if (obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: active });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      if (obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: false });
      }
      break;
    }

    case 'invoice.payment_failed': {
      // On ne coupe pas l'accès sur un simple échec isolé (Stripe retente
      // automatiquement plusieurs fois — "dunning") : c'est
      // customer.subscription.updated qui déclenchera la désactivation si
      // Stripe finit par marquer l'abonnement past_due/unpaid/canceled.
      await safeNotify(() => notifyAdmins({
        category: 'admin.business.payment_failed',
        eventKey: `payment_failed:${stripeEvent.id}`,
        ctx: {},
      }));
      break;
    }

    case 'charge.refunded': {
      // Une commande CRM (paiement unique) et un abonnement (paiement
      // récurrent) peuvent tous deux être remboursés — on tente d'abord de
      // retrouver une commande via le payment_intent (obj.payment_intent
      // existe sur l'objet Charge), sinon on retombe sur le comportement
      // existant (désactivation d'abonnement par stripe_customer_id).
      const handledAsOrder = await handleOrderRefund(obj);
      if (!handledAsOrder && obj.customer) {
        await updateSubscriberByCustomerId(obj.customer, { is_active: false });
      }
      await safeNotify(() => notifyAdmins({
        category: 'admin.business.refund_processed',
        eventKey: `refund_processed:${stripeEvent.id}`,
        ctx: { montant: formatEuros(obj.amount_refunded ?? obj.amount) },
      }));
      break;
    }

    case 'charge.dispute.created': {
      // Litige Stripe : on gèle la commission concernée (statut 'disputed',
      // exclue du solde disponible/en attente) plutôt que de la laisser
      // comptée normalement pendant l'instruction du litige. Résolution
      // manuelle par l'admin ensuite (hors automatisation Stripe : Stripe ne
      // notifie pas de façon fiable et automatisable une résolution positive).
      await freezeCommissionForDispute(obj);
      // Un litige est, du point de vue de l'admin, une demande de
      // remboursement contestée par le client — c'est le signal le plus
      // proche disponible côté Stripe (voir docs/notifications-system.md).
      await safeNotify(() => notifyAdmins({
        category: 'admin.business.refund_requested',
        eventKey: `dispute:${stripeEvent.id}`,
        ctx: { montant: formatEuros(obj.amount) },
      }));
      break;
    }

    default: {
      // Événement reçu mais non géré par cette intégration — déjà tracé dans
      // stripe_events_processed ci-dessus, rien de plus à faire.
    }
  }

  // Traitement terminé sans erreur (un throw plus haut aurait interrompu
  // l'exécution avant d'arriver ici) : marque définitivement l'événement
  // comme traité, ce qui bloquera tout retry futur — c'est le comportement
  // voulu une fois le traitement réellement complet.
  await supabaseAdminRequest(`/rest/v1/stripe_events_processed?event_id=eq.${encodeURIComponent(stripeEvent.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ completed_at: new Date().toISOString() })
  });
}

async function upsertSubscriberByUserId(userId, fields) {
  await supabaseAdminRequest('/rest/v1/subscribers?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, ...fields, updated_at: new Date().toISOString() })
  });
}


// ── Commandes CRM : commande → vente → commission → wallet ──
//
// Le vendeur ne déclare jamais lui-même qu'une commande est payée
// (advance_prospect_stage() en base refuse explicitement l'étape "paid") :
// c'est cette fonction, déclenchée uniquement par un événement Stripe
// signé, qui fait foi.
// Vérifie qu'une écriture Supabase a réussi ; sinon lève une exception qui
// remonte jusqu'à exports.handler, y renvoie un 500, et déclenche le retry
// automatique de Stripe (voir migration 0013 — un échec ici ne bloque plus
// définitivement le traitement de l'événement). Avant ce fix, un échec
// HTTP sur n'importe laquelle de ces écritures était silencieusement ignoré
// (le code continuait comme si de rien n'était), pouvant laisser une vente
// sans commission, ou une commande "paid" sans jamais avoir généré la
// commission associée — perte d'argent invisible, sans aucune trace.
async function assertOk(resp, context) {
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`${context} — HTTP ${resp.status}: ${body}`);
  }
  return resp;
}

async function handleOrderPaid(session, stripeEvent) {
  const orderId = session.metadata.order_id;

  const orderResp = await supabaseAdminRequest(
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,prospect_id,seller_user_id,product_type,price,commission_rate,status`
  );
  await assertOk(orderResp, `handleOrderPaid: lecture commande ${orderId}`);
  const orders = await orderResp.json();
  const order = Array.isArray(orders) ? orders[0] : null;
  if (!order) {
    console.error('[stripe-webhook] handleOrderPaid: commande introuvable', orderId);
    return;
  }
  if (order.status === 'paid') {
    // Déjà traité par un événement antérieur (protection applicative en plus
    // de la déduplication sur stripeEvent.id — voir migration 0013).
    console.log('[stripe-webhook] handleOrderPaid: commande déjà payée, ignoré', orderId);
    return;
  }

  const productLabels = {
    site_internet: 'Site Internet', ia: 'Solution IA',
    generation_capable: 'Génération Capable', accompagnement: 'Accompagnement', autre: 'Prestation',
  };

  const saleResp = await supabaseAdminRequest('/rest/v1/sales', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      order_id: order.id,
      seller_user_id: order.seller_user_id,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      stripe_customer_id: session.customer || null,
      product_id: order.product_type,
      product_name: productLabels[order.product_type] || 'Prestation',
      amount: session.amount_total ?? order.price,
      currency: session.currency || 'eur',
      status: 'completed',
      stripe_event_id: stripeEvent.id,
      source: 'crm_order',
    })
  });
  await assertOk(saleResp, `handleOrderPaid: création vente pour commande ${orderId}`);
  const sales = await saleResp.json();
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) {
    throw new Error(`handleOrderPaid: la création de la vente pour la commande ${orderId} n'a renvoyé aucune ligne`);
  }

  const commissionAmount = Math.round((session.amount_total ?? order.price) * order.commission_rate);
  const commResp = await supabaseAdminRequest('/rest/v1/commissions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      sale_id: sale.id,
      order_id: order.id,
      seller_id: order.seller_user_id,
      amount: commissionAmount,
      percentage: order.commission_rate,
      status: 'pending',
      // 15 jours de délai avant maturation (voir get_my_wallet() : calculé
      // en direct depuis available_at, jamais un statut qu'un job devrait
      // faire progresser).
      available_at: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    })
  });
  await assertOk(commResp, `handleOrderPaid: création commission pour vente ${sale.id}`);

  const orderPatchResp = await supabaseAdminRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'paid', updated_at: new Date().toISOString() })
  });
  await assertOk(orderPatchResp, `handleOrderPaid: passage à "paid" de la commande ${orderId}`);

  const prospectResp = await supabaseAdminRequest(`/rest/v1/prospects?id=eq.${encodeURIComponent(order.prospect_id)}&select=stage`);
  await assertOk(prospectResp, `handleOrderPaid: lecture prospect ${order.prospect_id}`);
  const prospects = await prospectResp.json();
  const previousStage = prospects?.[0]?.stage || null;
  const prospectPatchResp = await supabaseAdminRequest(`/rest/v1/prospects?id=eq.${encodeURIComponent(order.prospect_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ stage: 'paid', updated_at: new Date().toISOString() })
  });
  await assertOk(prospectPatchResp, `handleOrderPaid: passage du prospect ${order.prospect_id} à "paid"`);
  const historyResp = await supabaseAdminRequest('/rest/v1/prospect_stage_history', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      prospect_id: order.prospect_id,
      seller_user_id: order.seller_user_id,
      from_stage: previousStage,
      to_stage: 'paid',
      justification: 'Paiement confirmé automatiquement par Stripe',
    })
  });
  await assertOk(historyResp, `handleOrderPaid: historique de stage pour prospect ${order.prospect_id}`);

  // Notifications — strictement après que tout ce qui précède a réussi
  // (sale/commission/order/prospect), et entièrement best-effort : voir
  // safeNotify(). Un souci ici ne doit jamais transformer une vente
  // correctement enregistrée en 500 (qui ferait rejouer tout handleOrderPaid
  // par Stripe alors que la commande est déjà 'paid' — protégé plus haut,
  // mais autant ne pas en dépendre).
  await safeNotify(() => runSaleNotifications(sale, order, productLabels[order.product_type] || 'Prestation'));
}

// Notifications déclenchées par une vente CRM confirmée : jalons vendeur
// (première vente / vente / record personnel) et alertes admin (vente,
// grosse vente, record plateforme, objectif journalier).
async function runSaleNotifications(sale, order, productLabel) {
  const montant = formatEuros(sale.amount);
  const sellerEmail = await getEmailByUserId(order.seller_user_id);

  const countResp = await supabaseAdminRequest(
    `/rest/v1/sales?seller_user_id=eq.${order.seller_user_id}&status=eq.completed&select=id`,
    { headers: { Prefer: 'count=exact', Range: '0-0' } }
  );
  const contentRange = countResp.headers.get('content-range') || '';
  const totalSalesForSeller = Number(contentRange.split('/')[1]) || 1;
  const isFirstSale = totalSalesForSeller <= 1;

  await sendToUser({
    userId: order.seller_user_id,
    category: isFirstSale ? 'seller.milestone.first_sale' : 'seller.milestone.sale',
    eventKey: `sale:${sale.id}`,
    ctx: { montant },
  });

  await notifyAdmins({
    category: isFirstSale ? 'admin.business.first_sale' : 'admin.business.sale',
    eventKey: `sale:${sale.id}`,
    ctx: { montant, produit: productLabel, email: sellerEmail },
  });

  if (sale.amount >= BIG_SALE_THRESHOLD_CENTS) {
    await notifyAdmins({
      category: 'admin.business.big_sale',
      eventKey: `big_sale:${sale.id}`,
      ctx: { montant, email: sellerEmail },
    });
  }

  // Record personnel du vendeur (comparé à ses ventes précédentes, jamais
  // stocké séparément — calculé en direct comme le reste du schéma financier).
  const priorMaxResp = await supabaseAdminRequest(
    `/rest/v1/sales?seller_user_id=eq.${order.seller_user_id}&status=eq.completed&id=neq.${sale.id}&select=amount&order=amount.desc&limit=1`
  );
  const priorMaxRows = priorMaxResp.ok ? await priorMaxResp.json() : [];
  const priorMax = priorMaxRows && priorMaxRows[0] ? priorMaxRows[0].amount : 0;
  if (sale.amount > priorMax && !isFirstSale) {
    await sendToUser({
      userId: order.seller_user_id,
      category: 'seller.milestone.record',
      eventKey: `record:${sale.id}`,
      ctx: { montant },
    });
  }

  // Record plateforme "plus grosse vente" — table platform_records.
  const recordResp = await supabaseAdminRequest(`/rest/v1/platform_records?metric=eq.single_sale_amount&select=value`);
  const recordRows = recordResp.ok ? await recordResp.json() : [];
  const currentRecord = recordRows && recordRows[0] ? Number(recordRows[0].value) : 0;
  if (sale.amount > currentRecord) {
    await supabaseAdminRequest('/rest/v1/platform_records?on_conflict=metric', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ metric: 'single_sale_amount', value: sale.amount, achieved_at: new Date().toISOString() }),
    });
    await notifyAdmins({
      category: 'admin.business.sales_record',
      eventKey: `platform_record:single:${sale.id}`,
      ctx: { record: `Plus grosse vente : ${montant}` },
    });
  }

  // CA du jour vs objectif fixé (DAILY_SALES_GOAL_CENTS) — une seule alerte
  // par jour même si plusieurs ventes le franchissent successivement.
  if (DAILY_SALES_GOAL_CENTS > 0) {
    const today = localDateKey('Europe/Paris');
    const startOfDayIso = startOfLocalDayUTC('Europe/Paris').toISOString();
    const startOfDayResp = await supabaseAdminRequest(
      `/rest/v1/sales?status=eq.completed&created_at=gte.${startOfDayIso}&select=amount`
    );
    const todaySales = startOfDayResp.ok ? await startOfDayResp.json() : [];
    const todayTotal = (todaySales || []).reduce((sum, s) => sum + (s.amount || 0), 0);
    if (todayTotal >= DAILY_SALES_GOAL_CENTS) {
      await notifyAdmins({
        category: 'admin.business.daily_goal_reached',
        eventKey: `daily_goal:${today}`,
        ctx: { objectif: formatEuros(DAILY_SALES_GOAL_CENTS) },
      });
    }
  }
}

// Remboursement d'une commande CRM : retrouve la vente via le
// payment_intent du Charge remboursé. Si aucune vente CRM ne correspond
// (ex: remboursement d'un abonnement), renvoie false pour laisser
// l'appelant traiter le cas abonnement existant.
async function handleOrderRefund(charge) {
  if (!charge.payment_intent) return false;

  const saleResp = await supabaseAdminRequest(
    `/rest/v1/sales?stripe_payment_intent=eq.${encodeURIComponent(charge.payment_intent)}&order_id=not.is.null&select=id,order_id`
  );
  await assertOk(saleResp, `handleOrderRefund: recherche vente pour payment_intent ${charge.payment_intent}`);
  const sales = await saleResp.json();
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) return false;

  const commResp = await supabaseAdminRequest(`/rest/v1/commissions?sale_id=eq.${encodeURIComponent(sale.id)}&select=id,status,amount,seller_id,order_id`);
  await assertOk(commResp, `handleOrderRefund: lecture commissions pour vente ${sale.id}`);
  const commissions = await commResp.json();

  for (const c of (commissions || [])) {
    if (c.status === 'pending') {
      // Pas encore versée (mûre ou non) : simple annulation, aucune dette.
      const patchResp = await supabaseAdminRequest(`/rest/v1/commissions?id=eq.${encodeURIComponent(c.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() })
      });
      await assertOk(patchResp, `handleOrderRefund: annulation commission ${c.id}`);
    } else if (c.status === 'withdrawn') {
      // Déjà versée au vendeur : dette qui sera déduite du prochain retrait,
      // jamais une réécriture silencieuse de la ligne historique déjà payée.
      // Montant stocké en magnitude POSITIVE (commissions.amount a un
      // CHECK amount >= 0) : get_my_wallet()/request_payout() SOUSTRAIENT
      // les lignes 'debt' plutôt que de supposer un montant déjà négatif
      // (voir migration 0008 — bug trouvé en testant ce flux par exécution).
      const debtResp = await supabaseAdminRequest('/rest/v1/commissions', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          sale_id: sale.id, order_id: c.order_id, seller_id: c.seller_id,
          amount: Math.abs(c.amount), percentage: 0, status: 'debt',
        })
      });
      await assertOk(debtResp, `handleOrderRefund: création dette pour commission ${c.id}`);
    }
  }

  const orderPatchResp = await supabaseAdminRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(sale.order_id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'refunded', updated_at: new Date().toISOString() })
  });
  await assertOk(orderPatchResp, `handleOrderRefund: passage à "refunded" de la commande ${sale.order_id}`);

  return true;
}

// Gèle la ou les commissions liées à la vente remboursée par le litige.
// Deux cas bien distincts :
//  - commission encore "pending" : gelée en "disputed" directement (rien
//    n'a encore été versé, aucun risque financier immédiat).
//  - commission déjà "withdrawn" (versée au vendeur) : la ligne historique
//    n'est JAMAIS modifiée (même principe que handleOrderRefund) — une
//    ligne "disputed" MIROIR est créée à côté, de la même magnitude,
//    purement informative pour le dashboard admin (get_my_wallet() ne
//    compte "disputed" dans aucun total tant qu'elle n'est pas résolue).
//    Trouvé en auditant ce flux après coup : sans ce cas, un litige arrivant
//    après un retrait ne laissait absolument aucune trace nulle part.
async function freezeCommissionForDispute(charge) {
  if (!charge.payment_intent) return;
  const saleResp = await supabaseAdminRequest(
    `/rest/v1/sales?stripe_payment_intent=eq.${encodeURIComponent(charge.payment_intent)}&order_id=not.is.null&select=id`
  );
  await assertOk(saleResp, `freezeCommissionForDispute: recherche vente pour payment_intent ${charge.payment_intent}`);
  const sales = await saleResp.json();
  const sale = Array.isArray(sales) ? sales[0] : null;
  if (!sale) return;

  const commResp = await supabaseAdminRequest(`/rest/v1/commissions?sale_id=eq.${encodeURIComponent(sale.id)}&select=id,status,amount,seller_id,order_id`);
  await assertOk(commResp, `freezeCommissionForDispute: lecture commissions pour vente ${sale.id}`);
  const commissions = await commResp.json();

  for (const c of (commissions || [])) {
    if (c.status === 'pending') {
      const patchResp = await supabaseAdminRequest(`/rest/v1/commissions?id=eq.${encodeURIComponent(c.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'disputed', updated_at: new Date().toISOString() })
      });
      await assertOk(patchResp, `freezeCommissionForDispute: gel commission ${c.id}`);
    } else if (c.status === 'withdrawn') {
      const shadowResp = await supabaseAdminRequest('/rest/v1/commissions', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          sale_id: sale.id, order_id: c.order_id, seller_id: c.seller_id,
          amount: c.amount, percentage: 0, status: 'disputed',
        })
      });
      await assertOk(shadowResp, `freezeCommissionForDispute: création ligne miroir pour commission déjà retirée ${c.id}`);
    }
  }
}

async function updateSubscriberByCustomerId(stripeCustomerId, fields) {
  await supabaseAdminRequest(
    `/rest/v1/subscribers?stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() })
    }
  );
}
