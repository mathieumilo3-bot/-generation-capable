/* ==========================================================
   Dr Hossame Bakraoui — interactions
   ========================================================== */

/* >>> À REMPLACER : numéro WhatsApp du cabinet, format international sans "+" (ex. 212612345678) */
const WHATSAPP_NUMBER = "212600000000";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;

/* ---------- Langue FR / AR ---------- */
const i18nNodes = $$("[data-ar]");
i18nNodes.forEach(n => (n.dataset.fr = n.innerHTML));
const btnLang = $("#lang");

function setLang(lang) {
  const ar = lang === "ar";
  html.lang = ar ? "ar" : "fr";
  html.dir = ar ? "rtl" : "ltr";
  i18nNodes.forEach(n => (n.innerHTML = ar ? n.dataset.ar : n.dataset.fr));
  const [fr, arSpan] = $$("span", btnLang);
  fr.classList.toggle("on", !ar);
  arSpan.classList.toggle("on", ar);
  try { localStorage.setItem("hb-lang", lang); } catch (e) {}
}
btnLang.addEventListener("click", () => setLang(html.lang === "ar" ? "fr" : "ar"));
try { if (localStorage.getItem("hb-lang") === "ar") setLang("ar"); } catch (e) {}

/* ---------- Nav ---------- */
const nav = $("#nav"), progress = $("#progress");
function onScroll() {
  nav.classList.toggle("scrolled", scrollY > 40);
  const h = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const burger = $("#burger"), links = $("#links");
burger.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  burger.setAttribute("aria-expanded", open);
});
$$("#links a").forEach(a => a.addEventListener("click", () => {
  links.classList.remove("open");
  burger.setAttribute("aria-expanded", "false");
}));

/* ---------- Reveal au scroll ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
$$(".reveal").forEach(el => io.observe(el));

/* ---------- Lueur qui suit la souris sur les cartes ---------- */
$$(".card").forEach(c => c.addEventListener("pointermove", e => {
  const r = c.getBoundingClientRect();
  c.style.setProperty("--mx", `${e.clientX - r.left}px`);
  c.style.setProperty("--my", `${e.clientY - r.top}px`);
}));

/* ---------- Parallaxe légère du portrait ---------- */
const portrait = $("#portrait");
if (portrait && matchMedia("(hover:hover)").matches) {
  const hero = $(".hero");
  hero.addEventListener("pointermove", e => {
    const x = (e.clientX / innerWidth - .5) * 14, y = (e.clientY / innerHeight - .5) * 14;
    portrait.style.transform = `translate(${x}px,${y}px)`;
  });
  portrait.style.transition = "transform .6s cubic-bezier(.22,.8,.24,1)";
}

