/* Dr Hossame Bakraoui — tunnel de conversion + interactions */

const CONFIG = {
  /* >>> À REMPLACER : numéro WhatsApp du cabinet, format international sans "+" (ex. 212612345678) */
  WHATSAPP_NUMBER: "212600000000",
  /* Optionnel : URL qui reçoit chaque demande en JSON (Formspree, Netlify function, Zapier…). Vide = WhatsApp uniquement. */
  LEAD_ENDPOINT: "",
  /* Délai de réponse annoncé — à confirmer avec le Dr Bakraoui */
  RESPONSE: { fr: "dans la journée", ar: "خلال اليوم" }
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lang = () => (html.lang === "ar" ? "ar" : "fr");

/* ------------------------------------------------------------------
   Textes du tunnel (FR / AR)
------------------------------------------------------------------ */
const T = {
  fr: {
    stepOf: n => `Étape ${n} sur 5`,
    left: ["Plus que 4 questions", "Plus que 3", "Plus que 2", "Dernière étape", "Votre plan est prêt"],
    back: "Retour", cont: "Continuer",
    q1: "Qu’aimeriez-vous améliorer ?", s1: "Choisissez ce qui vous correspond le mieux.",
    goals: {
      align: ["Aligner mes dents", "Gouttières discrètes"],
      smile: ["Embellir mon sourire", "Esthétique, blanchiment"],
      pain: ["J’ai mal", "Douleur ou urgence"],
      surgery: ["Une extraction", "Chirurgie, dent de sagesse"],
      check: ["Un bilan", "Contrôle et prévention"]
    },
    q2: "Pour quand ?", s2: "Cela nous aide à préparer votre consultation.",
    whens: { asap: "Dès que possible", month: "Dans le mois", info: "Je me renseigne" },
    q3: "Qu’est-ce qui vous freine ?", s3: "Plusieurs choix possibles. On s’en occupe.",
    blockers: { pain: "La douleur", fear: "La peur du dentiste", budget: "Le budget", time: "Le manque de temps", none: "Rien de particulier" },
    q4: "Quand seriez-vous disponible ?", s4: "Une préférence suffit, nous confirmons ensuite.",
    day: "Jour", slot: "Moment", asap: "Dès que possible",
    slots: { morning: "Matin", afternoon: "Après-midi", late: "Fin de journée", flex: "Peu importe" },
    q5: "Où pouvons-nous vous répondre ?", s5: "Votre numéro WhatsApp, uniquement pour confirmer votre rendez-vous.",
    name: "Prénom et nom", phone: "Numéro WhatsApp",
    errName: "Indiquez votre nom.", errPhone: "Numéro invalide. Exemple : 06 12 34 56 78",
    see: "Voir ma recommandation",
    secure: "Sans engagement · Vos données restent confidentielles",
    ready: "Votre plan est prêt",
    resTitle: { align: "Bilan d’alignement dentaire", smile: "Consultation esthétique du sourire", pain: "Consultation douleur", surgery: "Consultation chirurgicale", check: "Bilan dentaire complet" },
    resList: {
      align: ["Examen de votre sourire et de l’alignement actuel", "Options d’alignement expliquées simplement", "Plan de traitement et devis clairs"],
      smile: ["Analyse esthétique de votre sourire", "Options adaptées à votre visage, sans effet artificiel", "Plan de traitement et devis clairs"],
      pain: ["Identification de l’origine de la douleur", "Soin adapté, avec un confort maîtrisé", "Conseils pour la suite"],
      surgery: ["Examen et explication de l’intervention, étape par étape", "Intervention menée avec précision et douceur", "Consignes claires pour bien cicatriser"],
      check: ["Bilan complet de votre santé bucco-dentaire", "Détartrage si nécessaire", "Conseils personnalisés pour durer"]
    },
    reassure: {
      pain: "Vous craignez la douleur : les soins sont pensés pour être confortables, avec une anesthésie adaptée.",
      fear: "Vous avez peur du dentiste : on vous explique chaque geste et on avance à votre rythme.",
      budget: "Le budget compte : un devis clair vous est présenté avant tout soin.",
      time: "Le temps manque : nous cherchons le créneau qui s’adapte à votre emploi du temps."
    },
    yourSlot: "Votre créneau souhaité", yourGoal: "Votre demande",
    confirm: "Confirmer sur WhatsApp",
    note: r => `Nous vous répondons ${r}. Sans engagement.`,
    edit: "Modifier mes réponses",
    resume: "On reprend là où vous vous étiez arrêté.", restart: "Recommencer",
    msg: {
      hello: "Bonjour Dr Bakraoui, je souhaite prendre rendez-vous.",
      goal: "Objectif", when: "Délai", blockers: "Freins", slot: "Créneau", name: "Nom", phone: "Tél"
    }
  },
  ar: {
    stepOf: n => `الخطوة ${n} من 5`,
    left: ["بقيت 4 أسئلة", "بقيت 3 أسئلة", "بقي سؤالان", "الخطوة الأخيرة", "خطتك جاهزة"],
    back: "رجوع", cont: "متابعة",
    q1: "ما الذي تودّ تحسينه؟", s1: "اختر ما يناسبك أكثر.",
    goals: {
      align: ["تقويم أسناني", "تقويم شفاف وخفي"],
      smile: ["تجميل ابتسامتي", "تجميل وتبييض"],
      pain: ["أعاني من ألم", "ألم أو حالة مستعجلة"],
      surgery: ["قلع سن", "جراحة، ضرس العقل"],
      check: ["فحص شامل", "مراقبة ووقاية"]
    },
    q2: "لأي وقت؟", s2: "هذا يساعدنا على تحضير استشارتك.",
    whens: { asap: "في أقرب وقت", month: "خلال الشهر", info: "أستفسر فقط" },
    q3: "ما الذي يمنعك؟", s3: "يمكنك اختيار أكثر من إجابة. نتكفل بها.",
    blockers: { pain: "الألم", fear: "الخوف من طبيب الأسنان", budget: "الميزانية", time: "ضيق الوقت", none: "لا شيء محدد" },
    q4: "متى تكون متاحا؟", s4: "يكفي تفضيل واحد، ثم نؤكد لك الموعد.",
    day: "اليوم", slot: "الفترة", asap: "في أقرب وقت",
    slots: { morning: "صباحا", afternoon: "بعد الزوال", late: "آخر النهار", flex: "لا يهم" },
    q5: "أين نرد عليك؟", s5: "رقم واتساب الخاص بك، فقط لتأكيد موعدك.",
    name: "الاسم الكامل", phone: "رقم واتساب",
    errName: "أدخل اسمك.", errPhone: "رقم غير صحيح. مثال: 06 12 34 56 78",
    see: "اعرض توصيتي",
    secure: "دون أي التزام · بياناتك سرية",
    ready: "خطتك جاهزة",
    resTitle: { align: "فحص لتقويم الأسنان", smile: "استشارة تجميل الابتسامة", pain: "استشارة للألم", surgery: "استشارة جراحية", check: "فحص شامل للأسنان" },
    resList: {
      align: ["فحص ابتسامتك وتراصّ أسنانك الحالي", "شرح خيارات التقويم ببساطة", "خطة علاج وعرض سعر واضحان"],
      smile: ["تحليل جمالي لابتسامتك", "خيارات تناسب وجهك دون مظهر مصطنع", "خطة علاج وعرض سعر واضحان"],
      pain: ["تحديد سبب الألم", "علاج مناسب براحة مضمونة", "نصائح لما بعد العلاج"],
      surgery: ["فحص وشرح التدخل خطوة بخطوة", "تدخل بدقة ولطف", "تعليمات واضحة للالتئام الجيد"],
      check: ["فحص كامل لصحة الفم والأسنان", "تنظيف الجير عند الحاجة", "نصائح شخصية للحفاظ على النتيجة"]
    },
    reassure: {
      pain: "تخشى الألم: العلاجات مصممة لتكون مريحة، مع تخدير مناسب.",
      fear: "تخاف من طبيب الأسنان: نشرح لك كل خطوة ونتقدم بالوتيرة التي تناسبك.",
      budget: "الميزانية مهمة: يُقدَّم لك عرض سعر واضح قبل أي علاج.",
      time: "الوقت ضيق: نبحث عن موعد يناسب جدولك."
    },
    yourSlot: "الموعد المفضل", yourGoal: "طلبك",
    confirm: "تأكيد عبر واتساب",
    note: r => `نرد عليك ${r}. دون أي التزام.`,
    edit: "تعديل إجاباتي",
    resume: "نواصل من حيث توقفت.", restart: "البدء من جديد"
  }
};

const ICONS = {
  align: '<path d="M4 15c2.500 4 13.500 4 16 0"/><path d="M4 11c2.500 4 13.500 4 16 0"/><path d="M8 8v3M12 8v4M16 8v3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.800 2.500 2.500 4 2.500s3-.7 4-2.500"/><path d="M9 9.500h.01M15 9.500h.01"/>',
  pain: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  surgery: '<path d="M12 4c-1.500 0-2.500.5-3.700.5C6 4.500 4 6 4 9c0 2 1 3.500 1.500 5.500.4 2 .6 5.500 2.200 5.500 1.400 0 1.200-3.200 2.200-4.700.5-.8 1.200-1.100 2.100-1.100s1.600.3 2.100 1.100c1 1.500.8 4.700 2.200 4.700 1.600 0 1.800-3.500 2.200-5.500C19 12.500 20 11 20 9c0-3-2-4.500-4.300-4.500C14.500 4.500 13.500 4 12 4z"/>',
  check: '<path d="M12 3l7 2.500V11c0 4.500-3 8-7 10-4-2-7-5.500-7-10V5.500z"/><path d="M8.500 12l2.500 2.500 4.500-5"/>'
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

/* ------------------------------------------------------------------
   Tunnel
------------------------------------------------------------------ */
const STORE = "hb-funnel-v1";
const blank = () => ({ step: 0, goal: "", when: "", blockers: [], day: "", slot: "", name: "", phone: "" });
let S = blank();
let dir = "fwd";
let resumed = false;

try {
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if (saved && saved.step > 0 && saved.step < 5) { S = { ...blank(), ...saved }; resumed = true; }
} catch (e) {}
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };

const body = $("#fBody"), back = $("#fBack"), bar = $("#fBar"), stepEl = $("#fStep"), leftEl = $("#fLeft"), resumeEl = $("#fResume");
let started = false;

function days() {
  const out = [], loc = lang() === "ar" ? "ar-MA" : "fr-FR";
  const d = new Date(); d.setHours(12, 0, 0, 0);
  while (out.length < 5) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue;                       // pas de dimanche
    let wd, dm;
    try {
      wd = new Intl.DateTimeFormat(loc, { weekday: "short" }).format(d);
      dm = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short" }).format(d);
    } catch (e) { wd = ""; dm = d.toDateString(); }
    out.push({ key: d.toISOString().slice(0, 10), wd, dm });
  }
  return out;
}

