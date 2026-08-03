// netlify/functions/ai-proxy.js
//
// Les 5 fonctions IA de Génération Capable (plan du jour, coaching, évaluation,
// rapport du soir, scan vendeur) appelaient https://api.anthropic.com directement
// depuis le navigateur. Ce pattern ne fonctionne QUE dans l'aperçu Artifacts de
// claude.ai (qui proxifie la clé automatiquement) — une fois le site déployé sur
// Netlify, cet appel échoue à 100% (pas de clé envoyée, et de toute façon les
// navigateurs bloquent les appels directs à l'API Anthropic pour des raisons de
// sécurité : une clé visible côté client serait volable par n'importe qui).
//
// Cette fonction tourne côté serveur (jamais visible du navigateur).
// Le site a une clé OPENAI_API_KEY configurée dans Netlify (pas de clé Anthropic
// pour l'instant). La fonction gère les deux automatiquement :
//   1) si ANTHROPIC_API_KEY existe → utilise Claude
//   2) sinon, si OPENAI_API_KEY existe → utilise la clé OpenAI déjà en place
//   3) sinon → message "Analyse indisponible" propre (bouton Réessayer déjà en place)
// Dans tous les cas, la réponse renvoyée au front-end a exactement la même forme
// (celle de l'API Anthropic : {content:[{type:'text', text:'...'}]}) donc index.html
// n'a besoin d'aucun changement supplémentaire, quel que soit le fournisseur utilisé.
//
// FIX (audit 2026-07-21) :
//   1) Toutes les erreurs (clé absente, erreur API, réseau) étaient renvoyées avec
//      statusCode 200 dans un champ {error:...}. Le front-end ne lisait jamais ce
//      champ : il cherchait directement data.content, qui était undefined, ce qui
//      faisait planter le JSON.parse() côté front avec un message générique
//      "Analyse indisponible" qui masquait la VRAIE cause. On garde le statusCode 200
//      (pour compat front) mais on logge maintenant l'erreur réelle côté serveur
//      (visible dans Netlify → Functions → ai-proxy → Logs).
//   2) max_tokens envoyé par le front (1000-1200) est trop juste pour les schémas JSON
//      demandés (5 actions détaillées, 3 axes d'amélioration, etc.) avec gpt-4o-mini.
//      Une réponse tronquée = JSON invalide = échec silencieux. On relève le plancher
//      à 2000 côté proxy et on force response_format:json_object côté OpenAI pour
//      garantir un JSON valide (gpt-4o-mini supporte ce paramètre).
//
// FIX (GC Cognitive Engine — intégration system prompt) :
//   3) index.html envoie désormais un champ `system` (GC_SYSTEM_PROMPT) dans le
//      payload, distinct de `messages`. Les deux fournisseurs ne le consomment pas
//      pareil :
//        - Anthropic /v1/messages accepte un paramètre top-level `system` séparé
//          des messages → on le transmet tel quel.
//        - OpenAI /v1/chat/completions n'a pas de paramètre `system` dédié : le
//          system prompt doit être le premier message avec role:'system'. On le
//          construit ici, sans jamais dépendre de ce que le front envoie dans
//          `messages` (qui ne contient qu'un message role:'user').
//      Si `system` est absent du payload (appel legacy), le comportement précédent
//      est conservé à l'identique pour les deux fournisseurs.
//
// FIX (audit 2026-07-23 — GC Ambassadors OS) :
//   4) response_format:'json_object' était forcé sur TOUS les appels OpenAI, sans
//      condition. Or l'API OpenAI exige que le mot "json" apparaisse quelque part
//      dans les messages/system quand ce paramètre est utilisé, sinon elle renvoie
//      une erreur 400 ("'messages' must contain the word 'json' in some form").
//      Les 5 fonctions IA du site principal (index.html) demandent bien du JSON
//      structuré → ça passait. Mais l'IA Coach de l'Ambassadors OS (ambassadors.html)
//      est un chat conversationnel classique, sans "json" dans son prompt → 100% des
//      messages échouaient avec cette erreur 400, silencieusement masquée côté front
//      par "Je n'ai pas pu répondre".
//      Fix : on ne force response_format:json_object que si le mot "json" apparaît
//      déjà (insensible à la casse) dans le system prompt ou les messages envoyés.
//      Sinon, l'appel se fait en texte libre normal, comme pour un vrai chat.

