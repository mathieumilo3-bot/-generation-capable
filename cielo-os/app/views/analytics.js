/* ==========================================================================
   Vue — ANALYTICS
   Une seule question : est-ce que la boucle se referme, et à quel coût ?
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  /** Grille de rétention par cohorte. */
  function cohorts() {
    var a = D.analytics;
    var cols = a.retentionHead.length;

    function cell(v) {
      if (v === null || v === undefined) {
        return '<div class="cohort-cell" style="background:rgba(255,255,255,0.02);color:var(--muted-3)">—</div>';
      }
      // Une seule teinte, intensité proportionnelle à la rétention : deux
      // couleurs laissaient les valeurs basses quasi invisibles.
      var alpha = 0.1 + (v / 100) * 0.55;
      var color = "rgba(214,168,95," + alpha.toFixed(2) + ")";
      return (
        '<div class="cohort-cell" style="background:' + color + '">' + v + "%</div>"
      );
    }

    var style =
      'style="grid-template-columns:110px repeat(' + cols + ',minmax(0,1fr))"';

    var head =
      '<div class="cohort-head"></div>' +
      a.retentionHead
        .map(function (h) {
          return '<div class="cohort-head">' + UI.esc(h) + "</div>";
        })
        .join("");

    var body = a.retention
      .map(function (r) {
        return (
          '<div class="cohort-label">' +
          UI.esc(r.cohort) +
          "</div>" +
          r.cells
            .map(function (c) {
              return cell(c);
            })
            .join("")
        );
      })
      .join("");

    return '<div class="cohort" ' + style + ">" + head + body + "</div>";
  }

  NS.views.analytics = {
    label: "Analytics",
    crumbs: ["ANALYTICS"],

    render: function () {
      var a = D.analytics;

      // Coefficient et payback ne sont pas des pourcentages : ils sont rendus
      // en texte brut plus bas pour ne pas mentir sur l'unité.
      var kpis = [
        {
          label: "COST PER NEW MEMBER",
          value: a.costPerMember,
          format: "eur1", // 11,4 € — arrondir à 11 € perdrait la précision
          foot: "Blended across all channels",
          delta: { dir: "down", text: "−38% since CIELO 001" },
        },
        {
          label: "MEMBER VALUE",
          value: a.memberValue,
          format: "eur",
          foot: "Average spend to date",
          delta: { dir: "up", text: "+€22" },
        },
      ];

      var kpiCards =
        UI.card(
          '<div class="kpi">' +
            UI.label("LOOP COEFFICIENT") +
            '<div class="kpi-value is-accent">' + a.loopCoefficient.toFixed(2) + "</div>" +
            '<div class="kpi-foot">' +
            UI.delta({ dir: "up", text: "+0.11" }) +
            '<span class="muted-2">·</span><span>New members generated per member</span>' +
            "</div></div>",
          { mod: "is-hover rv" }
        ) +
        UI.kpi(kpis[0]) +
        UI.kpi(kpis[1]) +
        UI.card(
          '<div class="kpi">' +
            UI.label("PAYBACK") +
            '<div class="kpi-value">1.2 <span style="font-size:15px;color:var(--muted)">events</span></div>' +
            '<div class="kpi-foot"><span>Acquisition cost recovered before the second night</span></div>' +
            "</div>",
          { mod: "is-hover rv" }
        );

      var growth = UI.card(
        UI.cardHead(
          "CIELO MEMBERS OVER TIME",
          UI.legend([{ label: "Members", color: "#d6a85f" }])
        ) +
          UI.chart("area", { points: a.audienceGrowth, format: "int", height: 250 }),
        { mod: "is-pad-lg rv" }
      );

      var retention = UI.card(
        UI.cardHead("RETENTION BY COHORT", UI.tag("% returning")) +
          cohorts() +
          '<p class="note" style="margin-top:20px">' +
          "Each row is the group of members acquired at one event. The question the loop " +
          "has to answer: does a later cohort come back better than an earlier one? In this " +
          "model it does — 41% → 46% → 52% at the first return." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      var channels = UI.card(
        UI.cardHead("CHANNEL ECONOMICS") +
          UI.table(
            ["Channel", "Share", "Cost per member", "Verdict"],
            a.channels.map(function (c) {
              var verdict =
                c.cost === 0
                  ? UI.tag("FREE", "is-accent")
                  : c.cost < 10
                  ? UI.tag("SCALE", "is-accent")
                  : c.cost < 20
                  ? UI.tag("KEEP", "is-white")
                  : UI.tag("CAP");
              return (
                "<tr>" +
                "<td class='cell-strong'>" + UI.esc(c.k) + "</td>" +
                "<td class='cell-num'>" + c.v + "%</td>" +
                "<td class='cell-num'>" + (c.cost ? UI.fmt.eur1(c.cost) : "—") + "</td>" +
                "<td>" + verdict + "</td>" +
                "</tr>"
              );
            })
          ) +
          '<p class="note" style="margin-top:20px">' +
          "Member referral is the cheapest channel and the only one that grows on its own. " +
          "Paid social costs almost seven times more per member — useful to ignite an event, " +
          "expensive to rely on." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      return (
        '<div class="stack stack-lg">' +
        UI.sectionHead({
          eyebrow: "MODULE",
          title: "Analytics",
          sub: "Does the loop close, and at what cost? Everything on this page answers that.",
          right: UI.demoChip(),
        }) +
        '<section><div class="grid g-4">' + kpiCards + "</div></section>" +
        '<section class="grid g-2">' + growth + retention + "</section>" +
        "<section>" + channels + "</section>" +
        "<section>" +
        NS.blocks.statement(
          ["Every event", "creates the next."],
          "Growth stops being a campaign budget and starts being a property of the system."
        ) +
        "</section>" +
        "<section>" + UI.disclaimer() + "</section>" +
        "</div>"
      );
    },
  };
})(window.CIELO);