function progress() {
  const n = Math.min(S.step, 4);
  $$("i", bar).forEach((el, i) => {
    el.classList.toggle("on", i < S.step);
    el.classList.toggle("half", i === S.step && S.step < 5);
  });
  const t = T[lang()];
  stepEl.textContent = t.stepOf(Math.min(S.step + 1, 5));
  leftEl.textContent = t.left[Math.min(S.step, 4)];
  back.hidden = S.step === 0 || S.step === 5;
  if (S.step === 5) { stepEl.textContent = ""; leftEl.textContent = ""; }
}

function go(step, direction) {
  dir = direction || (step >= S.step ? "fwd" : "back");
  S.step = step; persist(); render();
}

function render() {
  const t = T[lang()];
  progress();
  resumeEl.hidden = !(resumed && S.step > 0 && S.step < 5);
  if (!resumeEl.hidden) {
    resumeEl.innerHTML = `<span>${esc(t.resume)}</span><button type="button" id="fRestart">${esc(t.restart)}</button>`;
    $("#fRestart").onclick = () => { S = blank(); resumed = false; persist(); dir = "back"; render(); };
  }
  const wrap = `<div class="step ${dir === "back" ? "back" : ""}">`;
  let h = "";
  if (S.step === 0) {
    h = `${wrap}<h3 class="q">${t.q1}</h3><p class="sub">${t.s1}</p><div class="opts" role="radiogroup">` +
      Object.entries(t.goals).map(([k, [a, b]]) => `<button type="button" class="opt" role="radio" aria-checked="${S.goal === k}" data-goal="${k}"><span class="ico">${svg(k)}</span><span><b>${a}</b><small>${b}</small></span><span class="tick"></span></button>`).join("") +
      `</div></div>`;
  } else if (S.step === 1) {
    h = `${wrap}<h3 class="q">${t.q2}</h3><p class="sub">${t.s2}</p><div class="opts" role="radiogroup">` +
      Object.entries(t.whens).map(([k, a]) => `<button type="button" class="opt simple" role="radio" aria-checked="${S.when === k}" data-when="${k}"><b>${a}</b><span class="tick"></span></button>`).join("") +
      `</div></div>`;
  } else if (S.step === 2) {
    h = `${wrap}<h3 class="q">${t.q3}</h3><p class="sub">${t.s3}</p><div class="opts two">` +
      Object.entries(t.blockers).map(([k, a]) => `<button type="button" class="opt simple" aria-pressed="${S.blockers.includes(k)}" data-blk="${k}"><b>${a}</b><span class="tick"></span></button>`).join("") +
      `</div><div class="f-next"><button class="btn btn-mint" type="button" id="fNext">${t.cont}</button></div></div>`;
  } else if (S.step === 3) {
    const ds = days();
    h = `${wrap}<h3 class="q">${t.q4}</h3><p class="sub">${t.s4}</p>
      <div class="grp"><div class="grp-t">${t.day}</div><div class="chips" role="radiogroup">
        <button type="button" class="chip" role="radio" aria-checked="${S.day === "asap"}" data-day="asap">${t.asap}</button>` +
      ds.map(d => `<button type="button" class="chip" role="radio" aria-checked="${S.day === d.key}" data-day="${d.key}" data-label="${esc(d.wd + " " + d.dm)}">${esc(d.wd)}<small>${esc(d.dm)}</small></button>`).join("") +
      `</div></div><div class="grp"><div class="grp-t">${t.slot}</div><div class="chips" role="radiogroup">` +
      Object.entries(t.slots).map(([k, a]) => `<button type="button" class="chip" role="radio" aria-checked="${S.slot === k}" data-slot="${k}">${a}</button>`).join("") +
      `</div></div><div class="f-next"><button class="btn btn-mint" type="button" id="fNext" ${S.day && S.slot ? "" : "disabled"}>${t.cont}</button></div></div>`;
  } else if (S.step === 4) {
    h = `${wrap}<h3 class="q">${t.q5}</h3><p class="sub">${t.s5}</p>
      <div class="field"><label for="fName">${t.name}</label><input id="fName" type="text" autocomplete="name" value="${esc(S.name)}"><div class="err" id="eName"></div></div>
      <div class="field"><label for="fPhone">${t.phone}</label><div class="phone-wrap"><span>+212</span><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="6 12 34 56 78" value="${esc(S.phone)}"></div><div class="err" id="ePhone"></div></div>
      <div class="f-next"><button class="btn btn-mint" type="button" id="fNext">${t.see}</button><p class="fine">${t.secure}</p></div></div>`;
  } else {
    h = resultHTML(t);
  }
  body.innerHTML = h;
  bind();
}

