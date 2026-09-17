/* ==========================================================================
   CIELO OS — Surcouches : modale, process, campagne, simulation
   --------------------------------------------------------------------------
   Rien n'est réellement envoyé nulle part. Toutes ces séquences sont des
   simulations locales, et chaque écran le rappelle.
   ========================================================================== */

window.CIELO = window.CIELO || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;
  var O = {};

  var root = null;
  var timers = [];
  var escBound = false;

  function host() {
    if (!root) root = document.getElementById("overlay");
    return root;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function later(fn, ms) {
    var t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  }

  function bindEsc() {
    if (escBound) return;
    escBound = true;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") O.close();
    });
  }

  O.close = function () {
    clearTimers();
    var h = host();
    var node = h.firstElementChild;
    if (!node) return;
    node.classList.add("is-closing");
    setTimeout(function () {
      h.innerHTML = "";
      document.body.style.overflow = "";
    }, 260);
  };

  function open(html) {
    bindEsc();
    clearTimers();
    var h = host();
    h.innerHTML = html;
    document.body.style.overflow = "hidden";
    UI.mount(h);

    // Clic sur le fond = fermeture (sauf pendant la simulation plein écran).
    var overlay = h.querySelector(".overlay");
    if (overlay) {
      overlay.addEventListener("mousedown", function (e) {
        if (e.target === overlay) O.close();
      });
    }
    return h;
  }

  /* ======================================================================
     Modale générique
     ====================================================================== */

  O.modal = function (opts) {
    var actions = (opts.actions || [])
      .map(function (a) {
        return UI.btn(a.text, {
          mod: a.mod,
          action: a.action,
          value: a.value,
          arrow: a.arrow,
        });
      })
      .join("");

    open(
      '<div class="overlay"><div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
        "<div>" +
        (opts.eyebrow ? '<div class="label label-accent">' + UI.esc(opts.eyebrow) + "</div>" : "") +
        '<div class="h2" style="margin-top:10px">' + UI.esc(opts.title) + "</div>" +
        "</div>" +
        '<button class="icon-btn" data-action="closeModal" aria-label="Close">&#215;</button>' +
        "</div>" +
        '<div class="modal-body">' + opts.body + "</div>" +
        (actions ? '<div class="modal-foot">' + actions + "</div>" : "") +
        "</div></div>"
    );
  };

  /* ======================================================================
     Séquence de traitement (génération de rapport, envoi de campagne…)
     ====================================================================== */

  O.process = function (opts) {
    var steps = opts.steps || [];

    open(
      '<div class="overlay"><div class="modal" style="max-width:560px" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><div>' +
        '<div class="label label-accent">' + UI.esc(opts.eyebrow || "PROCESSING") + "</div>" +
        '<div class="h2" style="margin-top:10px">' + UI.esc(opts.title) + "</div>" +
        "</div></div>" +
        '<div class="modal-body"><div class="steps" data-process>' +
        steps
          .map(function (s, i) {
            return (
              '<div class="step" data-step="' + i + '">' +
              '<div class="step-mark">' + (i + 1) + "</div>" +
              '<div class="step-body"><div class="t">' + UI.esc(s) + "</div></div>" +
              "</div>"
            );
          })
          .join("") +
        "</div></div>" +
        "</div></div>"
    );

    var perStep = UI.reduced ? 60 : 520;
    steps.forEach(function (_, i) {
      later(function () {
        var node = document.querySelector('[data-process] [data-step="' + i + '"]');
        if (node) {
          node.classList.add("is-done");
          node.querySelector(".step-mark").innerHTML = "&#10003;";
        }
      }, 260 + i * perStep);
    });

    later(function () {
      if (opts.onDone) opts.onDone();
    }, 460 + steps.length * perStep);
  };

  /* ======================================================================
     Campagne « early access » — simulation interactive
     ====================================================================== */

  var campaignState = null;

  function campaignBody() {
    var n = D.nextEvent;

    var channels = campaignState.channels
      .map(function (c, i) {
        return (
          '<button class="choice' + (c.on ? " is-on" : "") + '" data-action="toggleChannel" data-value="' + i + '">' +
          '<span class="choice-box"></span>' +
          '<span class="t">' + UI.esc(c.k) + "</span>" +
          '<span class="m">' + UI.fmt.int(c.reach) + " reachable</span>" +
          "</button>"
        );
      })
      .join("");

    var selected = campaignState.channels.filter(function (c) {
      return c.on;
    });

    var segments = n.segments
      .map(function (s) {
        return (
          '<div class="row row-between" style="padding:11px 0;border-bottom:1px solid var(--line-soft)">' +
          '<span class="label">' + UI.esc(s.k) + "</span>" +
          '<span class="' + (s.k === "VIP" ? "accent" : "") + '">' + UI.fmt.int(s.v) + "</span>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="stack stack-md">' +
      '<div class="grid g-2" style="gap:22px;align-items:start">' +

      '<div class="stack stack-md">' +
      "<div>" +
      UI.label("AUDIENCE SELECTED") +
      '<div class="display" style="font-size:clamp(34px,4vw,56px);margin-top:12px">' +
      UI.fmt.int(n.ready) +
      "</div>" +
      '<p class="note" style="margin-top:10px">Everyone on the CIELO 002 waitlist.</p>' +
      "</div>" +
      "<div>" + segments + "</div>" +
      "</div>" +

      '<div class="stack stack-md">' +
      "<div>" +
      UI.label("CHANNEL") +
      '<div class="stack stack-xs" style="margin-top:12px">' + channels + "</div>" +
      '<p class="note" style="margin-top:12px" data-region="channelSummary">' +
      (selected.length
        ? selected.length + " channel" + (selected.length > 1 ? "s" : "") + " selected"
        : "No channel selected") +
      "</p>" +
      "</div>" +

      "<div>" +
      UI.label("MESSAGE PREVIEW") +
      '<div class="preview" style="margin-top:12px">' +
      '<div class="preview-head">' +
      '<div class="avatar is-vip" style="width:26px;height:26px;font-size:9px">C</div>' +
      '<span class="label">CIELO</span>' +
      "</div>" +
      '<div class="preview-body"><strong>' + UI.esc(D.nextEvent.message) + "</strong><br>" +
      UI.esc(D.nextEvent.messageBody) +
      "</div>" +
      '<div class="row" style="padding-top:12px;border-top:1px solid var(--line-soft)">' +
      UI.tag("48H EARLY ACCESS", "is-accent") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +

      "</div>" +
      UI.note(
        "Interactive simulation. This prototype has no messaging integration and will not " +
        "contact anyone — launching the campaign only plays back what the system would do."
      ) +
      "</div>"
    );
  }

  O.campaign = function () {
    campaignState = {
      channels: D.nextEvent.channels.map(function (c) {
        return { k: c.k, reach: c.reach, on: c.on };
      }),
    };

    O.modal({
      eyebrow: "EARLY ACCESS CAMPAIGN",
      title: "CIELO 002 — early access",
      body: '<div data-region="campaignBody">' + campaignBody() + "</div>",
      actions: [
        { text: "Launch campaign", mod: "is-primary", action: "launchCampaign", arrow: true },
        { text: "Cancel", mod: "is-ghost", action: "closeModal" },
      ],
    });
  };

  O.toggleChannel = function (index) {
    if (!campaignState) return;
    var c = campaignState.channels[parseInt(index, 10)];
    if (!c) return;
    c.on = !c.on;
    NS.app.patch('[data-region="campaignBody"]', campaignBody());
  };

  O.launchCampaign = function () {
    var selected = (campaignState ? campaignState.channels : []).filter(function (c) {
      return c.on;
    });

    if (!selected.length) {
      UI.toast("Select at least one channel");
      return;
    }

    O.process({
      eyebrow: "EARLY ACCESS CAMPAIGN",
      title: "Launching — simulation",
      steps: [
        "Segmenting 2,847 waitlist contacts",
        "Prioritising VIP and returning members",
        "Preparing " + selected.length + " channel" + (selected.length > 1 ? "s" : ""),
        "Scheduling 48-hour early access window",
      ],
      onDone: function () {
        O.modal({
          eyebrow: "SIMULATION COMPLETE",
          title: "Campaign simulated",
          body:
            '<div class="stack stack-md">' +
            '<div class="grid g-3 divided-x">' +
            UI.stat({ label: "CONTACTS", value: D.nextEvent.ready, format: "int", foot: "Waitlist segmented" }) +
            UI.stat({ label: "CHANNELS", raw: String(selected.length), foot: selected.map(function (c) { return c.k; }).join(" · ") }) +
            UI.stat({ label: "WINDOW", raw: "48h", accent: true, foot: "Before public on-sale" }) +
            "</div>" +
            '<hr class="hr">' +
            '<p class="lead">In a live setup, CIELO 002 would open to 2,847 people who already ' +
            "know Cielo, 48 hours before anyone else could buy a ticket.</p>" +
            UI.note(
              "No message was sent. No integration is connected. This screen is the end of the simulation."
            ) +
            "</div>",
          actions: [
            { text: "Run the full simulation", mod: "is-primary", action: "simulate", arrow: true },
            { text: "Close", mod: "is-ghost", action: "closeModal" },
          ],
        });
      },
    });
  };

  /* ======================================================================
     WOW MOMENT — simulation plein écran du lancement de CIELO 002
     ====================================================================== */

  function simStep(step, i, total) {
    var progress = "";
    for (var p = 0; p < total; p++) {
      progress +=
        '<i class="' +
        (p < i ? "is-done" : p === i ? "is-live" : "") +
        '" style="--dur:' +
        (step.duration || 2600) +
        'ms"></i>';
    }

    var stage;
    if (step.number !== undefined) {
      stage =
        '<div class="sim-number' + (step.accent ? " is-accent" : "") + '" data-sim-number="' + step.number + '">0</div>' +
        '<div class="sim-caption">' + UI.esc(step.caption) + "</div>";
    } else {
      stage =
        '<div class="sim-caption">' + UI.esc(step.caption) + "</div>" +
        '<div class="sim-number">' + UI.esc(step.title) + "</div>" +
        '<div class="h1" style="letter-spacing:0.16em;font-size:clamp(16px,2.2vw,26px)">' +
        UI.esc(step.big) +
        "</div>";
    }

    var chips = step.chips
      ? '<div class="sim-chips">' +
        step.chips
          .map(function (c, j) {
            return '<span class="sim-chip' + (j === 0 ? " is-accent" : "") + '" style="--i:' + j + '">' + UI.esc(c) + "</span>";
          })
          .join("") +
        "</div>"
      : "";

    var final = step.final
      ? '<div class="row row-wrap" style="justify-content:center;gap:12px;margin-top:14px">' +
        UI.btn("Open the Cielo loop", { mod: "is-primary", action: "goFromSim", value: "loop", arrow: true }) +
        UI.btn("Back to control center", { mod: "is-ghost", action: "goFromSim", value: "overview" }) +
        "</div>"
      : "";

    return (
      '<div class="sim-top">' +
      '<span class="label label-accent">CIELO OS · NEXT EVENT SIMULATION</span>' +
      '<span class="spacer"></span>' +
      UI.demoChip() +
      '<button class="icon-btn" data-action="closeSim" aria-label="Close">&#215;</button>' +
      "</div>" +

      '<div class="sim-stage"><div class="sim-step" data-sim-step>' +
      stage +
      (step.sub ? '<div class="sim-sub">' + UI.esc(step.sub) + "</div>" : "") +
      chips +
      final +
      "</div></div>" +

      '<div class="sim-bottom">' +
      '<span class="label">' + String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0") + "</span>" +
      '<div class="sim-progress">' + progress + "</div>" +
      (step.final
        ? '<span class="label">END OF SIMULATION</span>'
        : '<button class="btn is-sm is-ghost" data-action="skipSim">Skip</button>') +
      "</div>"
    );
  }

  var simIndex = 0;

  function renderSim() {
    var steps = D.simulation;
    var step = steps[simIndex];
    var h = host();
    h.innerHTML = '<div class="sim">' + simStep(step, simIndex, steps.length) + "</div>";
    document.body.style.overflow = "hidden";

    var numberNode = h.querySelector("[data-sim-number]");
    if (numberNode) {
      UI.animateNumber(
        numberNode,
        parseFloat(numberNode.getAttribute("data-sim-number")),
        "int",
        Math.max(900, (step.duration || 2600) * 0.72)
      );
    }

    if (!step.final) {
      later(function () {
        var current = h.querySelector("[data-sim-step]");
        if (current) current.classList.add("is-out");
        later(function () {
          simIndex++;
          renderSim();
        }, UI.reduced ? 10 : 380);
      }, step.duration || 2600);
    }
  }

  O.simulate = function () {
    bindEsc();
    clearTimers();
    simIndex = 0;
    renderSim();
  };

  O.skipSim = function () {
    clearTimers();
    simIndex = D.simulation.length - 1;
    renderSim();
  };

  NS.overlays = O;
})(window.CIELO);
