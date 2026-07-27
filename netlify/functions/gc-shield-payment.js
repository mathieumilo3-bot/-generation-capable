const { json, methodNotAllowed, parseJsonBody } = require('./_shared/http');
const { getVerifiedUser, supabaseFetch } = require('./_shared/supabase');
const { resolveRole, hasPermission } = require('./_shared/roles');
const { writeAudit, detectBasicAnomalies } = require('./_shared/audit');

const PRODUCTS = {
  eco_monthly: { amount_cents: 9700, currency: 'eur', stripeEnv: 'STRIPE_LINK_ECO_MONTHLY' },
  eco_semester: { amount_cents: 49700, currency: 'eur', stripeEnv: 'STRIPE_LINK_ECO_SEMESTER' },
  academie_97: { amount_cents: 9700, currency: 'eur', stripeEnv: 'STRIPE_LINK_ACADEMIE_97' },
  academie_247: { amount_cents: 24700, currency: 'eur', stripeEnv: 'STRIPE_LINK_ACADEMIE_247' },
  studio: { amount_cents: 24700, currency: 'eur', stripeEnv: 'STRIPE_LINK_STUDIO' }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST']);
  const parsed = parseJsonBody(event);
  if (parsed.error) return json(400, parsed);

  const { product_code, buyer_email, seller_email, ambassador_code, metadata = {} } = parsed.data;
  const product = PRODUCTS[product_code];
  if (!product) return json(400, { error: 'UNKNOWN_PRODUCT' });

  let actor = { email: buyer_email || null, id: null };
  let role = 'client';
  const auth = await getVerifiedUser(event);
  if (!auth.error) {
    actor = auth.user;
    role = await resolveRole(auth.user, supabaseFetch);
  }
  if (seller_email && !hasPermission(role, 'payment:create')) return json(403, { error: 'FORBIDDEN_OFF_PLATFORM_SALE', role });

  await detectBasicAnomalies(event, { email: actor.email });
  const payment = await supabaseFetch('gc_platform_payments', {
    method: 'POST',
    body: {
      buyer_email: (buyer_email || actor.email || '').toLowerCase(), seller_email, ambassador_code,
      product_code, amount_cents: product.amount_cents, currency: product.currency,
      status: 'initiated', platform_enforced: true, metadata
    },
    prefer: 'return=representation',
    serviceRole: true
  });
  if (!payment.ok) return json(502, { error: 'PAYMENT_RECORD_FAILED', detail: payment.data });

  await writeAudit(event, { actor_user_id: actor.id, actor_email: actor.email, actor_role: role, action: 'payment.initiated', resource_type: 'payment', resource_id: payment.data?.[0]?.id, metadata: { product_code, seller_email, ambassador_code } });

  const stripeLink = process.env[product.stripeEnv];
  return json(201, {
    payment: payment.data?.[0],
    checkout_url: stripeLink ? `${stripeLink}${stripeLink.includes('?') ? '&' : '?'}client_reference_id=${encodeURIComponent(payment.data?.[0]?.id || '')}&prefilled_email=${encodeURIComponent(buyer_email || actor.email || '')}` : null,
    platform_enforced: true
  });
};
