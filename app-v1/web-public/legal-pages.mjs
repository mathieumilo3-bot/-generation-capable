/**
 * Contenus juridiques (FR). MODÈLES à faire relire par un juriste : ils décrivent le fonctionnement réel du produit
 * et appliquent le droit français de la consommation (C. consom. art. L221-18 s., L221-28, L224-25-1 s., L612-1 s.),
 * le RGPD / la loi Informatique et Libertés et la LCEN (art. 6). Aucune identité de société n'est inventée :
 * tout est lu dans legal.config.json.
 */
const item = (arr) => `<ul>${arr.map((x) => `<li>${x}</li>`).join("")}</ul>`;
const company = ({ v }) => `${v("company.name", "Dénomination de la société")}, ${v("company.legalForm", "Forme juridique")} au capital de ${v("company.shareCapital", "Capital social")} €, dont le siège est situé ${v("company.address", "Adresse du siège")}, ${v("company.postalCode", "Code postal")} ${v("company.city", "Ville")} (${v("company.country", "Pays")}), immatriculée sous le numéro SIREN ${v("company.siren", "SIREN")} (${v("company.rcs", "RCS / ville d'immatriculation")}), numéro de TVA intracommunautaire ${v("company.vatNumber", "N° de TVA intracommunautaire")}`;

