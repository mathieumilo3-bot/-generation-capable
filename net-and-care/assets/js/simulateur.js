/* ===========================================================================
   Net & Care — simulateur de devis.
   ---------------------------------------------------------------------------
   C'est la pièce qui fait vivre le site : tout le reste de la page n'existe
   que pour amener le visiteur jusqu'ici. Trois règles ont guidé le code.

   1. NE JAMAIS PERDRE UNE DEMANDE.
      Si l'envoi échoue (réseau coupé dans un ascenseur, fonction
      indisponible), on n'affiche pas un simple message d'erreur : on propose
      immédiatement WhatsApp et le téléphone, message pré-rempli avec tout ce
      que le visiteur a déjà saisi. Le prospect ne repart jamais les mains
      vides.

   2. NE JAMAIS BLOQUER LE PARCOURS.
      Les photos sont facultatives, l'email est facultatif, l'estimation est
      facultative (prestation « autre »). Le seul obstacle réellement
      obligatoire est le couple nom + téléphone : c'est la seule chose dont
      Net & Care a besoin pour rappeler.

   3. TOUT CE QUI EST SAISI EST TRANSMIS.
      Le récapitulatif envoyé au serveur est construit à partir du même objet
      que celui affiché à l'écran : ce que le prospect a vu est exactement ce
      que l'entreprise reçoit.
   =========================================================================== */

