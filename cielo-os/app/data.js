/* ==========================================================================
   CIELO OS — Données de démonstration
   --------------------------------------------------------------------------
   ⚠️ TOUTES LES DONNÉES DE CE FICHIER SONT FICTIVES.
   Elles servent uniquement à faire fonctionner le prototype. Aucune n'est
   issue de l'activité réelle de Cielo. Les noms de clients sont inventés.

   Les chiffres sont volontairement cohérents entre eux : la billetterie
   s'additionne au revenu affiché, les segments d'audience totalisent le
   nombre de membres, les conversions de parrainage produisent le revenu de
   parrainage. Un dirigeant qui vérifie doit tomber juste.
   ========================================================================== */

window.CIELO = window.CIELO || {};

(function (NS) {
  "use strict";

  /* --- Contexte --------------------------------------------------------- */

  var brand = {
    name: "CIELO",
    product: "CIELO OS",
    subtitle: "CONTROL CENTER",
    signature: ["THE OPERATING SYSTEM", "BEHIND EVERY CIELO EXPERIENCE."],
    promise:
      "CIELO OS helps Cielo own the relationship with its audience and build a repeatable growth system around every event.",
    disclaimer:
      "Prototype — all figures shown are demonstration data, not Cielo's real performance.",
  };

  var current = {
    code: "CIELO 001",
    city: "FRÉJUS",
    dateShort: "18.09.2026",
    dateLong: "18 SEPTEMBER 2026",
    status: "LIVE",
  };

  /* --- Billetterie ------------------------------------------------------
     3 612 billets + 46 tables. Le détail ci-dessous totalise exactement
     184 250 € (voir ticketing.total).
     ---------------------------------------------------------------------- */

  var ticketing = {
    capacity: 6000,
    attendance: 3888, // 3 612 billets + 276 invités en table (46 × 6)
    sellThrough: 64.8,
    tiers: [
      { label: "EARLY BIRD", qty: 900, price: 29, revenue: 26100 },
      { label: "STANDARD", qty: 2200, price: 38, revenue: 83600 },
      { label: "LAST RELEASE", qty: 200, price: 44, revenue: 8800 },
      { label: "VIP PASS", qty: 312, price: 95, revenue: 29640 },
      { label: "TABLES", qty: 46, price: 785, revenue: 36110 },
    ],
    total: 184250,
    buyers: 3612,
    averageBasket: 51,
    tablesAvailable: 60,
  };

  /* --- KPI de tête ------------------------------------------------------ */

  var kpis = [
    {
      label: "EVENT CAPACITY",
      value: 6000,
      format: "int",
      foot: "3,888 attending · 64.8% sell-through",
      delta: null,
    },
    {
      label: "WAITLIST",
      value: 2847,
      format: "int",
      foot: "Ready for CIELO 002",
      delta: { dir: "up", text: "+41% since CIELO 001" },
    },
    {
      label: "TICKET REVENUE",
      value: 184250,
      format: "eur",
      accent: true,
      foot: "Average basket €51",
      delta: { dir: "up", text: "+28% vs. previous" },
    },
    {
      label: "CIELO MEMBERS",
      value: 1284,
      format: "int",
      foot: "33% of attendees became members",
      delta: { dir: "up", text: "+312 this event" },
    },
    {
      label: "NEW AUDIENCE",
      value: 68,
      format: "pct",
      foot: "873 first-time attendees",
      delta: { dir: "flat", text: "Stable" },
    },
  ];

  /* --- Revenu par événement --------------------------------------------
     CIELO 001 est réalisé. 002 → 004 sont une projection issue du modèle
     de rétention du prototype. Clairement identifiés comme tels.
     ---------------------------------------------------------------------- */

  var revenueSeries = [
    {
      label: "CIELO 001",
      value: 184250,
      projected: false,
      note: "Fréjus · 18.09.2026",
    },
    { label: "CIELO 002", value: 268400, projected: true, note: "Projection" },
    { label: "CIELO 003", value: 352900, projected: true, note: "Projection" },
    { label: "CIELO 004", value: 470000, projected: true, note: "Projection" },
  ];

  /* --- Événements -------------------------------------------------------- */

  var events = [
    {
      code: "CIELO 001",
      city: "FRÉJUS",
      date: "18 SEPTEMBER 2026",
      status: "LIVE",
      tickets: 3612,
      vip: 312,
      tables: 46,
      revenue: 184250,
      attendance: 3888,
      capacity: 6000,
      newAudience: 68,
    },
    {
      code: "CIELO 002",
      city: "TO BE ANNOUNCED",
      date: "SPRING 2027",
      status: "COMING SOON",
      tickets: 0,
      vip: 0,
      tables: 0,
      revenue: 0,
      attendance: 0,
      capacity: 6000,
      newAudience: 0,
    },
    {
      code: "CIELO 003",
      city: "TO BE ANNOUNCED",
      date: "SUMMER 2027",
      status: "DRAFT",
      tickets: 0,
      vip: 0,
      tables: 0,
      revenue: 0,
      attendance: 0,
      capacity: 8000,
      newAudience: 0,
    },
  ];

  var performance = [
    {
      k: "Ticket conversion",
      v: "42.8%",
      d: "Checkout completion, all channels",
    },
    { k: "Average basket", v: "€51", d: "Across 3,612 buyers", accent: true },
    { k: "VIP conversion", v: "8.6%", d: "312 VIP passes sold" },
    { k: "Table conversion", v: "76.7%", d: "46 of 60 tables booked" },
    { k: "Referral rate", v: "17.3%", d: "624 tickets from member invites" },
    { k: "Returning customers", v: "11.4%", d: "411 members came back" },
  ];

  var acquisition = [
    { k: "ORGANIC", v: 38 },
    { k: "REFERRAL", v: 23, accent: true },
    { k: "PAID", v: 17 },
    { k: "PARTNER", v: 14 },
    { k: "DIRECT", v: 8 },
  ];

  /* --- Audience ---------------------------------------------------------
     Les trois axes de segmentation totalisent chacun 1 284 membres.
     ---------------------------------------------------------------------- */

  var audience = {
    total: 1284,
    lifecycle: [
      { k: "NEW", v: 873, color: "rgba(255,255,255,0.9)" },
      { k: "RETURNING", v: 411, color: "#d6a85f" },
    ],
    value: [
      { k: "REGULAR", v: 786 },
      { k: "VIP", v: 312, accent: true },
      { k: "HIGH VALUE", v: 186, accent: true },
    ],
    geography: [
      { k: "LOCAL", v: 941, d: "Var · Alpes-Maritimes · Bouches-du-Rhône" },
      { k: "INTERNATIONAL", v: 343, d: "IT · CH · UK · BE · ES" },
    ],
    lifetimeValue: 143,
    repeatRate: 32,
  };

  // Noms entièrement inventés — aucune personne réelle.
  var customers = [
    {
      name: "Alex Martin",
      type: "VIP",
      events: 3,
      value: 1240,
      status: "HIGH VALUE",
      since: "MAR 2025",
      invited: 7,
    },
    {
      name: "Lucas Morel",
      type: "REGULAR",
      events: 2,
      value: 180,
      status: "RETURNING",
      since: "SEP 2025",
      invited: 2,
    },
    {
      name: "Inès Fabre",
      type: "VIP",
      events: 3,
      value: 980,
      status: "HIGH VALUE",
      since: "MAR 2025",
      invited: 5,
    },
    {
      name: "Noah Duval",
      type: "REGULAR",
      events: 1,
      value: 38,
      status: "NEW",
      since: "SEP 2026",
      invited: 0,
    },
    {
      name: "Camille Roy",
      type: "VIP",
      events: 2,
      value: 615,
      status: "RETURNING",
      since: "JUN 2025",
      invited: 4,
    },
    {
      name: "Théo Bonnet",
      type: "REGULAR",
      events: 1,
      value: 29,
      status: "NEW",
      since: "SEP 2026",
      invited: 1,
    },
    {
      name: "Sofia Lenoir",
      type: "VIP",
      events: 4,
      value: 1685,
      status: "HIGH VALUE",
      since: "NOV 2024",
      invited: 11,
    },
    {
      name: "Marius Clerc",
      type: "REGULAR",
      events: 2,
      value: 144,
      status: "RETURNING",
      since: "JUN 2025",
      invited: 3,
    },
    {
      name: "Jade Ferrari",
      type: "REGULAR",
      events: 1,
      value: 44,
      status: "NEW",
      since: "SEP 2026",
      invited: 0,
    },
    {
      name: "Elias Nardi",
      type: "VIP",
      events: 3,
      value: 1120,
      status: "HIGH VALUE",
      since: "MAR 2025",
      invited: 6,
    },
    {
      name: "Léna Sauvage",
      type: "REGULAR",
      events: 2,
      value: 167,
      status: "RETURNING",
      since: "SEP 2025",
      invited: 2,
    },
    {
      name: "Hugo Valenti",
      type: "REGULAR",
      events: 1,
      value: 38,
      status: "NEW",
      since: "SEP 2026",
      invited: 1,
    },
  ];

  /* --- Cielo Access ------------------------------------------------------ */

  var access = {
    tagline: "Your passport to the Cielo universe.",
    member: {
      id: "#001284",
      name: "Alex Martin",
      initials: "AM",
      tier: "CIELO MEMBER",
      since: "MARCH 2025",
      eventsAttended: 3,
      friendsInvited: 7,
      totalSpent: 1240,
      nextTierProgress: 62,
    },
    stamps: [
      { e: "CIELO 001", done: true },
      { e: "CIELO 002", done: false },
      { e: "CIELO 003", done: false },
    ],
    tiers: [
      {
        t: "MEMBER",
        d: "One event attended. The relationship starts here.",
        threshold: "1 event",
      },
      {
        t: "INSIDER",
        d: "Three events or two friends converted.",
        threshold: "3 events",
      },
      {
        t: "INNER CIRCLE",
        d: "Five events. Invited by Cielo, not by algorithm.",
        threshold: "5 events",
      },
    ],
    currentTierIndex: 1,
    perks: [
      { t: "Early access", lvl: "MEMBER", on: true },
      { t: "Priority tickets", lvl: "MEMBER", on: true },
      { t: "VIP upgrades", lvl: "INSIDER", on: true },
      { t: "Exclusive drops", lvl: "INSIDER", on: true },
      { t: "Private experiences", lvl: "INNER CIRCLE", on: false },
    ],
    distribution: [
      { k: "MEMBER", v: 786 },
      { k: "INSIDER", v: 372 },
      { k: "INNER CIRCLE", v: 126 },
    ],
  };

  /* --- Referrals --------------------------------------------------------
     624 conversions × 50 € de panier moyen sur billet parrainé = 31 200 €.
     ---------------------------------------------------------------------- */

  var referrals = {
    invitations: 2481,
    conversions: 624,
    revenue: 31200,
    conversionRate: 25.2,
    link: "cielo.example/invite/ENZO123",
    flow: [
      { t: "MEMBER", d: "A member gets a personal Cielo link." },
      { t: "INVITE FRIEND", d: "They share it with people who look like them." },
      { t: "FRIEND BUYS TICKET", d: "The purchase is attributed automatically." },
      { t: "REWARD", d: "The member unlocks status, not a discount." },
      { t: "NEW CIELO MEMBER", d: "The friend enters the loop. It starts again." },
    ],
    top: [
      { name: "Sofia Lenoir", invites: 41, conversions: 18, revenue: 900 },
      { name: "Elias Nardi", invites: 34, conversions: 14, revenue: 700 },
      { name: "Alex Martin", invites: 29, conversions: 12, revenue: 600 },
      { name: "Inès Fabre", invites: 26, conversions: 9, revenue: 450 },
      { name: "Camille Roy", invites: 22, conversions: 8, revenue: 400 },
    ],
  };

  /* --- Next event -------------------------------------------------------
     312 + 684 + 1 851 = 2 847.
     ---------------------------------------------------------------------- */

  var nextEvent = {
    code: "CIELO 002",
    status: "COMING SOON",
    ready: 2847,
    segments: [
      { k: "VIP", v: 312, d: "Notified first. 48h head start." },
      { k: "RETURNING", v: 684, d: "Already bought once." },
      { k: "NEW", v: 1851, d: "Joined the waitlist after CIELO 001." },
    ],
    channels: [
      { k: "Email", reach: 2847, on: true },
      { k: "SMS", reach: 1962, on: true },
      { k: "WhatsApp", reach: 1104, on: false },
    ],
    message: "CIELO 002 IS COMING.",
    messageBody:
      "You were there for 001. Your access opens 48 hours before everyone else.",
  };

  /* --- Partenaires ------------------------------------------------------- */

  var partners = {
    primary: {
      name: "PARTNER DEMO",
      category: "FICTIONAL BRAND · PROTOTYPE",
      since: "CIELO 001",
      investment: 18000,
      metrics: [
        { k: "Reach", v: "412,800" },
        { k: "Impressions", v: "1,284,000" },
        { k: "Engagement", v: "6.8%" },
        { k: "Clicks", v: "34,200" },
        { k: "Ticket conversions", v: "486", accent: true },
        { k: "Content generated", v: "284 assets" },
      ],
      attributedRevenue: 24786,
      mediaValue: 61400,
      roi: 4.8,
      series: [
        { label: "PRE-EVENT", reach: 96000, clicks: 7400 },
        { label: "LAUNCH WEEK", reach: 142000, clicks: 12800 },
        { label: "EVENT NIGHT", reach: 118800, clicks: 9600 },
        { label: "POST-EVENT", reach: 56000, clicks: 4400 },
      ],
    },
    others: [
      { name: "PARTNER DEMO B", status: "ACTIVE", value: 12000, roi: 3.1 },
      { name: "PARTNER DEMO C", status: "IN TALKS", value: 8000, roi: null },
    ],
  };

  /* --- Analytics --------------------------------------------------------- */

  var analytics = {
    loopCoefficient: 0.49,
    costPerMember: 11.4,
    memberValue: 143,
    payback: "1.2 events",
    retention: [
      { cohort: "CIELO 001", cells: [100, 41, 28, 22] },
      { cohort: "CIELO 002", cells: [100, 46, 33, null] },
      { cohort: "CIELO 003", cells: [100, 52, null, null] },
      { cohort: "CIELO 004", cells: [100, null, null, null] },
    ],
    retentionHead: ["EVENT 0", "+1", "+2", "+3"],
    channels: [
      { k: "Member referral", v: 23, cost: 4.2 },
      { k: "Organic social", v: 38, cost: 6.8 },
      { k: "Paid social", v: 17, cost: 28.4 },
      { k: "Partner audiences", v: 14, cost: 9.1 },
      { k: "Direct", v: 8, cost: 0 },
    ],
    audienceGrowth: [
      { label: "MAR 25", value: 180 },
      { label: "JUN 25", value: 342 },
      { label: "SEP 25", value: 561 },
      { label: "JAN 26", value: 794 },
      { label: "MAY 26", value: 972 },
      { label: "SEP 26", value: 1284 },
    ],
  };

  /* --- La boucle --------------------------------------------------------- */

  var loop = {
    nodes: [
      { t: "DISCOVER", d: "Someone hears about Cielo." },
      { t: "JOIN", d: "They join the waitlist. You own the contact." },
      { t: "EXPERIENCE", d: "They attend. The night does the work." },
      { t: "SHARE", d: "They post. The content belongs to the brand." },
      { t: "INVITE", d: "They bring people who look like them." },
      { t: "RETURN", d: "They come back — and the next event starts full." },
    ],
    lines: [
      "Every attendee becomes a member.",
      "Every member becomes an audience.",
      "Every audience becomes a future sale.",
    ],
  };

  /* --- Simulation « NEXT EVENT » ---------------------------------------- */

  var simulation = [
    {
      caption: "STEP 01 — ANNOUNCEMENT",
      title: "CIELO 002",
      big: "ANNOUNCED",
      sub: "The next event does not start from zero. It starts from everything CIELO 001 produced.",
      duration: 2600,
    },
    {
      caption: "CIELO MEMBERS NOTIFIED",
      number: 2847,
      sub: "Owned audience. No platform in between, no ad spend required.",
      duration: 2800,
      accent: true,
    },
    {
      caption: "RETURNING MEMBERS",
      number: 1284,
      sub: "People who already know what a Cielo night feels like.",
      duration: 2800,
    },
    {
      caption: "REFERRAL INVITES SENT",
      number: 624,
      sub: "Each member invites the audience you would otherwise have to buy.",
      duration: 2800,
      accent: true,
    },
    {
      caption: "TICKETS CONVERTING",
      number: 1962,
      prefix: "",
      sub: "Early access converts before the event is public.",
      duration: 3000,
      chips: ["VIP 312", "RETURNING 684", "NEW 966"],
    },
    {
      caption: "STEP 06 — RESULT",
      title: "CIELO 002",
      big: "AUDIENCE READY",
      sub: "Your event ends. Your ecosystem doesn't.",
      duration: 0,
      final: true,
    },
  ];

  /* --- Copy -------------------------------------------------------------- */

  var copy = {
    hero: "Don't start from zero.",
    closing: ["Your event ends.", "Your ecosystem doesn't."],
    lines: [
      "Turn attendance into membership.",
      "Turn membership into loyalty.",
      "Turn loyalty into the next ticket.",
    ],
  };

  NS.data = {
    brand: brand,
    current: current,
    ticketing: ticketing,
    kpis: kpis,
    revenueSeries: revenueSeries,
    events: events,
    performance: performance,
    acquisition: acquisition,
    audience: audience,
    customers: customers,
    access: access,
    referrals: referrals,
    nextEvent: nextEvent,
    partners: partners,
    analytics: analytics,
    loop: loop,
    simulation: simulation,
    copy: copy,
  };
})(window.CIELO);
