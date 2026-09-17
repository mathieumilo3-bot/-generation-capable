#!/usr/bin/env node
/* ===========================================================================
   Net & Care — générateur de pages statiques.
   ---------------------------------------------------------------------------
   POURQUOI UN GÉNÉRATEUR PLUTÔT QUE DES FICHIERS HTML ÉCRITS À LA MAIN
   Le site compte une dizaine de pages qui partagent le même en-tête, le même
   pied de page et le même simulateur. Écrites à la main, changer un numéro de
   téléphone imposerait dix modifications — et une seule oubliée suffit à
   perdre des appels. Ici, tout vient de site.config.json et des gabarits de
   src/ : on régénère, et les dix pages sont cohérentes.

   Le résultat reste du HTML statique pur, versionné dans le dépôt : Netlify
   ne lance aucune compilation, et Google indexe du vrai contenu, pas une
   coquille remplie en JavaScript.

       npm run build:netcare      (ou : node net-and-care/tools/build.js)
   =========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const avis = require(path.join(SRC, 'data', 'avis.js'));
const prestations = require(path.join(SRC, 'data', 'prestations.js'));
const pagesLocales = require(path.join(SRC, 'local-pages.js'));
const rendreLocale = require(path.join(SRC, 'templates', 'local.js'));

/* ------------------------------------------------------------------ outils */

const lire = (p) => fs.readFileSync(p, 'utf8');
const echapper = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const domaine = config.domaine.replace(/\/$/, '');
const url = (slug) => (slug === 'index' ? domaine + '/' : `${domaine}/${slug}`);

/* --------------------------------------------------------- moteur de rendu */

const partials = {};
for (const f of fs.readdirSync(path.join(SRC, 'partials'))) {
  partials[path.basename(f, '.html')] = lire(path.join(SRC, 'partials', f));
}

// {{> nom}} insère un partial ; {{clef}} insère une variable du contexte.
// Deux passes suffisent (un partial peut en contenir un autre, jamais plus).
function rendre(gabarit, ctx) {
  let out = gabarit;
  for (let i = 0; i < 3 && out.includes('{{>'); i++) {
    out = out.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, nom) => {
      if (!partials[nom]) throw new Error(`Partial inconnu : ${nom}`);
      return partials[nom];
    });
  }
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (tout, clef) => {
    const v = clef.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);
    if (v === undefined || v === null) {
      manquants.add(clef);
      return '';
    }
    return String(v);
  });
  return out;
}

const manquants = new Set();

/* ------------------------------------------------- données structurées SEO */

const horaires = config.entreprise.horaires.map((h) => ({
  '@type': 'OpeningHoursSpecification',
  dayOfWeek: h.jours,
  opens: h.ouverture,
  closes: h.fermeture
}));

function localBusiness(extra = {}) {
  const e = config.entreprise;
  const base = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': domaine + '/#entreprise',
    name: e.nom,
    description: e.descriptionCourte,
    url: domaine + '/',
    telephone: config.contact.telephone,
    email: config.contact.email,
    image: domaine + '/assets/img/og-netandcare.png',
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    address: {
      '@type': 'PostalAddress',
      addressLocality: e.villeBase,
      postalCode: e.codePostalBase,
      addressRegion: 'Provence-Alpes-Côte d\'Azur',
      addressCountry: 'FR'
    },
    geo: { '@type': 'GeoCoordinates', latitude: e.geo.latitude, longitude: e.geo.longitude },
    areaServed: config.zones.communes.map((v) => ({ '@type': 'City', name: v })),
    openingHoursSpecification: horaires,
    sameAs: [config.contact.instagram].filter((u) => u && !/À_REMPLACER/.test(u))
  };
  // La note agrégée n'est publiée que lorsqu'elle correspond à de vrais avis
  // vérifiables : inventer un aggregateRating est une infraction aux règles
  // Google sur les avis, sanctionnable jusqu'au retrait de la fiche.
  if (config.preuve.afficherNoteDansSchema && config.preuve.nombreAvis > 0) {
    base.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(config.preuve.noteGoogle).replace(',', '.'),
      reviewCount: config.preuve.nombreAvis
    };
  }
  return Object.assign(base, extra);
}

function serviceSchema({ nom, description, ville, slug }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: nom,
    description,
    provider: { '@id': domaine + '/#entreprise' },
    areaServed: { '@type': 'City', name: ville },
    url: url(slug),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: url(slug) + '#simulateur'
    }
  };
}

function faqSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.r.replace(/<[^>]+>/g, '') }
    }))
  };
}

function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.nom, item: domaine + it.href
    }))
  };
}