// FIX CRITIQUE (audit 2026-08-03) : cette fonction n'exigeait AUCUNE
// authentification — n'importe qui sur Internet pouvait l'appeler directement
// (curl, script) et consommer sans aucune limite le quota payant
// OpenAI/Anthropic du site, sans même avoir de compte Génération Capable.
// Comme ambassador-data.js, on exige maintenant un token de session Supabase
// valide (Authorization: Bearer) avant de dépenser le moindre appel IA payant.
const { verifySessionToken } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[ai-proxy] SUPABASE_ANON_KEY absente sur Netlify.');
    return ok({ error: 'NO_SUPABASE_KEY', message: "Clé Supabase non configurée sur Netlify (SUPABASE_ANON_KEY)." });
  }
  const { error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Connecte-toi pour utiliser cette fonctionnalité.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('[ai-proxy] Invalid JSON body from client:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { messages, system } = payload;
  if (!messages) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing messages' }) };
  }

  // Plancher 2000 (cf. FIX audit 2026-07-21 ci-dessus) et plafond 4000 : sans
  // plafond, un appelant pouvait demander un max_tokens arbitrairement élevé
  // (aucune vérification d'auth sur cette fonction) et faire exploser la
  // facture OpenAI/Anthropic pour un seul appel.
  const MAX_TOKENS_CEILING = 4000;
  const max_tokens = Math.min(Math.max(payload.max_tokens || 1000, 2000), MAX_TOKENS_CEILING);

  // Garde-fou taille d'entrée : les prompts réels de ce site (system + message
  // utilisateur) font quelques Ko au maximum. Une entrée anormalement grosse
  // n'a pas d'usage légitime ici et ne fait qu'augmenter le coût par appel.
  const MAX_INPUT_CHARS = 20000;
  const inputSize = (system || '').length + JSON.stringify(messages).length;
  if (inputSize > MAX_INPUT_CHARS) {
    return { statusCode: 413, body: JSON.stringify({ error: 'PAYLOAD_TOO_LARGE' }) };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  console.log('[ai-proxy] Clés présentes -> ANTHROPIC:', !!anthropicKey, '| OPENAI:', !!openaiKey, '| system prompt fourni:', !!system);

  if (!anthropicKey && !openaiKey) {
    console.error('[ai-proxy] AUCUNE clé API configurée sur Netlify.');
    return ok({
      error: 'NO_API_KEY',
      message: "Aucune clé IA configurée sur Netlify (ANTHROPIC_API_KEY ou OPENAI_API_KEY)."
    });
  }

  if (anthropicKey) {
    const result = await callAnthropic({ anthropicKey, model: payload.model, max_tokens, system, messages });
    if (result.ok) return ok(result.data);
    console.error('[ai-proxy] Anthropic a échoué', result.error);
    // Si une clé OpenAI existe aussi, on tente le fournisseur de secours plutôt
    // que de renvoyer un échec sec — l'utilisateur n'a pas à savoir qu'un des
    // deux fournisseurs a un problème tant qu'un autre peut répondre.
    if (!openaiKey) return ok(result.error);
  }

  const result = await callOpenAI({ openaiKey, system, messages, max_tokens });
  if (result.ok) return ok(result.data);
  console.error('[ai-proxy] OpenAI a échoué', result.error);
  return ok(result.error);
};

// Timeout explicite : sans lui, un fournisseur qui traîne fait tomber la
// fonction Netlify sur SON PROPRE timeout (10-26s selon le plan), qui renvoie
// une erreur 502 générique et illisible au lieu d'un message clair.
const PROVIDER_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Classe une réponse HTTP en échec en une erreur typée et un message clair
// pour l'utilisateur — au lieu du même "Analyse indisponible" générique quel
// que soit le problème réel (clé invalide, quota dépassé, panne fournisseur).
function classifyHttpError(provider, status, data) {
  if (status === 401 || status === 403) {
    return { error: 'INVALID_API_KEY', provider, status, message: `Clé API ${provider} invalide ou révoquée — vérifie la variable d'environnement sur Netlify.` };
  }
  if (status === 429) {
    return { error: 'RATE_LIMITED', provider, status, message: `Quota ${provider} dépassé pour le moment — réessaie dans quelques instants.` };
  }
  if (status >= 500) {
    return { error: 'PROVIDER_DOWN', provider, status, message: `${provider} rencontre un incident — réessaie dans quelques instants.`, detail: data };
  }
  return { error: `${provider.toUpperCase()}_API_ERROR`, provider, status, message: data?.error?.message || data?.error?.type || `Erreur ${provider}`, detail: data };
}

async function callAnthropic({ anthropicKey, model, max_tokens, system, messages }) {
  const anthropicBody = {
    // "claude-sonnet-4-6" n'a jamais été un identifiant de modèle Anthropic
    // valide — si une clé Anthropic est un jour configurée sans ce correctif,
    // 100% des appels échouent avec "model not found", explication la plus
    // probable d'un échec total et silencieux de l'IA en production.
    model: model || 'claude-sonnet-5',
    max_tokens,
    messages
  };
  // Anthropic attend le system prompt comme paramètre top-level dédié,
  // jamais mélangé dans le tableau messages.
  if (system) anthropicBody.system = system;

  try {
    const r = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicBody)
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: classifyHttpError('anthropic', r.status, data) };
    return { ok: true, data }; // déjà au bon format {content:[{type:'text',text:...}]}
  } catch (e) {
    if (e.name === 'AbortError') {
      return { ok: false, error: { error: 'TIMEOUT', provider: 'anthropic', message: 'Anthropic n\'a pas répondu à temps.' } };
    }
    return { ok: false, error: { error: 'NETWORK_ERROR', provider: 'anthropic', message: String(e) } };
  }
}

