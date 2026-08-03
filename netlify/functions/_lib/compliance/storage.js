// netlify/functions/_lib/compliance/storage.js
//
// Écriture/lecture du bucket privé "compliance-documents" via l'API REST
// Storage de Supabase (pas de SDK — même logique que supabase-admin.js pour
// PostgREST). Toute écriture utilise la clé service_role : seule une
// Netlify Function qui a déjà vérifié l'identité de l'appelant et validé le
// fichier a le droit d'y écrire (voir 0015_compliance_contracts.sql, section
// Storage — aucune policy insert pour authenticated).

const { SUPABASE_URL } = require('../supabase-admin');

const BUCKET = 'compliance-documents';

async function uploadObject(path, buffer, contentType) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente');

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`Échec upload Storage (${r.status}): ${detail}`);
  }
  return path;
}

// Téléchargement direct (service_role) — utilisé côté serveur uniquement,
// par exemple pour ré-embarquer une image déjà archivée (logo/signature de
// la Société) dans un PDF généré à la volée.
async function downloadObject(path) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente');

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!r.ok) return null;
  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function deleteObject(path) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente');

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  return r.ok;
}

// URL signée à durée limitée (secondes) — jamais d'URL publique pour des
// pièces d'identité/RIB/contrats.
async function signedUrl(path, expiresInSeconds = 300) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente');

  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
}

module.exports = { uploadObject, downloadObject, deleteObject, signedUrl, BUCKET };