const bloc = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj, null, 0)}</script>`;

/* ------------------------------------------------------- fragments communs */

// L'accordéon FAQ et son balisage Schema.org sont produits à partir de la
// MÊME source : impossible qu'ils divergent (ce qui ferait perdre le rich
// snippet Google sans que personne ne s'en aperçoive).
function faqHtml(items) {
  return items.map((it) => `        <details>
          <summary>${echapper(it.q)}</summary>
          <div class="faq__body">${it.r}</div>
        </details>`).join('\n');
}

function avisHtml(liste) {
  return liste.map((a) => `        <article class="review">
          <div class="review__stars" aria-label="${a.note} étoiles sur 5">${'★'.repeat(a.note)}${'☆'.repeat(5 - a.note)}</div>
          <p class="review__text">«&nbsp;${echapper(a.texte)}&nbsp;»</p>
          <div class="review__author">
            <span class="review__avatar" aria-hidden="true">${echapper(a.initiales)}</span>
            <span><strong>${echapper(a.nom)}</strong><span>${echapper(a.ville)} · ${echapper(a.prestation)}</span></span>
          </div>
        </article>`).join('\n');
}

function prestationsHtml(liste) {
  return liste.map((p) => `        <article class="card reveal">
          <span class="card__icon">${p.icone}</span>
          <h3>${echapper(p.titre)}</h3>
          <p>${p.texte}</p>
          <p class="card__price">${echapper(p.prix)}<span>${echapper(p.prixNote)}</span></p>
          ${p.lien ? `<a class="card__link" href="${p.lien}">${echapper(p.lienTexte)}</a>` : ''}
        </article>`).join('\n');
}

function zonesHtml(communes) {
  const liens = {
    Cannes: '/nettoyage-canape-cannes',
    Antibes: '/nettoyage-canape-antibes',
    Grasse: '/nettoyage-canape-grasse'
  };
  return communes.map((v) => liens[v]
    ? `<li><a href="${liens[v]}">${echapper(v)}</a></li>`
    : `<li><span>${echapper(v)}</span></li>`).join('\n          ');
}

/* -------------------------------------------------------------- contexte */

const vars = {
  nom: config.entreprise.nom,
  villeBase: config.entreprise.villeBase,
  domaine,
  annee: new Date().getFullYear(),
  tel: config.contact.telephone,
  telAffichage: config.contact.telephoneAffichage,
  email: config.contact.email,
  instagram: config.contact.instagram,
  tiktok: config.contact.tiktok,
  whatsapp: config.contact.whatsapp,
  waUrl: 'https://wa.me/' + config.contact.whatsapp +
    '?text=' + encodeURIComponent(`Bonjour Net & Care, je souhaite un devis pour un nettoyage.`),
  horairesTexte: config.entreprise.horairesTexte,
  raisonSociale: config.entreprise.raisonSociale,
  formeJuridique: config.entreprise.formeJuridique,
  adresse: config.entreprise.adresse,
  siret: config.entreprise.siret,
  tva: config.entreprise.tva,
  directeurPublication: config.entreprise.directeurPublication,
  hebergeur: config.entreprise.hebergeur,
  rayonKm: config.zones.rayonKm,
  villesPrincipales: config.zones.principales.join(', '),
  villesFooter: 'Intervention à ' + config.zones.communes.join(' · '),
  delaiRappel: config.delais.rappel,
  delaiIntervention: config.delais.intervention,
  delaiSechage: config.delais.sechage,
  delaiInterventionCourt: config.delais.interventionCourt,
  delaiSechageCourt: config.delais.sechageCourt,
  avisHtml: avisHtml(avis),
  zonesHtml: zonesHtml(config.zones.communes),
  prestationsHtml: prestationsHtml(prestations),
  robots: 'index, follow',
  bodyClass: '',
  preselect: '',
  simTitre: 'Estimation en 60 secondes',
  simSousTitre: 'Six questions, une fourchette immédiate — puis Net & Care confirme sur WhatsApp ou par téléphone.',
  analytics: ''
};

if (config.analytics.ga4) {
  vars.analytics =
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${config.analytics.ga4}"></script>\n` +
    `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${config.analytics.ga4}');</script>`;
}

// Deux gabarits : le site complet, et une version dépouillée pour la page
// « lien en bio » (voir src/layout-bio.html). Une page choisit le sien avec
// « "layout": "layout-bio" » dans son en-tête JSON.
const layouts = {
  layout: lire(path.join(SRC, 'layout.html')),
  'layout-bio': lire(path.join(SRC, 'layout-bio.html'))
};

/* ------------------------------------------------------------- génération */

const ecrites = [];

function ecrirePage(page) {
  const ctx = Object.assign({}, vars, page, {
    canonical: url(page.slug),
    home: page.slug === 'index' ? '' : '/',
    ogTitle: page.ogTitle || page.title
  });

  if (page.faq) {
    ctx.faqHtml = faqHtml(page.faq);
  }

  const schemas = [];
  if (page.slug === 'index') {
    schemas.push(localBusiness({ '@type': ['HomeAndConstructionBusiness', 'LocalBusiness'] }));
    schemas.push({
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: config.entreprise.nom, url: domaine + '/'
    });
  } else if (page.service) {
    schemas.push(localBusiness());
    schemas.push(serviceSchema(Object.assign({ slug: page.slug }, page.service)));
  } else if (page.localBusiness) {
    schemas.push(localBusiness());
  }
  if (page.faq) schemas.push(faqSchema(page.faq));
  if (page.fil) schemas.push(breadcrumbSchema(page.fil));
  ctx.jsonld = schemas.map(bloc).join('\n');

  const gabarit = layouts[page.layout || 'layout'];
  if (!gabarit) throw new Error(`Gabarit inconnu : ${page.layout}`);
  const corps = rendre(page.body, ctx);
  const html = rendre(gabarit, Object.assign(ctx, { body: corps }));

  const dest = path.join(ROOT, page.slug + '.html');
  fs.writeFileSync(dest, html);
  ecrites.push({ slug: page.slug, priorite: page.priorite || 0.7, octets: Buffer.byteLength(html) });
}

