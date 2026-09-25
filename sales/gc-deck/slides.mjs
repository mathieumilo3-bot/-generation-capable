/**
 * GC sales deck — slide templates. Each slide is a function (cfg, ctx) →
 * one <section> in the Slides artifact format (fixed 1920×1080 canvas,
 * inline styles only). Visual system: architectural plan grid, three
 * surfaces (paper, stone, black), one mineral accent — no gold, no glow.
 */

const P = {
  paper: "#F3F1EC",
  stone: "#E4DFD6",
  black: "#131313",
  panel: "#1C1C1D",
  ink: "#141414",
  inkSoft: "#55534F",
  onDark: "#ECEAE5",
  onDarkSoft: "#A7A49E",
  lineLight: "#D9D4CB",
  lineStone: "#CAC4B9",
  lineDark: "#2B2B2B",
  ruleDark: "#3A3A3A",
  mineral: "#CFC7B8",
  sand: "#6E6556",
};

const F = {
  d: "'Inter Tight', Arial, sans-serif",
  b: "Manrope, Arial, sans-serif",
  m: "'IBM Plex Mono', 'Courier New', monospace",
};

const T = {
  paper: { bg: P.paper, fg: P.ink, soft: P.inkSoft, line: P.lineLight, rule: P.ink, accent: P.sand },
  stone: { bg: P.stone, fg: P.ink, soft: P.inkSoft, line: P.lineStone, rule: P.ink, accent: P.sand },
  dark: { bg: P.black, fg: P.onDark, soft: P.onDarkSoft, line: P.lineDark, rule: P.ruleDark, accent: P.mineral },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Architectural plan grid: four bays, axis bubbles, crosses at the nodes. */
function grid(t) {
  const xs = [128, 544, 960, 1376, 1792];
  const ys = [128, 952];
  const lines = [
    ...xs.map((x) => `<line x1="${x}" y1="96" x2="${x}" y2="984" stroke="${t.line}" stroke-width="1"/>`),
    ...ys.map((y) => `<line x1="96" y1="${y}" x2="1824" y2="${y}" stroke="${t.line}" stroke-width="1"/>`),
    ...xs.map((x) => `<circle cx="${x}" cy="56" r="11" fill="none" stroke="${t.line}" stroke-width="1"/>`),
    ...ys.map((y) => `<circle cx="56" cy="${y}" r="11" fill="none" stroke="${t.line}" stroke-width="1"/>`),
    ...xs.flatMap((x) => ys.map((y) => `<path d="M${x - 9} ${y}H${x + 9}M${x} ${y - 9}V${y + 9}" stroke="${t.soft}" stroke-opacity="0.45" stroke-width="1"/>`)),
  ];
  return `<svg aria-hidden="true" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${lines.join("")}</svg>`;
}

const label = (t, text, color) =>
  `<p style="font-family:${F.m}; font-size:24px; font-weight:500; letter-spacing:3px; text-transform:uppercase; line-height:1.3; color:${color ?? t.accent}">${text}</p>`;

const mono = (t, text, extra = "") =>
  `<p style="font-family:${F.m}; font-size:24px; letter-spacing:2px; text-transform:uppercase; line-height:1.4; color:${t.soft}; ${extra}">${text}</p>`;

const h2 = (text, extra = "") =>
  `<h2 style="font-family:${F.d}; font-size:64px; font-weight:500; line-height:1.1; letter-spacing:-1px; ${extra}">${text}</h2>`;

function footer(t, ctx) {
  return `<div style="position:absolute; left:128px; right:128px; bottom:64px; display:flex; flex-direction:row; justify-content:space-between">${mono(t, "GC — Systèmes de revenus digitaux")}${mono(t, `${ctx.num} / ${ctx.chapter}`)}</div>`;
}

function section(id, theme, ctx, body, layout = "justify-content:space-between") {
  const t = T[theme];
  return `<section id="${id}"${ctx.hidden ? " hidden" : ""} data-transition="fade" style="background:${t.bg}; color:${t.fg}; font-family:${F.b}; padding:128px 128px 160px; display:flex; flex-direction:column; gap:40px; ${layout}">${grid(t)}${body}${footer(t, ctx)}</section>`;
}

/* ------------------------------------------------------------------------ */
/* 01 — CORE                                                                */
/* ------------------------------------------------------------------------ */

function cover(cfg, ctx) {
  const t = T.dark;
  const a = cfg.assets;
  const dim = `<svg aria-hidden="true" viewBox="0 0 980 24" width="980" height="24" style="position:absolute; left:800px; top:150px; width:980px; height:24px"><line x1="0" y1="12" x2="980" y2="12" stroke="${P.onDarkSoft}" stroke-width="1"/><line x1="0.5" y1="2" x2="0.5" y2="22" stroke="${P.onDarkSoft}" stroke-width="1"/><line x1="979.5" y1="2" x2="979.5" y2="22" stroke="${P.onDarkSoft}" stroke-width="1"/></svg>`;
  return `<section id="cover"${ctx.hidden ? " hidden" : ""} data-transition="fade" style="background:${t.bg}; color:${t.fg}; font-family:${F.b}; padding:128px; display:flex; flex-direction:column; justify-content:space-between">
${grid(t)}
<div style="width:600px; display:flex; flex-direction:column; gap:24px">${label(t, "GC — Génération Capable")}</div>
<div style="width:600px; display:flex; flex-direction:column; gap:40px">
<h1 style="font-family:${F.d}; font-size:88px; font-weight:500; line-height:1.02; letter-spacing:-2px">Votre visibilité attire.<br><span style="color:#8F8C86">Votre système convertit.</span></h1>
${label(t, "Systèmes de revenus digitaux", P.onDarkSoft)}
</div>
${dim}
<p style="position:absolute; left:800px; top:100px; width:600px; font-family:${F.m}; font-size:24px; letter-spacing:2px; color:${P.onDarkSoft}">DESKTOP · 1440 PX</p>
<img src="${a.ccDesktopHero}" alt="Page d'accueil de la démonstration Clos &amp; Cadre, en desktop" style="position:absolute; left:800px; top:200px; width:980px; height:612px; object-fit:cover; border:1px solid #2F2F2F">
<img src="${a.ccMobileHero}" alt="La même page d'accueil sur mobile" style="position:absolute; left:1548px; top:420px; width:236px; height:511px; object-fit:cover; border:6px solid #262626; border-radius:30px; box-shadow:0px 30px 80px rgba(0,0,0,0.55)">
<p style="position:absolute; left:800px; top:840px; width:700px; font-family:${F.m}; font-size:24px; letter-spacing:2px; color:${P.mineral}">DÉMONSTRATION GC — CLOS &amp; CADRE</p>
</section>`;
}

function manifeste(cfg, ctx) {
  const t = T.paper;
  return section(
    "manifeste",
    "paper",
    ctx,
    `${label(t, "Positionnement")}
<h1 style="font-family:${F.d}; font-size:150px; font-weight:600; line-height:0.95; letter-spacing:-4px; text-transform:uppercase">Nous ne<br>construisons<br>pas des sites.</h1>
<div style="display:flex; flex-direction:row; justify-content:space-between; align-items:flex-end; gap:64px">
<p style="font-family:${F.d}; font-size:56px; font-weight:400; line-height:1.1; width:760px">Nous construisons le système derrière.</p>
${mono(t, "Visibilité → Site → Confiance → Conversion → Qualification → RDV → Suivi → Client", "width:760px; text-align:right")}
</div>`,
  );
}

function parcours(cfg, ctx) {
  const t = T.stone;
  const steps = ["Visibilité", "Compréhension", "Confiance", "Action", "Qualification", "RDV", "Client"];
  const cols = steps
    .map((step, i) => {
      const last = i === steps.length - 1;
      return `<div style="flex:1; display:flex; flex-direction:column; gap:14px; padding:28px 16px 0px 0px; border-top:${last ? 8 : 2}px solid ${P.ink}">${label(t, String(i + 1).padStart(2, "0"))}<p style="font-family:${F.d}; font-size:28px; font-weight:${last ? 600 : 500}; line-height:1.2">${step}</p></div>`;
    })
    .join("");
  return section(
    "parcours",
    "stone",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "01 — Le parcours")}${h2("Entre la visibilité et le client, sept passages.")}</div>
<div style="display:flex; flex-direction:row; gap:12px">${cols}</div>
<p style="font-family:${F.d}; font-size:40px; font-weight:400; line-height:1.25; width:1100px">Un prospect ne se perd pas d'un coup. Il se perd à chaque passage.</p>`,
  );
}

