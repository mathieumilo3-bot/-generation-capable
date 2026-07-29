function json(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(data)
  };
}

function methodNotAllowed(allowed) {
  return json(405, { error: 'METHOD_NOT_ALLOWED', allowed }, { Allow: allowed.join(', ') });
}

function parseJsonBody(event) {
  try {
    return { data: JSON.parse(event.body || '{}') };
  } catch (error) {
    return { error: 'INVALID_JSON', message: error.message };
  }
}

module.exports = { json, methodNotAllowed, parseJsonBody };
