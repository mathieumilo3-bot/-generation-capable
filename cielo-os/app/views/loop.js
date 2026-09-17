/* ==========================================================================
   Vue — THE CIELO LOOP
   La page qui explique l'idée en dix secondes, sans une seule métrique.
   ========================================================================== */

window.CIELO = window.CIELO || {};
window.CIELO.views = window.CIELO.views || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  var RADIUS = 37; // % du conteneur

  function diagram() {
    var nodes = D.loop.nodes;

    var positions = nodes
      .map(function (n, i) {
        var angle = (-90 + (360 / nodes.length) * i) * (Math.PI / 180);
        var left = 50 + RADIUS * Math.cos(angle);
        var top = 50 + RADIUS * Math.sin(angle);
        return (
          '<div class="loop-node" data-loop-node="' +
          i +
          '" style="left:' +
          left.toFixed(2) +
          "%;top:" +
          top.toFixed(2) +
          '%">' +
          '<div class="b"></div>' +
          '<div class="t">' +
          UI.esc(n.t) +
          "</div>" +
          '<div class="d">' +
          UI.esc(n.d) +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    var svg =
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="' + RADIUS + '" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="0.25" stroke-dasharray="0.8 1.6"/>' +
      '<circle cx="50" cy="50" r="' + (RADIUS - 9) + '" fill="none" stroke="rgba(255,255,255,0.045)" stroke-width="0.2"/>' +
      '<g class="loop-sweep" style="transform-origin:50px 50px">' +
      '<circle cx="50" cy="50" r="' + RADIUS + '" fill="none" stroke="#d6a85f" stroke-width="0.45" ' +
      'stroke-linecap="round" stroke-dasharray="46 186" opacity="0.85"/>' +
      "</g>" +
      "</svg>";

    return (
      '<div class="loop-wrap" data-loop>' +
      svg +
      '<div class="loop-center"><div class="n">CIELO</div><div class="s">THE LOOP</div></div>' +
      positions +
      "</div>"
    );
  }

  NS.views.loop = {
    label: "The Cielo Loop",
    crumbs: ["THE CIELO LOOP"],

    render: function () {
      var chain = [
        { t: "AUDIENCE" },
        { t: "WAITLIST" },
        { t: "TICKET" },
        { t: "CIELO ACCESS" },
        { t: "EVENT" },
        { t: "DATA" },
        { t: "REFERRAL" },
        { t: "NEXT EVENT" },
        { t: "REPEAT PURCHASE" },
      ];

      var head =
        '<div class="rv" style="text-align:center;max-width:70ch;margin:0 auto">' +
        UI.label("THE BIG IDEA", true) +
        '<h1 class="display" style="margin-top:22px">The Cielo Loop</h1>' +
        '<p class="lead" style="margin-top:26px">' +
        UI.esc(D.copy.hero) +
        " Every event Cielo produces should leave behind an audience the next one starts from." +
        "</p>" +
        "</div>";

      var lines =
        '<div class="rv" style="text-align:center;max-width:62ch;margin:0 auto">' +
        D.loop.lines
          .map(function (l, i) {
            return (
              '<div class="h2" style="padding:18px 0' +
              (i ? ";border-top:1px solid var(--line-soft)" : "") +
              '">' +
              UI.esc(l) +
              "</div>"
            );
          })
          .join("") +
        "</div>";

      var closing =
        '<div class="hero rv" style="text-align:center">' +
        '<div class="statement">' +
        UI.esc(D.copy.closing[0]) +
        "<br><em>" +
        UI.esc(D.copy.closing[1]) +
        "</em></div>" +
        '<p class="lead" style="margin:30px auto 0;max-width:54ch">' +
        UI.esc(D.brand.promise) +
        "</p>" +
        '<div class="row row-wrap" style="justify-content:center;margin-top:34px;gap:12px">' +
        UI.btn("Next event simulation", { mod: "is-primary is-lg", action: "simulate", arrow: true }) +
        UI.btn("Back to control center", { mod: "is-lg", action: "go", value: "overview" }) +
        "</div>" +
        "</div>";

      return (
        '<div class="stack stack-xl">' +
        "<section>" + head + "</section>" +
        '<section class="rv">' +
        diagram() +
        '<p class="note" style="text-align:center;margin-top:34px">' +
        "Hover any step to read it. The loop runs on its own." +
        "</p>" +
        "</section>" +
        '<section class="rv" style="text-align:center">' +
        '<h2 class="statement" style="max-width:20ch;margin:0 auto">Every event makes the next one stronger.</h2>' +
        "</section>" +
        "<section>" + lines + "</section>" +
        "<section>" +
        UI.card(
          UI.cardHead("THE CHAIN", UI.tag("what the system tracks")) +
            UI.flow(chain, { compact: true }) +
            '<p class="lead" style="margin-top:28px;max-width:72ch">' +
            "Nine steps, one rule: nothing leaks. Every step writes into the next, and the " +
            "last one feeds the first." +
            "</p>",
          { mod: "is-pad-lg rv" }
        ) +
        "</section>" +
        "<section>" + closing + "</section>" +
        "</div>"
      );
    },

    /** Animation d'ambiance : le nœud actif tourne en continu. */
    after: function (root) {
      var wrap = root.querySelector("[data-loop]");
      if (!wrap) return;

      var nodes = Array.prototype.slice.call(wrap.querySelectorAll("[data-loop-node]"));
      if (!nodes.length) return;

      var index = 0;
      var paused = false;

      function setActive(i) {
        nodes.forEach(function (n, j) {
          n.classList.toggle("is-active", j === i);
        });
      }

      setActive(0);

      nodes.forEach(function (n, i) {
        n.addEventListener("mouseenter", function () {
          paused = true;
          index = i;
          setActive(i);
        });
        n.addEventListener("mouseleave", function () {
          paused = false;
        });
      });

      if (NS.ui.reduced) return;

      var timer = setInterval(function () {
        if (!wrap.isConnected) {
          clearInterval(timer);
          return;
        }
        if (paused) return;
        index = (index + 1) % nodes.length;
        setActive(index);
      }, 2300);

      NS.app.onLeave(function () {
        clearInterval(timer);
      });
    },
  };
})(window.CIELO);