async function callOpenAI({ openaiKey, system, messages, max_tokens }) {
  if (!openaiKey) {
    return { ok: false, error: { error: 'NO_API_KEY', message: 'Aucune clé OpenAI configurée sur Netlify.' } };
  }

  // OpenAI n'a pas de paramètre `system` séparé : on le préfixe comme premier
  // message role:'system'. On ne fait jamais confiance à ce que le front met dans
  // `messages` pour ce rôle — c'est reconstruit ici de façon déterministe.
  const openaiMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  // FIX 2026-07-23 : n'active response_format:json_object que si "json" apparaît
  // réellement dans le contenu envoyé (exigence stricte de l'API OpenAI). Sinon
  // l'appel échoue en 400 pour tout chat conversationnel normal (ex: IA Coach
  // Ambassadeur) qui ne demande pas explicitement du JSON.
  const combinedText = [
    system || '',
    ...openaiMessages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')))
  ].join(' ').toLowerCase();
  const wantsJson = combinedText.includes('json');

  const openaiBody = {
    model: 'gpt-4o-mini',
    max_tokens,
    messages: openaiMessages
  };
  if (wantsJson) {
    openaiBody.response_format = { type: 'json_object' };
  }

  try {
    const r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify(openaiBody)
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: classifyHttpError('openai', r.status, data) };

    const text = data.choices?.[0]?.message?.content || '';
    const finishReason = data.choices?.[0]?.finish_reason;
    if (!text) {
      console.error('[ai-proxy] Réponse OpenAI vide ou tronquée:', JSON.stringify(data));
      return { ok: false, error: { error: 'EMPTY_RESPONSE', message: 'Le modèle IA a renvoyé une réponse vide.', detail: data } };
    }
    if (finishReason === 'length') {
      // La réponse a été coupée avant la fin du JSON demandé : mieux vaut le
      // signaler clairement que de laisser index.html échouer sur un
      // JSON.parse() invalide avec un message d'erreur générique.
      console.error('[ai-proxy] Réponse OpenAI tronquée (max_tokens atteint).');
      return { ok: false, error: { error: 'TRUNCATED_RESPONSE', message: 'La réponse IA a été coupée avant la fin — réessaie.' } };
    }
    // Normalisé à la forme Anthropic pour que index.html n'ait besoin d'aucun changement.
    return { ok: true, data: { content: [{ type: 'text', text }] } };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { ok: false, error: { error: 'TIMEOUT', provider: 'openai', message: 'OpenAI n\'a pas répondu à temps.' } };
    }
    return { ok: false, error: { error: 'NETWORK_ERROR', provider: 'openai', message: String(e) } };
  }
}

function ok(data) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}