function normPhone(raw) {
  let p = String(raw).replace(/[\s.\-()]/g, "");
  if (/^\+/.test(p)) return /^\+\d{8,15}$/.test(p) ? p.slice(1) : null;
  if (/^00\d{8,15}$/.test(p)) return p.slice(2);
  if (/^0[5-7]\d{8}$/.test(p)) return "212" + p.slice(1);
  if (/^[5-7]\d{8}$/.test(p)) return "212" + p;
  if (/^212[5-7]\d{8}$/.test(p)) return p;
  return null;
}

function summary() {
  const fr = T.fr;
  const dayEl = S.day === "asap" ? fr.asap : (S.dayLabel || S.day);
  return {
    goal: fr.goals[S.goal] ? fr.goals[S.goal][0] : "",
    when: fr.whens[S.when] || "",
    blockers: S.blockers.filter(b => b !== "none").map(b => fr.blockers[b]).join(", ") || "—",
    slot: `${dayEl} · ${fr.slots[S.slot] || ""}`,
    name: S.name, phone: "+" + S.phoneNorm
  };
}
function waLink() {
  const m = T.fr.msg, s = summary();
  const text = [m.hello, `${m.goal} : ${s.goal}`, `${m.when} : ${s.when}`, `${m.blockers} : ${s.blockers}`, `${m.slot} : ${s.slot}`, `${m.name} : ${s.name}`, `${m.phone} : ${s.phone}`].join("\n");
  return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function resultHTML(t) {
  const first = S.blockers.find(b => b !== "none");
  const dayTxt = S.day === "asap" ? t.asap : (S.dayLabel || "");
  return `<div class="step ${dir === "back" ? "back" : ""}">
    <div class="res-k"><svg class="check" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11"/><path d="M8 13.500l3.500 3.500L18 9.500"/></svg>${t.ready}</div>
    <h3 class="q res-t">${t.resTitle[S.goal]}</h3>
    <ul class="res-list">${t.resList[S.goal].map(x => `<li>${x}</li>`).join("")}</ul>
    ${first ? `<div class="res-box mint">${t.reassure[first]}</div>` : ""}
    <div class="res-box"><b>${t.yourSlot}</b>${esc(dayTxt)} · ${t.slots[S.slot]}</div>
    <div class="f-next"><a class="btn btn-mint" id="fSend" href="${waLink()}" target="_blank" rel="noopener">${t.confirm}</a>
    <p class="fine">${t.note(CONFIG.RESPONSE[lang()])}</p><button class="f-edit" type="button" id="fEdit">${t.edit}</button></div></div>`;
}

function sendLead() {
  if (!CONFIG.LEAD_ENDPOINT) return;
  try {
    fetch(CONFIG.LEAD_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ ...summary(), lang: lang(), at: new Date().toISOString() }) }).catch(() => {});
  } catch (e) {}
}

