/* ==========================================================================
   Vue — CIELO ACCESS
   Fonctionnalité CONCEPTUELLE du prototype : elle n'existe pas aujourd'hui
   chez Cielo. C'est une proposition, et la vue le dit explicitement.
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  function passport() {
    var m = D.access.member;

    return (
      '<div class="passport rv">' +
      '<div class="row row-between" style="align-items:flex-start">' +
      "<div>" +
      '<div class="label">CIELO ACCESS</div>' +
      '<div class="passport-id" style="margin-top:10px">MEMBER ' + UI.esc(m.id) + "</div>" +
      "</div>" +
      '<div class="avatar is-vip" style="width:40px;height:40px;font-size:12px">' +
      UI.esc(m.initials) +
      "</div>" +
      "</div>" +

      '<div style="margin-top:34px">' +
      '<div class="passport-name">' + UI.esc(m.name) + "</div>" +
      '<div class="label" style="margin-top:12px">STATUS</div>' +
      '<div class="h2 accent" style="margin-top:8px">' + UI.esc(m.tier) + "</div>" +
      "</div>" +

      '<div style="margin-top:32px">' +
      '<div class="label" style="margin-bottom:12px">EVENTS EXPERIENCED</div>' +
      '<div class="stamp-row">' +
      D.access.stamps
        .map(function (s) {
          return (
            '<div class="stamp' + (s.done ? " is-done" : "") + '">' +
            '<div class="e">' + UI.esc(s.e) + "</div>" +
            '<div class="m">' + (s.done ? "&#10003;" : "&#9675;") + "</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +

      // Prochain palier : occupe l'espace libre de la carte et donne au
      // membre la seule information qui le fait revenir.
      '<div style="margin-top:32px">' +
      '<div class="label" style="margin-bottom:12px">NEXT UNLOCK</div>' +
      '<div class="row row-between" style="align-items:baseline">' +
      '<span style="font-size:15px">Private experiences</span>' +
      '<span class="label label-accent">INNER CIRCLE</span>' +
      "</div>" +
      '<div class="bar" style="margin-top:14px"><i class="is-accent" data-w="' +
      m.nextTierProgress +
      '"></i></div>' +
      '<div class="note" style="margin-top:10px">' +
      m.nextTierProgress +
      "% of the way there — 2 events to go." +
      "</div>" +
      "</div>" +

      '<div style="margin-top:auto;padding-top:30px">' +
      '<div class="row row-between" style="padding-top:20px;border-top:1px solid var(--line)">' +
      '<span class="label">MEMBER SINCE</span>' +
      '<span class="mono" style="font-size:12px;letter-spacing:0.16em">' + UI.esc(m.since) + "</span>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function tiers() {
    var a = D.access;
    var progress = ((a.currentTierIndex + a.member.nextTierProgress / 100) / (a.tiers.length - 1)) * 84;

    return UI.card(
      UI.cardHead("PROGRESSION", UI.tag("concept")) +
        '<p class="lead" style="margin-bottom:8px;max-width:56ch">' +
        "The more someone experiences Cielo, the more the brand opens up to them. " +
        "Status is earned by attendance and by bringing people in — never bought." +
        "</p>" +
        '<div class="tier-rail" style="--tier-progress:' + progress.toFixed(1) + '%">' +
        a.tiers
          .map(function (t, i) {
            var reached = i <= a.currentTierIndex;
            var current = i === a.currentTierIndex;
            return (
              '<div class="tier' +
              (reached ? " is-reached" : "") +
              (current ? " is-current" : "") +
              '">' +
              '<div class="tier-dot"></div>' +
              '<div class="t">' + UI.esc(t.t) + "</div>" +
              '<div class="d">' + UI.esc(t.d) + "</div>" +
              "</div>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="row row-between" style="margin-top:30px;padding-top:20px;border-top:1px solid var(--line-soft)">' +
        '<span class="note">Progress to INNER CIRCLE</span>' +
        '<span class="accent">' + a.member.nextTierProgress + "%</span>" +
        "</div>" +
        '<div class="bar" style="margin-top:12px"><i class="is-accent" data-w="' +
        a.member.nextTierProgress +
        '"></i></div>',
      { mod: "is-pad-lg rv" }
    );
  }

  NS.views.access = {
    label: "Cielo Access",
    crumbs: ["CIELO ACCESS"],

    render: function () {
      var a = D.access;
      var m = a.member;

      var stats = UI.card(
        UI.cardHead("MEMBER FILE") +
          '<div class="metric-list">' +
          UI.metricRow({ k: "Events attended", v: String(m.eventsAttended) }) +
          UI.metricRow({ k: "Friends invited", v: String(m.friendsInvited), accent: true }) +
          UI.metricRow({ k: "Total spent", v: UI.fmt.eur(m.totalSpent) }) +
          UI.metricRow({ k: "Member since", v: m.since }) +
          "</div>",
        { mod: "is-pad-lg rv" }
      );

      var perks = UI.card(
        UI.cardHead("WHAT ACCESS UNLOCKS", UI.tag("concept")) +
          a.perks
            .map(function (p) {
              return (
                '<div class="perk' + (p.on ? " is-on" : "") + '">' +
                '<div class="perk-mark"></div>' +
                '<div class="t">' + UI.esc(p.t) + "</div>" +
                '<div class="lvl">' + UI.esc(p.lvl) + "</div>" +
                "</div>"
              );
            })
            .join("") +
          '<p class="note" style="margin-top:20px">' +
          "Unlocked perks are shown in accent. Locked perks stay visible on purpose — " +
          "a member should always see what the next tier gives them." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      var distribution = UI.card(
        UI.cardHead("MEMBER BASE BY TIER", UI.tag("1,284 members")) +
          a.distribution
            .map(function (d, i) {
              return UI.barRow({
                k: d.k,
                v: UI.fmt.int(d.v) + "  ·  " + Math.round((d.v / D.audience.total) * 100) + "%",
                pct: Math.round((d.v / D.audience.total) * 100),
                accent: i === 2,
              });
            })
            .join("") +
          '<p class="note" style="margin-top:20px">' +
          "126 people in the Inner Circle produce a disproportionate share of invitations. " +
          "Growing that group is the cheapest growth lever Cielo has." +
          "</p>",
        { mod: "is-pad-lg rv" }
      );

      var conceptNote = UI.card(
        '<div class="row row-wrap" style="gap:18px;align-items:flex-start">' +
          '<div style="flex:1;min-width:260px">' +
          UI.label("PROTOTYPE SCOPE") +
          '<p class="note" style="margin-top:12px;max-width:72ch;font-size:12px">' +
          "Cielo Access is a concept proposed by this prototype. It does not exist in " +
          "Cielo's current setup. The member shown here is fictional, and so is every " +
          "figure on this page. What is real is the mechanism: a named identity per " +
          "attendee, a status that grows with attendance, and benefits that make coming " +
          "back more valuable than coming once." +
          "</p>" +
          "</div>" +
          "</div>",
        { mod: "is-flat rv", style: "border-style:dashed" }
      );

      return (
        '<div class="stack stack-lg">' +
        UI.sectionHead({
          eyebrow: "MODULE · CONCEPT",
          title: "Cielo Access",
          sub: a.tagline,
          right: UI.demoChip(),
        }) +
        '<section class="grid g-1-2" style="align-items:stretch;gap:22px">' +
        passport() +
        '<div class="stack stack-sm">' + stats + perks + "</div>" +
        "</section>" +
        "<section>" + tiers() + "</section>" +
        "<section>" + distribution + "</section>" +
        "<section>" +
        NS.blocks.statement(
          ["Turn attendance", "into membership."],
          "A ticket is a transaction. A member is a relationship that survives the night."
        ) +
        "</section>" +
        "<section>" + conceptNote + "</section>" +
        "</div>"
      );
    },
  };
})(window.CIELO);
