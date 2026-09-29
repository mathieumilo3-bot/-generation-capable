/* Dr Hossame Bakraoui — interactions minimales */

/* >>> À REMPLACER : numéro WhatsApp du cabinet, format international sans "+" (ex. 212612345678) */
const WHATSAPP_NUMBER = "212600000000";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;

/* Langue FR / AR */
const nodes = $$("[data-ar]");
nodes.forEach(n => (n.dataset.fr = n.innerHTML));
function setLang(lang) {
  const ar = lang === "ar";
  html.lang = ar ? "ar" : "fr";
  html.dir = ar ? "rtl" : "ltr";
  nodes.forEach(n => (n.innerHTML = ar ? n.dataset.ar : n.dataset.fr));
  const [fr, arSpan] = $$("#lang span");
  fr.classList.toggle("on", !ar);
  arSpan.classList.toggle("on", ar);
  try { localStorage.setItem("hb-lang", lang); } catch (e) {}
}
$("#lang").addEventListener("click", () => setLang(html.lang === "ar" ? "fr" : "ar"));
try { if (localStorage.getItem("hb-lang") === "ar") setLang("ar"); } catch (e) {}

/* Nav */
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* Apparition douce */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: .12, rootMargin: "0px 0px -5% 0px" });
$$(".reveal").forEach(el => io.observe(el));

/* WhatsApp */
const wa = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent("Bonjour Dr Bakraoui, je souhaite prendre rendez-vous.");
$$("[data-wa]").forEach(a => { a.href = wa; a.target = "_blank"; a.rel = "noopener"; });

$("#year").textContent = new Date().getFullYear();
