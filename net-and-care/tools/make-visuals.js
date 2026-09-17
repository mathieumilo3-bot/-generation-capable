/* ===========================================================================
   Génère les visuels de remplacement (SVG) livrés avec le site.
   ---------------------------------------------------------------------------
   Net & Care n'a pas encore fourni ses photos : le site doit pourtant être
   présentable et démontrable dès maintenant. Ces visuels sont donc des
   placeholders ASSUMÉS — texture textile, silhouette du mobilier, et un
   discret libellé « visuel provisoire » pour qu'aucun visiteur (ni aucun
   relecteur) ne les prenne pour de vraies photos de chantier.

   Remplacement : déposer les vraies photos dans assets/img/ sous le même nom
   en .jpg, puis remplacer l'extension dans les pages (voir README).

       node net-and-care/tools/make-visuals.js
   =========================================================================== */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'img');

// Palettes par type de textile : [fond, ombre, rehaut]
const SCENES = {
  canape:   { fond: '#8fa8b6', mur: '#e9f0f2', nom: 'Canapé tissu 3 places' },
  matelas:  { fond: '#dcd6c9', mur: '#f1efe9', nom: 'Matelas 140×190' },
  tapis:    { fond: '#b9a184', mur: '#ece7dd', nom: 'Tapis laine 2×1,5 m' },
  moquette: { fond: '#9fae9c', mur: '#eceee8', nom: 'Moquette de bureau' }
};

