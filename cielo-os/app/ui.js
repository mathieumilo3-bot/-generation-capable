/* ==========================================================================
   CIELO OS — Primitives d'interface
   --------------------------------------------------------------------------
   Toutes les vues sont construites à partir de ces composants : ils renvoient
   des chaînes HTML, et `UI.mount()` réveille ensuite le comportement
   (compteurs, jauges, graphiques, apparitions échelonnées).
   ========================================================================== */

window.CIELO = window.CIELO || {};

(function (NS) {
  "use strict";

  var UI = {};

  /* ======================================================================
     Formatage
     ====================================================================== */

  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  var fmt = {
    int: function (n) {
      return group(Math.round(n));
    },
    eur: function (n) {
      return "€" + group(Math.round(n));
    },
    eur1: function (n) {
      return "€" + (Math.round(n * 10) / 10).toFixed(1);
    },
    pct: function (n) {
      return (Math.round(n * 10) / 10).toFixed(n % 1 === 0 ? 0 : 1) + "%";
    },
    compact: function (n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
      if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
      return String(n);
    },
    eurCompact: function (n) {
      return "€" + fmt.compact(n);
    },
    x: function (n) {
      return (Math.round(n * 10) / 10).toFixed(1) + "×";
    },
  };

  UI.fmt = fmt;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  UI.esc = esc;

  /** Encode un objet pour un attribut data-* (guillemets simples en HTML). */
  function enc(obj) {
    return JSON.stringify(obj).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  }
  UI.enc = enc;

  UI.initials = function (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(function (p) {
        return p.charAt(0);
      })
      .join("")
      .toUpperCase();
  };

  /* ======================================================================
     Composants
     ====================================================================== */

  /** Valeur animée. `format` ∈ int | eur | pct | compact | eurCompact */
  UI.counter = function (value, format, opts) {
    opts = opts || {};
    return (
      '<span data-count="' +
      value +
      '" data-format="' +
      (format || "int") +
      '" data-dur="' +
      (opts.duration || 1400) +
      '">' +
      (fmt[format || "int"] ? fmt[format || "int"](0) : "0") +
      "</span>"
    );
  };

  UI.label = function (text, accent) {
    return (
      '<div class="label' + (accent ? " label-accent" : "") + '">' + esc(text) + "</div>"
    );
  };

  UI.pill = function (text, mod) {
    return '<span class="pill ' + (mod || "") + '">' + text + "</span>";
  };

  UI.tag = function (text, mod) {
    return '<span class="tag ' + (mod || "") + '">' + esc(text) + "</span>";
  };

  UI.demoChip = function () {
    return '<span class="pill is-demo" title="All figures in this prototype are fictional demonstration data.">Demo data</span>';
  };

  UI.btn = function (text, opts) {
    opts = opts || {};
    var attrs = "";
    if (opts.action) attrs += ' data-action="' + esc(opts.action) + '"';
    if (opts.value !== undefined) attrs += ' data-value="' + esc(opts.value) + '"';
    if (opts.href) attrs += ' data-href="' + esc(opts.href) + '"';
    if (opts.disabled) attrs += " disabled";
    return (
      '<button class="btn ' +
      (opts.mod || "") +
      '"' +
      attrs +
      ">" +
      esc(text) +
      (opts.arrow
        ? '<span class="btn-arrow" aria-hidden="true">&#8594;</span>'
        : "") +
      "</button>"
    );
  };

  UI.card = function (inner, opts) {
    opts = opts || {};
    return (
      '<div class="card ' +
      (opts.mod || "") +
      '"' +
      (opts.style ? ' style="' + opts.style + '"' : "") +
      ">" +
      inner +
      "</div>"
    );
  };

  UI.cardHead = function (title, right) {
    return (
      '<div class="card-head"><div>' +
      (typeof title === "string"
        ? '<div class="label">' + esc(title) + "</div>"
        : title) +
      "</div>" +
      (right ? "<div>" + right + "</div>" : "") +
      "</div>"
    );
  };

  UI.sectionHead = function (opts) {
    return (
      '<div class="section-head rv">' +
      "<div>" +
      (opts.eyebrow ? '<div class="label">' + esc(opts.eyebrow) + "</div>" : "") +
      '<h2 class="h1">' +
      esc(opts.title) +
      "</h2>" +
      (opts.sub ? '<p class="lead" style="margin-top:14px;max-width:62ch">' + esc(opts.sub) + "</p>" : "") +
      "</div>" +
      (opts.right ? '<div class="row row-wrap">' + opts.right + "</div>" : "") +
      "</div>"
    );
  };

  UI.delta = function (delta) {
    if (!delta) return "";
    var mod = delta.dir === "down" ? " is-down" : delta.dir === "flat" ? " is-flat" : "";
    return '<span class="delta' + mod + '">' + esc(delta.text) + "</span>";
  };

  /** Bloc KPI — le composant le plus réutilisé du produit. */
  UI.kpi = function (k) {
    return UI.card(
      '<div class="kpi">' +
        UI.label(k.label) +
        '<div class="kpi-value' +
        (k.accent ? " is-accent" : "") +
        '">' +
        UI.counter(k.value, k.format) +
        "</div>" +
        '<div class="kpi-foot">' +
        UI.delta(k.delta) +
        (k.delta && k.foot ? '<span class="muted-2">·</span>' : "") +
        (k.foot ? "<span>" + esc(k.foot) + "</span>" : "") +
        "</div>" +
        "</div>",
      { mod: "is-hover rv" }
    );
  };

  /** Statistique compacte (sans carte). */
  UI.stat = function (s) {
    return (
      '<div class="stat-block">' +
      UI.label(s.label) +
      '<div class="v' +
      (s.accent ? " accent" : "") +
      '">' +
      (s.raw ? esc(s.raw) : UI.counter(s.value, s.format)) +
      "</div>" +
      (s.foot ? '<div class="note">' + esc(s.foot) + "</div>" : "") +
      "</div>"
    );
  };

  UI.metricRow = function (m) {
    return (
      '<div class="metric-row">' +
      '<div><div class="k">' +
      esc(m.k) +
      "</div>" +
      (m.d ? '<div class="note" style="margin-top:3px">' + esc(m.d) + "</div>" : "") +
      "</div>" +
      '<div class="v' +
      (m.accent ? " is-accent" : "") +
      '">' +
      esc(m.v) +
      "</div>" +
      "</div>"
    );
  };

  /** Ligne « libellé + jauge + valeur ». `pct` pilote la largeur animée. */
  UI.barRow = function (b) {
    return (
      '<div class="bar-row">' +
      '<div class="k">' +
      esc(b.k) +
      "</div>" +
      '<div class="v">' +
      esc(b.v) +
      "</div>" +
      '<div class="bar"><i data-w="' +
      b.pct +
      '" class="' +
      (b.accent ? "is-accent" : "") +
      '"></i></div>' +
      "</div>"
    );
  };

  UI.flow = function (nodes, opts) {
    opts = opts || {};
    var arrow =
      '<div class="flow-link" aria-hidden="true"><svg viewBox="0 0 22 8" fill="none"><path d="M0 4h19" stroke="currentColor" stroke-width="1"/><path d="M16 1l3 3-3 3" stroke="currentColor" stroke-width="1"/></svg></div>';
    return (
      '<div class="flow" data-flow>' +
      nodes
        .map(function (n, i) {
          return (
            (i ? arrow : "") +
            '<div class="flow-node" data-flow-node="' +
            i +
            '">' +
            '<div class="n">' +
            String(i + 1).padStart(2, "0") +
            "</div>" +
            '<div class="t">' +
            esc(n.t) +
            "</div>" +
            (opts.compact || !n.d ? "" : '<div class="d">' + esc(n.d) + "</div>") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  };

  UI.table = function (cols, rows) {
    return (
      '<div class="table-scroll"><table class="table"><thead><tr>' +
      cols
        .map(function (c) {
          return "<th>" + esc(c) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      rows.join("") +
      "</tbody></table></div>"
    );
  };

  UI.person = function (name, vip) {
    return (
      '<div class="person"><div class="avatar' +
      (vip ? " is-vip" : "") +
      '">' +
      esc(UI.initials(name)) +
      '</div><span class="cell-strong">' +
      esc(name) +
      "</span></div>"
    );
  };

  UI.note = function (text) {
    return '<p class="note">' + esc(text) + "</p>";
  };

  /** Conteneur de graphique déclaratif — voir charts.js. */
  UI.chart = function (type, opts, style) {
    return (
      '<div class="chart" data-chart="' +
      type +
      '" data-opts="' +
      enc(opts || {}) +
      '"' +
      (style ? ' style="' + style + '"' : "") +
      "></div>"
    );
  };

  UI.legend = function (items) {
    return (
      '<div class="chart-legend">' +
      items
        .map(function (i) {
          return (
            '<span class="legend-item"><i class="legend-swatch' +
            (i.dashed ? " is-dashed" : "") +
            '" style="background:' +
            (i.color || "transparent") +
            '"></i>' +
            esc(i.label) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  };

  /** Mention obligatoire : les données sont fictives. */
  UI.disclaimer = function (extra) {
    return (
      '<p class="note" style="margin-top:26px;padding-top:18px;border-top:1px solid var(--line-soft)">' +
      esc(NS.data.brand.disclaimer) +
      (extra ? " " + esc(extra) : "") +
      "</p>"
    );
  };

  /* ======================================================================
     Comportement : compteurs, jauges, apparitions
     ====================================================================== */

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  UI.animateNumber = function (node, target, format, duration) {
    var f = fmt[format] || fmt.int;
    if (reduced) {
      node.textContent = f(target);
      return;
    }
    var start = performance.now();
    var dur = duration || 1400;
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      node.textContent = f(target * easeOutExpo(t));
      if (t < 1) requestAnimationFrame(frame);
      else node.textContent = f(target);
    }
    requestAnimationFrame(frame);
  };

  /**
   * Réveille un fragment fraîchement inséré dans le DOM :
   * compteurs, jauges, graphiques, délais d'apparition.
   */
  UI.mount = function (root) {
    root = root || document;

    // Apparitions échelonnées : index attribué par conteneur.
    var groups = new Map();
    root.querySelectorAll(".rv").forEach(function (node) {
      if (node.style.getPropertyValue("--i")) return;
      var parent = node.parentElement || document.body;
      var i = groups.get(parent) || 0;
      node.style.setProperty("--i", Math.min(i, 12));
      groups.set(parent, i + 1);
    });

    // Compteurs — démarrés quand l'élément entre dans le viewport.
    var counters = root.querySelectorAll("[data-count]");

    // Sans IntersectionObserver, on affiche directement la valeur finale :
    // un chiffre figé à zéro pendant une présentation serait pire que
    // l'absence d'animation.
    if (counters.length && !("IntersectionObserver" in window)) {
      counters.forEach(function (n) {
        var f = fmt[n.getAttribute("data-format")] || fmt.int;
        n.textContent = f(parseFloat(n.getAttribute("data-count")));
      });
      counters = [];
    }

    if (counters.length) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var n = entry.target;
            io.unobserve(n);
            UI.animateNumber(
              n,
              parseFloat(n.getAttribute("data-count")),
              n.getAttribute("data-format"),
              parseInt(n.getAttribute("data-dur"), 10)
            );
          });
        },
        { threshold: 0.2 }
      );
      counters.forEach(function (n) {
        io.observe(n);
      });
    }

    // Jauges.
    root.querySelectorAll("[data-w]").forEach(function (n, i) {
      var w = n.getAttribute("data-w");
      setTimeout(
        function () {
          n.style.width = w + "%";
        },
        reduced ? 0 : 140 + i * 50
      );
    });

    // Graphiques.
    if (NS.charts) NS.charts.mountAll(root);
  };

  /* ======================================================================
     Toast & presse-papier
     ====================================================================== */

  var toastTimer = null;

  UI.toast = function (message) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    clearTimeout(toastTimer);

    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = '<span class="dot-live"></span><span>' + esc(message) + "</span>";
    document.body.appendChild(el);

    toastTimer = setTimeout(function () {
      el.classList.add("is-out");
      setTimeout(function () {
        el.remove();
      }, 320);
    }, 2400);
  };

  UI.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Repli pour file:// et navigateurs anciens.
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      /* silencieux : le prototype affiche quand même le retour visuel */
    }
    ta.remove();
    return Promise.resolve();
  };

  UI.reduced = reduced;

  NS.ui = UI;
})(window.CIELO);
