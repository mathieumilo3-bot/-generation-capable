import type { FetchHtmlResult } from "../probe";

/**
 * A realistic small roofer's website, served from memory. Built to contain
 * the kind of problems the diagnostic must catch on real sites:
 * - "isolation extérieure" and "démoussage" are sold but have no page;
 * - the phone number is written but not clickable;
 * - réalisations exist on their own page but the homepage shows no proof;
 * - the RGE label is only on "qui sommes-nous";
 * - the title does not name the city.
 */
export const ARTISAN_PAGES: Record<string, string> = {
  "https://www.martin-couverture56.fr/": `<!doctype html><html lang="fr"><head>
<title>Martin Couverture — Couvreur zingueur</title>
<meta name="description" content="Entreprise de couverture familiale. Toiture, zinguerie, charpente.">
</head><body>
<header><a href="/"><img src="/logo.png" alt="Martin Couverture"></a>
<nav><a href="/">Accueil</a><a href="/couverture-ardoise">Couverture ardoise</a><a href="/zinguerie">Zinguerie</a><a href="/charpente">Charpente</a><a href="/nos-realisations">Réalisations</a><a href="/qui-sommes-nous">Qui sommes-nous</a><a href="/contact">Contact</a></nav>
</header>
<main>
<h1>Votre couvreur de confiance</h1>
<p>Depuis 1998, Martin Couverture réalise vos travaux de toiture : couverture en ardoise, zinguerie et gouttières, charpente, démoussage de toiture et isolation extérieure des murs.</p>
<p>Nous intervenons sur Vannes, Séné, Theix-Noyalo et tout le Golfe du Morbihan.</p>
<h2>Nos services</h2><p>Couverture neuve et rénovation. Démoussage et traitement hydrofuge. Isolation thermique par l'extérieur.</p>
<p>Contactez-nous au 02 97 12 34 56 pour un devis gratuit.</p>
<a class="btn" href="/contact">Demander un devis</a>
</main>
<footer><a href="/mentions-legales">Mentions légales</a> <a href="https://www.facebook.com/martincouverture56">Facebook</a></footer>
</body></html>`,
  "https://www.martin-couverture56.fr/sitemap.xml": `<?xml version="1.0"?><urlset>
<url><loc>https://www.martin-couverture56.fr/</loc></url>
<url><loc>https://www.martin-couverture56.fr/couverture-ardoise</loc></url>
<url><loc>https://www.martin-couverture56.fr/zinguerie</loc></url>
<url><loc>https://www.martin-couverture56.fr/charpente</loc></url>
<url><loc>https://www.martin-couverture56.fr/nos-realisations</loc></url>
<url><loc>https://www.martin-couverture56.fr/qui-sommes-nous</loc></url>
<url><loc>https://www.martin-couverture56.fr/contact</loc></url>
<url><loc>https://www.martin-couverture56.fr/mentions-legales</loc></url>
</urlset>`,
  "https://www.martin-couverture56.fr/couverture-ardoise": `<html><head><title>Couverture ardoise — Martin Couverture</title></head><body><h1>Couverture en ardoise naturelle</h1><p>Pose et rénovation de toiture en ardoise.</p></body></html>`,
  "https://www.martin-couverture56.fr/zinguerie": `<html><head><title>Zinguerie — Martin Couverture</title></head><body><h1>Zinguerie et gouttières</h1><p>Gouttières zinc, noues, solins.</p></body></html>`,
  "https://www.martin-couverture56.fr/charpente": `<html><head><title>Charpente — Martin Couverture</title></head><body><h1>Charpente traditionnelle</h1><p>Réparation et traitement de charpente.</p></body></html>`,
  "https://www.martin-couverture56.fr/nos-realisations": `<html><head><title>Nos réalisations</title></head><body><header>x</header><main><h1>Nos chantiers</h1>
<img src="1.jpg"><img src="2.jpg"><img src="3.jpg"><img src="4.jpg"><img src="5.jpg"><img src="6.jpg"><p>Réfection de toiture à Séné.</p></main></body></html>`,
  "https://www.martin-couverture56.fr/qui-sommes-nous": `<html><head><title>Qui sommes-nous</title></head><body><h1>Une entreprise familiale</h1><p>Entreprise certifiée RGE Qualibat, assurance décennale.</p></body></html>`,
  "https://www.martin-couverture56.fr/contact": `<html><head><title>Contact</title></head><body><h1>Contact</h1>
<form><label for="n">Nom</label><input id="n" name="nom"><label for="p">Prénom</label><input id="p" name="prenom"><label for="e">Email</label><input id="e" type="email" name="email">
<label for="t">Téléphone</label><input id="t" name="tel"><label for="a">Adresse</label><input id="a" name="adresse"><label for="c">Code postal</label><input id="c" name="cp">
<label for="v">Ville</label><input id="v" name="ville"><label for="s">Surface</label><input id="s" name="surface"><label for="m">Message</label><textarea id="m" name="message"></textarea>
<input type="hidden" name="_wpcf7" value="1"><input type="submit" value="Envoyer"></form></body></html>`,
  "https://www.martin-couverture56.fr/mentions-legales": `<html><head><title>Mentions légales</title></head><body><h1>Mentions légales</h1><p>Martin Couverture SARL — SIRET 123 456 789 00012 — 12 rue des Ardoisiers 56000 Vannes.</p></body></html>`,
};

export function fakeFetch(pages: Record<string, string>) {
  return async (url: string): Promise<FetchHtmlResult> => {
    const key = Object.keys(pages).find((k) => k.replace(/\/$/, "") === url.replace(/\/$/, ""));
    if (!key) return { ok: false, reason: "http_error", status: 404 };
    return { ok: true, finalUrl: new URL(key), status: 200, html: pages[key], responseTimeMs: 20 };
  };
}