function ruptures(cfg, ctx) {
  const t = T.dark;
  const stages = [
    ["Visibilité", "l'attention ne comprend pas l'offre"],
    ["Site", "la confiance ne suffit pas pour agir"],
    ["Contact", "la demande arrive sans qualification"],
    ["Vente", null],
  ];
  const stack = stages
    .map(([name, rupture]) => {
      const block = `<div style="display:flex; flex-direction:column; gap:10px"><p style="font-family:${F.d}; font-size:72px; font-weight:500; line-height:1; letter-spacing:-1px">${name}</p><div style="width:520px; height:3px; background:${P.onDark}"></div></div>`;
      const gap = rupture
        ? `<div style="display:flex; flex-direction:row; align-items:center; gap:24px; padding:18px 0px 18px 0px"><div style="width:2px; height:52px; border-left:2px dashed ${P.onDarkSoft}"></div><p style="font-family:${F.m}; font-size:24px; letter-spacing:2px; color:${P.onDarkSoft}">RUPTURE — ${rupture}</p></div>`
        : "";
      return block + gap;
    })
    .join("");
  return section(
    "ruptures",
    "dark",
    ctx,
    `${label(t, "02 — Les ruptures")}
<div style="display:flex; flex-direction:row; justify-content:space-between; align-items:flex-end; gap:80px">
<div style="width:820px; display:flex; flex-direction:column">${stack}</div>
<div style="flex:1; display:flex; flex-direction:column; gap:32px">${h2("Chaque rupture laisse du chiffre d'affaires sur le parcours.")}<p style="font-size:30px; line-height:1.4; color:${P.onDarkSoft}">GC travaille sur les jonctions, pas seulement sur les pages.</p></div>
</div>`,
    "justify-content:flex-start; gap:56px",
  );
}

