// Dashboard administrateur GC Setter.
//
// Source unique de vérité : la table public.setter_applications du projet
// Supabase "setter-hunter" — exactement celle où la page publique
// (gc-setter.netlify.app/) insère les candidatures. Aucune seconde base,
// aucune table miroir.
// createClient vient du bundle UMD servi par le site (voir vendor/README.md),
// chargé par un <script> classique avant ce module.
const { createClient } = window.supabase;
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  APPLICATIONS_TABLE,
  PENDING_STATUSES,
  STATUS_LABELS,
  AVAILABILITY_LABELS,
  isAdminEmail,
} from '/gc-config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const $ = (sel) => document.querySelector(sel);

const els = {
  login: $('#login'),
  loginForm: $('#login-form'),
  loginMsg: $('#login-msg'),
  loginSubmit: $('#login-submit'),
  email: $('#email'),
  password: $('#password'),
  pwBlock: $('#pw-block'),
  otp: $('#otp'),
  otpBlock: $('#otp-block'),
  otpRequest: $('#otp-request'),
  app: $('#app'),
  list: $('#list'),
  filters: $('#filters'),
  search: $('#search'),
  detail: $('#detail'),
  detailTitle: $('#detail-title'),
  detailBody: $('#detail-body'),
  toasts: $('#toasts'),
  notifBtn: $('#notif-btn'),
  notifBanner: $('#notif-banner'),
};

let rows = [];
let filter = 'pending';
let query = '';
let channel = null;
const freshIds = new Set(); // candidatures arrivées pendant la session

/* ------------------------------------------------------------------ utils */

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const isPending = (r) => PENDING_STATUSES.includes(r.status);

function bucket(r) {
  if (r.status === 'accepted') return 'accepted';
  if (r.status === 'rejected') return 'rejected';
  return 'pending';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function onboardingUrl(row) {
  return `${location.origin}/onboarding?token=${row.onboarding_token}`;
}

function toast(text, ms = 6000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  els.toasts.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ------------------------------------------------------------------- auth */

function setLoginMsg(text, kind = '') {
  els.loginMsg.textContent = text;
  els.loginMsg.className = `msg ${kind}`;
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = els.email.value.trim().toLowerCase();
  els.loginSubmit.disabled = true;
  setLoginMsg('Connexion…');

  try {
    // Deux chemins possibles : mot de passe, ou code à usage unique envoyé par
    // e-mail (évite d'avoir à configurer une URL de redirection Supabase).
    const { error } = els.otpBlock.hidden
      ? await sb.auth.signInWithPassword({ email, password: els.password.value })
      : await sb.auth.verifyOtp({ email, token: els.otp.value.trim(), type: 'email' });

    if (error) throw error;
    // La suite est prise en charge par onAuthStateChange.
  } catch (err) {
    setLoginMsg(err.message || 'Connexion impossible.', 'err');
  } finally {
    els.loginSubmit.disabled = false;
  }
});

els.otpRequest.addEventListener('click', async () => {
  const email = els.email.value.trim().toLowerCase();
  if (!email) { setLoginMsg('Renseignez d’abord votre e-mail.', 'err'); return; }

  els.otpRequest.disabled = true;
  setLoginMsg('Envoi du code…');
  try {
    // shouldCreateUser: false — seul un compte admin déjà créé peut recevoir un
    // code. Sans ça, n'importe quelle adresse se créerait un compte.
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
    els.pwBlock.hidden = true;
    els.otpBlock.hidden = false;
    els.otp.focus();
    setLoginMsg('Code envoyé. Vérifiez votre boîte mail.', 'ok');
  } catch (err) {
    setLoginMsg(err.message || 'Envoi impossible.', 'err');
  } finally {
    els.otpRequest.disabled = false;
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
  const email = session?.user?.email;
  if (!session) { showLogin(); return; }

  if (!isAdminEmail(email)) {
    // Garde-fou d'interface. Même si quelqu'un le contournait, la RLS ne
    // renverrait aucune ligne : les policies filtrent sur setter_admins.
    sb.auth.signOut();
    showLogin();
    setLoginMsg(`Accès refusé pour ${email}. Ce compte n’est pas administrateur.`, 'err');
    return;
  }
  showApp();
});

function showLogin() {
  stopRealtime();
  els.app.hidden = true;
  els.login.hidden = false;
}

async function showApp() {
  els.login.hidden = true;
  els.app.hidden = false;
  syncNotifButton();
  await load();
  startRealtime();
}

/* ------------------------------------------------------------------- data */

async function load() {
  const { data, error } = await sb
    .from(APPLICATIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    els.list.innerHTML = `<p class="empty">Lecture impossible : ${esc(error.message)}</p>`;
    return;
  }
  rows = data || [];
  render();
}

$('#refresh-btn').addEventListener('click', load);

/* --------------------------------------------------------------- realtime */

function startRealtime() {
  stopRealtime();
  channel = sb
    .channel('setter-applications')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: APPLICATIONS_TABLE },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          rows.unshift(payload.new);
          freshIds.add(payload.new.id);
          announce(payload.new);
        } else if (payload.eventType === 'UPDATE') {
          const i = rows.findIndex((r) => r.id === payload.new.id);
          if (i >= 0) rows[i] = payload.new; else rows.unshift(payload.new);
        } else if (payload.eventType === 'DELETE') {
          rows = rows.filter((r) => r.id !== payload.old.id);
        }
        render();
      },
    )
    .subscribe();
}

