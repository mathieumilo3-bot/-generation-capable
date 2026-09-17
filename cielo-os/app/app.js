/* ==========================================================================
   CIELO OS — Shell applicatif
   Navigation, routeur, délégation d'événements, écran d'ouverture.
   ========================================================================== */

window.CIELO = window.CIELO || {};

(function (NS) {
  "use strict";

  var UI = NS.ui;
  var D = NS.data;

  var NAV = [
    {
      items: [
        { id: "overview", label: "Overview" },
        { id: "events", label: "Events", badge: "LIVE" },
        { id: "audience", label: "Audience" },
        { id: "access", label: "Cielo Access" },
        { id: "referrals", label: "Referrals" },
        { id: "partners", label: "Partners" },
        { id: "analytics", label: "Analytics" },
      ],
    },
    {
      label: "SYSTEM",
      items: [{ id: "loop", label: "The Cielo Loop" }],
    },
  ];

  /* --- État partagé entre les vues -------------------------------------- */

  NS.state = {
    route: "overview",
    eventIndex: 0,
    audienceFilter: "All",
  };

  var leaveHooks = [];
  var App = {};

  /* ======================================================================
     Shell
     ====================================================================== */

  function sidebar() {
    var groups = NAV.map(function (g) {
      return (
        '<nav class="nav-group">' +
        (g.label ? '<div class="nav-group-label">' + UI.esc(g.label) + "</div>" : "") +
        g.items
          .map(function (it) {
            return (
              '<a class="nav-item" href="#/' +
              it.id +
              '" data-nav="' +
              it.id +
              '">' +
              '<span class="nav-dot"></span>' +
              "<span>" + UI.esc(it.label) + "</span>" +
              (it.badge ? '<span class="nav-badge">' + UI.esc(it.badge) + "</span>" : "") +
              "</a>"
            );
          })
          .join("") +
        "</nav>"
      );
    }).join("");

    return (
      '<aside class="sidebar" id="sidebar">' +
      '<div class="brand" data-action="go" data-value="overview">' +
      '<div class="brand-mark"></div>' +
      '<div class="brand-text">' +
      '<div class="brand-name">CIELO OS</div>' +
      '<div class="brand-sub">' + UI.esc(D.brand.subtitle) + "</div>" +
      "</div>" +
      "</div>" +
      groups +
      '<div class="sidebar-foot">' +
      '<p class="sidebar-note">Concept prototype.<br>All figures are demonstration data.</p>' +
      '<button class="btn is-sm is-ghost" data-action="replayIntro">Replay intro</button>' +
      "</div>" +
      "</aside>"
    );
  }

  function topbar() {
    return (
      '<header class="topbar">' +
      '<button class="menu-toggle" data-action="toggleMenu" aria-label="Menu"><span></span></button>' +
      '<div class="crumbs">' +
      '<span class="crumb is-lead">' + UI.esc(D.current.code.split(" ")[0]) + "</span>" +
      '<span class="crumb-sep"></span>' +
      '<span class="crumb is-hide-sm">' + UI.esc(D.current.city) + "</span>" +
      '<span class="crumb-sep is-hide-sm"></span>' +
      '<span class="crumb is-hide-sm">' + UI.esc(D.current.dateShort) + "</span>" +
      '<span class="crumb-sep"></span>' +
      '<span class="crumb" data-region="crumb"></span>' +
      "</div>" +
      '<div class="topbar-right">' +
      UI.pill(
        '<span class="dot-live"></span>LIVE EVENT · ' + UI.esc(D.current.dateShort.slice(0, 6) + D.current.dateShort.slice(8)),
        "is-live"
      ) +
      UI.btn("Next event simulation", { mod: "is-sm", action: "simulate" }) +
      "</div>" +
      "</header>"
    );
  }

  function shell() {
    return (
      sidebar() +
      '<div class="main">' +
      topbar() +
      '<main class="view-wrap" id="viewWrap"></main>' +
      "</div>"
    );
  }

  /* ======================================================================
     Routeur
     ====================================================================== */

  function routeFromHash() {
    var id = (location.hash || "").replace(/^#\/?/, "").trim();
    return NS.views[id] ? id : "overview";
  }

  function setNavActive(id) {
    document.querySelectorAll("[data-nav]").forEach(function (n) {
      n.classList.toggle("is-active", n.getAttribute("data-nav") === id);
    });
  }

  App.navigate = function (id) {
    if (!NS.views[id]) id = "overview";
    if (location.hash !== "#/" + id) {
      location.hash = "#/" + id;
      return; // hashchange relancera le rendu
    }
    App.render(id);
  };

  App.render = function (id) {
    // Nettoyage des vues précédentes (timers d'animation, etc.).
    leaveHooks.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        /* une vue qui se ferme ne doit jamais casser la navigation */
      }
    });
    leaveHooks = [];

    var view = NS.views[id];
    NS.state.route = id;

    var wrap = document.getElementById("viewWrap");
    wrap.innerHTML = '<div class="view">' + view.render() + "</div>";

    var crumb = document.querySelector('[data-region="crumb"]');
    if (crumb) crumb.textContent = (view.crumbs && view.crumbs[0]) || view.label;

    setNavActive(id);
    UI.mount(wrap);

    if (view.after) view.after(wrap);

    window.scrollTo({ top: 0, behavior: UI.reduced ? "auto" : "smooth" });
    closeMenu();
  };

  App.onLeave = function (fn) {
    leaveHooks.push(fn);
  };

  /**
   * Remplace une région de la page sans re-rendre la vue entière.
   * `outer` remplace l'élément lui-même plutôt que son contenu.
   */
  App.patch = function (selector, html, outer) {
    var node = document.querySelector(selector);
    if (!node) return;

    if (outer) {
      var tmp = document.createElement("div");
      tmp.innerHTML = html;
      var next = tmp.firstElementChild;
      if (!next) return;
      node.replaceWith(next);
      UI.mount(next);
    } else {
      node.innerHTML = html;
      UI.mount(node);
    }
  };

  /* ======================================================================
     Menu mobile
     ====================================================================== */

  function closeMenu() {
    var sb = document.getElementById("sidebar");
    var scrim = document.getElementById("scrim");
    if (sb) sb.classList.remove("is-open");
    if (scrim) scrim.classList.remove("is-open");
  }

  function toggleMenu() {
    var sb = document.getElementById("sidebar");
    var scrim = document.getElementById("scrim");
    if (!sb) return;
    var open = sb.classList.toggle("is-open");
    if (scrim) scrim.classList.toggle("is-open", open);
  }

  /* ======================================================================
     Actions globales
     ====================================================================== */

  var actions = {
    go: function (value) {
      App.navigate(value);
    },

    goFromSim: function (value) {
      NS.overlays.close();
      App.navigate(value);
    },

    simulate: function () {
      NS.overlays.simulate();
    },

    campaign: function () {
      NS.overlays.campaign();
    },

    launchCampaign: function () {
      NS.overlays.launchCampaign();
    },

    toggleChannel: function (value) {
      NS.overlays.toggleChannel(value);
    },

    closeModal: function () {
      NS.overlays.close();
    },

    closeSim: function () {
      NS.overlays.close();
    },

    skipSim: function () {
      NS.overlays.skipSim();
    },

    toggleMenu: toggleMenu,

    replayIntro: function () {
      showBoot(true);
    },
  };

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-action]");
    if (!trigger) return;

    var name = trigger.getAttribute("data-action");
    var value = trigger.getAttribute("data-value");

    // Les actions de la vue courante ont la priorité.
    var view = NS.views[NS.state.route];
    if (view && view.actions && view.actions[name]) {
      e.preventDefault();
      view.actions[name](value, trigger);
      return;
    }

    if (actions[name]) {
      e.preventDefault();
      actions[name](value, trigger);
    }
  });

  /* ======================================================================
     Écran d'ouverture
     ====================================================================== */

  function bootMarkup() {
    return (
      '<div class="boot" id="bootScreen">' +
      '<div class="boot-inner">' +
      '<h1 class="boot-title">CIELO OS</h1>' +
      '<div class="boot-rule"></div>' +
      '<p class="boot-sign">' +
      D.brand.signature.map(UI.esc).join("<br>") +
      "</p>" +
      '<div class="boot-cta">' +
      UI.btn("Enter control center", { mod: "is-primary is-lg", action: "enterOS", arrow: true }) +
      "</div>" +
      '<p class="boot-note">Concept prototype · demonstration data</p>' +
      "</div>" +
      "</div>"
    );
  }

  function showBoot(force) {
    var host = document.getElementById("boot");
    host.innerHTML = bootMarkup();
    document.body.style.overflow = "hidden";

    var screen = document.getElementById("bootScreen");

    function enter() {
      screen.classList.add("is-out");
      document.body.style.overflow = "";
      setTimeout(function () {
        host.innerHTML = "";
      }, 780);
    }

    screen.addEventListener("click", function (e) {
      if (e.target.closest('[data-action="enterOS"]')) {
        e.preventDefault();
        enter();
      }
    });

    // Entrée au clavier — pratique en présentation.
    function onKey(e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        enter();
        document.removeEventListener("keydown", onKey);
      }
    }
    document.addEventListener("keydown", onKey);

    if (!force) {
      try {
        sessionStorage.setItem("cielo-os-booted", "1");
      } catch (err) {
        /* mode privé : on réaffichera l'intro, sans conséquence */
      }
    }
  }

  /* ======================================================================
     Démarrage
     ====================================================================== */

  function start() {
    var app = document.getElementById("app");
    app.innerHTML = shell() + '<div class="scrim" id="scrim" data-action="toggleMenu"></div>';

    App.render(routeFromHash());
    requestAnimationFrame(function () {
      app.classList.add("is-ready");
    });

    window.addEventListener("hashchange", function () {
      App.render(routeFromHash());
    });

    var booted = false;
    try {
      booted = sessionStorage.getItem("cielo-os-booted") === "1";
    } catch (e) {
      booted = false;
    }
    if (!booted) showBoot(false);
  }

  NS.app = App;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window.CIELO);