function architecture(cfg, ctx) {
  const t = T.paper;
  const rows = [
    ["Acquisition", "Google · Social · Recommandation", "Flow"],
    ["Landing", null, "Foundation"],
    ["Confiance", null, "Foundation"],
    ["Qualification", null, "Conversion"],
    ["CRM", null, "Data"],
    ["RDV", null, "Conversion"],
    ["Vente", null, "Growth"],
  ];
  const tree = rows
    .map(([name, detail, layer], i) => {
      const box = `<div style="width:900px; display:flex; flex-direction:row; align-items:center; gap:24px; padding:12px 24px; border:1px solid ${P.ink}; background:${i === rows.length - 1 ? P.ink : P.paper}; color:${i === rows.length - 1 ? P.paper : P.ink}">${mono(t, String(i + 1).padStart(2, "0"), i === rows.length - 1 ? `color:${P.mineral}` : "")}<p style="font-family:${F.d}; font-size:28px; font-weight:500; line-height:1.2">${name}</p>${detail ? `<p style="font-size:24px; color:${P.inkSoft}">${detail}</p>` : ""}<div style="flex:1"></div>${mono(t, layer, i === rows.length - 1 ? `color:${P.mineral}` : "")}</div>`;
      const link = i < rows.length - 1 ? `<div style="width:2px; height:16px; background:${P.ink}; align-self:center"></div>` : "";
      return box + link;
    })
    .join("");
  const layers = [
    ["Foundation", "Le message, la page et les preuves sur lesquels tout repose."],
    ["Flow", "Le chemin du premier contact à la demande."],
    ["Conversion", "Le moment où l'intérêt devient une conversation."],
    ["Data", "Ce qui est mesuré, et donc pilotable."],
    ["Growth", "Ce qu'on amplifie une fois que le reste tient."],
  ]
    .map(([name, text]) => `<div style="display:flex; flex-direction:column; gap:8px">${label(t, name)}<p style="font-size:26px; line-height:1.35; color:${P.inkSoft}">${text}</p></div>`)
    .join("");
  return section(
    "architecture",
    "paper",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "03 — Architecture du système")}${h2("Un système se dessine avant de se construire.")}</div>
<div style="display:flex; flex-direction:row; gap:96px; align-items:flex-start">
<div style="display:flex; flex-direction:column">${tree}</div>
<div style="flex:1; display:flex; flex-direction:column; gap:28px">${layers}</div>
</div>`,
    "justify-content:flex-start; gap:48px",
  );
}

/* ------------------------------------------------------------------------ */
/* 02 — PREUVES                                                             */
/* ------------------------------------------------------------------------ */

function statuts(cfg, ctx) {
  const t = T.paper;
  const cols = [
    ["Réalisation", `background:${P.ink}; color:${P.paper}; border:2px solid ${P.ink}`, "Un travail livré pour une entreprise cliente, présenté avec son accord.", "Captures, périmètre, chiffres mesurés et fournis par le client."],
    ["Étude de cas interne", `color:${P.ink}; border:2px solid ${P.ink}`, "Un projet GC analysé de l'intérieur : contexte, décisions, limites.", "La méthode et les choix. Les résultats, une fois mesurés."],
    ["Démonstration GC", `color:${P.ink}; border:2px dashed ${P.ink}`, "Un système complet conçu pour une entreprise fictive d'un secteur.", "La qualité du travail. Jamais de client, de chiffre ou d'avis."],
  ]
    .map(
      ([name, style, def, admitted], i) =>
        `<div style="flex:1; display:flex; flex-direction:column; gap:24px; padding:0px 40px 0px ${i === 0 ? 0 : 40}px; ${i > 0 ? `border-left:1px solid ${P.lineLight}` : ""}"><p style="font-family:${F.m}; font-size:24px; font-weight:500; letter-spacing:3px; text-transform:uppercase; padding:10px 18px; ${style}">${name}</p><p style="font-family:${F.d}; font-size:32px; font-weight:500; line-height:1.25">${def}</p>${label(t, "Preuve admise", P.inkSoft)}<p style="font-size:26px; line-height:1.4; color:${P.inkSoft}">${admitted}</p></div>`,
    )
    .join("");
  return section(
    "statuts",
    "paper",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "04 — Transparence")}${h2("Trois statuts. Jamais confondus.")}</div>
<div style="display:flex; flex-direction:row">${cols}</div>
<p style="font-family:${F.d}; font-size:32px; font-weight:500; line-height:1.3; width:1300px; padding:24px 0px 0px 0px; border-top:2px solid ${P.ink}">Aucun chiffre d'affaires, ROI, trafic, avis ou témoignage n'apparaît ici sans avoir été mesuré ou recueilli.</p>`,
  );
}