function stopRealtime() {
  if (channel) { sb.removeChannel(channel); channel = null; }
}

function announce(row) {
  const text = `Nouvelle candidature — ${row.full_name || row.email || 'candidat'}`;
  toast(text);
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('GC Setter', { body: text, icon: '/icons/icon-192.png', tag: row.id });
    } catch { /* iOS refuse hors PWA installée : le toast suffit */ }
  }
}

/* ---------------------------------------------------------- notifications */

function syncNotifButton() {
  if (!('Notification' in window)) {
    els.notifBtn.hidden = true;
    els.notifBanner.hidden = true;
    return;
  }
  const granted = Notification.permission === 'granted';
  els.notifBtn.classList.toggle('on', granted);
  els.notifBtn.title = granted ? 'Notifications activées' : 'Activer les notifications';
  // La bannière ne s'affiche que tant que l'autorisation n'est pas accordée :
  // une fois activée, elle n'a plus rien à demander.
  els.notifBanner.hidden = granted;
}

async function askNotifications() {
  if (!('Notification' in window)) return;
  const res = await Notification.requestPermission();
  syncNotifButton();
  toast(res === 'granted'
    ? 'Notifications activées.'
    : 'Notifications refusées. Sur iPhone, installez d’abord l’app via « Ajouter à l’écran d’accueil ».');
}

els.notifBtn.addEventListener('click', askNotifications);
els.notifBanner.addEventListener('click', askNotifications);

/* ------------------------------------------------------------------ rendu */

els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  filter = btn.dataset.filter;
  [...els.filters.querySelectorAll('.chip')].forEach((c) =>
    c.setAttribute('aria-pressed', String(c === btn)));
  render();
});

els.search.addEventListener('input', () => {
  query = els.search.value.trim().toLowerCase();
  render();
});

function visibleRows() {
  return rows.filter((r) => {
    if (filter !== 'all' && bucket(r) !== filter) return false;
    if (!query) return true;
    return [r.full_name, r.email, r.phone, r.socials, r.country, r.platforms]
      .some((v) => String(v ?? '').toLowerCase().includes(query));
  });
}

function render() {
  const counts = { pending: 0, accepted: 0, rejected: 0, all: rows.length };
  rows.forEach((r) => { counts[bucket(r)] += 1; });
  for (const [key, n] of Object.entries(counts)) {
    const el = els.filters.querySelector(`[data-count="${key}"]`);
    if (el) el.textContent = n;
  }

  const list = visibleRows();
  if (!list.length) {
    els.list.innerHTML = '<p class="empty">Aucune candidature dans ce filtre.</p>';
    return;
  }

  els.list.innerHTML = list.map(cardHtml).join('');
}

function cardHtml(r) {
  const b = bucket(r);
  const meta = [r.email, r.phone, r.country].filter(Boolean).map(esc).join(' · ');
  return `
  <article class="card ${freshIds.has(r.id) ? 'is-new' : ''}" data-id="${esc(r.id)}">
    <div class="card-head">
      <div>
        <p class="card-name">${esc(r.full_name || '(sans nom)')}</p>
        <p class="card-meta">${meta || '—'}</p>
        <p class="card-meta">${esc(fmtDate(r.created_at))}</p>
      </div>
      <span class="badge ${b}">${esc(STATUS_LABELS[r.status] || r.status)}</span>
    </div>
    <div class="card-actions">
      <button class="act" data-act="open">Voir le détail</button>
      ${r.status !== 'accepted' ? '<button class="act accept" data-act="accept">Accepter</button>' : ''}
      ${r.status !== 'rejected' ? '<button class="act reject" data-act="reject">Refuser</button>' : ''}
      ${r.status === 'accepted' ? '<button class="act" data-act="copy">Copier le lien d’onboarding</button>' : ''}
    </div>
  </article>`;
}

/* --------------------------------------------------------------- actions */

