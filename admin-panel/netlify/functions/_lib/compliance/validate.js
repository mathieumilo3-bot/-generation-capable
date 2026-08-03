// netlify/functions/_lib/compliance/validate.js
//
// Valide qu'une valeur ressemble à un UUID Postgres avant de l'interpoler
// dans un filtre PostgREST (`?id=eq.<valeur>`). PostgREST lie ses filtres en
// paramètres — il n'y a pas d'injection SQL classique possible via cette
// valeur — mais une chaîne non échappée contenant "&" ou "=" changerait la
// query string elle-même (ex: "x&user_id=eq.<autre-id>" ajouterait un filtre
// supplémentaire, potentiellement exploitable pour élargir une requête
// censée être bornée à un seul enregistrement). Un format UUID strict ferme
// cette classe de problème par construction, avant même de songer à
// encodeURIComponent().

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

module.exports = { isUuid };
