// netlify/functions/ai-proxy.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('[ai-proxy] Invalid JSON body from client:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { messages } = payload;
  if (!messages) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing messages' }) };
  }
  const max_tokens = Math.max(payload.max_tokens || 1000, 2000);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  console.log('[ai-proxy] Clés présentes -> ANTHROPIC:', !!anthropicKey, '| OPENAI:', !!openaiKey);

  if (!anthropicKey && !openaiKey) {
    console.error('[ai-proxy] AUCUNE clé API configurée sur Netlify.');
    return ok({
      error: 'NO_API_KEY',
      message: "Aucune clé IA configurée sur Netlify (ANTHROPIC_API_KEY ou OPENAI_API_KEY)."
    });
  }

  try {
    if (anthropicKey) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: payload.model || 'claude-sonnet-4-6',
          max_tokens,
          messages
        })
      });
      const data = await r.json();
      if (!r.ok) {
        console.error('[ai-proxy] Erreur Anthropic', r.status, JSON.stringify(data));
        return ok({ error: 'ANTHROPIC_API_ERROR', status: r.status, detail: data });
      }
      return ok(data);
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens,
        response_format: { type: 'json_object' },
        messages
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[ai-proxy] Erreur OpenAI', r.status, JSON.stringify(data));
      return ok({ error: 'OPENAI_API_ERROR', status: r.status, detail: data });
    }
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) {
      console.error('[ai-proxy] Réponse OpenAI vide ou tronquée:', JSON.stringify(data));
    }
    return ok({ content: [{ type: 'text', text }] });

  } catch (e) {
    console.error('[ai-proxy] NETWORK_ERROR', e);
    return ok({ error: 'NETWORK_ERROR', message: String(e) });
  }
};

function ok(data) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}