els.list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = e.target.closest('.card').dataset.id;
  const row = rows.find((r) => r.id === id);
  if (!row) return;

  if (btn.dataset.act === 'open') return openDetail(row);
  if (btn.dataset.act === 'copy') return copyOnboarding(row);

  btn.disabled = true;
  await setStatus(row, btn.dataset.act === 'accept' ? 'accepted' : 'rejected');
  btn.disabled = false;
});

async function setStatus(row, status) {
  // accepted_at / rejected_at sont posés par le trigger SQL, pas ici : une
  // seule source de vérité pour l'horodatage.
  const { data, error } = await sb
    .from(APPLICATIONS_TABLE)
    .update({ status })
    .eq('id', row.id)
    .select()
    .single();

  if (error) { toast(`Échec : ${error.message}`); return; }

  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = data;
  freshIds.delete(row.id);
  render();

  if (status === 'accepted') {
    toast('Candidature acceptée. Espace d’onboarding créé.');
    openDetail(data);
  } else {
    toast('Candidature refusée.');
  }
}

async function copyOnboarding(row) {
  const url = onboardingUrl(row);
  try {
    await navigator.clipboard.writeText(url);
    toast('Lien d’onboarding copié.');
  } catch {
    prompt('Lien d’onboarding :', url);
  }
}

/* ---------------------------------------------------------------- détail */

const FIELDS = [
  ['full_name', 'Nom'],
  ['email', 'E-mail'],
  ['phone', 'WhatsApp'],
  ['socials', 'Instagram / réseaux'],
  ['country', 'Pays'],
  ['experience', 'Expérience'],
  ['setting_since', 'Ancienneté en setting'],
  ['high_ticket_experience', 'Expérience high-ticket'],
  ['platforms', 'Plateformes utilisées'],
  ['daily_conversations', 'Conversations par jour'],
  ['meetings_generated', 'RDV générés'],
  ['demonstrable_results', 'Résultats démontrables'],
  ['proof_url', 'Preuve (lien)'],
  ['availability', 'Disponibilité'],
  ['start_date', 'Date de démarrage'],
  ['days_per_week', 'Jours par semaine'],
  ['motivation', 'Motivation'],
  ['why_you', 'Pourquoi vous'],
  ['situation_1', 'Questionnaire — situation 1'],
  ['situation_2', 'Questionnaire — situation 2'],
  ['source', 'Source'],
  ['security_accepted', 'Charte sécurité acceptée'],
  ['remuneration_accepted', 'Rémunération acceptée'],
  ['created_at', 'Date de candidature'],
  ['accepted_at', 'Acceptée le'],
  ['rejected_at', 'Refusée le'],
  ['admin_notes', 'Notes internes'],
];

function valueHtml(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (['created_at', 'accepted_at', 'rejected_at', 'updated_at'].includes(key)) {
    return esc(fmtDate(value));
  }
  if (key === 'availability') return esc(AVAILABILITY_LABELS[value] || value);
  const s = String(value);
  if (/^https?:\/\//i.test(s)) {
    return `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>`;
  }
  return esc(s);
}

function openDetail(row) {
  freshIds.delete(row.id);
  els.detailTitle.textContent = row.full_name || row.email || 'Candidature';

  const fields = FIELDS
    .map(([key, label]) => `
      <div class="field">
        <dt>${esc(label)}</dt>
        <dd>${valueHtml(key, row[key])}</dd>
      </div>`)
    .join('');

  const onboarding = row.status === 'accepted'
    ? `<div class="onboarding">
         <h3>Espace d’onboarding — candidat accepté</h3>
         <code>${esc(onboardingUrl(row))}</code>
         <button class="act" id="detail-copy" type="button">Copier le lien</button>
       </div>`
    : '';

  els.detailBody.innerHTML = `
    <p class="card-meta" style="padding-top:12px">
      Statut : <strong>${esc(STATUS_LABELS[row.status] || row.status)}</strong>
    </p>
    ${onboarding}
    <div class="card-actions" style="margin:14px 0 4px">
      ${row.status !== 'accepted' ? '<button class="act accept" data-detail-act="accept">Accepter</button>' : ''}
      ${row.status !== 'rejected' ? '<button class="act reject" data-detail-act="reject">Refuser</button>' : ''}
    </div>
    <dl style="margin:0">${fields}</dl>`;

  els.detailBody.querySelector('#detail-copy')
    ?.addEventListener('click', () => copyOnboarding(row));

  els.detailBody.querySelectorAll('[data-detail-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await setStatus(row, btn.dataset.detailAct === 'accept' ? 'accepted' : 'rejected');
      btn.disabled = false;
    });
  });

  if (!els.detail.open) els.detail.showModal();
}

$('#detail-close').addEventListener('click', () => els.detail.close());

/* ------------------------------------------------------------------- PWA */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* non bloquant */ });
}
