/* ==========================================================================
   Vue — REFERRALS
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  NS.views.referrals = {
    label: "Referrals",
    crumbs: ["REFERRALS"],

    render: function () {
      var r = D.referrals;

      /* --- Bandeau ------------------------------------------------------ */
      var head =
        '<div class="hero rv">' +
        '<div class="row row-between row-wrap" style="gap:20px;align-items:flex-start">' +
        // Le titre doit tenir en deux ou trois lignes : à la taille display
        // pleine il se brisait mot par mot.
        // Largeur en px : une contrainte en `ch` se calculerait sur la police
        // du conteneur (14px) et non sur celle du titre.
        '<div style="flex:1;min-width:260px;max-width:780px">' +
        UI.label("REFERRAL ENGINE", true) +
        '<h2 class="display" style="margin-top:20px;font-size:clamp(30px,4.4vw,60px)">' +
        "Turn your audience into your acquisition engine." +
        "</h2>" +
        "</div>" +
        UI.demoChip() +
        "</div>" +
        '<div class="grid g-3 divided-x" style="margin-top:46px;padding-top:30px;border-top:1px solid var(--line)">' +
        UI.stat({ label: "INVITATIONS", value: r.invitations, format: "int", foot: "Sent by members" }) +
        UI.stat({ label: "CONVERSIONS", value: r.conversions, format: "int", foot: r.conversionRate + "% conversion rate" }) +
        UI.stat({ label: "REFERRAL REVENUE", value: r.revenue, format: "eur", accent: true, foot: "17% of CIELO 001" }) +
        "</div>" +
        "</div>";

      /* --- Mécanique ----------------------------------------------------- */
      var flow = UI.card(
        UI.cardHead("HOW IT WORKS", UI.tag("automatic attribution")) +
          UI.flow(r.flow) +
          '<p class="lead" style="margin-top:28px;max-width:70ch">' +
          "The reward is status, not a discount. A discount trains an audience to wait for " +
          "a discount. Status trains it to bring people." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Lien personnel ------------------------------------------------ */
      var link = UI.card(
        UI.cardHead("YOUR CIELO LINK", UI.tag("member #001284")) +
          '<div class="copy-field">' +
          "<code>" + UI.esc(r.link) + "</code>" +
          UI.btn("Copy link", { mod: "is-sm", action: "copyLink", value: r.link }) +
          "</div>" +
          '<div class="grid g-3 divided-x" style="margin-top:26px">' +
          UI.stat({ label: "CLICKS", value: 118, format: "int" }) +
          UI.stat({ label: "SIGN-UPS", value: 34, format: "int" }) +
          UI.stat({ label: "TICKETS", value: 12, format: "int", accent: true }) +
          "</div>" +
          '<p class="note" style="margin-top:22px">' +
          "Demo link — it does not resolve to a live page." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Funnel -------------------------------------------------------- */
      var funnelSteps = [
        { k: "INVITATIONS SENT", v: r.invitations, pct: 100 },
        { k: "LINKS OPENED", v: 1489, pct: 60 },
        { k: "ADDED TO WAITLIST", v: 892, pct: 36 },
        { k: "TICKETS PURCHASED", v: r.conversions, pct: 25, accent: true },
      ];

      var funnel = UI.card(
        UI.cardHead("REFERRAL FUNNEL", UI.tag("CIELO 001")) +
          funnelSteps
            .map(function (s) {
              return UI.barRow({
                k: s.k,
                v: UI.fmt.int(s.v) + "  ·  " + s.pct + "%",
                pct: s.pct,
                accent: !!s.accent,
              });
            })
            .join("") +
          '<p class="note" style="margin-top:22px">' +
          "One in four invitations becomes a paying attendee. No paid channel available to " +
          "Cielo converts at that rate." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      /* --- Top referrers -------------------------------------------------- */
      var top = UI.card(
        '<div class="row row-between row-wrap" style="gap:16px;margin-bottom:24px">' +
          "<div>" +
          UI.label("TOP REFERRERS") +
          '<p class="note" style="margin-top:8px">Fictional members — demonstration data.</p>' +
          "</div>" +
          UI.btn("Reward top referrers", { mod: "is-sm", action: "rewardReferrers", arrow: true }) +
          "</div>" +
          UI.table(
            ["Member", "Invites", "Conversions", "Revenue", "Rate"],
            r.top.map(function (t) {
              var rate = Math.round((t.conversions / t.invites) * 100);
              return (
                "<tr>" +
                "<td>" + UI.person(t.name, true) + "</td>" +
                '<td class="cell-num">' + t.invites + "</td>" +
                '<td class="cell-num">' + t.conversions + "</td>" +
                '<td class="cell-num">' + UI.fmt.eur(t.revenue) + "</td>" +
                "<td>" + UI.tag(rate + "%", rate >= 40 ? "is-accent" : "") + "</td>" +
                "</tr>"
              );
            })
          ),
        { mod: "is-pad-lg rv" }
      );

      return (
        '<div class="stack stack-lg">' +
        UI.sectionHead({
          eyebrow: "MODULE",
          title: "Referrals",
          sub: "The cheapest ticket Cielo will ever sell is the one sold by someone who already came.",
        }) +
        "<section>" + head + "</section>" +
        "<section>" + flow + "</section>" +
        '<section class="grid g-2">' + link + funnel + "</section>" +
        "<section>" + top + "</section>" +
        "<section>" + UI.disclaimer() + "</section>" +
        "</div>"
      );
    },

    actions: {
      copyLink: function (value) {
        UI.copy(value);
        UI.toast("Link copied");
      },

      rewardReferrers: function () {
        NS.overlays.modal({
          eyebrow: "SIMULATION",
          title: "Reward 5 top referrers",
          body:
            '<div class="stack stack-md">' +
            '<p class="lead">Each of these members would be moved up one Cielo Access tier and ' +
            "given 48-hour priority on CIELO 002.</p>" +
            D.referrals.top
              .map(function (t) {
                return (
                  '<div class="row row-between" style="padding:14px 0;border-bottom:1px solid var(--line-soft)">' +
                  UI.person(t.name, true) +
                  '<span class="tag is-accent">+1 TIER</span>' +
                  "</div>"
                );
              })
              .join("") +
            UI.note(
              "Nothing is sent. This prototype never contacts anyone — it only shows what the system would do."
            ) +
            "</div>",
          actions: [
            { text: "Apply rewards", mod: "is-primary", action: "confirmReward" },
            { text: "Cancel", mod: "is-ghost", action: "closeModal" },
          ],
        });
      },

      confirmReward: function () {
        NS.overlays.close();
        UI.toast("5 members upgraded · simulation");
      },
    },
  };
})(window.CIELO);
