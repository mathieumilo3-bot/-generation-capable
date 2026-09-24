(() => {
  "use strict";

  /* ---------------------------------------------------------------
     Header : ombre au scroll
  --------------------------------------------------------------- */
  const header = document.getElementById("site-header");
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------------------------------------------------------
     Menu mobile
  --------------------------------------------------------------- */
  const navToggle = document.getElementById("nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  const closeMobileNav = () => {
    navToggle.setAttribute("aria-expanded", "false");
    mobileNav.hidden = true;
    document.body.style.overflow = "";
    document.body.classList.remove("nav-open");
  };
  const openMobileNav = () => {
    navToggle.setAttribute("aria-expanded", "true");
    mobileNav.hidden = false;
    document.body.style.overflow = "hidden";
    document.body.classList.add("nav-open");
  };

  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    expanded ? closeMobileNav() : openMobileNav();
  });

  mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMobileNav));

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !mobileNav.hidden) closeMobileNav();
  });

  /* ---------------------------------------------------------------
     Scrollspy — surligne le lien de nav actif
  --------------------------------------------------------------- */
  const navLinks = Array.from(document.querySelectorAll('.main-nav a[href^="#"]'));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if (sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = "#" + entry.target.id;
          const link = navLinks.find((a) => a.getAttribute("href") === id);
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach((a) => a.classList.remove("is-active"));
            link.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------------------------------------------------------------
     Apparition douce au scroll
  --------------------------------------------------------------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((el, i) => {
      el.style.transitionDelay = (i % 4) * 60 + "ms";
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------------------------------------------------------------
     Rail des étapes de construction (scroll-snap + flèches + points)
  --------------------------------------------------------------- */
  const rail = document.getElementById("steps-rail");
  const dotsWrap = document.getElementById("steps-dots");
  const prevBtn = document.getElementById("rail-prev");
  const nextBtn = document.getElementById("rail-next");

  if (rail && dotsWrap) {
    const cards = Array.from(rail.children);
    cards.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Étape " + (i + 1));
      dot.addEventListener("click", () => {
        cards[i].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      });
      dotsWrap.appendChild(dot);
    });
    const dots = Array.from(dotsWrap.children);

    const updateDots = () => {
      const railRect = rail.getBoundingClientRect();
      let closest = 0;
      let closestDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs(card.getBoundingClientRect().left - railRect.left);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      dots.forEach((d, i) => d.classList.toggle("is-active", i === closest));
    };
    updateDots();
    rail.addEventListener("scroll", () => {
      window.requestAnimationFrame(updateDots);
    }, { passive: true });

    const scrollByCard = (dir) => {
      const card = cards[0];
      const gap = 18;
      const amount = (card.getBoundingClientRect().width + gap) * dir;
      rail.scrollBy({ left: amount, behavior: "smooth" });
    };
    prevBtn.addEventListener("click", () => scrollByCard(-1));
    nextBtn.addEventListener("click", () => scrollByCard(1));
  }

  /* ---------------------------------------------------------------
     Formulaire multi-étapes — "Parlez-nous de votre projet"
  --------------------------------------------------------------- */
  const form = document.getElementById("project-form");
  if (!form) return;

  const STEP_COUNT = 5;
  let currentStep = 1;

  const steps = Array.from(form.querySelectorAll(".form-step[data-step]"));
  const getStep = (n) => steps.find((s) => s.dataset.step === String(n));

  const progressFill = document.getElementById("form-progress-fill");
  const progressLabel = document.getElementById("form-progress-label");
  const backBtn = document.getElementById("form-back");
  const nextBtn2 = document.getElementById("form-next");
  const submitBtn = document.getElementById("form-submit");

  const showStep = (target) => {
    steps.forEach((s) => s.classList.remove("is-active"));
    const el = getStep(target);
    if (el) el.classList.add("is-active");

    const isNumeric = typeof target === "number";
    backBtn.hidden = !isNumeric || target === 1;
    nextBtn2.hidden = !isNumeric || target === STEP_COUNT;
    submitBtn.hidden = !isNumeric || target !== STEP_COUNT;

    if (isNumeric) {
      progressFill.style.width = (target / STEP_COUNT) * 100 + "%";
      progressLabel.textContent = "Étape " + target + " sur " + STEP_COUNT;
      progressLabel.closest(".form-progress").hidden = false;
    } else {
      progressLabel.closest(".form-progress").hidden = true;
    }

    if (el) el.querySelector("legend, h3")?.focus?.();
  };

  /* ---- choix (étapes 1 et 3) ---- */
  form.querySelectorAll(".choice-grid").forEach((grid) => {
    const cards = Array.from(grid.querySelectorAll(".choice-card"));
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const field = card.dataset.field;
        cards.forEach((c) => c.setAttribute("aria-checked", "false"));
        card.setAttribute("aria-checked", "true");
        const hidden = document.getElementById("field-" + field);
        if (hidden) hidden.value = card.dataset.value;
        clearStepError(currentStep);
      });
    });
  });

  const clearStepError = (step) => {
    const err = form.querySelector('.form-error[data-error-for="' + step + '"]');
    if (err) err.hidden = true;
  };
  const showStepError = (step, msg) => {
    const err = form.querySelector('.form-error[data-error-for="' + step + '"]');
    if (err) {
      if (msg) err.textContent = msg;
      err.hidden = false;
    }
  };

  const phoneRegex = /^(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateStep = (step) => {
    if (step === 1) {
      const val = document.getElementById("field-projet").value;
      if (!val) { showStepError(1); return false; }
      return true;
    }
    if (step === 2) {
      const input = document.getElementById("field-ville");
      const val = input.value.trim();
      input.closest(".field").classList.toggle("has-error", val.length < 2);
      if (val.length < 2) { showStepError(2); return false; }
      return true;
    }
    if (step === 3) {
      const val = document.getElementById("field-delai").value;
      if (!val) { showStepError(3); return false; }
      return true;
    }
    if (step === 4) {
      return true; // facultatif
    }
    if (step === 5) {
      const prenom = document.getElementById("field-prenom");
      const telephone = document.getElementById("field-telephone");
      const email = document.getElementById("field-email");

      const prenomOk = prenom.value.trim().length >= 2;
      const telOk = phoneRegex.test(telephone.value.trim());
      const emailOk = email.value.trim() === "" || emailRegex.test(email.value.trim());

      prenom.closest(".field").classList.toggle("has-error", !prenomOk);
      telephone.closest(".field").classList.toggle("has-error", !telOk);
      email.closest(".field").classList.toggle("has-error", !emailOk);

      if (!prenomOk || !telOk || !emailOk) {
        showStepError(5, "Merci de vérifier votre prénom et votre numéro de téléphone.");
        return false;
      }
      return true;
    }
    return true;
  };

  nextBtn2.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    clearStepError(currentStep);
    if (currentStep < STEP_COUNT) {
      currentStep += 1;
      showStep(currentStep);
    }
  });

  backBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep -= 1;
      showStep(currentStep);
    }
  });

  const submitToNetlify = () => {
    const data = new FormData(form);
    return fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString(),
    });
  };

  const setSubmitting = (isSubmitting) => {
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? "Envoi en cours…" : "Envoyer ma demande";
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateStep(5)) return;

    setSubmitting(true);
    submitToNetlify()
      .then((res) => {
        setSubmitting(false);
        if (res.ok) {
          showStep("success");
        } else {
          showStep("submit-error");
        }
      })
      .catch(() => {
        setSubmitting(false);
        showStep("submit-error");
      });
  });

  document.getElementById("retry-submit")?.addEventListener("click", () => {
    showStep(currentStep);
  });

  showStep(currentStep);

  /* ---------------------------------------------------------------
     Année courante — pied de page
  --------------------------------------------------------------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
