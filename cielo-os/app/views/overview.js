/* ==========================================================================
   Vue — OVERVIEW / Executive dashboard
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  NS.views.overview = {
    label: "Overview",
    crumbs: ["OVERVIEW"],

    render: function () {
      /* --- KPI ---------------------------------------------------------- */
      var kpis = D.kpis
        .map(function (k) {
          return UI.kpi(k);
        })
        .join("");

      /* --- Revenu par événement ----------------------------------------- */
      var revenueChart = UI.card(
        UI.cardHead(
          "EVENT REVENUE",
          UI.legend([
            { label: "Realised", color: "#d6a85f" },
            { label: "Projection", dashed: true },
          ])
        ) +
          UI.chart("area", {
            points: D.revenueSeries,
            format: "eurCompact",
            height: 264,
          }) +
          '<p class="note" style="margin-top:18px">' +
          "CIELO 001 is the realised figure of this prototype's dataset. CIELO 002 to 004 " +
          "are a projection produced by the loop model — retention, referral and waitlist " +
          "conversion compounding from one event to the next. Demonstration data." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Synthèse billetterie ----------------------------------------- */
      var t = D.ticketing;
      var breakdown = t.tiers
        .map(function (tier) {
          return UI.barRow({
            k: tier.label,
            v: UI.fmt.eur(tier.revenue) + "  ·  " + UI.fmt.int(tier.qty),
            pct: Math.round((tier.revenue / t.total) * 100),
            accent: tier.label === "VIP PASS" || tier.label === "TABLES",
          });
        })
        .join("");

      var snapshot = UI.card(
        UI.cardHead("TICKETING BREAKDOWN") +
          breakdown +
          '<div class="metric-row" style="margin-top:14px;border-top:1px solid var(--line);padding-top:18px">' +
          '<div class="k">Total</div><div class="v is-accent">' +
          UI.fmt.eur(t.total) +
          "</div></div>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Bandeau de tête ---------------------------------------------- */
      var head =
        '<div class="hero rv" style="padding-top:clamp(30px,3.6vw,54px)">' +
        '<div class="row row-between row-wrap" style="gap:20px;align-items:flex-start">' +
        "<div>" +
        UI.label("CIELO OS", true) +
        '<h1 class="display" style="margin-top:18px">Control<br>Center</h1>' +
        "</div>" +
        '<div class="stack stack-sm" style="align-items:flex-end;text-align:right">' +
        UI.pill(
          '<span class="dot-live"></span>' + UI.esc(D.current.status) + " · " + UI.esc(D.current.dateShort),
          "is-live"
        ) +
        UI.demoChip() +
        "</div>" +
        "</div>" +
        '<p class="lead" style="margin-top:30px;max-width:60ch">' +
        UI.esc(D.brand.promise) +
        "</p>" +
        '<div class="row row-wrap" style="margin-top:30px;gap:12px">' +
        UI.btn("Next event simulation", { mod: "is-primary is-lg", action: "simulate", arrow: true }) +
        UI.btn("The Cielo loop", { mod: "is-lg", action: "go", value: "loop" }) +
        "</div>" +
        "</div>";

      /* --- Acquisition --------------------------------------------------- */
      var acq = UI.card(
        UI.cardHead("ACQUISITION MIX", UI.tag("CIELO 001")) +
          D.acquisition
            .map(function (a) {
              return UI.barRow({ k: a.k, v: a.v + "%", pct: a.v, accent: a.accent });
            })
            .join("") +
          '<p class="note" style="margin-top:20px">' +
          "23% of CIELO 001 was acquired by members inviting members. That share is the one " +
          "CIELO OS is built to grow." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Trois promesses ---------------------------------------------- */
      var lines = UI.card(
        UI.label("THE SYSTEM") +
          '<div class="stack" style="margin-top:22px">' +
          D.copy.lines
            .map(function (l, i) {
              return (
                '<div class="h2" style="padding:16px 0' +
                (i ? ";border-top:1px solid var(--line-soft)" : "") +
                '">' +
                UI.esc(l) +
                "</div>"
              );
            })
            .join("") +
          "</div>",
        { mod: "is-pad-lg rv" }
      );

      return (
        '<div class="stack stack-xl">' +
        head +
        '<section><div class="grid g-5">' + kpis + "</div>" +
        UI.disclaimer() +
        "</section>" +
        '<section class="grid g-3-2">' + revenueChart + snapshot + "</section>" +
        "<section>" + NS.blocks.nextEvent({ hideSimulation: true }) + "</section>" +
        '<section class="grid g-2">' + acq + lines + "</section>" +
        "<section>" + NS.blocks.loopTeaser() + "</section>" +
        "</div>"
      );
    },
  };
})(window.CIELO);