function kerne(cfg, ctx) {
  const t = T.stone;
  const status = { realisation: "Réalisation", etude: "Étude de cas interne", demonstration: "Démonstration GC" }[cfg.kerneStatus];
  const frame = (tag, src, alt, empty) =>
    `<div style="flex:1; display:flex; flex-direction:column; gap:16px">${label(t, tag, P.ink)}<div style="position:relative; width:800px; height:460px; background:${P.paper}; border:1px ${src ? "solid" : "dashed"} ${P.lineStone}">${
      src ? `<img src="${src}" alt="${alt}" style="width:800px; height:460px; object-fit:cover">` : `<img alt="${alt}" style="width:800px; height:460px; object-fit:cover"><p style="position:absolute; left:0px; top:205px; width:800px; text-align:center; font-family:${F.m}; font-size:24px; letter-spacing:2px; color:${P.inkSoft}">${empty}</p>`
    }</div></div>`;
  const notes = [
    ["01", "Hiérarchie"],
    ["02", "Promesse"],
    ["03", "Mobile"],
    ["04", "Qualification"],
    ["05", "CTA"],
  ]
    .map(([n, name]) => `<div style="flex:1; display:flex; flex-direction:row; gap:14px; padding:14px 0px 0px 0px; border-top:1px solid ${P.ink}">${label(t, n)}<p style="font-family:${F.d}; font-size:28px; font-weight:500">${name}</p></div>`)
    .join("");
  return section(
    "kerne",
    "stone",
    ctx,
    `<div style="display:flex; flex-direction:row; justify-content:space-between; align-items:flex-end">
<div style="display:flex; flex-direction:column; gap:24px">${label(t, "05 — Avant / après")}${h2("Kerné Couverture")}</div>
<p style="font-family:${F.m}; font-size:24px; font-weight:500; letter-spacing:3px; text-transform:uppercase; padding:10px 18px; border:2px ${status === "Réalisation" ? "solid" : "dashed"} ${P.ink}">${status ?? "Statut à confirmer"}</p>
</div>
<div style="display:flex; flex-direction:row; gap:64px">${frame("Avant", cfg.assets.kerneBefore, "Kerné Couverture — site avant intervention", "CAPTURE « AVANT » À DÉPOSER")}${frame("Après GC", cfg.assets.kerneAfter, "Kerné Couverture — version GC", "CAPTURE « APRÈS GC » À DÉPOSER")}</div>
<div style="display:flex; flex-direction:row; gap:24px">${notes}</div>`,
    "justify-content:space-between; gap:32px",
  );
}

function specRow(t, key, value, dark) {
  return `<div style="display:flex; flex-direction:column; gap:6px; padding:18px 0px 0px 0px; border-top:1px solid ${dark ? P.ruleDark : P.lineLight}">${mono(t, key)}<p style="font-family:${F.d}; font-size:30px; font-weight:500; line-height:1.3">${value}</p></div>`;
}

function ccProjet(cfg, ctx) {
  const t = T.dark;
  return section(
    "cc-projet",
    "dark",
    ctx,
    `<div style="display:flex; flex-direction:row; align-items:center; gap:64px">
<div style="width:560px; display:flex; flex-direction:column; gap:22px">
${label(t, "Projet 01")}
<h2 style="font-family:${F.d}; font-size:96px; font-weight:500; line-height:1; letter-spacing:-2px">Clos &amp; Cadre</h2>
${specRow(t, "Secteur", "Construction et rénovation", true)}
${specRow(t, "Système", "GC Conversion", true)}
${specRow(t, "Intervention", "Architecture du parcours · Portfolio chantier · Qualification · Mobile", true)}
<p style="align-self:flex-start; font-family:${F.m}; font-size:24px; font-weight:500; letter-spacing:3px; padding:10px 18px; border:2px dashed ${P.mineral}; color:${P.mineral}">DÉMONSTRATION GC</p>
</div>
<img src="${cfg.assets.ccDesktopHero}" alt="Accueil de la démonstration Clos &amp; Cadre : qui, quoi, où, et un chantier cliquable" style="width:1040px; height:650px; object-fit:cover; border:1px solid #2F2F2F">
</div>`,
    "justify-content:center",
  );
}

function ccMobile(cfg, ctx) {
  const t = T.paper;
  const phone = (src, alt, cap) =>
    `<div style="display:flex; flex-direction:column; gap:18px"><img src="${src}" alt="${alt}" style="width:280px; height:606px; object-fit:cover; border:6px solid ${P.panel}; border-radius:32px">${mono(t, cap)}</div>`;
  return section(
    "cc-mobile",
    "paper",
    ctx,
    `<div style="display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:80px">
<div style="width:500px; display:flex; flex-direction:column; gap:28px">
${label(t, "Projet 01 — Mobile")}
${h2("Le mobile, dessiné comme un produit à part.")}
<p style="font-size:28px; line-height:1.45; color:${P.inkSoft}">L'appel et la demande de projet restent à portée de pouce. Les chantiers se lisent sans zoomer.</p>
</div>
<div style="display:flex; flex-direction:row; gap:40px">
${phone(cfg.assets.ccMobileHero, "Accueil mobile de Clos &amp; Cadre", "01 · Accueil")}
${phone(cfg.assets.ccMobileRealisations, "Fiche chantier sur mobile", "02 · Preuve")}
${phone(cfg.assets.ccMobileForm, "Demande de projet sur mobile", "03 · Qualification")}
</div>
</div>`,
    "justify-content:center",
  );
}