function bind() {
  $$(".opt,.chip").forEach(el => el.addEventListener("pointermove", e => {
    const r = el.getBoundingClientRect(); el.style.setProperty("--mx", e.clientX - r.left + "px"); el.style.setProperty("--my", e.clientY - r.top + "px");
  }));
  $$("[data-goal]").forEach(b => b.onclick = () => { S.goal = b.dataset.goal; b.setAttribute("aria-checked", "true"); setTimeout(() => go(1, "fwd"), 220); });
  $$("[data-when]").forEach(b => b.onclick = () => { S.when = b.dataset.when; b.setAttribute("aria-checked", "true"); setTimeout(() => go(2, "fwd"), 220); });
  $$("[data-blk]").forEach(b => b.onclick = () => {
    const k = b.dataset.blk, has = S.blockers.includes(k);
    if (k === "none") S.blockers = has ? [] : ["none"];
    else { S.blockers = S.blockers.filter(x => x !== "none"); S.blockers = has ? S.blockers.filter(x => x !== k) : [...S.blockers, k]; }
    persist(); $$("[data-blk]").forEach(x => x.setAttribute("aria-pressed", S.blockers.includes(x.dataset.blk)));
  });
  $$("[data-day]").forEach(b => b.onclick = () => {
    S.day = b.dataset.day; S.dayLabel = b.dataset.label || ""; persist();
    $$("[data-day]").forEach(x => x.setAttribute("aria-checked", x === b)); upd();
  });
  $$("[data-slot]").forEach(b => b.onclick = () => {
    S.slot = b.dataset.slot; persist();
    $$("[data-slot]").forEach(x => x.setAttribute("aria-checked", x === b)); upd();
  });
  function upd() { const n = $("#fNext"); if (n && S.step === 3) n.disabled = !(S.day && S.slot); }

  const next = $("#fNext");
  if (next) next.onclick = () => {
    if (S.step === 2 && !S.blockers.length) S.blockers = ["none"];
    if (S.step === 4) return submitContact();
    go(S.step + 1, "fwd");
  };
  if (S.step === 4) {
    const n = $("#fName"), p = $("#fPhone");
    [n, p].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") submitContact(); }));
    n.oninput = () => { n.classList.remove("bad"); $("#eName").textContent = ""; };
    p.oninput = () => { p.classList.remove("bad"); $("#ePhone").textContent = ""; };
  }
  const send = $("#fSend"); if (send) send.addEventListener("click", sendLead);
  const edit = $("#fEdit"); if (edit) edit.onclick = () => go(0, "back");
}