(function () {
  'use strict';

  var CFG = window.NETCARE || {};
  var STORAGE_KEY = 'netcare.devis.v1';
  var MAX_PHOTOS = 4;
  var MAX_PHOTO_BYTES = 480 * 1024;   // par photo, après compression
  var MAX_TOTAL_BYTES = 3.2 * 1024 * 1024; // marge sous la limite d'une fonction Netlify

  /* ---------------------------------------------------------------- outils */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function num(v, fallback) { var n = parseFloat(v); return isFinite(n) ? n : (fallback || 0); }

  function euro(v) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  }

  function roundTo(v, step) { return Math.round(v / step) * step; }

  // Événement pour Google Analytics 4 / Meta via dataLayer. Aucun outil n'est
  // chargé par le site lui-même : si le client branche GTM plus tard, les
  // événements sont déjà là (voir README, section « Indicateurs »).
  function track(name, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  function reference() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return 'NC-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      String(Math.floor(Math.random() * 9000) + 1000);
  }

  /* --------------------------------------------------------- libellés ---- */

  var PRESTATIONS = {
    canape: 'Canapé / fauteuils',
    matelas: 'Matelas',
    tapis: 'Tapis',
    moquette: 'Moquette',
    chantier: 'Nettoyage fin de chantier',
    autre: 'Autre textile'
  };

  var ETATS = {
    leger: 'Entretien léger',
    normal: 'Usage courant',
    important: 'Très encrassé',
    taches: 'Taches spécifiques'
  };

  var OPTIONS = {
    acariens: 'Traitement anti-acariens',
    impermeabilisation: 'Imperméabilisation',
    urgence: 'Intervention urgente'
  };

  /* ------------------------------------------------------------ estimation */

  // Renvoie { bas, haut, detail } ou null quand aucune estimation sérieuse
  // n'est possible (prestation « autre »). Afficher un prix au hasard serait
  // pire que de ne rien afficher : le devis final paraîtrait gonflé.
  function estimate(s) {
    var T = CFG.tarifs;
    if (!T || s.prestation === 'autre' || !s.prestation) return null;

    var P = T.prestations;
    var base = 0;
    var detail = [];

    if (s.prestation === 'canape') {
      var places = Math.max(1, num(s.places, 3));
      base = P.canape.base + P.canape.parPlace * places;
      detail.push(places + ' place' + (places > 1 ? 's' : ''));
      if (s.fauteuils > 0) { base += s.fauteuils * P.fauteuil.parUnite; detail.push(s.fauteuils + ' fauteuil' + (s.fauteuils > 1 ? 's' : '')); }
      if (s.chaises > 0) { base += s.chaises * P.chaise.parUnite; detail.push(s.chaises + ' chaise' + (s.chaises > 1 ? 's' : '')); }
      base = Math.max(base, P.canape.min);

    } else if (s.prestation === 'matelas') {
      var q = Math.max(1, num(s.matelas_quantite, 1));
      var coef = num(s.matelas_places, 1);
      base = Math.max(P.matelas.base + P.matelas.parPlace * coef, P.matelas.min) * q;
      detail.push(q + ' matelas ' + (s.matelas_taille || ''));

    } else if (s.prestation === 'tapis') {
      var surface = Math.max(0.5, num(s.tapis_longueur, 2) * num(s.tapis_largeur, 1.5));
      var qt = Math.max(1, num(s.tapis_quantite, 1));
      base = Math.max(surface * P.tapis.parM2, P.tapis.min) * qt;
      detail.push(qt + ' tapis · ' + surface.toFixed(1).replace('.0', '') + ' m² pièce');

    } else if (s.prestation === 'moquette') {
      var m2 = Math.max(1, num(s.moquette_surface, 20));
      base = Math.max(m2 * P.moquette.parM2, P.moquette.min);
      detail.push(m2 + ' m²');

    } else if (s.prestation === 'chantier') {
      var sc = Math.max(10, num(s.chantier_surface, 60));
      base = Math.max(sc * P.chantier.parM2, P.chantier.min);
      detail.push(sc + ' m²');
    }

    base *= (T.etat[s.etat] || 1);

    (s.options || []).forEach(function (o) { base += num(T.options[o], 0); });

    if (s.ville && (CFG.zones.zone2 || []).indexOf(s.ville) !== -1) {
      base += num(T.deplacementZone2, 0);
    }

    var amp = num(T.amplitude, 0.12);
    var step = num(T.arrondi, 5);
    var bas = Math.max(step, roundTo(base * (1 - amp), step));
    var haut = roundTo(base * (1 + amp), step);
    if (haut <= bas) haut = bas + step;

    return { bas: bas, haut: haut, detail: detail.join(' · ') };
  }

  /* -------------------------------------------------------- initialisation */

  function initSim(root) {
    var form = $('[data-sim-form]', root);
    if (!form) return;

    var steps = $$('.sim__step', root);
    var TOTAL = steps.length - 1;          // la dernière « étape » est la confirmation
    var bar = $('[data-sim-bar]', root);
    var elCurrent = $('[data-sim-current]', root);
    var elTotal = $('[data-sim-total]', root);
    var elName = $('[data-sim-stepname]', root);
    var btnNext = $('[data-sim-next]', root);
    var btnNextLabel = $('[data-sim-next-label]', root);
    var btnBack = $('[data-sim-back]', root);
    var nav = $('[data-sim-nav]', root);
    var errorBox = $('[data-sim-error]', root);
    var errorText = $('[data-sim-error-text]', root);

    var current = 1;
    var photos = [];          // { name, dataUrl, bytes }
    var started = false;
    var ref = reference();

    if (elTotal) elTotal.textContent = TOTAL;

    /* --- remplissage des villes (source unique : site.config.json) ------- */
    var selVille = $('[data-villes]', root);
    if (selVille && !selVille.options.length) {
      var opt = document.createElement('option');
      opt.value = ''; opt.textContent = 'Choisir une ville…';
      selVille.appendChild(opt);
      (CFG.zones.communes || []).forEach(function (v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        selVille.appendChild(o);
      });
      var autre = document.createElement('option');
      autre.value = '__autre'; autre.textContent = 'Une autre commune…';
      selVille.appendChild(autre);
    }

    /* --- prix des options affichés depuis la config ---------------------- */
    $$('[data-option-price]', root).forEach(function (el) {
      var key = el.getAttribute('data-option-price');
      var v = CFG.tarifs && CFG.tarifs.options ? CFG.tarifs.options[key] : null;
      if (v) el.textContent = '+ ' + euro(v);
    });

    /* --------------------------------------------------- lecture de l'état */

    function readState() {
      var fd = new FormData(form);
      var s = {
        prestation: fd.get('prestation') || '',
        etat: fd.get('etat') || 'normal',
        options: fd.getAll('option'),
        ville: fd.get('ville') === '__autre' ? (fd.get('ville_autre') || '').trim() : (fd.get('ville') || ''),
        villeHorsZone: fd.get('ville') === '__autre',
        delai: fd.get('delai') || '',
        nom: (fd.get('nom') || '').trim(),
        telephone: (fd.get('telephone') || '').trim(),
        email: (fd.get('email') || '').trim(),
        message: (fd.get('message') || '').trim(),
        piege: (fd.get('societe_site') || '').trim(),

        canape_type: fd.get('canape_type') || '',
        places: num(fd.get('places'), 3),
        fauteuils: num(fd.get('fauteuils'), 0),
        chaises: num(fd.get('chaises'), 0),

        matelas_taille: fd.get('matelas_taille') || '',
        matelas_quantite: num(fd.get('matelas_quantite'), 1),

        tapis_longueur: num(fd.get('tapis_longueur'), 2),
        tapis_largeur: num(fd.get('tapis_largeur'), 1.5),
        tapis_quantite: num(fd.get('tapis_quantite'), 1),
        tapis_matiere: fd.get('tapis_matiere') || '',

        moquette_surface: num(fd.get('moquette_surface'), 20),
        moquette_type: fd.get('moquette_type') || '',

        chantier_surface: num(fd.get('chantier_surface'), 60),
        chantier_type: fd.get('chantier_type') || '',

        autre_description: (fd.get('autre_description') || '').trim()
      };
      var checkedTaille = $('input[name="matelas_taille"]:checked', root);
      s.matelas_places = checkedTaille ? num(checkedTaille.getAttribute('data-places'), 1) : 1;
      return s;
    }

    /* ------------------------------------------------ description lisible */

    function describe(s) {
      if (s.prestation === 'canape') {
        var t = [s.canape_type || 'Canapé', s.places + ' place' + (s.places > 1 ? 's' : '')];
        if (s.fauteuils > 0) t.push(s.fauteuils + ' fauteuil' + (s.fauteuils > 1 ? 's' : ''));
        if (s.chaises > 0) t.push(s.chaises + ' chaise' + (s.chaises > 1 ? 's' : ''));
        return t.join(', ');
      }
      if (s.prestation === 'matelas') {
        return s.matelas_quantite + ' matelas ' + s.matelas_taille;
      }
      if (s.prestation === 'tapis') {
        var surf = (s.tapis_longueur * s.tapis_largeur).toFixed(1).replace('.0', '');
        return s.tapis_quantite + ' tapis de ' + s.tapis_longueur + ' × ' + s.tapis_largeur + ' m (' + surf + ' m²)' +
          (s.tapis_matiere ? ' — ' + s.tapis_matiere : '');
      }
      if (s.prestation === 'moquette') return (s.moquette_type || 'Moquette') + ' — ' + s.moquette_surface + ' m²';
      if (s.prestation === 'chantier') return (s.chantier_type || 'Bien') + ' — ' + s.chantier_surface + ' m²';
      if (s.prestation === 'autre') return s.autre_description || 'À préciser';
      return '';
    }

    /* ------------------------------------------------------ récapitulatif */

    function recapLines(s, est) {
      var lines = [
        { k: 'Prestation', v: PRESTATIONS[s.prestation] || '—' },
        { k: 'Détail', v: describe(s) },
        { k: 'État', v: ETATS[s.etat] || '—' }
      ];
      if (s.options.length) {
        lines.push({ k: 'Options', v: s.options.map(function (o) { return OPTIONS[o] || o; }).join(', ') });
      }
      lines.push({ k: 'Ville', v: s.ville + (s.villeHorsZone ? ' (hors zone habituelle)' : '') });
      if (s.delai) lines.push({ k: 'Délai souhaité', v: s.delai });
      if (photos.length) lines.push({ k: 'Photos jointes', v: String(photos.length) });
      lines.push({
        k: 'Estimation indicative',
        v: est ? euro(est.bas) + ' – ' + euro(est.haut) : 'Sur devis'
      });
      return lines;
    }

    function paintRecap(s, est) {
      var ul = $('[data-recap]', root);
      if (!ul) return;
      ul.innerHTML = '';
      recapLines(s, est).forEach(function (l) {
        var li = document.createElement('li');
        var sp = document.createElement('span'); sp.textContent = l.k;
        var st = document.createElement('strong'); st.textContent = l.v;
        li.appendChild(sp); li.appendChild(st);
        ul.appendChild(li);
      });
    }

    function paintEstimate(s) {
      var est = estimate(s);
      var val = $('[data-estimate-value]', root);
      var unit = $('[data-estimate-unit]', root);
      if (val) {
        if (est) {
          val.textContent = euro(est.bas) + ' – ' + euro(est.haut);
          if (unit) {
            unit.textContent = 'TTC · déplacement inclus' +
              (s.villeHorsZone ? ' (hors zone : à confirmer)' : '');
          }
        } else {
          val.textContent = 'Sur devis';
          if (unit) unit.textContent = 'Votre demande mérite une réponse sur mesure — Net & Care revient vers vous avec un prix ferme.';
        }
      }
      paintRecap(s, est);
      return est;
    }

    /* ------------------------------------------------------- message WhatsApp */

    function whatsappUrl(s, est) {
      var L = ['Bonjour Net & Care, je souhaite un devis.', ''];
      recapLines(s, est).forEach(function (l) { L.push('• ' + l.k + ' : ' + l.v); });
      L.push('');
      L.push('• Nom : ' + (s.nom || '—'));
      L.push('• Téléphone : ' + (s.telephone || '—'));
      if (s.email) L.push('• Email : ' + s.email);
      if (s.message) L.push('• Précisions : ' + s.message);
      if (photos.length) L.push('', 'Je vous envoie ' + photos.length + ' photo' + (photos.length > 1 ? 's' : '') + ' ici.');
      L.push('', 'Réf. ' + ref);
      return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(L.join('\n'));
    }

    /* --------------------------------------------- raccourci WhatsApp ---- */

    // Message construit avec ce que le visiteur a RÉELLEMENT renseigné à
    // l'instant où il clique. Rien n'est deviné : tant qu'une étape n'a pas
    // été franchie, sa valeur par défaut (« usage courant », « dans la
    // semaine ») n'est pas envoyée comme si elle avait été choisie.
    function whatsappExpress() {
      var s = readState();
      var est = current >= 5 ? estimate(s) : null;
      var faits = [];

      if (s.prestation) {
        faits.push('Prestation : ' + (PRESTATIONS[s.prestation] || s.prestation));
        if (current > 2) {
          var d = describe(s);
          if (d) faits.push('Détail : ' + d);
          if (s.prestation !== 'autre') faits.push('État : ' + (ETATS[s.etat] || ''));
          if (s.options.length) {
            faits.push('Options : ' + s.options.map(function (o) { return OPTIONS[o] || o; }).join(', '));
          }
        }
      }
      if (s.ville) faits.push('Ville : ' + s.ville);
      if (current > 3 && s.delai) faits.push('Délai souhaité : ' + s.delai);
      if (est) faits.push('Estimation vue sur le site : ' + euro(est.bas) + ' – ' + euro(est.haut));
      if (s.nom) faits.push('Nom : ' + s.nom);

      var L = ['Bonjour Net & Care, je souhaite un devis.'];
      if (faits.length) {
        L.push('');
        faits.forEach(function (f) { L.push('• ' + f); });
      }
      L.push('', 'Je peux vous envoyer des photos ici.');
      return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(L.join('\n'));
    }

    var btnExpress = $('[data-sim-wa-express]', root);
    var blocExpress = $('[data-sim-express]', root);

    function syncExpress() {
      if (btnExpress) btnExpress.href = whatsappExpress();
    }

    if (btnExpress) {
      btnExpress.addEventListener('click', function () {
        track('devis_whatsapp_direct', { etape: current, prestation: readState().prestation || null });
      });
    }

    /* ---------------------------------------------------------- validation */

    function showError(key, on) {
      var el = $('[data-error="' + key + '"]', root);
      if (el) el.classList.toggle('is-on', !!on);
      var input = form.querySelector('[name="' + key + '"]');
      if (input && input.setAttribute) input.setAttribute('aria-invalid', on ? 'true' : 'false');
    }

    function validateStep(n) {
      var s = readState();
      var ok = true;

      if (n === 1) {
        ok = !!s.prestation;
        showError('prestation', !ok);
      }

      if (n === 3) {
        var villeOk = !!s.ville;
        showError('ville', !villeOk);
        ok = villeOk;
      }

      if (n === 6) {
        var nomOk = s.nom.length >= 2;
        // Numéro français ou international, espaces et séparateurs tolérés :
        // refuser une saisie « 06 12 34 56 78 » parce qu'elle contient des
        // espaces ferait perdre des demandes pour rien.
        var digits = s.telephone.replace(/[^0-9+]/g, '');
        var telOk = digits.replace(/\D/g, '').length >= 9;
        var mailOk = !s.email || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s.email);
        var consentOk = !!form.querySelector('[name="consentement"]').checked;
        showError('nom', !nomOk);
        showError('telephone', !telOk);
        showError('email', !mailOk);
        showError('consentement', !consentOk);
        ok = nomOk && telOk && mailOk && consentOk;
      }

      if (!ok) {
        var firstErr = $('.field__error.is-on', steps[n - 1]);
        if (firstErr) firstErr.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return ok;
    }

    /* -------------------------------------------------------- navigation */

    function stepLabel(n) {
      if (n === TOTAL) return 'Recevoir mon devis personnalisé';
      if (n === TOTAL - 1) return 'Recevoir mon devis personnalisé';
      if (n === 1) return 'Continuer';
      return 'Continuer';
    }

    function show(n) {
      current = n;
      steps.forEach(function (st) {
        st.classList.toggle('is-active', num(st.getAttribute('data-step')) === n);
      });

      var isDone = n > TOTAL;
      if (nav) nav.hidden = isDone;
      // À la confirmation, le raccourci ferait doublon avec le bouton
      // WhatsApp de l'écran final.
      if (blocExpress) blocExpress.hidden = isDone;
      if (bar) bar.style.width = Math.min(100, ((isDone ? TOTAL : n) / TOTAL) * 100) + '%';
      if (elCurrent) elCurrent.textContent = isDone ? TOTAL : n;
      if (elName) {
        var act = steps.filter(function (st) { return num(st.getAttribute('data-step')) === n; })[0];
        elName.textContent = act ? act.getAttribute('data-step-name') : '';
      }
      if (btnBack) btnBack.hidden = n <= 1 || isDone;
      if (btnNextLabel) btnNextLabel.textContent = stepLabel(n);

      if (n === 5) paintEstimate(readState());
      syncExpress();

      // Ne pas remonter la page au premier affichage : le simulateur est déjà
      // au bon endroit, et un scroll automatique au chargement est désagréable.
      if (started) {
        var top = root.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
      started = true;
      save();
    }

    function syncDetails() {
      var s = readState();
      $$('[data-details]', root).forEach(function (el) {
        el.hidden = el.getAttribute('data-details') !== s.prestation;
      });
      // « Autre » : ni état ni options ne changent le prix puisqu'il n'y a pas
      // d'estimation — on n'encombre pas l'écran avec des questions inutiles.
      var etatBlock = $('[data-etat-block]', root);
      var optBlock = $('[data-options-block]', root);
      if (etatBlock) etatBlock.hidden = s.prestation === 'autre';
      if (optBlock) optBlock.hidden = s.prestation === 'autre' || s.prestation === 'chantier';

      var title = $('[data-details-title]', root);
      if (title && s.prestation) {
        title.textContent = ({
          canape: 'Votre canapé',
          matelas: 'Votre matelas',
          tapis: 'Votre tapis',
          moquette: 'Votre moquette',
          chantier: 'Votre chantier',
          autre: 'Votre demande'
        })[s.prestation] || 'Votre textile';
      }

      var surf = $('[data-surface="tapis"] strong', root);
      if (surf) surf.textContent = (s.tapis_longueur * s.tapis_largeur).toFixed(1).replace('.0', '') + ' m²';
    }

    /* ------------------------------------------------------ persistance */

    // Un visiteur interrompu (appel entrant, changement d'application) doit
    // retrouver ses réponses. Les photos ne sont PAS stockées : trop
    // volumineuses pour localStorage, et inutiles à conserver.
    function save() {
      try {
        var s = readState();
        delete s.piege;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ t: Date.now(), step: current, state: s }));
      } catch (e) { /* mode privé, quota plein : sans importance */ }
    }

    function restore() {
      var raw;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
      if (!raw) return;
      var data;
      try { data = JSON.parse(raw); } catch (e) { return; }
      // Au-delà de 24 h, la demande n'est probablement plus d'actualité.
      if (!data || !data.state || Date.now() - data.t > 864e5) return;

      var s = data.state;
      Object.keys(s).forEach(function (k) {
        var val = s[k];
        if (k === 'options') {
          $$('[name="option"]', form).forEach(function (cb) { cb.checked = val.indexOf(cb.value) !== -1; });
          return;
        }
        var field = form.querySelector('[name="' + k + '"]');
        if (!field) return;
        if (field.type === 'radio') {
          var r = form.querySelector('[name="' + k + '"][value="' + String(val).replace(/"/g, '\\"') + '"]');
          if (r) r.checked = true;
        } else if (field.type !== 'checkbox' && field.type !== 'file') {
          if (val !== '' && val !== null && val !== undefined) field.value = val;
        }
      });
      if (s.villeHorsZone) {
        var sel = $('[data-villes]', root);
        if (sel) sel.value = '__autre';
        var f = form.querySelector('[name="ville_autre"]');
        if (f) f.value = s.ville;
      }
    }

    /* ----------------------------------------------------------- photos */

    function humanSize(b) {
      return b < 1024 * 1024
        ? Math.max(1, Math.round(b / 1024)) + ' Ko'
        : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
    }

    function setPhotoStatus(msg, warn) {
      var el = $('[data-photo-status]', root);
      if (!el) return;
      el.textContent = msg || '';
      el.style.color = warn ? 'var(--warn)' : '';
    }

    // Compression côté navigateur : une photo de téléphone pèse 3 à 8 Mo et
    // ne passerait ni dans une requête de fonction Netlify ni dans un email.
    // 1400 px de large suffisent largement à juger d'une tache.
    function compress(file) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          try {
            var max = 1400;
            var ratio = Math.min(1, max / Math.max(img.width, img.height));
            var w = Math.round(img.width * ratio);
            var h = Math.round(img.height * ratio);
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            var q = 0.78, out = canvas.toDataURL('image/jpeg', q);
            while (out.length * 0.75 > MAX_PHOTO_BYTES && q > 0.35) {
              q -= 0.12;
              out = canvas.toDataURL('image/jpeg', q);
            }
            URL.revokeObjectURL(url);
            resolve({ name: file.name || 'photo.jpg', dataUrl: out, bytes: Math.round(out.length * 0.75) });
          } catch (e) { URL.revokeObjectURL(url); reject(e); }
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('IMAGE_ILLISIBLE')); };
        img.src = url;
      });
    }

    function paintThumbs() {
      var wrap = $('[data-thumbs]', root);
      if (!wrap) return;
      wrap.innerHTML = '';
      wrap.hidden = photos.length === 0;
      photos.forEach(function (p, i) {
        var d = document.createElement('div');
        d.className = 'thumb';
        var im = document.createElement('img');
        im.src = p.dataUrl; im.alt = 'Photo ' + (i + 1);
        var b = document.createElement('button');
        b.type = 'button'; b.innerHTML = '&times;';
        b.setAttribute('aria-label', 'Retirer la photo ' + (i + 1));
        b.addEventListener('click', function () {
          photos.splice(i, 1); paintThumbs(); setPhotoStatus('');
        });
        d.appendChild(im); d.appendChild(b);
        wrap.appendChild(d);
      });
    }

    var input = $('[data-photos]', root);
    if (input) {
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        if (!files.length) return;
        setPhotoStatus('Compression en cours…');

        var queue = files.slice(0, MAX_PHOTOS - photos.length);
        Promise.all(queue.map(function (f) {
          return compress(f).catch(function () { return null; });
        })).then(function (results) {
          var rejected = 0;
          results.forEach(function (r) {
            if (!r) { rejected++; return; }
            var total = photos.reduce(function (a, p) { return a + p.bytes; }, 0);
            if (total + r.bytes > MAX_TOTAL_BYTES) { rejected++; return; }
            photos.push(r);
          });
          paintThumbs();
          input.value = '';
          var total = photos.reduce(function (a, p) { return a + p.bytes; }, 0);
          if (rejected) {
            setPhotoStatus(rejected + ' photo(s) non ajoutée(s) — limite de ' + MAX_PHOTOS + ' photos ou de poids atteinte.', true);
          } else if (photos.length) {
            setPhotoStatus(photos.length + ' photo' + (photos.length > 1 ? 's' : '') + ' prête' + (photos.length > 1 ? 's' : '') + ' (' + humanSize(total) + ').');
            track('devis_photo_ajoutee', { photos: photos.length });
          }
        });
      });

      var drop = $('[data-drop]', root);
      if (drop) {
        ['dragenter', 'dragover'].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
        });
        drop.addEventListener('drop', function (e) {
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            input.files = e.dataTransfer.files;
            input.dispatchEvent(new Event('change'));
          }
        });
      }
    }

    /* ------------------------------------------------------------- envoi */

    function submit() {
      var s = readState();
      var est = estimate(s);

      // Piège à robots rempli : on fait comme si tout allait bien, sans rien
      // envoyer. Un script ne doit pas apprendre qu'il a été filtré.
      if (s.piege) { show(TOTAL + 1); return; }

      btnNext.disabled = true;
      var oldLabel = btnNextLabel.textContent;
      btnNextLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Envoi…';
      errorBox.classList.remove('is-on');

      // Le champ piège a joué son rôle au-dessus : il n'a rien à faire dans
      // les données transmises ni archivées.
      var reponses = Object.assign({}, s);
      delete reponses.piege;

      var payload = {
        reference: ref,
        prestation: s.prestation,
        prestation_label: PRESTATIONS[s.prestation] || s.prestation,
        detail: describe(s),
        etat: s.etat,
        etat_label: ETATS[s.etat] || '',
        options: s.options.map(function (o) { return OPTIONS[o] || o; }),
        ville: s.ville,
        hors_zone: s.villeHorsZone,
        delai: s.delai,
        estimation_basse: est ? est.bas : null,
        estimation_haute: est ? est.haut : null,
        nom: s.nom,
        telephone: s.telephone,
        email: s.email,
        message: s.message,
        recap: recapLines(s, est).map(function (l) { return l.k + ' : ' + l.v; }),
        reponses: reponses,
        photos: photos.map(function (p) { return { name: p.name, data: p.dataUrl }; }),
        page: location.pathname,
        source: document.referrer || 'direct'
      };

      var waHref = whatsappUrl(s, est);
      var waBtn = $('[data-wa-send]', root);
      if (waBtn) waBtn.href = waHref;

      var done = function (ok, message) {
        btnNext.disabled = false;
        btnNextLabel.textContent = oldLabel;
        if (ok) {
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          var txt = $('[data-done-text]', root);
          if (txt && message) txt.textContent = message;
          show(TOTAL + 1);
          track('devis_envoye', {
            prestation: s.prestation, ville: s.ville,
            estimation_basse: est ? est.bas : null,
            estimation_haute: est ? est.haut : null,
            photos: photos.length, reference: ref
          });
        } else {
          // Échec d'envoi : la demande ne doit pas mourir ici. On bascule le
          // visiteur sur WhatsApp, message déjà écrit.
          errorText.innerHTML = 'L\'envoi automatique n\'a pas abouti. Votre demande est prête : ' +
            '<a href="' + waHref + '" target="_blank" rel="noopener"><strong>l\'envoyer sur WhatsApp</strong></a> ' +
            'ou appeler le <a href="tel:' + CFG.tel + '"><strong>' + CFG.telAffichage + '</strong></a>.';
          errorBox.classList.add('is-on');
          errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
          track('devis_echec_envoi', { prestation: s.prestation });
        }
      };

      var timeout = setTimeout(function () { done(false); }, 25000);

      fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        clearTimeout(timeout);
        if (!r.ok) throw new Error('HTTP_' + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function (data) {
        done(true, data && data.message);
      }).catch(function () {
        clearTimeout(timeout);
        done(false);
      });
    }

    /* ---------------------------------------------------------- écouteurs */

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(current)) return;

      if (current === 1 && !started) track('devis_commence', {});
      if (current === TOTAL) { submit(); return; }

      track('devis_etape', { etape: current, prestation: readState().prestation });
      show(current + 1);
    });

    if (btnBack) {
      btnBack.addEventListener('click', function () { if (current > 1) show(current - 1); });
    }

    form.addEventListener('change', function (e) {
      if (e.target.name === 'prestation') {
        syncDetails();
        track('devis_prestation', { prestation: e.target.value });
      }
      if (e.target.name === 'ville') {
        var box = $('[data-ville-autre]', root);
        if (box) box.hidden = e.target.value !== '__autre';
      }
      if (e.target.name && e.target.name.indexOf('tapis_') === 0) syncDetails();
      syncExpress();
      save();
    });

    form.addEventListener('input', function (e) {
      if (e.target.name && e.target.name.indexOf('tapis_') === 0) syncDetails();
    });

    // Compteurs + / −
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-step-btn]') : null;
      if (!btn) return;
      var target = document.getElementById(btn.getAttribute('data-target'));
      if (!target) return;
      var delta = num(btn.getAttribute('data-step-btn'), 1);
      var min = num(target.getAttribute('min'), 0);
      var max = num(target.getAttribute('max'), 9999);
      target.value = Math.min(max, Math.max(min, num(target.value, 0) + delta));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    });

    /* -------------------------------------------------------- démarrage */

    restore();

    // Préselection : soit la page l'impose (page locale « nettoyage canapé »),
    // soit elle vient de l'URL (?prestation=matelas depuis une publicité).
    var params = new URLSearchParams(location.search);
    var pre = params.get('prestation') || root.getAttribute('data-preselect');
    if (pre && PRESTATIONS[pre]) {
      var r = form.querySelector('[name="prestation"][value="' + pre + '"]');
      if (r) r.checked = true;
    }
    var villeParam = params.get('ville');
    if (villeParam && selVille) {
      var match = (CFG.zones.communes || []).filter(function (v) {
        return v.toLowerCase() === villeParam.toLowerCase();
      })[0];
      if (match) selVille.value = match;
    }

    syncDetails();
    show(1);
    started = false;   // le premier show() ne doit pas faire défiler la page
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('[data-sim]').forEach(initSim);
  });
})();