/* ---------- Comparateur avant / après (illustration vectorielle) ---------- */
function smileSVG(after) {
  const n = 8, W = 800, H = 640, cx = W / 2;
  let teeth = "";
  // rangée supérieure, disposée sur une courbe de sourire
  const rng = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 43758.5453 % 1;
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / ((n - 1) / 2);            // -1..1
    const w = 72 - Math.abs(t) * 22 + (i === 3 || i === 4 ? 10 : 0);
    const h = 120 - Math.abs(t) * 36;
    const x = cx + t * 232;
    const y = 272 + Math.pow(Math.abs(t), 2) * 62;
    const rot = after ? t * 9 : t * 9 + (rng(i, 1) - .5) * 26;
    const dy = after ? 0 : (rng(i, 2) - .5) * 26;
    const dx = after ? 0 : (rng(i, 3) - .5) * 18;
    const g = after ? ["#ffffff", "#f1ede2"] : ["#e3cf98", "#c9ae6c"];
    teeth += `<g transform="translate(${x + dx} ${y + dy}) rotate(${rot})">
      <path d="M${-w / 2} ${-h * .1} C${-w / 2} ${-h * .5} ${-w * .38} ${-h * .5} 0 ${-h * .5} S${w / 2} ${-h * .5} ${w / 2} ${-h * .1} C${w / 2} ${h * .3} ${w * .3} ${h * .5} 0 ${h * .5} S${-w / 2} ${h * .3} ${-w / 2} ${-h * .1}Z" fill="url(#${after ? "ta" : "tb"})" stroke="${after ? "#d9d3c2" : "#a88e50"}" stroke-width="1.5"/>
      <path d="M${-w * .28} ${-h * .3} Q${-w * .1} ${-h * .42} ${w * .1} ${-h * .36}" stroke="#fff" stroke-opacity="${after ? .85 : .35}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${after ? "" : `<circle cx="${(rng(i, 4)) * w * .3}" cy="${h * .18}" r="${5 + rng(i, 5) * 4}" fill="#8a6b2a" opacity=".28"/>`}
    </g>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg${after ? "a" : "b"}" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${after ? "#2a8077" : "#5b6f6a"}"/><stop offset="1" stop-color="${after ? "#0b2a28" : "#1f2c2a"}"/></radialGradient>
      <linearGradient id="${after ? "ta" : "tb"}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${after ? "#ffffff" : "#eadba6"}"/><stop offset="1" stop-color="${after ? "#ece7d9" : "#c3a765"}"/></linearGradient>
      <linearGradient id="lip${after ? "a" : "b"}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${after ? "#c9736f" : "#b06a66"}"/><stop offset="1" stop-color="${after ? "#8f3d43" : "#7d4045"}"/></linearGradient>
      <clipPath id="mouth${after ? "a" : "b"}"><path d="M100 300 C210 200 590 200 700 300 C620 490 180 490 100 300Z"/></clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg${after ? "a" : "b"})"/>
    <path d="M100 300 C210 200 590 200 700 300 C620 490 180 490 100 300Z" fill="#2a0d12"/>
    <g clip-path="url(#mouth${after ? "a" : "b"})">${teeth}
      <ellipse cx="${cx}" cy="470" rx="230" ry="46" fill="#3b1218" opacity=".65"/></g>
    <path d="M80 300 C200 165 600 165 720 300 C610 250 190 250 80 300Z" fill="url(#lip${after ? "a" : "b"})"/>
    <path d="M80 300 C190 480 610 480 720 300 C650 555 150 555 80 300Z" fill="url(#lip${after ? "a" : "b"})"/>
    <path d="M100 300 C210 200 590 200 700 300" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="2"/>
  </svg>`;
}
const ba = $("#ba"), baRange = $("#baRange");
if (ba) {
  $("#baAfter").innerHTML = smileSVG(true);
  $("#baBeforeSvg").innerHTML = smileSVG(false);
  const set = v => ba.style.setProperty("--pos", v + "%");
  baRange.addEventListener("input", () => set(baRange.value));
  set(50);
}

/* ---------- WhatsApp ---------- */
const waUrl = text => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
$$("[data-wa]").forEach(a => {
  a.href = waUrl("Bonjour Dr Bakraoui, je souhaite prendre rendez-vous.");
  a.target = "_blank"; a.rel = "noopener";
});

const form = $("#rdvForm");
form.addEventListener("submit", e => {
  e.preventDefault();
  const name = form.name.value.trim();
  form.name.classList.toggle("err", !name);
  if (!name) { form.name.focus(); return; }
  const lines = [
    "Bonjour Dr Bakraoui, je souhaite prendre rendez-vous.",
    `Nom : ${name}`,
    form.phone.value.trim() && `Téléphone : ${form.phone.value.trim()}`,
    `Motif : ${form.motif.value}`,
    form.msg.value.trim() && `Message : ${form.msg.value.trim()}`
  ].filter(Boolean);
  const url = waUrl(lines.join("\n"));
  // Certains environnements bloquent window.open : on affiche aussi un lien direct.
  let opened = null;
  try { opened = window.open(url, "_blank", "noopener"); } catch (err) {}
  let fb = $("#waFallback");
  if (!fb) {
    fb = document.createElement("a");
    fb.id = "waFallback"; fb.className = "wa-fallback"; fb.target = "_blank"; fb.rel = "noopener";
    form.appendChild(fb);
  }
  fb.href = url;
  fb.textContent = html.lang === "ar" ? "افتح واتساب لإرسال الطلب ←" : "Ouvrir WhatsApp pour envoyer la demande →";
  fb.hidden = !!opened;
});
form.name.addEventListener("input", () => form.name.classList.remove("err"));

$("#year").textContent = new Date().getFullYear();