function submitContact() {
  const t = T[lang()], n = $("#fName"), p = $("#fPhone");
  const name = n.value.trim(), norm = normPhone(p.value);
  let ok = true;
  if (name.length < 2) { n.classList.add("bad"); $("#eName").textContent = t.errName; ok = false; }
  if (!norm) { p.classList.add("bad"); $("#ePhone").textContent = t.errPhone; ok = false; }
  if (!ok) { (name.length < 2 ? n : p).focus(); return; }
  S.name = name; S.phone = p.value.trim(); S.phoneNorm = norm;
  go(5, "fwd");
}

/* ------------------------------------------------------------------
   Langue
------------------------------------------------------------------ */
const nodes = $$("[data-ar]");
nodes.forEach(n => (n.dataset.fr = n.innerHTML));
function setLang(l) {
  const ar = l === "ar";
  html.lang = ar ? "ar" : "fr"; html.dir = ar ? "rtl" : "ltr";
  nodes.forEach(n => (n.innerHTML = ar ? n.dataset.ar : n.dataset.fr));
  const [fr, arSpan] = $$("#lang span");
  fr.classList.toggle("on", !ar); arSpan.classList.toggle("on", ar);
  try { localStorage.setItem("hb-lang", l); } catch (e) {}
  dir = "fwd"; render(); renderObj(); countUp(true);
}
$("#lang").addEventListener("click", () => setLang(lang() === "ar" ? "fr" : "ar"));