function ccPortfolio(cfg, ctx) {
  const t = T.stone;
  const notes = [
    ["01", "Bâti, surface, durée, budget"],
    ["02", "Problème, contraintes, solution"],
    ["03", "État initial, intervention, résultat"],
  ]
    .map(([n, text]) => `<div style="flex:1; display:flex; flex-direction:row; gap:16px; padding:14px 0px 0px 0px; border-top:1px solid ${P.ink}">${label(t, n)}<p style="font-size:26px; line-height:1.35">${text}</p></div>`)
    .join("");
  return section(
    "cc-portfolio",
    "stone",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "Projet 01 — Portfolio")}${h2("Un chantier documenté, pas une photo.")}</div>
<div style="display:flex; flex-direction:row; gap:56px; align-items:flex-start">
<img src="${cfg.assets.ccDesktopProject}" alt="Fiche chantier : titre, faits clés et plan de la réalisation" style="width:840px; height:525px; object-fit:cover; border:1px solid ${P.lineStone}">
<div style="flex:1; display:flex; flex-direction:column; gap:24px">
<img src="${cfg.assets.ccSlider}" alt="Comparateur avant / après avec son explication" style="width:768px; height:494px; object-fit:contain; background:${P.paper}">
</div>
</div>
<div style="display:flex; flex-direction:row; gap:32px">${notes}</div>`,
    "justify-content:space-between; gap:32px",
  );
}

function ccQualification(cfg, ctx) {
  const t = T.dark;
  return section(
    "cc-qualification",
    "dark",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "Projet 01 — Qualification")}${h2("Le formulaire remet une fiche, pas un message.")}</div>
<div style="display:flex; flex-direction:row; gap:48px; align-items:flex-start">
<div style="display:flex; flex-direction:column; gap:16px"><img src="${cfg.assets.ccFormStep3}" alt="Étape 3 du pré-diagnostic : travaux, délai, enveloppe, photos" style="width:960px; height:600px; object-fit:cover; border:1px solid #2F2F2F"></div>
<div style="flex:1; display:flex; flex-direction:column; gap:20px">
<img src="${cfg.assets.ccFiche}" alt="Fiche projet reçue par l'entreprise : priorité, zone, enveloppe, urbanisme, points de visite" style="width:500px; height:590px; object-fit:contain; background:${P.black}">
</div>
</div>`,
    "justify-content:flex-start; gap:48px",
  );
}

/* ------------------------------------------------------------------------ */
/* 03 — OFFRES                                                              */
/* ------------------------------------------------------------------------ */

function offres(cfg, ctx) {
  const t = T.paper;
  const o = cfg.offers;
  const col = (offer, dark) =>
    `<div style="flex:1; display:flex; flex-direction:column; gap:24px; padding:40px; ${dark ? `background:${P.black}; color:${P.onDark}` : `border:1px solid ${P.ink}`}">${label(dark ? T.dark : t, offer.code)}<p style="font-family:${F.d}; font-size:48px; font-weight:600; line-height:1.05">${offer.name}</p><p style="font-size:28px; line-height:1.4; color:${dark ? P.onDarkSoft : P.inkSoft}">${offer.forWhom}</p><div style="flex:1"></div>${mono(dark ? T.dark : t, offer.priceNote)}<p style="font-family:${F.d}; font-size:36px; font-weight:500; line-height:1.2">${offer.setup ? `${offer.setup}<br>${offer.monthly}` : offer.price}</p></div>`;
  return section(
    "offres",
    "paper",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "06 — Les systèmes")}${h2("Trois systèmes. Un seul plan.")}</div>
<div style="display:flex; flex-direction:row; gap:32px; flex:1">${col(o.conversion)}${col(o.acquisition)}${col(o.growth, true)}</div>`,
    "justify-content:flex-start; gap:56px",
  );
}

function offerDetail(id, key, theme) {
  return (cfg, ctx) => {
    const t = T[theme];
    const o = cfg.offers[key];
    const rows = o.components
      .map((c, i) => `<div style="display:flex; flex-direction:row; align-items:baseline; gap:28px; padding:16px 0px; border-top:1px solid ${theme === "dark" ? P.ruleDark : P.ink}">${label(t, String(i + 1).padStart(2, "0"))}<p style="font-family:${F.d}; font-size:36px; font-weight:500">${c}</p></div>`)
      .join("");
    return section(
      id,
      theme,
      ctx,
      `<div style="display:flex; flex-direction:row; gap:120px; flex:1">
