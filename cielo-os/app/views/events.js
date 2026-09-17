/* ==========================================================================
   Vue — EVENTS
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  function statusMod(status) {
    if (status === "LIVE") return "is-live";
    if (status === "COMING SOON") return "is-solid";
    return "";
  }

  /** Carte d'événement dans la colonne de gauche. */
  function eventCard(e, i, active) {
    return (
      '<button class="card is-hover' +
      (active ? " is-accent" : "") +
      '" data-action="selectEvent" data-value="' +
      i +
      '" style="display:block;width:100%;text-align:left">' +
      '<div class="row row-between" style="align-items:flex-start;margin-bottom:22px">' +
      "<div>" +
      '<div class="h2">' + UI.esc(e.code) + "</div>" +
      '<div class="label" style="margin-top:10px">' + UI.esc(e.city) + "</div>" +
      "</div>" +
      UI.pill(
        (e.status === "LIVE" ? '<span class="dot-live"></span>' : "") + UI.esc(e.status),
        statusMod(e.status)
      ) +
      "</div>" +
      '<div class="row row-between" style="align-items:flex-end">' +
      '<span class="note">' + UI.esc(e.date) + "</span>" +
      '<span class="' + (e.revenue ? "accent" : "muted-2") + '" style="font-size:15px">' +
      (e.revenue ? UI.fmt.eur(e.revenue) : "—") +
      "</span>" +
      "</div>" +
      "</button>"
    );
  }

  /** Détail de l'événement sélectionné. */
  function detail(i) {
    var e = D.events[i];

    if (e.status !== "LIVE") {
      return (
        UI.card(
          '<div class="stack stack-md" style="align-items:flex-start">' +
            UI.label("NO EVENT DATA YET") +
            '<div class="h1">' + UI.esc(e.code) + "</div>" +
            '<p class="lead" style="max-width:52ch">' +
            "This event has not happened yet. What already exists is the audience that " +
            "will receive it: " +
            UI.fmt.int(D.nextEvent.ready) +
            " people carried over from CIELO 001." +
            "</p>" +
            '<div class="row row-wrap" style="gap:12px">' +
            UI.btn("Activate early access", { mod: "is-primary", action: "campaign", arrow: true }) +
            UI.btn("Back to CIELO 001", { mod: "is-ghost", action: "selectEvent", value: "0" }) +
            "</div>" +
            "</div>",
          { mod: "is-pad-lg" }
        )
      );
    }

    var stats = [
      { label: "TICKETS", value: e.tickets, format: "int", foot: "Paid admissions" },
      { label: "VIP", value: e.vip, format: "int", foot: "VIP passes", accent: true },
      { label: "TABLES", value: e.tables, format: "int", foot: "of 60 available" },
      { label: "REVENUE", value: e.revenue, format: "eur", foot: "Gross ticketing", accent: true },
      { label: "ATTENDANCE", value: e.attendance, format: "int", foot: "of 6,000 capacity" },
      { label: "ACQUISITION", value: e.newAudience, format: "pct", foot: "New audience share" },
    ];

    var perf = D.performance
      .map(function (p) {
        return UI.metricRow(p);
      })
      .join("");

    var acqChart = UI.chart("columns", {
      height: 210,
      categories: D.acquisition.map(function (a) {
        return {
          label: a.k,
          value: a.v,
          display: a.v + "%",
          accent: !!a.accent,
        };
      }),
    });

    return (
      '<div class="stack stack-md">' +
      UI.card(
        '<div class="row row-between row-wrap" style="gap:18px;margin-bottom:30px">' +
          "<div>" +
          UI.label("EVENT FILE") +
          '<div class="h1" style="margin-top:12px">' + UI.esc(e.code) + "</div>" +
          '<div class="label" style="margin-top:10px">' +
          UI.esc(e.city) + " · " + UI.esc(e.date) +
          "</div>" +
          "</div>" +
          '<div class="row" style="gap:10px">' +
          UI.pill('<span class="dot-live"></span>LIVE', "is-live") +
          UI.btn("View event", { mod: "is-sm", action: "viewEvent", arrow: true }) +
          "</div>" +
          "</div>" +
          '<div class="grid g-3">' +
          stats
            .map(function (s) {
              return (
                '<div class="stat-block" style="padding:18px 0;border-top:1px solid var(--line-soft)">' +
                UI.label(s.label) +
                '<div class="v' + (s.accent ? " accent" : "") + '">' +
                UI.counter(s.value, s.format) +
                "</div>" +
                '<div class="note">' + UI.esc(s.foot) + "</div>" +
                "</div>"
              );
            })
            .join("") +
          "</div>",
        { mod: "is-pad-lg" }
      ) +
      '<div class="grid g-2">' +
      UI.card(UI.cardHead("EVENT PERFORMANCE") + perf, { mod: "is-pad-lg" }) +
      UI.card(
        UI.cardHead("ACQUISITION", UI.tag("share of buyers")) +
          acqChart +
          '<p class="note" style="margin-top:18px">' +
          "Referral is the only channel that gets cheaper as the audience grows." +
          "</p>",
        { mod: "is-pad-lg" }
      ) +
      "</div>" +
      "</div>"
    );
  }

  /**
   * Ce que CIELO 001 transmet à CIELO 002 : la démonstration que l'événement
   * ne s'arrête pas le soir même.
   */
  function carryOver() {
    var items = [
      { k: "CIELO MEMBERS", v: 1284 },
      { k: "WAITLIST", v: 2847 },
      { k: "REFERRAL INVITES", v: 624 },
      { k: "CONTENT ASSETS", v: 284 },
    ];

    return UI.card(
      UI.label("CARRIED OVER TO CIELO 002") +
        '<div class="metric-list" style="margin-top:16px">' +
        items
          .map(function (i, n) {
            return (
              '<div class="metric-row"><div class="k">' +
              UI.esc(i.k) +
              '</div><div class="v' + (n === 1 ? " is-accent" : "") + '">' +
              UI.counter(i.v, "int") +
              "</div></div>"
            );
          })
          .join("") +
        "</div>" +
        '<p class="note" style="margin-top:18px">' +
        "None of this existed before CIELO 001. All of it is available to CIELO 002 " +
        "on day one." +
        "</p>",
      { mod: "is-pad-lg" }
    );
  }

  /** Fiche complète ouverte par « VIEW EVENT ». */
  function eventSheet() {
    var e = D.events[0];
    var t = D.ticketing;

    return (
      '<div class="stack stack-md">' +
      '<div class="grid g-3 divided-x">' +
      UI.stat({ label: "REVENUE", value: e.revenue, format: "eur", accent: true, foot: "Gross ticketing" }) +
      UI.stat({ label: "ATTENDANCE", value: e.attendance, format: "int", foot: "64.8% sell-through" }) +
      UI.stat({ label: "NEW MEMBERS", value: 312, format: "int", foot: "Joined Cielo Access" }) +
      "</div>" +
      '<hr class="hr">' +
      UI.label("TICKETING") +
      UI.table(
        ["Tier", "Quantity", "Price", "Revenue"],
        t.tiers.map(function (tier) {
          return (
            "<tr><td class='cell-strong'>" +
            UI.esc(tier.label) +
            "</td><td class='cell-num'>" +
            UI.fmt.int(tier.qty) +
            "</td><td>" +
            UI.fmt.eur(tier.price) +
            "</td><td class='cell-num'>" +
            UI.fmt.eur(tier.revenue) +
            "</td></tr>"
          );
        }).concat([
          "<tr><td class='cell-strong'>TOTAL</td><td class='cell-num'>" +
            UI.fmt.int(t.buyers) +
            "</td><td>—</td><td class='accent'>" +
            UI.fmt.eur(t.total) +
            "</td></tr>",
        ])
      ) +
      '<hr class="hr">' +
      UI.label("WHAT THE EVENT PRODUCED") +
      '<div class="steps" style="margin-top:8px">' +
      [
        { t: "312 new Cielo Access members", d: "33% of attendees now have an identity in the system." },
        { t: "2,847 people on the CIELO 002 waitlist", d: "Owned contacts, reachable without paid media." },
        { t: "624 tickets sold through member invites", d: "€31,200 of revenue attributed to referral." },
        { t: "284 content assets generated", d: "Reusable for the next announcement." },
      ]
        .map(function (s, i) {
          return (
            '<div class="step is-done"><div class="step-mark">' +
            (i + 1) +
            '</div><div class="step-body"><div class="t">' +
            UI.esc(s.t) +
            '</div><div class="d">' +
            UI.esc(s.d) +
            "</div></div></div>"
          );
        })
        .join("") +
      "</div>" +
      UI.disclaimer() +
      "</div>"
    );
  }

  NS.views.events = {
    label: "Events",
    crumbs: ["EVENTS"],

    render: function () {
      var idx = NS.state.eventIndex;

      return (
        '<div class="stack stack-lg">' +
        UI.sectionHead({
          eyebrow: "MODULE",
          title: "Events",
          sub: "Every Cielo event is a file that keeps producing value after the night is over.",
          right: UI.demoChip(),
        }) +
        '<section class="grid g-1-2" style="align-items:start;gap:22px">' +
        '<div class="stack stack-sm">' +
        '<div class="stack stack-sm" data-region="eventList">' +
        D.events
          .map(function (e, i) {
            return eventCard(e, i, i === idx);
          })
          .join("") +
        "</div>" +
        carryOver() +
        "</div>" +
        '<div data-region="eventDetail">' + detail(idx) + "</div>" +
        "</section>" +
        "<section>" + NS.blocks.nextEvent() + "</section>" +
        "<section>" + UI.disclaimer() + "</section>" +
        "</div>"
      );
    },

    actions: {
      selectEvent: function (value) {
        NS.state.eventIndex = parseInt(value, 10) || 0;
        NS.app.patch(
          '[data-region="eventList"]',
          D.events
            .map(function (e, i) {
              return eventCard(e, i, i === NS.state.eventIndex);
            })
            .join("")
        );
        NS.app.patch('[data-region="eventDetail"]', detail(NS.state.eventIndex));
      },

      viewEvent: function () {
        NS.overlays.modal({
          eyebrow: "EVENT FILE · CIELO 001",
          title: "Fréjus — 18 September 2026",
          body: eventSheet(),
          actions: [
            { text: "Activate early access for CIELO 002", mod: "is-primary", action: "campaign", arrow: true },
            { text: "Close", mod: "is-ghost", action: "closeModal" },
          ],
        });
      },
    },
  };
})(window.CIELO);
