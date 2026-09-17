/* ===========================================================================
   Gabarit des pages locales (« nettoyage canapé Cannes », etc.).
   ---------------------------------------------------------------------------
   Ces pages sont la moitié du travail de référencement local : c'est sur elles
   qu'atterrit une recherche « nettoyage canapé Antibes ». Pour qu'elles soient
   utiles — et non considérées comme des doublons par Google — la structure est
   commune mais TOUT le contenu vient de src/local-pages.js : titres, texte
   d'introduction, quartiers cités, tarifs, questions fréquentes.

   Règle : aucune phrase générique recopiée d'une ville à l'autre. Si une page
   n'a rien de spécifique à dire sur sa ville, elle ne mérite pas d'exister.
   =========================================================================== */

module.exports = function rendreLocale(p, { echapper }) {
  const visuel = p.visuel || 'canape';

  const proof = (p.reassurance || []).map((r) =>
    `        <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg> ${echapper(r)}</li>`
  ).join('\n');

  const sections = (p.sections || []).map((s) => `
      <h2>${echapper(s.titre)}</h2>
      ${s.corps}`).join('\n');

  const tarifs = (p.tarifs || []).map((t) =>
    `          <tr><td><strong>${echapper(t.quoi)}</strong><br><span style="color:var(--muted);font-size:.86rem">${echapper(t.detail)}</span></td><td>${echapper(t.prix)}</td></tr>`
  ).join('\n');

  const quartiers = (p.quartiers || []).map((q) => `<li><span>${echapper(q)}</span></li>`).join('\n            ');

  const liens = (p.liens || []).map((l) =>
    `        <a href="${l.href}">${echapper(l.texte)}</a>`
  ).join('\n');

  const body = `
<div class="wrap">
  <nav class="crumb" aria-label="Fil d'ariane">
    <a href="/">Accueil</a> › <span>${echapper(p.h1)}</span>
  </nav>
</div>

<section class="hero" style="padding-top:20px">
  <div class="wrap hero__grid">
    <div>
      <span class="hero__local">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${echapper(p.ville)} et communes limitrophes
      </span>
      <h1>${p.h1Html || echapper(p.h1)}</h1>
      <p class="hero__lead">${p.accroche}</p>
      <div class="btn-row">
        <a class="btn btn--primary btn--lg" href="#simulateur" data-track="cta-hero-local">
          Estimer mon nettoyage
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a class="btn btn--ghost btn--lg" href="tel:{{tel}}" data-track="tel-hero-local">{{telAffichage}}</a>
      </div>
      <ul class="hero__proof">
${proof}
      </ul>
    </div>
    <div class="hero__visual">
      <div class="ba" style="border:0;box-shadow:var(--shadow-l)">
        <div class="ba__viewer" data-ba style="aspect-ratio:4/3;border-radius:var(--radius-xl)">
          <img src="/assets/img/${visuel}-apres.svg" alt="${echapper(p.altApres)}" width="1200" height="900" fetchpriority="high">
          <span class="ba__tag ba__tag--before">Avant</span>
          <div class="ba__overlay"><img src="/assets/img/${visuel}-avant.svg" alt="${echapper(p.altAvant)}" width="1200" height="900"></div>
          <span class="ba__tag ba__tag--after">Après</span>
          <input class="ba__range" type="range" min="0" max="100" value="52" aria-label="Comparer le résultat avant et après nettoyage">
          <div class="ba__handle"><span class="ba__knob">‹ ›</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section--mist section--tight">
  <div class="wrap">
    <div class="section-head section-head--center">
      <span class="eyebrow">Estimation immédiate</span>
      <h2>${echapper(p.simH2)}</h2>
      <p>Renseignez votre besoin en une minute. Net&nbsp;&amp;&nbsp;Care vous rappelle en {{delaiRappel}} avec un prix ferme.</p>
    </div>
    {{> simulateur}}
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="prose">
${sections}
    </div>
  </div>
</section>

<section class="section section--mist section--tight">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Tarifs indicatifs</span>
      <h2>${echapper(p.tarifsTitre)}</h2>
      <p>Prix TTC, déplacement inclus à ${echapper(p.ville)}. Le montant exact est confirmé avant l'intervention.</p>
    </div>
    <div class="price-table">
      <table>
        <thead><tr><th scope="col">Prestation</th><th scope="col">À partir de</th></tr></thead>
        <tbody>
${tarifs}
        </tbody>
      </table>
    </div>
    <p style="margin-top:16px;font-size:.86rem;color:var(--muted-light)">
      Tarifs indicatifs hors cas particuliers (textile fragile, tache ancienne, accès difficile).
      Le simulateur affine l'estimation selon l'état réel de votre textile.
    </p>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap zones-grid">
    <div>
      <span class="eyebrow">Secteurs couverts</span>
      <h2>Net&nbsp;&amp;&nbsp;Care intervient dans tout ${echapper(p.ville)}</h2>
      <p>${p.zoneTexte}</p>
      <ul class="zones-list">
            ${quartiers}
      </ul>
    </div>
    <div>
      <div class="zone-map">
        <img src="/assets/img/zone-intervention.svg" alt="Zone d'intervention de Net &amp; Care autour de ${echapper(p.ville)}" width="860" height="660" loading="lazy">
      </div>
    </div>
  </div>
</section>

<section class="section section--sand">
  <div class="wrap">
    <div class="section-head section-head--center">
      <span class="eyebrow">Questions fréquentes</span>
      <h2>${echapper(p.faqTitre)}</h2>
    </div>
    <div class="faq">
{{faqHtml}}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <div class="section-head">
      <span class="eyebrow">Voir aussi</span>
      <h2>Autres prestations et villes</h2>
    </div>
    <div class="linkgrid">
${liens}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <div class="cta-final">
      <h2>${echapper(p.ctaTitre)}</h2>
      <p>Estimation immédiate, devis gratuit, rappel en {{delaiRappel}}.</p>
      <div class="btn-row">
        <a class="btn btn--primary btn--lg" href="#simulateur" data-track="cta-final-local">Obtenir mon devis</a>
        <a class="btn btn--ghost btn--lg" href="{{waUrl}}" target="_blank" rel="noopener" data-track="wa-final-local">WhatsApp</a>
      </div>
    </div>
  </div>
</section>
`;

  return {
    slug: p.slug,
    title: p.title,
    ogTitle: p.ogTitle || p.title,
    description: p.description,
    priorite: p.priorite || 0.8,
    preselect: p.preselect || '',
    simTitre: p.simTitre || 'Estimation en 60 secondes',
    simSousTitre: p.simSousTitre || 'Six questions, une fourchette de prix immédiate.',
    faq: p.faq,
    fil: [
      { nom: 'Accueil', href: '/' },
      { nom: p.h1, href: '/' + p.slug }
    ],
    service: {
      nom: p.serviceNom,
      description: p.description,
      ville: p.ville
    },
    body
  };
};