<div style="width:780px; display:flex; flex-direction:column; gap:32px">
${label(t, `Système ${o.code.slice(2)}`)}
<h1 style="font-family:${F.d}; font-size:112px; font-weight:600; line-height:0.98; letter-spacing:-3px">${o.name}</h1>
<p style="font-size:32px; line-height:1.4; color:${t.soft}">${o.forWhom}</p>
<div style="flex:1"></div>
${label(t, "Résultat recherché")}
<p style="font-family:${F.d}; font-size:40px; font-weight:500; line-height:1.2">${o.result}</p>
</div>
<div style="flex:1; display:flex; flex-direction:column">
${rows}
<div style="flex:1"></div>
<div style="display:flex; flex-direction:column; gap:10px; padding:24px 0px 0px 0px; border-top:2px solid ${theme === "dark" ? P.onDark : P.ink}">${label(t, o.priceNote)}<p style="font-family:${F.d}; font-size:56px; font-weight:500; line-height:1.1">${o.price}</p></div>
</div>
</div>`,
      "justify-content:flex-start",
    );
  };
}

function growth(cfg, ctx) {
  const t = T.dark;
  const o = cfg.offers.growth;
  const room = (code, name, text) =>
    `<div style="display:flex; flex-direction:column; gap:10px; padding:26px 28px; background:${P.black}">${mono(t, code)}<p style="font-family:${F.d}; font-size:34px; font-weight:500">${name}</p><p style="font-size:24px; line-height:1.35; color:${P.onDarkSoft}">${text}</p></div>`;
  return section(
    "growth",
    "dark",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:20px">${label(t, "Système 03")}<h1 style="font-family:${F.d}; font-size:96px; font-weight:600; line-height:1; letter-spacing:-2px">${o.name}</h1><p style="font-size:30px; line-height:1.4; color:${P.onDarkSoft}">L'infrastructure complète, de la première impression au client suivi.</p></div>
<div style="display:flex; flex-direction:row; gap:72px; align-items:stretch">
<div style="width:1100px; display:flex; flex-direction:column; gap:1px; background:${P.ruleDark}; border:1px solid ${P.ruleDark}">
<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1px">
${room("R-01", "Acquisition", "Ads, SEO local, landing pages")}
${room("R-02", "Conversion", "Site, message, preuves, CTA")}
${room("R-03", "Qualification", "Pré-diagnostic, priorisation")}
${room("R-04", "CRM", "Chaque demande, un dossier")}
${room("R-05", "Suivi", "Relances, rendez-vous, devis")}
${room("R-06", "Automatisation", "Ce qui se répète, sans oubli")}
</div>
<div style="display:flex; flex-direction:row; align-items:center; gap:24px; padding:22px 28px; background:${P.mineral}; color:${P.ink}"><p style="font-family:${F.m}; font-size:24px; letter-spacing:2px; color:${P.sand}">FONDATION</p><p style="font-family:${F.d}; font-size:34px; font-weight:600">Data</p><p style="font-size:24px; color:${P.inkSoft}">chaque étape mesurée, chaque décision pilotée</p></div>
</div>
<div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; gap:12px">
${label(t, "Setup")}<p style="font-family:${F.d}; font-size:40px; font-weight:500; line-height:1.1">${o.setup}</p>
<div style="height:24px"></div>
${label(t, "Puis")}<p style="font-family:${F.d}; font-size:40px; font-weight:500; line-height:1.1">${o.monthly}</p>
</div>
</div>`,
    "justify-content:space-between; gap:40px",
  );
}

/* ------------------------------------------------------------------------ */
/* 04 — MÉTHODE                                                             */
/* ------------------------------------------------------------------------ */

function methode(cfg, ctx) {
  const t = T.paper;
  const items = [
    ["Diagnostic avant solution", "Marché, offre, parcours : analysés avant toute recommandation."],
    ["Périmètre clair", "Inclus, exclus, prix : écrits avant de commencer."],
    ["Production structurée", "Architecture, contenu, design, code : dans cet ordre."],
    ["Versions testées", "Vérifiées sur desktop, tablette et mobile avant livraison."],
    ["Tracking", "Chaque étape du parcours mesurée dès la mise en ligne."],
    ["Mise en production contrôlée", "Recette, sauvegarde, bascule : rien à l'aveugle."],
    ["Optimisation", "Les décisions suivantes se prennent sur les données."],
  ]
    .map(
      ([title, text], i) =>
        `<div style="display:flex; flex-direction:row; gap:32px; padding:12px 0px; border-top:1px solid ${P.ink}">${label(t, `M-${String(i + 1).padStart(2, "0")}`)}<div style="display:flex; flex-direction:column; gap:4px"><p style="font-family:${F.d}; font-size:30px; font-weight:600; line-height:1.2">${title}</p><p style="font-size:24px; line-height:1.4; color:${P.inkSoft}">${text}</p></div></div>`,
    )
    .join("");
  return section(
    "methode",
    "paper",
    ctx,
    `<div style="display:flex; flex-direction:row; gap:96px; flex:1">
<div style="width:700px; display:flex; flex-direction:column; gap:32px">
${label(t, "07 — Méthode")}
<h1 style="font-family:${F.d}; font-size:92px; font-weight:600; line-height:0.98; letter-spacing:-2px; text-transform:uppercase">Une méthode.<br><span style="color:${P.inkSoft}">Pas une promesse floue.</span></h1>
</div>
<div style="flex:1; display:flex; flex-direction:column">${items}</div>
</div>`,
    "justify-content:flex-start",
  );
}

