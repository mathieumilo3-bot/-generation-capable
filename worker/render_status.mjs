#!/usr/bin/env node
// Renders state/status.json (from the hub's GET /status) as STATUS.md, in French.
// Usage: node worker/render_status.mjs state/status.json > STATUS.md
import { readFileSync } from 'node:fs';

const s = JSON.parse(readFileSync(process.argv[2] ?? 'state/status.json', 'utf8'));
const usd = (n) => (n == null ? '—' : `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`);
const date = (iso) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—');
const esc = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const OUTCOME = { pending: '⏳ en attente des résultats', won: '🏆 gagné', lost: 'non retenu', unknown: '? annonce introuvable' };
const JOB = {
  queued: 'en file — à réaliser',
  rejected_qa: 'refusé par le contrôle qualité — à corriger',
  delivered: 'livré — soumission en cours',
  approved: 'validé (soumission auto désactivée)',
  submitted: 'soumis',
  submit_failed: 'échec de soumission',
  abandoned: 'abandonné (irréalisable honnêtement)',
  expired: 'expiré',
};

const out = [];
out.push('# Tableau de bord — agent Superteam Earn', '');
out.push(`_Mis à jour : ${date(s.generatedAt)} — état : **${s.heartbeat?.status ?? '?'}** — ${esc(s.heartbeat?.lastAction)}_`, '');

if (s.agent) {
  out.push('## Agent', '');
  out.push(`- Nom : **${esc(s.agent.name)}** — profil : [${s.agent.username}](${s.agent.profileUrl})`);
  out.push(`- Enregistré le : ${date(s.agent.registeredAt)}`);
  out.push(
    `- Réclamé par un humain : ${s.agent.claimed ? 'oui ✅' : '**non** — nécessaire pour percevoir les gains (voir README, « Réclamer les gains »)'}`,
    '',
  );
} else {
  out.push('## Agent', '', '_Pas encore enregistré._', '');
}

const t = s.totals ?? {};
out.push('## Gains', '');
out.push('| Indicateur | Valeur |', '|---|---|');
out.push(`| Soumissions envoyées | ${t.submissions ?? 0} |`);
out.push(`| En attente des résultats | ${t.pendingResults ?? 0} (1ᵉʳ prix cumulé : ${usd(t.pendingMaxUsd)}, espérance : ${usd(t.pendingExpectedUsd)}) |`);
out.push(`| Missions gagnées | ${t.won ?? 0} — ${usd(t.wonUsd)} |`);
for (const [tok, amt] of Object.entries(t.wonByToken ?? {})) out.push(`| Gagné en ${tok} | ${amt} ${tok} |`);
out.push(`| Gains en attente de réclamation | ${t.awaitingClaim ?? 0} |`);
out.push(`| Non retenues | ${t.lost ?? 0} |`, '');

if (s.ledger?.length) {
  out.push('### Registre des soumissions', '', '| Mission | Soumise le | Récompense max | Résultat | Paiement |', '|---|---|---|---|---|');
  for (const r of s.ledger) {
    const prize = r.first_prize != null ? `${r.first_prize} ${r.token ?? ''}` : '—';
    const result = r.outcome === 'won' ? `${OUTCOME.won} (place ${r.winner_position ?? '?'}, ${r.amount_won ?? '?'} ${r.token ?? ''})` : OUTCOME[r.outcome] ?? r.outcome;
    out.push(
      `| [${esc(r.title)}](https://superteam.fun/earn/listing/${r.slug}) · [livrable](${r.link}) | ${date(r.submitted_at)} | ${prize} | ${result} | ${esc(r.payout_status ?? '—')} |`,
    );
  }
  out.push('');
}

out.push('## Missions en cours', '');
if (s.jobs?.length) {
  out.push('| Mission | État | Dernière erreur |', '|---|---|---|');
  for (const j of s.jobs) {
    const name = j.link ? `[${j.slug}](${j.link})` : j.slug;
    out.push(`| ${name} | ${JOB[j.status] ?? j.status} | ${esc(j.lastError ?? '')} |`);
  }
} else out.push('_Aucune mission sélectionnée pour l’instant._');
out.push('');

const p = s.pipeline ?? {};
out.push('## Annonces analysées', '');
out.push(`${p.liveListings ?? 0} annonces ouvertes aux agents. Décisions : ${Object.entries(p.decisions ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}.`, '');
if (p.topCandidates?.length) {
  out.push('| Annonce | Type | Catégorie | Échéance | Espérance | Score | Décision |', '|---|---|---|---|---|---|---|');
  // Doable listings first, then the rest by score.
  const rank = (c) => (['selected', 'candidate', 'submitted', 'approved'].includes(c.decision) ? 0 : 1);
  for (const c of [...p.topCandidates].sort((a, b) => rank(a) - rank(b) || b.score - a.score)) {
    out.push(
      `| [${esc(c.title)}](https://superteam.fun/earn/listing/${c.slug}) | ${c.type} | ${c.category} | ${date(c.deadline)} | ${usd(c.expectedUsd)} | ${c.score} | ${esc(c.decision)} — ${esc(c.reason)} |`,
    );
  }
  out.push('');
}

out.push('## Derniers cycles', '', '| # | Type | Début | OK | Détail |', '|---|---|---|---|---|');
for (const r of s.runs ?? []) {
  const st = r.stats ?? {};
  const detail = [
    st.discover && `${st.discover.live} annonces, ${st.discover.candidates} candidates`,
    st.enqueue && st.enqueue.queued?.length ? `+${st.enqueue.queued.length} mission(s)` : null,
    st.ingest && st.ingest.submitted ? `${st.ingest.submitted} soumise(s)` : null,
    r.error && `erreur : ${r.error}`,
  ]
    .filter(Boolean)
    .join(' · ');
  out.push(`| ${r.id} | ${r.kind} | ${date(r.startedAt)} | ${r.ok ? '✅' : r.ok === false ? '⚠️' : '…'} | ${esc(detail)} |`);
}
out.push('');
process.stdout.write(out.join('\n'));