/* ------------------------------------------------------------------
   Objections
------------------------------------------------------------------ */
const OBJ = {
  fr: {
    pain: ["Et si ça fait mal ?", "Notre priorité est un soin confortable : anesthésie adaptée, gestes doux, et vous pouvez demander une pause à tout moment."],
    fear: ["J’ai peur du dentiste.", "Vous n’êtes pas seul(e). On vous explique chaque étape avant de commencer, et on avance à votre rythme."],
    budget: ["Combien ça coûte ?", "Vous recevez un plan de traitement et un devis clairs avant tout soin. Pas de surprise."],
    cta: "Recevoir mon plan"
  },
  ar: {
    pain: ["وماذا لو كان مؤلما؟", "أولويتنا علاج مريح: تخدير مناسب، حركات لطيفة، ويمكنك طلب استراحة في أي وقت."],
    fear: ["أخاف من طبيب الأسنان.", "لست وحدك. نشرح لك كل خطوة قبل البدء، ونتقدم بالوتيرة التي تناسبك."],
    budget: ["كم الثمن؟", "تتلقى خطة علاج وعرض سعر واضحين قبل أي علاج. دون مفاجآت."],
    cta: "احصل على خطتي"
  }
};
let objKey = "pain";
function renderObj() {
  const o = OBJ[lang()], [t, p] = o[objKey];
  $("#objPanel").innerHTML = `<h3>${t}</h3><p>${p}</p><a class="btn btn-mint" href="#funnel" data-open-funnel>${o.cta}</a>`;
  $$("#objTabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === objKey));
  bindOpen();
}
$$("#objTabs button").forEach(b => b.onclick = () => { objKey = b.dataset.k; renderObj(); });

/* ------------------------------------------------------------------
   Ouverture du tunnel, WhatsApp direct, nav, apparition, compteur
------------------------------------------------------------------ */
function openFunnel(e) {
  if (e) e.preventDefault();
  $("#funnel").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => { const f = $("#funnel .opt, #funnel input"); if (f) f.focus({ preventScroll: true }); }, 500);
}
function bindOpen() { $$("[data-open-funnel]").forEach(a => (a.onclick = openFunnel)); }

$$("[data-wa]").forEach(a => {
  a.href = "https://wa.me/" + CONFIG.WHATSAPP_NUMBER + "?text=" + encodeURIComponent("Bonjour Dr Bakraoui, je souhaite prendre rendez-vous.");
  a.target = "_blank"; a.rel = "noopener";
});

const nav = $("#nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true }); onScroll();

const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: .1, rootMargin: "0px 0px -5% 0px" });
$$(".reveal").forEach(el => io.observe(el));

/* Barre mobile : visible quand le tunnel n'est plus à l'écran */
const sticky = $("#sticky"), fun = $("#funnel");
new IntersectionObserver(([e]) => sticky.classList.toggle("show", !e.isIntersecting && scrollY > 200), { threshold: 0 }).observe(fun);

/* Relance douce, une seule fois par session, si le tunnel n'a pas été touché */
const touched = () => S.step > 0 || started;
fun.addEventListener("click", () => { started = true; hideNudge(); });
function hideNudge() { $("#nudge").hidden = true; }
$("#nudgeClose").onclick = () => { hideNudge(); try { sessionStorage.setItem("hb-nudge", "1"); } catch (e) {} };
setTimeout(() => {
  let seen = false; try { seen = sessionStorage.getItem("hb-nudge"); } catch (e) {}
  if (!seen && !touched()) { $("#nudge").hidden = false; try { sessionStorage.setItem("hb-nudge", "1"); } catch (e) {} bindOpen(); }
}, 22000);

/* Compteur */
function countUp(instant) {
  $$(".count").forEach(el => {
    const to = +el.dataset.to, fmt = n => n.toLocaleString(lang() === "ar" ? "en-US" : "fr-FR").replace(/[  ]/g, " ");
    if (instant || matchMedia("(prefers-reduced-motion:reduce)").matches) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), d = 1400;
    const tick = t => { const k = Math.min(1, (t - t0) / d), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = fmt(v); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const proof = $(".proof");
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { countUp(); o.disconnect(); } }, { threshold: .4 }).observe(proof);

try { if (localStorage.getItem("hb-lang") === "ar") { setLang("ar"); } else { render(); renderObj(); } } catch (e) { render(); renderObj(); }
bindOpen();
