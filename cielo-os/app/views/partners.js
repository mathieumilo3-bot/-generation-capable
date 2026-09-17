/* ==========================================================================
   Vue — PARTNER CENTER
   Objectif : rendre mesurable ce qu'un partenaire obtient réellement.
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  function reportSheet() {
    var p = D.partners.primary;

    var cells = [
      { k: "REACH", v: "412,800" },
      { k: "IMPRESSIONS", v: "1,284,000" },
      { k: "ENGAGEMENT", v: "6.8%" },
      { k: "CLICKS", v: "34,200" },
      { k: "TICKET CONVERSIONS", v: "486", accent: true },
      { k: "CONTENT ASSETS", v: "284" },
    ];

    return (
      '<div class="sheet">' +
      '<div class="sheet-head">' +
      '<div class="row row-between row-wrap" style="gap:16px;align-items:flex-start">' +
      "<div>" +
      '<div class="label label-accent">PARTNERSHIP REPORT</div>' +
      '<div class="h2" style="margin-top:12px">' + UI.esc(p.name) + " × CIELO 001</div>" +
      '<div class="note" style="margin-top:8px">Fréjus · 18 September 2026 · prepared by CIELO OS</div>' +
      "</div>" +
      UI.pill("Draft", "is-solid") +
      "</div>" +
      "</div>" +
      '<div class="sheet-grid">' +
      cells
        .map(function (c) {
          return (
            '<div class="sheet-cell">' +
            '<div class="label">' + UI.esc(c.k) + "</div>" +
            '<div class="v' + (c.accent ? " accent" : "") + '">' + UI.esc(c.v) + "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="sheet-body">' +
      '<div class="grid g-3 divided-x" style="margin-bottom:26px">' +
      UI.stat({ label: "INVESTMENT", raw: UI.fmt.eur(p.investment), foot: "Partner contribution" }) +
      UI.stat({ label: "ATTRIBUTED REVENUE", raw: UI.fmt.eur(p.attributedRevenue), foot: "486 tickets × €51" }) +
      UI.stat({ label: "ESTIMATED MEDIA VALUE", raw: UI.fmt.eur(p.mediaValue), accent: true, foot: UI.fmt.x(p.roi) + " on investment" }) +
      "</div>" +
      '<hr class="hr" style="margin-bottom:22px">' +
      '<div class="label" style="margin-bottom:14px">WHAT THE PARTNER ACTUALLY BOUGHT</div>' +
      '<p class="lead" style="max-width:70ch">' +
      "Not a logo on a poster. A measured position inside 3,888 nights out, 284 pieces of " +
      "content the brand can reuse, and 486 identified people who bought a ticket after " +
      "seeing them." +
      "</p>" +
      UI.disclaimer("Figures are illustrative — the partner is fictional.") +
      "</div>" +
      "</div>"
    );
  }

  NS.views.partners = {
    label: "Partners",
    crumbs: ["PARTNER CENTER"],

    render: function () {
      var p = D.partners.primary;

      var head =
        '<div class="hero rv">' +
        '<div class="row row-between row-wrap" style="gap:20px;align-items:flex-start">' +
        "<div>" +
        UI.label("ACTIVE PARTNERSHIP", true) +
        '<div class="display" style="margin-top:18px">' + UI.esc(p.name) + "</div>" +
        '<div class="label" style="margin-top:16px">' + UI.esc(p.category) + "</div>" +
        "</div>" +
        '<div class="stack stack-sm" style="align-items:flex-end">' +
        UI.pill("Since " + p.since, "is-solid") +
        UI.demoChip() +
        "</div>" +
        "</div>" +
        '<div class="grid g-3 divided-x" style="margin-top:44px;padding-top:30px;border-top:1px solid var(--line)">' +
        UI.stat({ label: "INVESTMENT", value: p.investment, format: "eur", foot: "Partner contribution" }) +
        UI.stat({ label: "ATTRIBUTED REVENUE", value: p.attributedRevenue, format: "eur", foot: "From 486 tickets" }) +
        UI.stat({ label: "RETURN", raw: UI.fmt.x(p.roi), accent: true, foot: "Estimated media value / investment" }) +
        "</div>" +
        '<div class="row row-wrap" style="margin-top:34px;gap:12px">' +
        UI.btn("Generate partner report", { mod: "is-primary is-lg", action: "generateReport", arrow: true }) +
        "</div>" +
        "</div>";

      var metrics = UI.card(
        UI.cardHead("PARTNER METRICS", UI.tag("CIELO 001")) +
          '<div class="metric-list">' +
          p.metrics
            .map(function (m) {
              return UI.metricRow(m);
            })
            .join("") +
          "</div>",
        { mod: "is-pad-lg rv" }
      );

      var chart = UI.card(
        UI.cardHead(
          "PARTNERSHIP PERFORMANCE",
          UI.legend([
            { label: "Reach", color: "rgba(255,255,255,0.16)" },
            { label: "Click-through rate", dashed: true },
          ])
        ) +
          UI.chart("columns", {
            height: 240,
            categories: p.series.map(function (s, i) {
              return {
                label: s.label,
                value: s.reach,
                display: UI.fmt.compact(s.reach),
                accent: i === 1,
                secondary: Math.round((s.clicks / s.reach) * 1000) / 10,
              };
            }),
          }) +
          '<p class="note" style="margin-top:18px">' +
          "Columns show reach per phase (left scale). The dashed line shows click-through " +
          "rate on its own scale — the two are not comparable in absolute value, only in " +
          "shape. Launch week carries both." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      var portfolio = UI.card(
        UI.cardHead("PARTNER PORTFOLIO") +
          UI.table(
            ["Partner", "Status", "Value", "Return"],
            [
              "<tr><td class='cell-strong'>" +
                UI.esc(p.name) +
                "</td><td>" +
                UI.tag("ACTIVE", "is-accent") +
                "</td><td class='cell-num'>" +
                UI.fmt.eur(p.investment) +
                "</td><td class='accent'>" +
                UI.fmt.x(p.roi) +
                "</td></tr>",
            ].concat(
              D.partners.others.map(function (o) {
                return (
                  "<tr><td class='cell-strong'>" +
                  UI.esc(o.name) +
                  "</td><td>" +
                  UI.tag(o.status, o.status === "ACTIVE" ? "is-white" : "") +
                  "</td><td class='cell-num'>" +
                  UI.fmt.eur(o.value) +
                  "</td><td class='cell-num'>" +
                  (o.roi ? UI.fmt.x(o.roi) : "—") +
                  "</td></tr>"
                );
              })
            )
          ) +
          '<p class="note" style="margin-top:20px">' +
          "Every partner is measured against the same six metrics. A partnership that cannot " +
          "be measured cannot be renewed at a higher price." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      return (
        '<div class="stack stack-lg">' +
        UI.sectionHead({
          eyebrow: "MODULE",
          title: "Partner Center",
          sub: "Measure what a partner actually gets — so the next contract is negotiated on evidence.",
        }) +
        "<section>" + head + "</section>" +
        '<section class="grid g-2">' + metrics + chart + "</section>" +
        "<section>" + portfolio + "</section>" +
        "<section>" + UI.disclaimer() + "</section>" +
        "</div>"
      );
    },

    actions: {
      generateReport: function () {
        NS.overlays.process({
          eyebrow: "PARTNER CENTER",
          title: "Generating partner report",
          steps: [
            "Collecting CIELO 001 partner data",
            "Matching ticket purchases to partner touchpoints",
            "Computing reach, engagement and attributed revenue",
            "Formatting the report",
          ],
          onDone: function () {
            NS.overlays.modal({
              eyebrow: "PARTNER CENTER",
              title: "Partner report — PARTNER DEMO",
              body: reportSheet(),
              actions: [
                { text: "Export as PDF", mod: "is-primary", action: "exportReport" },
                { text: "Close", mod: "is-ghost", action: "closeModal" },
              ],
            });
          },
        });
      },

      exportReport: function () {
        UI.toast("Export simulated · no file generated");
      },
    },
  };
})(window.CIELO);