export const PAGES = {
  // ───────────────────────────── Mentions légales (LCEN art. 6)
  "mentions-legales.html": {
    title: "Mentions légales",
    body: (c) => `<h1>Mentions légales</h1>
<h2>Éditeur du service</h2>
<p>${company(c)}.</p>
<p>Directeur de la publication : ${c.v("company.publicationDirector", "Directeur de la publication")}.<br>
Contact : <a href="mailto:${c.esc(c.cfg.company.email || c.cfg.brand.supportEmail)}">${c.v("company.email", "E-mail de contact de la société")}</a>${c.cfg.company.phone ? ` · ${c.esc(c.cfg.company.phone)}` : ""}.</p>
<h2>Hébergement</h2>
${item(c.cfg.hosting.map((h) => `<strong>${h.name ? c.esc(h.name) : c.v("hosting", "Nom de l'hébergeur")}</strong>${h.address ? `, ${c.esc(h.address)}` : ""} — ${c.esc(h.role)}`))}
<h2>Propriété intellectuelle</h2>
<p>L'application, son interface, ses textes, ses marques et logos sont protégés par le droit d'auteur et le droit des marques. Toute reproduction non autorisée est interdite. Les vidéos que vous envoyez et celles produites pour vous restent soumises aux droits que vous détenez (voir les <a href="conditions.html">conditions d'utilisation</a>).</p>
<h2>Données personnelles</h2>
<p>Voir la <a href="confidentialite.html">politique de confidentialité</a>.</p>`,
  },

  // ───────────────────────────── CGU
  "conditions.html": {
    title: "Conditions d'utilisation",
    body: (c) => `<h1>Conditions générales d'utilisation</h1>
<p class="muted">Applicables à compter du ${c.esc(c.cfg.effectiveDate)}. Les achats sont régis par les <a href="conditions-de-vente.html">conditions générales de vente</a>.</p>
<h2>1. Éditeur et objet</h2>
<p>Le service ${c.esc(c.cfg.brand.productName)} (« le Service ») est édité par ${company(c)} (« nous »). Il permet de transformer des vidéos que vous nous envoyez en une vidéo montée, selon la durée et le style que vous choisissez.</p>
<h2>2. Compte</h2>
${item([
  "Vous créez un compte avec Apple, Google ou une adresse e-mail (code de connexion). Vous garantissez l'exactitude des informations fournies et la confidentialité de votre accès.",
  "Le Service est réservé aux personnes majeures ou disposant de l'autorisation de leur représentant légal. Un professionnel peut l'utiliser pour son activité.",
  "Vous pouvez supprimer votre compte à tout moment depuis l'application (Compte → Confidentialité → Supprimer mon compte) ou via la page « Supprimer mon compte »."])}
<h2>3. Vos contenus et vos droits</h2>
${item([
  "Vous restez titulaire des droits sur les vidéos, images, sons et textes que vous envoyez. Vous déclarez détenir tous les droits nécessaires (image des personnes filmées, musiques, marques, droits d'auteur) et garantir que votre contenu est licite.",
  "Vous nous accordez une licence limitée, non exclusive et strictement nécessaire pour stocker, analyser, transformer et vous livrer le résultat. Nous n'utilisons pas vos contenus à d'autres fins, ni pour promouvoir le Service, sans votre accord.",
  "Les vidéos produites vous sont livrées pour votre usage, y compris commercial, sous réserve du respect des droits de tiers contenus dans vos fichiers d'origine.",
  `<strong>Durée de conservation :</strong> vos fichiers envoyés sont supprimés ${c.H} heures après leur envoi et les vidéos produites ${c.HV} heures après leur création. Téléchargez votre vidéo dès qu'elle est prête : nous ne pourrons pas la restituer ensuite.`])}
<h2>4. Utilisation acceptable</h2>
<p>Il est interdit d'envoyer des contenus illicites (contrefaisants, diffamatoires, haineux, pédopornographiques, violents, portant atteinte à la vie privée d'autrui), de chercher à contourner la sécurité du Service, de l'utiliser pour une activité frauduleuse ou d'en perturber le fonctionnement. Nous pouvons refuser, suspendre ou supprimer un contenu ou un compte en cas de manquement, après avoir informé l'utilisateur lorsque c'est possible.</p>
<h2>5. Intelligence artificielle et qualité du résultat</h2>
<p>Le montage est réalisé automatiquement, en partie par des outils d'intelligence artificielle. Le résultat dépend de la qualité et du contenu des fichiers fournis ; il peut contenir des imperfections et ne constitue pas une garantie de performance commerciale. Vous êtes responsable de vérifier la vidéo avant de la publier.</p>
<h2>6. Disponibilité</h2>
<p>Nous mettons en œuvre les moyens raisonnables pour assurer l'accès au Service, sans garantie d'une disponibilité continue (maintenance, incident, force majeure). Votre solde et vos créations en cours ne sont pas affectés par une maintenance.</p>
<h2>7. Responsabilité</h2>
<p>Nous répondons des dommages directs qui nous sont imputables, dans les limites permises par la loi. Rien dans ces conditions n'exclut les droits dont les consommateurs bénéficient impérativement (notamment la garantie légale de conformité des contenus et services numériques). Notre responsabilité ne peut être engagée pour le contenu que vous envoyez.</p>
<h2>8. Modification des conditions</h2>
<p>Nous pouvons faire évoluer ces conditions ; la version applicable est celle en vigueur lors de votre connexion. En cas de changement substantiel, nous vous en informons dans l'application et, si la loi l'exige, vous demandons de les accepter à nouveau.</p>
<h2>9. Droit applicable et litiges</h2>
<p>Ces conditions sont soumises au droit français. Les consommateurs peuvent saisir le tribunal de leur domicile et recourir gratuitement à la médiation (voir les conditions de vente). Pour les professionnels, les tribunaux du ressort du siège de l'éditeur sont compétents, sauf règle impérative contraire.</p>
<h2>10. Contact</h2>
<p><a href="mailto:${c.esc(c.cfg.brand.supportEmail)}">${c.esc(c.cfg.brand.supportEmail)}</a></p>`,
  },

  // ───────────────────────────── CGV
  "conditions-de-vente.html": {
    title: "Conditions de vente",
    body: (c) => `<h1>Conditions générales de vente</h1>
<p class="muted">Applicables à compter du ${c.esc(c.cfg.effectiveDate)}.</p>
<h2>1. Vendeur</h2>
<p>${company(c)}. Contact : <a href="mailto:${c.esc(c.cfg.brand.supportEmail)}">${c.esc(c.cfg.brand.supportEmail)}</a>.</p>
<h2>2. Service vendu</h2>
<p>Un service numérique de montage vidéo à la demande, payé à l'aide d'un <strong>solde prépayé</strong> en euros que vous rechargez puis dépensez pour chaque vidéo. ${c.esc(c.cfg.consumerBusiness)}</p>
<h2>3. Prix</h2>
<p>Le prix de chaque vidéo dépend de la durée choisie et est <strong>affiché en euros avant toute validation</strong>, sans frais cachés. ${c.cfg.vat.pricesNote.startsWith("[") ? c.v("vat.pricesNote", "Mention de TVA") : c.esc(c.cfg.vat.pricesNote)} Nous pouvons modifier nos prix ; le prix applicable est celui affiché au moment où vous lancez la création.</p>
<h2>4. Solde prépayé</h2>
${item([
  "Recharge minimale : 10 €. Sur le web, vous choisissez le montant ; sur iPhone et Android, des montants fixes sont proposés par l'App Store ou Google Play.",
  "<strong>Fonctionnement :</strong> au lancement d'une vidéo, son prix est <em>réservé</em> sur votre solde ; il est <em>encaissé</em> lorsque la vidéo vous est livrée et automatiquement <em>libéré</em> si le rendu échoue définitivement ou si vous annulez avant sa fin. Vous ne payez jamais un rendu qui n'existe pas.",
  "Le solde n'a pas de date d'expiration et ne produit pas d'intérêts. Il n'est utilisable que pour les services du Service ; il n'est pas transférable.",
  "La recharge automatique, lorsqu'elle est disponible (web uniquement), est facultative : vous fixez le seuil, le montant et le plafond mensuel, et pouvez la désactiver à tout moment.",
  "Vous pouvez consulter chaque mouvement de votre solde (recharges, montants réservés, encaissés, libérés) dans l'application."])}
<h2>5. Paiement</h2>
<p>Sur le web, le paiement est traité par Stripe (carte, Apple Pay, Google Pay, Link ou autres moyens proposés). Sur iPhone et Android, l'achat de solde est traité par Apple (App Store) ou Google (Google Play). Nous ne conservons aucun numéro de carte. Votre solde n'est crédité qu'après confirmation du paiement par le prestataire concerné ; en cas de refus, votre solde n'est pas modifié.</p>
<h2>6. Livraison et conservation</h2>
<p>La vidéo est livrée par voie numérique dans l'application et téléchargeable depuis votre compte. Le délai dépend de la durée des fichiers et de la charge du Service ; l'avancement est affiché en temps réel. <strong>Les fichiers envoyés et les vidéos produites sont supprimés ${c.H} heures après leur envoi ou leur création</strong> : téléchargez votre vidéo avant.</p>
<h2>7. Droit de rétractation (consommateurs)</h2>
${item([
  "<strong>Recharge du solde :</strong> vous disposez de 14 jours à compter de la recharge pour vous rétracter, sans motif (art. L221-18 du Code de la consommation). Nous vous remboursons la part du solde rechargé qui n'a pas été utilisée, par le moyen de paiement utilisé, dans les 14 jours suivant votre demande (écrivez-nous à l'adresse ci-dessus).",
  "<strong>Vidéo commandée :</strong> en lançant la création, vous demandez expressément l'exécution immédiate du service et, s'agissant d'un contenu numérique fourni sans support matériel, reconnaissez perdre votre droit de rétractation pour cette vidéo dès que l'exécution a commencé (art. L221-28 du Code de la consommation). Cette demande vous est présentée avant chaque validation.",
  "Si la vidéo n'est pas livrée (échec définitif ou annulation), le montant réservé est libéré : aucun prélèvement n'est effectué.",
  "<strong>Achats via Apple ou Google :</strong> les demandes de remboursement de la recharge elle-même sont traitées par le magasin concerné selon ses propres conditions ; nous traitons les demandes relatives à l'usage de votre solde.",
  "Les professionnels ne bénéficient pas du droit de rétractation applicable aux consommateurs."])}
<h2>8. Garantie légale et réclamations</h2>
<p>Les consommateurs bénéficient de la garantie légale de conformité des contenus et services numériques (art. L224-25-1 et suivants du Code de la consommation) et de la garantie des vices cachés (art. 1641 et suivants du Code civil). En cas de défaut de la vidéo livrée, contactez-nous via Compte → Aide → Signaler un problème : nous mettons la vidéo en conformité ou, à défaut, nous vous remboursons le montant correspondant.</p>
<h2>9. Suppression du compte et solde restant</h2>
<p>Si vous supprimez votre compte, votre solde restant est supprimé avec lui. Avant de supprimer votre compte, vous pouvez demander le remboursement du solde non utilisé dans les cas prévus à l'article 7 ou par accord avec nous. Les justificatifs de paiement sont conservés sans lien avec votre identité pour nos obligations comptables.</p>
<h2>10. Facturation</h2>
<p>Vos reçus sont disponibles dans Compte → Paiements. Vous pouvez renseigner vos informations de facturation (nom, entreprise, adresse, pays, numéro de TVA) dans Compte → Facturation.</p>
<h2>11. Médiation de la consommation</h2>
<p>Conformément aux articles L611-1 et suivants du Code de la consommation, après une réclamation écrite restée sans réponse satisfaisante, le consommateur peut recourir gratuitement au médiateur de la consommation : ${c.v("mediator.name", "Nom du médiateur de la consommation")}, ${c.v("mediator.address", "Adresse du médiateur")}, ${c.v("mediator.website", "Site du médiateur")}${c.cfg.mediator.email ? `, ${c.esc(c.cfg.mediator.email)}` : ""}.</p>
<h2>12. Données personnelles</h2>
<p>Voir la <a href="confidentialite.html">politique de confidentialité</a>.</p>
<h2>13. Droit applicable</h2>
<p>Les présentes conditions sont soumises au droit français, sans préjudice des dispositions impératives de protection du consommateur de son pays de résidence.</p>`,
  },

  // ───────────────────────────── Confidentialité (RGPD art. 13)
  "confidentialite.html": {
    title: "Politique de confidentialité",
    body: (c) => `<h1>Politique de confidentialité</h1>
<p class="muted">En vigueur à compter du ${c.esc(c.cfg.effectiveDate)}.</p>
<h2>1. Responsable de traitement</h2>
<p>${company(c)}. Contact données personnelles : ${c.cfg.dpo.email ? `<a href="mailto:${c.esc(c.cfg.dpo.email)}">${c.esc(c.cfg.dpo.email)}</a>${c.cfg.dpo.name ? ` (${c.esc(c.cfg.dpo.name)})` : ""}` : c.v("dpo.email", "E-mail de contact RGPD / DPO")}.</p>
<h2>2. Données traitées, finalités et bases légales</h2>
<table>
<tr><th>Données</th><th>Finalité</th><th>Base légale</th></tr>
<tr><td>Adresse e-mail, prénom/nom éventuels, méthode de connexion (Apple, Google, e-mail), identifiant de compte</td><td>Créer et sécuriser votre compte, vous identifier</td><td>Exécution du contrat</td></tr>
<tr><td>Vidéos, images, enregistrements vocaux et instructions que vous envoyez ; vidéos produites ; miniatures</td><td>Réaliser et vous livrer le montage</td><td>Exécution du contrat</td></tr>
<tr><td>Montants, dates, statuts de paiement, mouvements du solde, informations de facturation (si renseignées)</td><td>Gérer votre solde, facturer, prévenir la fraude, respecter la comptabilité</td><td>Exécution du contrat ; obligation légale</td></tr>
<tr><td>Version de l'application, plateforme, journaux techniques, identifiants de travaux</td><td>Assurer le fonctionnement, la sécurité et le support</td><td>Intérêt légitime (sécurité, qualité du service)</td></tr>
<tr><td>Consentement à l'analyse par des IA tierces (version, date)</td><td>Conserver la preuve de votre accord explicite</td><td>Obligation légale / intérêt légitime</td></tr>
<tr><td>Jeton de notification</td><td>Vous prévenir lorsque votre vidéo est prête ou en cas d'incident</td><td>Votre consentement (permission du système, révocable à tout moment)</td></tr>
<tr><td>Preuve d'acceptation des conditions (version, date)</td><td>Conserver la preuve du contrat</td><td>Intérêt légitime</td></tr>
</table>
<p>Nous n'envoyons pas de prospection commerciale. Nous ne vendons pas vos données et ne les utilisons pas pour entraîner des modèles d'intelligence artificielle.</p>
<h2>3. Intelligence artificielle</h2>
<p><strong>Votre accord explicite est demandé avant chaque premier montage</strong> (case à cocher non pré-cochée, version et date conservées) : sans cet accord, vos vidéos ne sont pas transmises à des services d'intelligence artificielle tiers et le montage n'est pas lancé. Le montage est automatisé. Pour le réaliser, vos vidéos peuvent être analysées (transcription de la parole, analyse visuelle, aide à la sélection des meilleurs passages) par notre moteur et, lorsqu'ils sont activés, par des fournisseurs d'intelligence artificielle mentionnés ci-dessous, uniquement pour produire votre vidéo. Aucune décision produisant des effets juridiques à votre égard n'est prise de manière exclusivement automatisée ; le résultat est une vidéo que vous restez libre d'utiliser ou non.</p>
<h2>4. Destinataires et sous-traitants</h2>
<p>Vos données sont accessibles à notre personnel habilité (support, administration) dans la limite de leurs fonctions, et à nos sous-traitants :</p>
<table>
<tr><th>Sous-traitant</th><th>Finalité</th><th>Localisation / garanties</th></tr>
${c.cfg.processors.map((p) => `<tr><td>${c.esc(p.name)}</td><td>${c.esc(p.purpose)}</td><td>${c.esc(p.location)}</td></tr>`).join("")}
</table>
<p>Lorsque des données sont transférées hors de l'Union européenne, nous nous appuyons sur une décision d'adéquation (cadre de protection des données UE-États-Unis) ou sur les clauses contractuelles types de la Commission européenne.</p>
<h2>5. Durées de conservation</h2>
${item([
  `<strong>Fichiers envoyés : ${c.H} heures</strong> après leur envoi, puis suppression définitive.`,
  `<strong>Vidéos produites et miniatures : ${c.HV} heures</strong> après leur création, puis suppression définitive. Nous vous prévenons avant la suppression.`,
  "Compte, profil, historique de projets : jusqu'à la suppression de votre compte.",
  `Justificatifs de paiement et écritures de votre solde : ${c.cfg.retention.accountingYears} ans (obligation comptable, art. L123-22 du Code de commerce), <strong>sans lien avec votre identité</strong> après suppression du compte.`,
  "Journaux de sécurité et d'audit : durée strictement nécessaire à la sécurité et à la preuve."])}
<h2>6. Vos droits</h2>
<p>Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition, de portabilité et de définir des directives post-mortem. Vous pouvez les exercer dans l'application (Compte → Confidentialité) ou en écrivant à l'adresse ci-dessus ; nous répondons dans un délai d'un mois. Vous pouvez supprimer votre compte à tout moment (<a href="supprimer-mon-compte.html">voir la procédure</a>). Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).</p>
<h2>7. Cookies et traceurs</h2>
<p>Le service n'utilise <strong>aucun cookie publicitaire ni outil de mesure d'audience tiers</strong>. L'application web stocke localement dans votre navigateur uniquement les informations strictement nécessaires à votre connexion (session) et à votre confort (brouillon en cours) ; elles sont exemptées de consentement. Si nous activons un jour une mesure d'audience, elle ne le sera qu'avec votre accord préalable.</p>
<h2>8. Sécurité</h2>
<p>Connexions chiffrées (HTTPS), cloisonnement strict des données entre utilisateurs, fichiers privés accessibles uniquement par des liens signés de courte durée, secrets conservés côté serveur, journalisation des actions d'administration. Nous ne prétendons pas offrir de chiffrement de bout en bout.</p>
<h2>9. Mineurs</h2>
<p>Le service n'est pas destiné aux personnes de moins de 15 ans et est réservé aux majeurs ou aux mineurs autorisés par leur représentant légal.</p>
<h2>10. Modifications</h2>
<p>Nous pouvons mettre à jour cette politique ; la date de version figure en bas de page et les changements substantiels sont portés à votre connaissance dans l'application.</p>`,
  },

  // ───────────────────────────── Gestion des données
  "mes-donnees.html": {
    title: "Gestion de mes données",
    body: (c) => `<h1>Gestion de mes données</h1>
<p>Vous gardez la main sur vos données. Depuis l'application (<em>Compte → Confidentialité</em>) vous pouvez :</p>
${item(["consulter et modifier votre profil et vos informations de facturation ;", "télécharger ou supprimer chacune de vos vidéos ;", `retrouver vos mouvements de solde et vos reçus (<em>Compte → Paiements</em>) ;`, "<a href=\"supprimer-mon-compte.html\">supprimer votre compte et vos données</a>."])}
<p>Rappel : vos fichiers envoyés et vos vidéos produites sont supprimés automatiquement après ${c.H} heures.</p>
<p>Pour toute demande d'accès, de rectification ou de portabilité : <a href="mailto:${c.esc(c.cfg.dpo.email || c.cfg.brand.supportEmail)}">${c.esc(c.cfg.dpo.email || c.cfg.brand.supportEmail)}</a>. Détails dans la <a href="confidentialite.html">politique de confidentialité</a>.</p>`,
  },

  // ───────────────────────────── Suppression de compte (URL Google Play / App Store)
  "supprimer-mon-compte.html": {
    title: "Supprimer mon compte",
    body: (c) => `<h1>Supprimer mon compte et mes données</h1>
<p>Cette page est l'adresse de suppression de compte déclarée dans les consoles Google Play et App Store.</p>
<div class="card"><h2 style="margin-top:0">Depuis l'application</h2><ol><li>Ouvrez l'application et connectez-vous.</li><li>Allez dans <strong>Compte → Confidentialité → Supprimer mon compte</strong>.</li><li>Lisez l'explication, confirmez, puis saisissez le code reçu par e-mail.</li></ol>
<p><a class="btn" href="${c.esc(c.cfg.brand.appUrl)}/account/delete">Supprimer depuis le web</a></p></div>
<h2>Ce qui est supprimé</h2>
<p>Vos projets, vos fichiers (vidéos envoyées, vidéos produites, miniatures), votre profil, vos informations de facturation et vos données de connexion. Si vous avez utilisé « Se connecter avec Apple », l'accès Apple est également révoqué. Votre solde restant est supprimé avec le compte : demandez-en le remboursement avant si vous y avez droit (voir les <a href="conditions-de-vente.html">conditions de vente</a>).</p>
<h2>Ce qui est conservé</h2>
<p>Les justificatifs de paiement (montants et dates), <strong>sans lien avec votre identité</strong>, pendant ${c.cfg.retention.accountingYears} ans, car la loi nous impose de tenir notre comptabilité.</p>
<h2>Vous n'avez plus accès à l'application ?</h2>
<p>Écrivez-nous depuis l'adresse e-mail du compte à <a href="mailto:${c.esc(c.cfg.brand.supportEmail)}">${c.esc(c.cfg.brand.supportEmail)}</a> : nous supprimerons votre compte après avoir vérifié votre identité.</p>`,
  },
};
