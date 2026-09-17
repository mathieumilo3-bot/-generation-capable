/* ==========================================================================
   CIELO OS — Blocs partagés entre plusieurs vues
   ========================================================================== */

window.CIELO = window.CIELO || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;
  var B = {};

  /* ----------------------------------------------------------------------
     NEXT EVENT — le bloc qui matérialise « on ne repart pas de zéro ».
     Présent sur Overview et sur Events.
     ---------------------------------------------------------------------- */

  B.nextEvent = function (opts) {
    opts = opts || {};
    var n = D.nextEvent;

    var segments = n.segments
      .map(function (s) {
        return (
          '<div class="stat-block">' +
          UI.label(s.k) +
          '<div class="v' + (s.k === "VIP" ? " accent" : "") + '">' +
          UI.counter(s.v, "int") +
          "</div>" +
          '<div class="note">' + UI.esc(s.d) + "</div>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="hero rv">' +
      '<div class="row row-between row-wrap" style="gap:18px;margin-bottom:34px">' +
      "<div>" +
      UI.label("NEXT EVENT", true) +
      '<div class="h1" style="margin-top:12px">' + UI.esc(n.code) + "</div>" +
      '<div class="label" style="margin-top:10px">' + UI.esc(n.status) + "</div>" +
      "</div>" +
      UI.pill("Waitlist active", "is-live") +
      "</div>" +

      '<div class="display" style="max-width:16ch">' +
      UI.counter(n.ready, "int") +
      "</div>" +
      '<p class="lead" style="margin-top:16px;max-width:52ch">People ready to be notified the day CIELO 002 is announced. ' +
      "They are not an ad audience — they are yours.</p>" +

      '<div class="grid g-3 divided-x" style="margin-top:40px;padding-top:30px;border-top:1px solid var(--line)">' +
      segments +
      "</div>" +

      '<div class="row row-wrap" style="margin-top:34px;gap:12px">' +
      UI.btn("Activate early access", {
        mod: "is-primary is-lg",
        action: "campaign",
        arrow: true,
      }) +
      (opts.hideSimulation
        ? ""
        : UI.btn("Next event simulation", { mod: "is-lg", action: "simulate" })) +
      "</div>" +
      "</div>"
    );
  };

  /* ----------------------------------------------------------------------
     Aperçu de la boucle — version compacte, renvoie vers la vue complète.
     ---------------------------------------------------------------------- */

  B.loopTeaser = function () {
    return UI.card(
      UI.cardHead(
        "THE CIELO LOOP",
        UI.btn("Open the loop", { mod: "is-sm", action: "go", value: "loop", arrow: true })
      ) +
        UI.flow(
          [
            { t: "AUDIENCE" },
            { t: "WAITLIST" },
            { t: "TICKET" },
            { t: "CIELO ACCESS" },
            { t: "EVENT" },
            { t: "DATA" },
            { t: "REFERRAL" },
            { t: "NEXT EVENT" },
          ],
          { compact: true }
        ) +
        '<p class="lead" style="margin-top:26px;max-width:64ch">' +
        "Each step feeds the next one. Nothing an event produces is allowed to leak." +
        "</p>",
      { mod: "is-pad-lg rv" }
    );
  };

  /* ----------------------------------------------------------------------
     Bandeau de citation.
     ---------------------------------------------------------------------- */

  B.statement = function (lines, sub) {
    return (
      '<div class="hero rv" style="text-align:center">' +
      '<div class="statement">' +
      lines
        .map(function (l, i) {
          return i === lines.length - 1 ? "<em>" + UI.esc(l) + "</em>" : UI.esc(l);
        })
        .join("<br>") +
      "</div>" +
      (sub ? '<p class="lead" style="margin:26px auto 0;max-width:56ch">' + UI.esc(sub) + "</p>" : "") +
      "</div>"
    );
  };

  NS.blocks = B;
})(window.CIELO);
