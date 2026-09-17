/* ==========================================================================
   CIELO OS — Graphiques
   --------------------------------------------------------------------------
   SVG écrit à la main, sans librairie : le rendu doit rester net, sobre et
   identique partout, sans dépendance réseau.

   Usage déclaratif dans les vues :
     <div class="chart" data-chart="area" data-opts='{ ... }'></div>
   ========================================================================== */

window.CIELO = window.CIELO || {};

(function (NS) {
  "use strict";

  var C = {};
  var ACCENT = "#d6a85f";
  var WHITE = "#ffffff";
  var registry = [];
  var uid = 0;

  function fmtBy(name, v) {
    var f = NS.ui.fmt[name];
    return f ? f(v) : NS.ui.fmt.int(v);
  }

  function svgEl(w, h, inner, extra) {
    return (
      '<svg viewBox="0 0 ' +
      w +
      " " +
      h +
      '" width="' +
      w +
      '" height="' +
      h +
      '" role="img" ' +
      (extra || "") +
      ">" +
      inner +
      "</svg>"
    );
  }

  /* ======================================================================
     Aire / courbe — évolution du revenu par événement
     Gère la distinction réalisé (trait plein) / projection (pointillés).
     ====================================================================== */

  function area(el, o, animate) {
    var pts = o.points || [];
    if (pts.length < 2) return;

    var w = Math.max(el.clientWidth || 640, 320);
    var h = o.height || 260;
    var padT = 38;
    var padB = 10;
    var padX = 16;
    var id = "g" + ++uid;

    var values = pts.map(function (p) {
      return p.value;
    });
    var max = Math.max.apply(null, values) * 1.18 || 1;
    var min = o.zeroBased === false ? Math.min.apply(null, values) * 0.72 : 0;

    var X = function (i) {
      return padX + (i * (w - 2 * padX)) / (pts.length - 1);
    };
    var Y = function (v) {
      return padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
    };

    // Index du dernier point réalisé.
    var lastReal = 0;
    pts.forEach(function (p, i) {
      if (!p.projected) lastReal = i;
    });

    function lineOf(from, to) {
      var d = "";
      for (var i = from; i <= to; i++) {
        d += (i === from ? "M" : "L") + X(i).toFixed(1) + " " + Y(pts[i].value).toFixed(1);
      }
      return d;
    }

    function areaOf(from, to) {
      var base = h - padB;
      return (
        lineOf(from, to) +
        "L" + X(to).toFixed(1) + " " + base +
        "L" + X(from).toFixed(1) + " " + base +
        "Z"
      );
    }

    var grid = "";
    for (var g = 0; g <= 3; g++) {
      var gy = padT + (g * (h - padT - padB)) / 3;
      grid +=
        '<line class="grid-line" x1="0" y1="' + gy.toFixed(1) + '" x2="' + w + '" y2="' + gy.toFixed(1) + '"/>';
    }

    var defs =
      "<defs>" +
      '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + ACCENT + '" stop-opacity="0.26"/>' +
      '<stop offset="100%" stop-color="' + ACCENT + '" stop-opacity="0"/>' +
      "</linearGradient>" +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + ACCENT + '" stop-opacity="0.1"/>' +
      '<stop offset="100%" stop-color="' + ACCENT + '" stop-opacity="0"/>' +
      "</linearGradient>" +
      "</defs>";

    var body = defs + grid;

    // Réalisé.
    body +=
      '<path d="' + areaOf(0, lastReal) + '" fill="url(#' + id + 'a)" class="' + (animate ? "fade-area" : "") + '"/>';

    // Projection : même teinte que le réalisé, mais atténuée et en pointillés.
    // (Le gris se lisait comme « pas de données » — or c'est bien la même
    // grandeur, simplement projetée.)
    if (lastReal < pts.length - 1) {
      body +=
        '<path d="' + areaOf(lastReal, pts.length - 1) + '" fill="url(#' + id + 'b)" class="' + (animate ? "fade-area" : "") + '"/>';
      body +=
        '<path d="' + lineOf(lastReal, pts.length - 1) + '" fill="none" stroke="' + ACCENT + '" stroke-opacity="0.5" stroke-width="1.4" stroke-dasharray="5 5" stroke-linecap="round" data-draw/>';

      // Repère vertical : là où le réalisé s'arrête et la projection commence.
      body +=
        '<line x1="' + X(lastReal).toFixed(1) + '" y1="' + padT + '" x2="' + X(lastReal).toFixed(1) + '" y2="' + (h - padB) + '" ' +
        'stroke="rgba(255,255,255,0.14)" stroke-width="1" stroke-dasharray="2 4"/>';
    }

    // Réalisé. Un seul point réalisé ne trace aucune ligne : on marque alors
    // le segment de départ par une base pleine sous le premier point.
    if (lastReal === 0) {
      body +=
        '<line x1="' + padX + '" y1="' + Y(pts[0].value).toFixed(1) + '" x2="' + X(0).toFixed(1) + '" y2="' + Y(pts[0].value).toFixed(1) + '" stroke="' + ACCENT + '" stroke-width="1.75"/>';
    } else {
      body +=
        '<path d="' + lineOf(0, lastReal) + '" fill="none" stroke="' + ACCENT + '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" data-draw/>';
    }

    // Points + valeurs.
    pts.forEach(function (p, i) {
      var cx = X(i);
      var cy = Y(p.value);
      var isProj = p.projected;
      body +=
        '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (isProj ? 3 : 4) + '" ' +
        'fill="' + (isProj ? "#0a0a0a" : ACCENT) + '" stroke="' + (isProj ? "rgba(214,168,95,0.6)" : ACCENT) + '" stroke-width="1.25" ' +
        'class="chart-dot" style="animation-delay:' + (animate ? 900 + i * 110 : 0) + 'ms"/>';

      var anchor = i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle";
      var tx = i === 0 ? cx - 4 : i === pts.length - 1 ? cx + 4 : cx;
      body +=
        '<text x="' + tx.toFixed(1) + '" y="' + (cy - 15).toFixed(1) + '" text-anchor="' + anchor + '" ' +
        'fill="' + (isProj ? "rgba(255,255,255,0.55)" : WHITE) + '" font-size="12" letter-spacing="-0.02em" ' +
        'class="chart-dot" style="animation-delay:' + (animate ? 1000 + i * 110 : 0) + 'ms">' +
        fmtBy(o.format || "eurCompact", p.value) +
        "</text>";
    });

    var axis =
      '<div class="chart-axis">' +
      pts
        .map(function (p, i) {
          return (
            '<span class="' + (i === lastReal ? "is-active" : "") + '">' + NS.ui.esc(p.label) + "</span>"
          );
        })
        .join("") +
      "</div>";

    el.innerHTML = svgEl(w, h, body) + axis;
    if (animate) drawPaths(el);
  }

  /** Anime le tracé des courbes (stroke-dashoffset). */
  function drawPaths(el) {
    if (NS.ui.reduced) return;
    el.querySelectorAll("[data-draw]").forEach(function (p, i) {
      var len = 0;
      try {
        len = p.getTotalLength();
      } catch (e) {
        return;
      }
      p.style.setProperty("--len", len);
      p.classList.add("draw-path");
      p.style.animationDelay = i * 160 + "ms";
    });
  }

  /* ======================================================================
     Donut — segmentation
     ====================================================================== */

  function donut(el, o, animate) {
    var segs = o.segments || [];
    var total = segs.reduce(function (a, s) {
      return a + s.v;
    }, 0);
    if (!total) return;

    var size = Math.min(el.clientWidth || 260, o.size || 260);
    var stroke = o.stroke || 14;
    var gap = o.gap === undefined ? 2.5 : o.gap; // en degrés
    var r = (size - stroke) / 2 - 2;
    var cx = size / 2;
    var cy = size / 2;
    var circ = 2 * Math.PI * r;

    var offset = -90; // départ à midi
    var body = "";

    segs.forEach(function (s, i) {
      var sweep = (s.v / total) * 360;
      var visible = Math.max(sweep - gap, 0.6);
      var len = (visible / 360) * circ;
      var color = s.color || (i === 0 ? WHITE : "rgba(255,255,255,0.3)");
      body +=
        '<circle class="donut-seg" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(2) + '" fill="none" ' +
        'stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="butt" ' +
        'stroke-dasharray="' + len.toFixed(2) + " " + (circ - len).toFixed(2) + '" ' +
        'stroke-dashoffset="0" transform="rotate(' + (offset + gap / 2).toFixed(2) + " " + cx + " " + cy + ')" ' +
        'style="' + (animate && !NS.ui.reduced
          ? "opacity:0;animation:fadeIn 700ms var(--ease) " + (220 + i * 160) + "ms forwards"
          : "") + '">' +
        "<title>" + NS.ui.esc(s.k) + " — " + NS.ui.fmt.int(s.v) + "</title>" +
        "</circle>";
      offset += sweep;
    });

    var center = o.center
      ? '<div class="donut-center">' +
        '<div class="v">' + o.center.value + "</div>" +
        '<div class="label">' + NS.ui.esc(o.center.label) + "</div>" +
        "</div>"
      : "";

    el.classList.add("donut");
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.margin = "0 auto";
    el.style.position = "relative";
    el.innerHTML = svgEl(size, size, body) + center;
  }

  /* ======================================================================
     Colonnes — performance par phase, avec courbe secondaire optionnelle
     ====================================================================== */

  function columns(el, o, animate) {
    var cats = o.categories || [];
    if (!cats.length) return;

    var w = Math.max(el.clientWidth || 560, 300);
    var h = o.height || 230;
    var padT = 30;
    var padB = 8;
    var slot = w / cats.length;
    var barW = Math.min(o.barWidth || 46, slot * 0.46);

    var max = Math.max.apply(
      null,
      cats.map(function (c) {
        return c.value;
      })
    ) * 1.2 || 1;

    var body = "";
    for (var g = 0; g <= 2; g++) {
      var gy = padT + (g * (h - padT - padB)) / 2;
      body += '<line class="grid-line" x1="0" y1="' + gy.toFixed(1) + '" x2="' + w + '" y2="' + gy.toFixed(1) + '"/>';
    }

    var linePts = [];

    cats.forEach(function (c, i) {
      var cx = slot * i + slot / 2;
      var bh = ((c.value / max) * (h - padT - padB));
      var y = h - padB - bh;
      var accent = c.accent;
      body +=
        '<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" ' +
        'fill="' + (accent ? ACCENT : "rgba(255,255,255,0.16)") + '" ' +
        'style="transform-origin:' + cx.toFixed(1) + "px " + (h - padB) + "px;" +
        (animate && !NS.ui.reduced
          ? "transform:scaleY(0);animation:colIn 900ms var(--ease) " + (120 + i * 110) + "ms forwards"
          : "") + '">' +
        "<title>" + NS.ui.esc(c.label) + " — " + NS.ui.esc(c.display || String(c.value)) + "</title>" +
        "</rect>";

      body +=
        '<text x="' + cx.toFixed(1) + '" y="' + (y - 12).toFixed(1) + '" text-anchor="middle" fill="' + (accent ? ACCENT : "rgba(255,255,255,0.75)") + '" font-size="11.5" ' +
        'class="chart-dot" style="animation-delay:' + (animate ? 700 + i * 110 : 0) + 'ms">' +
        NS.ui.esc(c.display || NS.ui.fmt.compact(c.value)) +
        "</text>";

      if (c.secondary !== undefined) linePts.push([cx, c.secondary]);
    });

    // Courbe secondaire (axe propre, échelle indépendante — toujours légendée
    // explicitement dans la vue pour éviter toute lecture trompeuse).
    if (linePts.length > 1) {
      var sMax = Math.max.apply(
        null,
        linePts.map(function (p) {
          return p[1];
        })
      ) * 1.5 || 1;
      var d = linePts
        .map(function (p, i) {
          var yy = padT + (1 - p[1] / sMax) * (h - padT - padB);
          return (i ? "L" : "M") + p[0].toFixed(1) + " " + yy.toFixed(1);
        })
        .join("");
      body +=
        '<path d="' + d + '" fill="none" stroke="' + WHITE + '" stroke-opacity="0.5" stroke-width="1.25" stroke-dasharray="4 4" data-draw/>';
      linePts.forEach(function (p) {
        var yy = padT + (1 - p[1] / sMax) * (h - padT - padB);
        body += '<circle cx="' + p[0].toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="2.5" fill="' + WHITE + '" fill-opacity="0.7"/>';
      });
    }

    var axis =
      '<div class="chart-axis">' +
      cats
        .map(function (c) {
          return "<span>" + NS.ui.esc(c.label) + "</span>";
        })
        .join("") +
      "</div>";

    el.innerHTML = svgEl(w, h, body) + axis;
    if (animate) drawPaths(el);
  }

  /* ======================================================================
     Montage & redimensionnement
     ====================================================================== */

  var renderers = { area: area, donut: donut, columns: columns };

  function render(entry, animate) {
    var fn = renderers[entry.type];
    if (fn && entry.el.isConnected) fn(entry.el, entry.opts, animate);
  }

  C.mountAll = function (root) {
    (root || document).querySelectorAll("[data-chart]").forEach(function (el) {
      if (el.hasAttribute("data-mounted")) return;
      el.setAttribute("data-mounted", "1");
      var opts = {};
      try {
        opts = JSON.parse(el.getAttribute("data-opts") || "{}");
      } catch (e) {
        opts = {};
      }
      var entry = { el: el, type: el.getAttribute("data-chart"), opts: opts };
      registry.push(entry);
      // Laisse le layout se stabiliser pour mesurer la largeur réelle.
      requestAnimationFrame(function () {
        render(entry, true);
      });
    });
  };

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      registry = registry.filter(function (e) {
        return e.el.isConnected;
      });
      registry.forEach(function (e) {
        render(e, false);
      });
    }, 180);
  });

  // Keyframe utilisée par les colonnes (injectée ici pour rester avec le
  // code qui s'en sert).
  var style = document.createElement("style");
  style.textContent = "@keyframes colIn{to{transform:scaleY(1)}}";
  document.head.appendChild(style);

  NS.charts = C;
})(window.CIELO);