function melange(hex, vers, k) {
  const a = hex.match(/\w\w/g).map(x => parseInt(x, 16));
  const b = vers.match(/\w\w/g).map(x => parseInt(x, 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// Silhouettes : dessinées en coordonnées d'un viewBox 1200×900.
const FORMES = {
  canape: (c) => `
    <rect x="120" y="300" width="960" height="330" rx="46" fill="${c.corps}"/>
    <rect x="150" y="250" width="900" height="240" rx="40" fill="${c.dos}"/>
    <rect x="200" y="370" width="380" height="180" rx="26" fill="${c.coussin}"/>
    <rect x="620" y="370" width="380" height="180" rx="26" fill="${c.coussin}"/>
    <rect x="96" y="330" width="120" height="290" rx="44" fill="${c.dos}"/>
    <rect x="984" y="330" width="120" height="290" rx="44" fill="${c.dos}"/>
    <rect x="200" y="630" width="42" height="70" rx="14" fill="${c.pied}"/>
    <rect x="958" y="630" width="42" height="70" rx="14" fill="${c.pied}"/>`,
  matelas: (c) => `
    <rect x="130" y="280" width="940" height="360" rx="40" fill="${c.corps}"/>
    <rect x="130" y="430" width="940" height="26" fill="${c.dos}" opacity=".5"/>
    <g fill="${c.dos}" opacity=".45">
      ${[300, 500, 700, 900].map(x => `<circle cx="${x}" cy="355" r="9"/><circle cx="${x}" cy="545" r="9"/>`).join('')}
    </g>
    <rect x="160" y="640" width="880" height="60" rx="18" fill="${c.pied}"/>`,
  tapis: (c) => `
    <rect x="150" y="260" width="900" height="420" rx="16" fill="${c.corps}"/>
    <rect x="200" y="310" width="800" height="320" rx="8" fill="none" stroke="${c.dos}" stroke-width="18"/>
    <rect x="270" y="380" width="660" height="180" rx="6" fill="${c.coussin}" opacity=".7"/>
    <path d="M330 470h540" stroke="${c.dos}" stroke-width="14" stroke-linecap="round" opacity=".6"/>`,
  moquette: (c) => `
    <rect x="90" y="250" width="1020" height="440" rx="10" fill="${c.corps}"/>
    <g stroke="${c.dos}" stroke-width="3" opacity=".35">
      ${Array.from({ length: 34 }, (_, i) => `<path d="M${110 + i * 30} 250v440"/>`).join('')}
    </g>`
};

function scene({ type, sale }) {
  const p = SCENES[type];
  // L'écart « avant / après » doit se lire en vignette, sur un téléphone, en
  // une demi-seconde : le côté sale est nettement plus terne et plus jaune,
  // le côté propre plus clair et plus saturé. Un écart subtil ne prouve rien.
  const corps = sale
    ? melange(melange(p.fond, '#6a5f4e', 0.46), '#000000', 0.08)
    : melange(p.fond, '#ffffff', 0.1);
  const c = {
    corps,
    dos: melange(corps, '#000000', sale ? 0.2 : 0.14),
    coussin: melange(corps, '#ffffff', sale ? 0.04 : 0.18),
    pied: sale ? '#4a3d31' : '#5a4a3c'
  };

  // Taches : uniquement sur la version « avant ».
  const taches = sale ? `
    <g filter="url(#flou)" opacity=".75">
      <ellipse cx="420" cy="455" rx="124" ry="78" fill="#57401f"/>
      <ellipse cx="760" cy="430" rx="78" ry="52" fill="#4b3720"/>
      <ellipse cx="610" cy="520" rx="56" ry="32" fill="#5c4726"/>
      <ellipse cx="880" cy="500" rx="44" ry="28" fill="#584626"/>
      <ellipse cx="300" cy="560" rx="90" ry="40" fill="#4f402c"/>
    </g>
    <g opacity=".3">
      <circle cx="330" cy="400" r="7" fill="#4a3c2c"/>
      <circle cx="520" cy="380" r="5" fill="#4a3c2c"/>
      <circle cx="700" cy="560" r="6" fill="#4a3c2c"/>
    </g>` : `
    <g opacity=".35">
      <path d="M240 330c120-34 300-34 420 0" stroke="#ffffff" stroke-width="16" fill="none" stroke-linecap="round"/>
      <path d="M700 350c90-22 180-22 260 0" stroke="#ffffff" stroke-width="12" fill="none" stroke-linecap="round"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="${p.nom} — ${sale ? 'avant' : 'après'} nettoyage (visuel provisoire)">
  <defs>
    <linearGradient id="mur" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${melange(p.mur, '#ffffff', 0.5)}"/>
      <stop offset="1" stop-color="${p.mur}"/>
    </linearGradient>
    <filter id="flou"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="fibre" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${sale ? 7 : 3}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="${sale ? 0.2 : 0.12}"/></feComponentTransfer>
    </filter>
    <radialGradient id="lum" cx="50%" cy="26%" r="80%">
      <stop offset="0" stop-color="${sale ? '#d8c9a8' : '#ffffff'}" stop-opacity="${sale ? 0.1 : 0.45}"/>
      <stop offset="1" stop-color="#000000" stop-opacity="${sale ? 0.36 : 0.1}"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="900" fill="url(#mur)"/>
  <ellipse cx="600" cy="726" rx="500" ry="52" fill="#000" opacity=".12"/>
  ${FORMES[type](c)}
  ${taches}
  <rect width="1200" height="900" fill="url(#lum)"/>
  <rect width="1200" height="900" filter="url(#fibre)" opacity=".75"/>

  <g opacity=".62">
    <rect x="28" y="824" width="${sale ? 250 : 250}" height="48" rx="12" fill="#07202b" opacity=".55"/>
    <text x="48" y="854" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="#ffffff">Visuel provisoire</text>
  </g>
</svg>`;
}

const fichiers = [];
Object.keys(SCENES).forEach((type) => {
  fichiers.push([`${type}-avant.svg`, scene({ type, sale: true })]);
  fichiers.push([`${type}-apres.svg`, scene({ type, sale: false })]);
});

/* --- Favicon ------------------------------------------------------------ */
fichiers.push(['favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e7c86"/><stop offset="1" stop-color="#12b3a8"/></linearGradient></defs>
  <rect width="48" height="48" rx="11" fill="url(#g)"/>
  <path d="M24 11c-4.6 4.9-8 9.3-8 13.6a8 8 0 0 0 16 0C32 20.3 28.6 15.9 24 11z" fill="#fff"/>
  <path d="M17.5 30.5c2.6 2 4.9 2.6 6.5 2.6s3.9-.6 6.5-2.6" stroke="#0e4557" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</svg>`]);

/* --- Carte de la zone d'intervention ------------------------------------
   Schéma stylisé, pas une carte géographique exacte : il sert à faire
   comprendre « ces communes sont couvertes », pas à naviguer.            */
const villes = [
  ['Grasse', 300, 180], ['Mouans-Sartoux', 372, 262], ['Valbonne', 520, 246],
  ['Biot', 640, 300], ['Mougins', 430, 330], ['Le Cannet', 448, 400],
  ['Cannes', 402, 470], ['Vallauris', 570, 392], ['Antibes', 672, 404],
  ['Juan-les-Pins', 652, 470], ['Mandelieu', 250, 496], ['Théoule', 192, 560]
];
fichiers.push(['zone-intervention.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 660" width="860" height="660" role="img" aria-label="Carte des communes couvertes par Net &amp; Care autour de Cannes">
  <defs>
    <linearGradient id="mer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9ea"/><stop offset="1" stop-color="#a9d7db"/></linearGradient>
    <radialGradient id="zone" cx="48%" cy="58%" r="52%">
      <stop offset="0" stop-color="#12b3a8" stop-opacity=".3"/>
      <stop offset="1" stop-color="#12b3a8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="860" height="660" fill="#f2f7f7"/>
  <path d="M0 470C140 500 260 556 330 600s180 60 240 60H860v60H0z" fill="url(#mer)"/>
  <path d="M0 470C140 500 260 556 330 600s180 60 240 60H860" fill="none" stroke="#7fc4c8" stroke-width="3"/>
  <g fill="#e6ece9" stroke="#d6e0da" stroke-width="2">
    <path d="M60 120h240l60 70-40 110-150 40-110-80z"/>
    <path d="M300 120h260l80 90-60 120-200 30-120-70z"/>
    <path d="M560 200h240l40 120-120 110-180-40z"/>
    <path d="M110 260l150 60 120 130-90 120-190-90z"/>
    <path d="M380 340l220 40 60 140-180 60-140-90z"/>
  </g>
  <ellipse cx="420" cy="400" rx="420" ry="330" fill="url(#zone)"/>
  <circle cx="402" cy="470" r="128" fill="none" stroke="#12b3a8" stroke-width="2.5" stroke-dasharray="8 7" opacity=".75"/>
  <circle cx="402" cy="470" r="250" fill="none" stroke="#12b3a8" stroke-width="2" stroke-dasharray="6 9" opacity=".45"/>
  ${villes.map(([nom, x, y]) => {
    const principal = ['Cannes', 'Antibes', 'Grasse'].includes(nom);
    return `<g>
      <circle cx="${x}" cy="${y}" r="${principal ? 9 : 5}" fill="${principal ? '#0e7c86' : '#5c7681'}"/>
      ${principal ? `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="#12b3a8" stroke-width="2" opacity=".6"/>` : ''}
      <text x="${x + (principal ? 22 : 12)}" y="${y + 5}" font-family="Helvetica,Arial,sans-serif" font-size="${principal ? 21 : 16}" font-weight="${principal ? '700' : '400'}" fill="#0a2029">${nom}</text>
    </g>`;
  }).join('\n  ')}
  <g>
    <rect x="28" y="590" width="258" height="44" rx="10" fill="#ffffff" opacity=".9"/>
    <circle cx="52" cy="612" r="7" fill="#0e7c86"/>
    <text x="70" y="618" font-family="Helvetica,Arial,sans-serif" font-size="17" fill="#0a2029">Zone d'intervention Net &amp; Care</text>
  </g>
</svg>`]);

fs.mkdirSync(OUT, { recursive: true });
fichiers.forEach(([nom, contenu]) => {
  fs.writeFileSync(path.join(OUT, nom), contenu.trim() + '\n');
  console.log('  ✓ assets/img/' + nom);
});
console.log(`\n${fichiers.length} visuels générés.`);