function production(cfg, ctx) {
  const t = T.dark;
  const stages = [
    ["Analyser", ["Marché", "Entreprise", "Offre", "Prospect", "Parcours"]],
    ["Concevoir", ["Message", "Architecture", "UX", "Design"]],
    ["Construire", ["Site", "Landing", "Formulaire", "Tracking"]],
    ["Connecter", ["Ads", "CRM", "RDV", "Suivi"]],
    ["Optimiser", ["Data", "Conversion", "Acquisition"]],
  ];
  const phases = [
    ["Architecture", 2],
    ["Production", 2],
    ["Pilotage", 1],
  ]
    .map(([name, span]) => `<div style="flex:${span}; padding:0px 0px 14px 0px; border-bottom:1px solid ${P.onDarkSoft}">${mono(t, name)}</div>`)
    .join("");
  const cols = stages
    .map(
      ([name, items], i) =>
        `<div style="flex:1; display:flex; flex-direction:column; gap:22px; padding:28px 24px 0px ${i === 0 ? 0 : 24}px; ${i > 0 ? `border-left:1px solid ${P.ruleDark}` : ""}">${label(t, `${String(i + 1).padStart(2, "0")} /`)}<p style="font-family:${F.d}; font-size:40px; font-weight:600; letter-spacing:1px; text-transform:uppercase">${name}</p><ul style="font-size:28px; line-height:1.6; color:${P.onDarkSoft}">${items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`,
    )
    .join("");
  return section(
    "production",
    "dark",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "08 — Ligne de production")}${h2("L'architecture précède la production.")}</div>
<div style="flex:1; display:flex; flex-direction:column; gap:0px">
<div style="display:flex; flex-direction:row; gap:24px">${phases}</div>
<div style="flex:1; display:flex; flex-direction:row">${cols}</div>
</div>`,
    "justify-content:flex-start; gap:64px",
  );
}

function risque(cfg, ctx) {
  const t = T.paper;
  const cells = [
    ["Scope", "défini"],
    ["Architecture", "validée"],
    ["Production", "visible"],
    ["Déploiement", "contrôlé"],
    ["Mesure", "connectée"],
    ["Prochaine étape", "claire"],
  ]
    .map(([name, state]) => `<div style="display:flex; flex-direction:column; justify-content:flex-end; gap:10px; padding:40px; background:${P.paper}"><p style="font-family:${F.d}; font-size:52px; font-weight:600; line-height:1.05; text-transform:uppercase">${name}</p><p style="font-family:${F.d}; font-size:32px; color:${P.inkSoft}">${state}</p></div>`)
    .join("");
  return section(
    "risque",
    "paper",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, "09 — Maîtrise du risque")}${h2("Vous savez où va chaque euro.")}</div>
<div style="flex:1; display:grid; grid-template-columns:repeat(3, 1fr); grid-template-rows:repeat(2, 1fr); gap:1px; background:${P.ink}; border:1px solid ${P.ink}">${cells}</div>`,
    "justify-content:flex-start; gap:64px",
  );
}

/* ------------------------------------------------------------------------ */
/* 05 — POUR VOUS (shown only when a prospect is configured)                 */
/* ------------------------------------------------------------------------ */

function pour(cfg, ctx) {
  const t = T.stone;
  const d = cfg.diagnosis;
  const company = esc(cfg.prospectCompany ?? "[Entreprise]");
  const block = (n, title, items) =>
    `<div style="display:flex; flex-direction:column; gap:18px; padding:32px 36px; background:${P.stone}">${label(t, `${n} / ${title}`)}<ul style="font-size:28px; line-height:1.5">${(items.length ? items : ["[À compléter après le diagnostic]"]).slice(0, 3).map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`;
  return section(
    "pour",
    "stone",
    ctx,
    `<div style="display:flex; flex-direction:column; gap:24px">${label(t, `Pour ${company}${cfg.prospectSector ? ` — ${esc(cfg.prospectSector)}` : ""}`)}${h2("Ce que nous avons observé.")}</div>
<div style="flex:1; display:grid; grid-template-columns:repeat(2, 1fr); grid-template-rows:repeat(2, 1fr); gap:1px; background:${P.ink}; border:1px solid ${P.ink}">
${block("01", "Ce qui fonctionne", d.works)}${block("02", "Ce qui freine", d.slows)}${block("03", "Ce qui manque", d.missing)}${block("04", "Ce que nous construirions", d.build)}
</div>`,
    "justify-content:flex-start; gap:48px",
  );
}

