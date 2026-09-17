/* ==========================================================================
   Vue — AUDIENCE
   Le cœur du produit : l'événement produit des gens, pas seulement du revenu.
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  var FILTERS = ["All", "VIP", "Returning", "New", "High Value"];

  function matches(c, filter) {
    switch (filter) {
      case "VIP":
        return c.type === "VIP";
      case "Returning":
        return c.status === "RETURNING";
      case "New":
        return c.status === "NEW";
      case "High Value":
        return c.status === "HIGH VALUE";
      default:
        return true;
    }
  }

  function statusTag(status) {
    if (status === "HIGH VALUE") return UI.tag(status, "is-accent");
    if (status === "RETURNING") return UI.tag(status, "is-white");
    return UI.tag(status);
  }

  function rows(filter) {
    var list = D.customers.filter(function (c) {
      return matches(c, filter);
    });

    if (!list.length) {
      return (
        '<tr><td colspan="5" style="text-align:center;padding:40px 0" class="note">No member matches this segment in the demo dataset.</td></tr>'
      );
    }

    return list
      .map(function (c) {
        return (
          "<tr>" +
          "<td>" + UI.person(c.name, c.type === "VIP") + "</td>" +
          "<td>" + UI.tag(c.type, c.type === "VIP" ? "is-accent" : "") + "</td>" +
          '<td class="cell-num">' + c.events + " EVENT" + (c.events > 1 ? "S" : "") + "</td>" +
          '<td class="cell-num">' + UI.fmt.eur(c.value) + "</td>" +
          "<td>" + statusTag(c.status) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function filterBar(active) {
    return (
      '<div class="filters" data-region="audienceFilters">' +
      FILTERS.map(function (f) {
        return (
          '<button class="filter' +
          (f === active ? " is-active" : "") +
          '" data-action="filterAudience" data-value="' +
          UI.esc(f) +
          '">' +
          UI.esc(f) +
          "</button>"
        );
      }).join("") +
      "</div>"
    );
  }

  NS.views.audience = {
    label: "Audience",
    crumbs: ["AUDIENCE"],

    render: function () {
      var a = D.audience;
      var filter = NS.state.audienceFilter;

      /* --- Bandeau ------------------------------------------------------ */
      var head =
        '<div class="hero rv">' +
        '<div class="row row-between row-wrap" style="gap:20px;align-items:flex-start">' +
        "<div>" +
        UI.label("TOTAL CIELO MEMBERS", true) +
        '<div class="display" style="margin-top:18px">' +
        UI.counter(a.total, "int") +
        "</div>" +
        '<p class="lead" style="margin-top:22px;max-width:50ch">' +
        "People Cielo can reach directly, without paying a platform for permission. " +
        "This number is the real asset an event produces." +
        "</p>" +
        "</div>" +
        '<div class="stack stack-sm" style="align-items:flex-end">' +
        UI.demoChip() +
        "</div>" +
        "</div>" +
        '<div class="grid g-3 divided-x" style="margin-top:40px;padding-top:30px;border-top:1px solid var(--line)">' +
        UI.stat({ label: "MEMBER VALUE", value: a.lifetimeValue, format: "eur", accent: true, foot: "Average spend to date" }) +
        UI.stat({ label: "REPEAT RATE", value: a.repeatRate, format: "pct", foot: "Members with 2+ events" }) +
        UI.stat({ label: "FROM CIELO 001", value: 312, format: "int", foot: "New members this event" }) +
        "</div>" +
        "</div>";

      /* --- Segmentation : trois axes distincts -------------------------- */
      var lifecycle = UI.card(
        UI.cardHead("LIFECYCLE", UI.tag("axis 01")) +
          UI.chart("donut", {
            size: 230,
            stroke: 16,
            segments: a.lifecycle,
            center: { value: UI.fmt.int(a.total), label: "MEMBERS" },
          }) +
          '<div class="stack" style="margin-top:26px">' +
          a.lifecycle
            .map(function (s) {
              return UI.barRow({
                k: s.k,
                v: UI.fmt.int(s.v) + "  ·  " + Math.round((s.v / a.total) * 100) + "%",
                pct: Math.round((s.v / a.total) * 100),
                accent: s.k === "RETURNING",
              });
            })
            .join("") +
          "</div>",
        { mod: "is-pad-lg rv" }
      );

      var value = UI.card(
        UI.cardHead("VALUE", UI.tag("axis 02")) +
          '<div class="stack" style="margin-top:6px">' +
          a.value
            .map(function (s) {
              return UI.barRow({
                k: s.k,
                v: UI.fmt.int(s.v),
                pct: Math.round((s.v / a.total) * 100),
                accent: !!s.accent,
              });
            })
            .join("") +
          "</div>" +
          '<p class="note" style="margin-top:22px">' +
          "498 members — 39% of the base — carry VIP or high-value behaviour. They are the " +
          "first audience for every announcement." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      var geography = UI.card(
        UI.cardHead("GEOGRAPHY", UI.tag("axis 03")) +
          '<div class="stack" style="margin-top:6px">' +
          a.geography
            .map(function (s) {
              return UI.barRow({
                k: s.k,
                v: UI.fmt.int(s.v),
                pct: Math.round((s.v / a.total) * 100),
                accent: s.k === "INTERNATIONAL",
              });
            })
            .join("") +
          "</div>" +
          '<div class="stack stack-xs" style="margin-top:22px">' +
          a.geography
            .map(function (s) {
              return '<p class="note">' + UI.esc(s.k) + " — " + UI.esc(s.d) + "</p>";
            })
            .join("") +
          "</div>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Croissance de la base ---------------------------------------- */
      var growth = UI.card(
        UI.cardHead(
          "MEMBER BASE GROWTH",
          UI.legend([{ label: "Cielo members", color: "#d6a85f" }])
        ) +
          UI.chart("area", {
            points: D.analytics.audienceGrowth,
            format: "int",
            height: 220,
          }),
        { mod: "is-pad-lg rv" }
      );

      /* --- Table --------------------------------------------------------- */
      var table = UI.card(
        '<div class="row row-between row-wrap" style="gap:16px;margin-bottom:24px">' +
          "<div>" +
          UI.label("MEMBER DIRECTORY") +
          '<p class="note" style="margin-top:8px">Fictional records — no real person is represented.</p>' +
          "</div>" +
          filterBar(filter) +
          "</div>" +
          '<div data-region="audienceTable">' +
          UI.table(
            ["Customer", "Type", "Events", "Value", "Status"],
            [rows(filter)]
          ) +
          "</div>",
        { mod: "is-pad-lg rv" }
      );

      return (
        '<div class="stack stack-lg">' +
        UI.sectionHead({
          eyebrow: "MODULE",
          title: "Audience",
          sub: "Turn attendance into membership. Turn membership into loyalty.",
        }) +
        "<section>" + head + "</section>" +
        '<section class="grid g-3">' + lifecycle + value + geography + "</section>" +
        "<section>" + growth + "</section>" +
        "<section>" + table + "</section>" +
        "<section>" + UI.disclaimer() + "</section>" +
        "</div>"
      );
    },

    actions: {
      filterAudience: function (value) {
        NS.state.audienceFilter = value;
        NS.app.patch('[data-region="audienceFilters"]', filterBar(value), true);
        NS.app.patch(
          '[data-region="audienceTable"]',
          UI.table(["Customer", "Type", "Events", "Value", "Status"], [rows(value)])
        );
      },
    },
  };
})(window.CIELO);
