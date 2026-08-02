// netlify/functions/_lib/notifications/time.js
//
// Clé "année-semaine ISO" partagée par les crons — sert à déduplicier des
// relances qui doivent se répéter au plus une fois par semaine tant que la
// situation qui les déclenche persiste (inactivité vendeur, prospect
// laissé sans suivi), sans jamais les envoyer en boucle à chaque passage.
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

module.exports = { isoWeekKey };