function recommandation(cfg, ctx) {
  const t = T.dark;
  const key = cfg.selectedOffer ?? (cfg.offer !== "full" ? cfg.offer : "conversion");
  const o = cfg.offers[key];
  const priceHtml = cfg.price ? esc(cfg.price) : o.setup ? `${o.setup}<br>${o.monthly}` : o.price;
  return section(
    "recommandation",
    "dark",
    ctx,
    `${label(t, "Système recommandé")}
<h1 style="font-family:${F.d}; font-size:140px; font-weight:600; line-height:0.95; letter-spacing:-4px">${o.name}</h1>
<p style="font-size:34px; line-height:1.4; width:1200px; color:${P.onDarkSoft}">${esc(cfg.prospectProblem ?? o.forWhom)}</p>
<div style="display:flex; flex-direction:row; gap:96px; padding:28px 0px 0px 0px; border-top:1px solid ${P.ruleDark}">
<div style="display:flex; flex-direction:column; gap:10px">${label(t, "Résultat recherché")}<p style="font-family:${F.d}; font-size:36px; font-weight:500; width:760px; line-height:1.25">${o.result}</p></div>
<div style="display:flex; flex-direction:column; gap:10px">${label(t, o.priceNote)}<p style="font-family:${F.d}; font-size:44px; font-weight:500; line-height:1.15">${priceHtml}</p></div>
</div>`,
  );
}

/* ------------------------------------------------------------------------ */
/* 06 — ACTION                                                              */
/* ------------------------------------------------------------------------ */

function action(cfg, ctx) {
  const t = T.dark;
  const cta = cfg.cta[cfg.ctaMode] ?? cfg.cta.diagnostic;
  return section(
    "action",
    "dark",
    ctx,
    `<h1 style="font-family:${F.d}; font-size:132px; font-weight:600; line-height:0.95; letter-spacing:-4px; text-transform:uppercase">Identifions<br>le maillon<br>qui bloque.</h1>
<div style="display:flex; flex-direction:row; justify-content:space-between; align-items:flex-end; gap:80px">
<p style="font-size:32px; line-height:1.45; width:900px; color:${P.onDarkSoft}">Nous analysons votre visibilité, votre parcours, votre conversion et votre acquisition avant de recommander une intervention.</p>
<div style="display:flex; flex-direction:column; gap:16px; align-items:flex-end">
<p style="font-family:${F.d}; font-size:32px; font-weight:600; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; padding:28px 44px; background:${P.onDark}; color:${P.black}"><a href="${cta.url}">${cta.label} →</a></p>
${mono(t, cta.url.replace(/^https:\/\//, ""))}
</div>
</div>`,
  );
}

/**
 * The deck, in order. `group` decides visibility per mode (see build.mjs):
 * core, proof, offer:<key>, overview, method, perso, cta.
 */
export const SLIDES = [
  { id: "cover", group: "core", chapter: "Ouverture", render: cover },
  { id: "manifeste", group: "core", chapter: "Positionnement", render: manifeste },
  { id: "parcours", group: "core", chapter: "Problème", render: parcours },
  { id: "ruptures", group: "core", chapter: "Problème", render: ruptures },
  { id: "architecture", group: "core", chapter: "Système", render: architecture },
  { id: "statuts", group: "proof", chapter: "Preuves", render: statuts },
  { id: "kerne", group: "proof", chapter: "Preuves", render: kerne },
  { id: "cc-projet", group: "proof", chapter: "Showroom", render: ccProjet },
  { id: "cc-mobile", group: "proof", chapter: "Showroom", render: ccMobile },
  { id: "cc-portfolio", group: "proof", chapter: "Showroom", render: ccPortfolio },
  { id: "cc-qualification", group: "proof", chapter: "Showroom", render: ccQualification },
  { id: "offres", group: "overview", chapter: "Offres", render: offres },
  { id: "conversion", group: "offer:conversion", chapter: "Offres", render: offerDetail("conversion", "conversion", "paper") },
  { id: "acquisition", group: "offer:acquisition", chapter: "Offres", render: offerDetail("acquisition", "acquisition", "stone") },
  { id: "growth", group: "offer:growth", chapter: "Offres", render: growth },
  { id: "methode", group: "method", chapter: "Méthode", render: methode },
  { id: "production", group: "method", chapter: "Méthode", render: production },
  { id: "risque", group: "method", chapter: "Méthode", render: risque },
  { id: "pour", group: "perso", chapter: "Pour vous", render: pour },
  { id: "recommandation", group: "perso", chapter: "Pour vous", render: recommandation },
  { id: "action", group: "cta", chapter: "Action", render: action },
];

export const SECTIONS = {
  "s-core": { description: "Pourquoi un système : le parcours, ses ruptures et l'architecture qui les ferme.", start: "cover" },
  "s-proof": { description: "Preuves transparentes : statuts, avant/après et showroom de la démonstration Clos & Cadre.", start: "statuts" },
  "s-offers": { description: "Les trois systèmes GC, leur périmètre et leur ordre de prix.", start: "offres" },
  "s-method": { description: "Méthode, ligne de production et maîtrise du risque.", start: "methode" },
  "s-perso": { description: "Diagnostic et système recommandé pour le prospect.", start: "pour" },
  "s-cta": { description: "Appel à l'action.", start: "action" },
};

export const FACES = {
  "inter-tight": { family: "Inter Tight", href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&display=swap" },
  manrope: { family: "Manrope", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400..700&display=swap" },
  "ibm-plex-mono": { family: "IBM Plex Mono", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" },
};