/* 1. Pages écrites à la main (src/pages/*.html) -------------------------- */
for (const f of fs.readdirSync(path.join(SRC, 'pages')).sort()) {
  const brut = lire(path.join(SRC, 'pages', f));
  const m = brut.match(/^<!--@([\s\S]*?)@-->\s*/);
  if (!m) throw new Error(`En-tête JSON manquant dans src/pages/${f}`);
  const meta = JSON.parse(m[1]);
  ecrirePage(Object.assign(meta, { body: brut.slice(m[0].length) }));
}

/* 2. Pages locales générées à partir de src/local-pages.js --------------- */
for (const p of pagesLocales) {
  ecrirePage(rendreLocale(p, { config, echapper }));
}

/* 3. Configuration exécutée par le navigateur ----------------------------
   Le simulateur ne doit jamais contenir de prix ni de numéro en dur : il lit
   ce fichier, lui-même dérivé de site.config.json.                        */
const runtime = {
  tel: config.contact.telephone,
  telAffichage: config.contact.telephoneAffichage,
  whatsapp: config.contact.whatsapp,
  email: config.contact.email,
  endpoint: '/.netlify/functions/netcare-devis',
  zones: { communes: config.zones.communes, zone2: config.zones.zone2 },
  tarifs: config.tarifs,
  delais: config.delais
};
delete runtime.tarifs._note;

fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'config.generated.js'),
`/* FICHIER GÉNÉRÉ — ne pas modifier à la main.
   Source : net-and-care/site.config.json · Régénérer : npm run build:netcare */
window.NETCARE = ${JSON.stringify(runtime, null, 2)};
`);

/* 4. sitemap.xml + robots.txt ------------------------------------------- */
const aujourdhui = new Date().toISOString().slice(0, 10);
// Les pages légales sont en noindex : les déclarer dans le sitemap enverrait
// à Google un signal contradictoire (« indexe ceci » / « n'indexe pas ceci »).
const indexables = ecrites.filter((p) => !['mentions-legales', 'confidentialite', '404'].includes(p.slug));

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexables
  .sort((a, b) => b.priorite - a.priorite)
  .map((p) => `  <url>
    <loc>${url(p.slug)}</loc>
    <lastmod>${aujourdhui}</lastmod>
    <changefreq>${p.priorite >= 0.9 ? 'weekly' : 'monthly'}</changefreq>
    <priority>${p.priorite.toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>
`);

fs.writeFileSync(path.join(ROOT, 'robots.txt'),
`# ${config.entreprise.nom} — ${domaine}
User-agent: *
Allow: /
Disallow: /.netlify/

Sitemap: ${domaine}/sitemap.xml
`);

/* ------------------------------------------------------------ rapport ---- */

console.log('\nNet & Care — pages générées\n');
ecrites.sort((a, b) => a.slug.localeCompare(b.slug)).forEach((p) => {
  console.log(`  ✓ ${(p.slug + '.html').padEnd(38)} ${(p.octets / 1024).toFixed(1).padStart(6)} Ko`);
});
console.log(`\n  ${ecrites.length} pages · sitemap.xml · robots.txt · assets/js/config.generated.js`);
console.log(`  ${indexables.length} pages dans le sitemap.\n`);

if (manquants.size) {
  console.log('  ⚠ Variables de gabarit sans valeur : ' + Array.from(manquants).join(', ') + '\n');
}

/* Rappel des valeurs à renseigner : tant qu'un « À_REMPLACER » subsiste, le
   site affiche des informations fausses (numéro, SIRET…). Le build ne bloque
   pas — on doit pouvoir travailler la mise en page avant d'avoir tout — mais
   il le dit à chaque fois, en clair. */
const aRemplir = [];
(function scan(obj, chemin) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.includes('À_REMPLACER')) aRemplir.push(`${chemin}${k}`);
    else if (v && typeof v === 'object' && !Array.isArray(v)) scan(v, `${chemin}${k}.`);
  }
})(config, '');

if (aRemplir.length) {
  console.log('  ⚠ INFORMATIONS À RENSEIGNER dans net-and-care/site.config.json :');
  aRemplir.forEach((c) => console.log('      · ' + c));
  console.log('');
}
if (config.contact.telephone === '+33600000000') {
  console.log('  ⚠ Le numéro de téléphone et le numéro WhatsApp sont encore des');
  console.log('    valeurs de démonstration : les liens d\'appel ne fonctionneront pas.\n');
}
