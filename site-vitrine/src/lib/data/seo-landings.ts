export type SeoLanding = {
  slug: string;
  title: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  intro: string;
  blocks: { heading: string; body: string }[];
  faqs: { question: string; answer: string }[];
  related: string[];
};

export const SEO_LANDINGS: SeoLanding[] = [
  {
    slug: "audit-site-internet",
    title: "Audit site internet : visibilité, conversion et acquisition",
    metaDescription:
      "Audit de site internet pour identifier les freins de visibilité, de conversion et d'acquisition. Diagnostic clair et priorités d'action.",
    eyebrow: "Diagnostic digital",
    h1: "Audit de site internet : trouvez ce qui bloque vos demandes.",
    intro:
      "Un site peut être propre visuellement et pourtant rester invisible, mal compris ou peu rentable. L'audit GC analyse le parcours complet : présence Google, clarté de l'offre, confiance, appels à l'action, qualification et passage vers le rendez-vous ou le devis.",
    blocks: [
      {
        heading: "Pourquoi votre site ne transforme pas forcément ses visites en clients",
        body:
          "Le problème n'est pas toujours le trafic. Une promesse floue, un premier écran trop générique, un formulaire trop long ou l'absence de preuve peuvent suffire à faire partir un prospect. L'audit cherche les fuites qui empêchent une visite de devenir une demande qualifiée.",
      },
      {
        heading: "Un audit qui regarde aussi votre visibilité Google",
        body:
          "Nous contrôlons les bases utiles au référencement : titres, structure des pages, indexabilité, maillage interne, contenus de services et cohérence avec les recherches de vos clients. L'objectif est de comprendre à la fois pourquoi Google vous montre peu et pourquoi les visiteurs convertissent peu.",
      },
      {
        heading: "Des priorités, pas une liste de problèmes",
        body:
          "Le rapport classe les corrections selon leur impact potentiel et leur facilité de mise en œuvre. Vous obtenez un ordre de travail concret : ce qu'il faut corriger maintenant, ce qu'il faut créer ensuite et ce qui peut attendre.",
      },
      {
        heading: "À qui s'adresse l'audit",
        body:
          "Aux artisans, TPE, PME, indépendants et entreprises de services qui ont déjà un site ou une présence en ligne mais veulent davantage de demandes, de devis ou de rendez-vous sans avancer à l'aveugle.",
      },
    ],
    faqs: [
      {
        question: "Que vérifie un audit de site internet ?",
        answer:
          "La visibilité, la structure SEO, la clarté de l'offre, la confiance, le parcours utilisateur, les appels à l'action et les points de conversion accessibles publiquement.",
      },
      {
        question: "Un audit peut-il aider si mon site a très peu de trafic ?",
        answer:
          "Oui. Il permet justement de distinguer un problème d'acquisition d'un problème de conversion et de prioriser les actions adaptées.",
      },
      {
        question: "Dois-je refaire tout mon site après l'audit ?",
        answer:
          "Pas forcément. Certaines situations nécessitent une refonte, d'autres seulement des corrections ciblées de structure, de contenu, de SEO local ou de conversion.",
      },
    ],
    related: ["audit-seo", "visibilite-google", "refonte-site-internet"],
  },
  {
    slug: "audit-seo",
    title: "Audit SEO : comprendre pourquoi votre site ne remonte pas sur Google",
    metaDescription:
      "Audit SEO pour analyser indexation, pages, contenus, maillage et visibilité Google. Identifiez les priorités qui peuvent améliorer votre référencement.",
    eyebrow: "Référencement naturel",
    h1: "Audit SEO : comprendre pourquoi Google ne vous place pas plus haut.",
    intro:
      "Un audit SEO utile ne consiste pas à sortir un score abstrait. Il relie les problèmes techniques, le contenu, les intentions de recherche et le maillage interne aux pages qui devraient réellement attirer des prospects.",
    blocks: [
      {
        heading: "Indexation et architecture",
        body:
          "Nous vérifions si les pages importantes peuvent être explorées et indexées, si les URL canoniques sont cohérentes et si le sitemap, les robots, les titres et la hiérarchie des contenus envoient des signaux clairs aux moteurs de recherche.",
      },
      {
        heading: "Intentions de recherche et pages manquantes",
        body:
          "Un site peut être techniquement propre mais absent sur Google parce qu'il ne possède aucune page correspondant aux recherches commerciales de ses clients : création de site, référencement local, audit, devis, métier ou problème précis.",
      },
      {
        heading: "Maillage interne et autorité",
        body:
          "Les pages importantes doivent recevoir des liens internes explicites depuis le reste du site. Nous repérons les pages isolées, les sujets qui se cannibalisent et les contenus qui devraient soutenir les pages commerciales.",
      },
      {
        heading: "Plan SEO priorisé",
        body:
          "Le résultat attendu est un plan de travail exploitable : corriger les blocages, renforcer les pages existantes, créer les pages manquantes puis mesurer impressions, clics et conversions dans Search Console et vos outils de suivi.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre audit SEO et audit de site internet ?",
        answer:
          "L'audit SEO se concentre sur la visibilité organique et les moteurs de recherche. L'audit de site couvre aussi le positionnement, la conversion et le parcours commercial.",
      },
      {
        question: "Combien de temps faut-il pour voir un effet SEO ?",
        answer:
          "Cela varie selon l'ancienneté du site, la concurrence et les changements réalisés. Un audit sert surtout à éviter de travailler plusieurs mois sur les mauvaises priorités.",
      },
      {
        question: "L'audit SEO inclut-il le référencement local ?",
        answer:
          "Oui lorsque l'activité dépend d'une zone géographique : pages locales utiles, cohérence de l'offre et Google Business Profile font partie de l'analyse.",
      },
    ],
    related: ["referencement-local", "visibilite-google", "audit-site-internet"],
  },
  {
    slug: "referencement-local",
    title: "Référencement local : être trouvé par les clients de votre zone",
    metaDescription:
      "Référencement local pour artisans, TPE et entreprises de services : site, pages de services, Google Business Profile et parcours vers le devis.",
    eyebrow: "SEO local",
    h1: "Référencement local : soyez visible quand un client cherche votre métier dans sa zone.",
    intro:
      "Pour une entreprise locale, le bon trafic vient souvent d'une recherche simple : un métier, un service ou un problème associé à une ville. Le référencement local relie votre site, vos pages de services et votre fiche Google pour capter cette intention.",
    blocks: [
      {
        heading: "Des pages de services qui correspondent aux recherches réelles",
        body:
          "Une page d'accueil générique ne peut pas répondre correctement à toutes les recherches. Il faut des pages distinctes pour les services importants, avec un contenu utile, des preuves et une action adaptée au besoin du prospect.",
      },
      {
        heading: "Google Business Profile et site doivent travailler ensemble",
        body:
          "La fiche Google attire l'attention locale ; le site doit ensuite rassurer et convertir. Coordonnées, services, zone d'intervention, avis, photos et pages du site doivent raconter la même histoire.",
      },
      {
        heading: "Métier + ville sans créer de pages artificielles",
        body:
          "L'objectif n'est pas de dupliquer la même page pour cent communes. Les pages locales doivent apporter une vraie information : zone servie, prestations, délais, exemples, contraintes locales et moyen de demander un devis.",
      },
      {
        heading: "Mesurer les demandes, pas seulement les positions",
        body:
          "Le référencement local devient intéressant quand on relie les impressions et clics aux appels, formulaires et rendez-vous. C'est cette chaîne qui permet de savoir quelles recherches apportent réellement des prospects.",
      },
    ],
    faqs: [
      {
        question: "Le référencement local est-il utile pour un artisan ?",
        answer:
          "Oui, particulièrement lorsque les clients choisissent un prestataire dans une zone précise et recherchent directement un métier ou un service près de chez eux.",
      },
      {
        question: "Faut-il une page pour chaque ville ?",
        answer:
          "Non. Une page locale n'est utile que si elle apporte un contenu réellement spécifique et correspond à une zone que l'entreprise sert effectivement.",
      },
      {
        question: "Le référencement local remplace-t-il Google Ads ?",
        answer:
          "Non. Le SEO local construit une visibilité organique progressive tandis que la publicité peut accélérer l'acquisition. Les deux peuvent être complémentaires.",
      },
    ],
    related: ["google-business-profile", "referencement-artisan", "visibilite-google"],
  },
  {
    slug: "google-business-profile",
    title: "Optimisation Google Business Profile pour gagner en visibilité locale",
    metaDescription:
      "Optimisez votre fiche Google Business Profile : catégories, services, photos, avis, cohérence avec le site et parcours vers l'appel ou le devis.",
    eyebrow: "Google Maps",
    h1: "Google Business Profile : transformez votre fiche Google en porte d'entrée commerciale.",
    intro:
      "Une fiche Google bien remplie ne suffit pas. Elle doit être cohérente avec votre site, vos services et votre zone d'intervention, puis conduire rapidement vers une action : appel, itinéraire, devis ou rendez-vous.",
    blocks: [
      {
        heading: "Clarifier ce que vous faites",
        body:
          "Catégorie principale, catégories secondaires, description et services doivent aider Google et le prospect à comprendre immédiatement votre activité. Une fiche trop vague perd en pertinence sur les recherches précises.",
      },
      {
        heading: "Renforcer la confiance",
        body:
          "Photos réelles, informations à jour, réponses aux avis et preuves visibles réduisent l'incertitude. Le site lié depuis la fiche doit reprendre les mêmes signaux de confiance et donner une suite évidente.",
      },
      {
        heading: "Connecter la fiche aux bonnes pages",
        body:
          "Au lieu de renvoyer systématiquement vers une page d'accueil générale, certaines intentions gagnent à pointer vers une page de service ou de prise de rendez-vous plus précise, lorsque cela correspond au parcours du client.",
      },
      {
        heading: "Suivre les actions utiles",
        body:
          "Les clics vers le site, appels, demandes d'itinéraire et conversions doivent être observés ensemble. L'objectif n'est pas d'avoir une fiche remplie : c'est d'obtenir davantage de contacts qualifiés.",
      },
    ],
    faqs: [
      {
        question: "Comment améliorer la visibilité d'une fiche Google ?",
        answer:
          "En travaillant la pertinence des catégories et services, la cohérence des informations, les contenus, les avis et surtout le lien entre la fiche et un site réellement utile.",
      },
      {
        question: "Une fiche Google suffit-elle sans site internet ?",
        answer:
          "Elle peut générer des contacts, mais un site permet de détailler les prestations, renforcer la confiance, couvrir davantage de recherches et mieux qualifier les demandes.",
      },
      {
        question: "Peut-on garantir la première place sur Google Maps ?",
        answer:
          "Non. Les résultats dépendent notamment de la pertinence, de la distance et de la notoriété. Une optimisation sérieuse améliore les signaux sans garantir une position fixe.",
      },
    ],
    related: ["referencement-local", "visibilite-google", "audit-seo"],
  },
  {
    slug: "visibilite-google",
    title: "Visibilité Google : rendre votre entreprise trouvable sur les bonnes recherches",
    metaDescription:
      "Améliorez la visibilité Google de votre entreprise avec des pages adaptées aux recherches clients, un SEO propre et un parcours qui transforme les clics en contacts.",
    eyebrow: "Visibilité",
    h1: "Être visible sur Google quand vos futurs clients cherchent déjà une solution.",
    intro:
      "La visibilité utile ne consiste pas à apparaître sur n'importe quelle requête. Elle consiste à être présent au moment où un prospect formule un besoin que votre entreprise peut réellement résoudre.",
    blocks: [
      {
        heading: "Couvrir les intentions à forte valeur",
        body:
          "Les recherches de service, de prix, de comparaison, de problème et de localisation ne doivent pas toutes arriver sur la même page. Une architecture claire donne à chaque intention importante une destination adaptée.",
      },
      {
        heading: "Créer des pages que Google peut comprendre",
        body:
          "Titre, H1, texte, liens internes, données structurées et URL doivent décrire naturellement le sujet. Le but n'est pas de répéter un mot-clé mais de traiter complètement la question du prospect.",
      },
      {
        heading: "Relier visibilité et conversion",
        body:
          "Une position Google n'a de valeur que si la page rassure et pousse à agir. Chaque porte d'entrée est donc reliée à une demande de diagnostic, de devis ou de rendez-vous selon l'intention.",
      },
      {
        heading: "Construire progressivement l'autorité",
        body:
          "Les pages commerciales sont soutenues par des guides, des questions fréquentes, des preuves réelles et un maillage interne logique. Cette profondeur est plus durable qu'une accumulation de pages quasi identiques.",
      },
    ],
    faqs: [
      {
        question: "Comment apparaître davantage sur Google ?",
        answer:
          "Il faut corriger les blocages techniques, créer des pages alignées sur les recherches de vos clients, renforcer leur contenu et développer des signaux de confiance et d'autorité.",
      },
      {
        question: "Pourquoi mon site existe mais n'apparaît presque pas ?",
        answer:
          "Il peut manquer de pages adaptées aux intentions recherchées, de liens internes, de contenu utile, d'autorité ou présenter un problème d'indexation.",
      },
      {
        question: "Le SEO peut-il générer des prospects ?",
        answer:
          "Oui lorsque les pages ciblent des recherches proches de l'achat et que le parcours transforme le clic en demande qualifiée.",
      },
    ],
    related: ["audit-seo", "referencement-local", "generation-de-leads"],
  },
  {
    slug: "generation-de-leads",
    title: "Génération de leads : transformer votre trafic en prospects qualifiés",
    metaDescription:
      "Système de génération de leads pour TPE, PME et services : acquisition, pages de conversion, qualification et prise de rendez-vous.",
    eyebrow: "Acquisition",
    h1: "Génération de leads : obtenez des prospects, pas seulement du trafic.",
    intro:
      "Un bon système d'acquisition relie une recherche, une publicité ou un contenu à une page précise, puis à une action mesurable. Le trafic est le début du parcours ; le lead qualifié est le résultat attendu.",
    blocks: [
      {
        heading: "Attirer une intention claire",
        body:
          "SEO, contenu, réseaux sociaux ou publicité doivent viser un problème réel et une offre identifiable. Plus l'intention de départ est précise, plus la page peut répondre avec une proposition pertinente.",
      },
      {
        heading: "Faire atterrir le prospect au bon endroit",
        body:
          "Une landing page ou une page de service doit reprendre la promesse qui a déclenché le clic, traiter les objections principales et proposer une seule prochaine étape.",
      },
      {
        heading: "Qualifier avant le rendez-vous",
        body:
          "Un formulaire court peut récupérer les informations qui changent réellement la suite : besoin, situation, objectif, délai ou type de projet. Cela évite de remplir l'agenda avec des demandes hors cible.",
      },
      {
        heading: "Mesurer jusqu'à la demande réelle",
        body:
          "Impressions, clics et vues ne suffisent pas. Il faut suivre les formulaires, prises de rendez-vous et demandes de devis pour savoir quels canaux et quelles pages produisent de vraies opportunités.",
      },
    ],
    faqs: [
      {
        question: "Qu'est-ce qu'un lead qualifié ?",
        answer:
          "Un contact qui correspond suffisamment à votre cible et a exprimé un besoin ou une intention permettant une suite commerciale pertinente.",
      },
      {
        question: "Faut-il beaucoup de trafic pour générer des leads ?",
        answer:
          "Pas nécessairement. Un trafic plus faible mais très intentionniste peut produire davantage de demandes qu'un gros volume de visiteurs peu concernés.",
      },
      {
        question: "Quels canaux peuvent générer des leads ?",
        answer:
          "Le SEO, Google Ads, les réseaux sociaux, le contenu, les partenariats et la prospection peuvent tous alimenter un même parcours de qualification.",
      },
    ],
    related: ["landing-page", "tunnel-de-vente", "acquisition-artisan"],
  },
  {
    slug: "landing-page",
    title: "Création de landing page : convertir une campagne en demandes",
    metaDescription:
      "Création de landing page orientée conversion : message, preuve, objections, formulaire et suivi des demandes pour campagnes et acquisition.",
    eyebrow: "Conversion",
    h1: "Landing page : une page pensée pour transformer une intention en action.",
    intro:
      "Une landing page efficace ne cherche pas à présenter toute l'entreprise. Elle reprend une intention précise, répond aux objections essentielles et conduit le visiteur vers une seule action mesurable.",
    blocks: [
      {
        heading: "Un message aligné avec la source du clic",
        body:
          "Si un prospect clique sur une annonce ou un résultat Google pour un service précis, il doit retrouver immédiatement cette promesse. Une page générique crée une rupture et augmente les abandons.",
      },
      {
        heading: "La preuve au bon moment",
        body:
          "Réalisations, avis vérifiables, méthode, garanties réelles et éléments de confiance doivent apparaître là où le prospect se pose la question, sans transformer la page en catalogue.",
      },
      {
        heading: "Un formulaire proportionné à l'intention",
        body:
          "Trop de champs réduisent souvent le nombre de demandes ; trop peu peuvent dégrader leur qualité. La bonne structure demande uniquement les informations utiles à la prochaine étape.",
      },
      {
        heading: "Tracking et amélioration continue",
        body:
          "La page doit mesurer les clics importants, démarrages de formulaire et conversions. Les décisions d'optimisation peuvent alors s'appuyer sur le comportement réel plutôt que sur le goût personnel.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre une landing page et un site vitrine ?",
        answer:
          "Un site couvre plusieurs sujets et parcours. Une landing page répond à une intention unique et vise généralement une action précise.",
      },
      {
        question: "Une landing page est-elle utile pour Google Ads ?",
        answer:
          "Oui lorsqu'elle est cohérente avec l'annonce et l'intention recherchée, car elle évite de renvoyer le prospect vers une page trop générale.",
      },
      {
        question: "Peut-on référencer une landing page sur Google ?",
        answer:
          "Oui si elle apporte un contenu utile et répond à une intention de recherche, mais certaines pages purement publicitaires peuvent être conçues principalement pour les campagnes.",
      },
    ],
    related: ["generation-de-leads", "tunnel-de-vente", "audit-site-internet"],
  },
  {
    slug: "tunnel-de-vente",
    title: "Création de tunnel de vente : de la visite au rendez-vous",
    metaDescription:
      "Création de tunnel de vente et de qualification : pages, formulaire, prise de rendez-vous et suivi pour transformer l'attention en opportunités commerciales.",
    eyebrow: "Parcours commercial",
    h1: "Tunnel de vente : donnez une suite claire à chaque visite.",
    intro:
      "Un tunnel de vente n'est pas nécessairement une série compliquée de pages. Pour beaucoup d'entreprises, il suffit d'un parcours simple : comprendre l'offre, vérifier l'adéquation, répondre à quelques questions puis réserver ou demander un devis.",
    blocks: [
      {
        heading: "Réduire les choix inutiles",
        body:
          "Plus une page propose d'actions concurrentes, plus le prospect hésite. Le tunnel hiérarchise le parcours et donne une prochaine étape évidente sans empêcher ceux qui ont besoin d'informations de les trouver.",
      },
      {
        heading: "Qualifier sans créer de friction",
        body:
          "Les questions doivent servir la suite commerciale. Elles peuvent filtrer le type de besoin, le canal actuel, l'objectif ou le délai, mais elles ne doivent pas demander des informations dont personne ne se servira.",
      },
      {
        heading: "Connecter le rendez-vous au contexte",
        body:
          "Le calendrier ou la demande de devis arrivent après un minimum de contexte. Le prospect sait pourquoi il réserve, et l'entreprise reçoit les informations nécessaires pour préparer l'échange.",
      },
      {
        heading: "Suivre les abandons",
        body:
          "En mesurant chaque étape, on identifie l'endroit où les prospects quittent le parcours : page d'entrée, formulaire, confirmation ou calendrier. Cela permet de corriger le vrai point faible.",
      },
    ],
    faqs: [
      {
        question: "Un tunnel de vente convient-il à une entreprise de services ?",
        answer:
          "Oui. Il peut simplement organiser le passage entre la découverte du service, la qualification et la prise de rendez-vous.",
      },
      {
        question: "Combien de pages faut-il dans un tunnel ?",
        answer:
          "Cela dépend du niveau d'information nécessaire. Un parcours court peut être plus efficace qu'une succession de pages si l'offre est simple.",
      },
      {
        question: "Le tunnel remplace-t-il le site internet ?",
        answer:
          "Non. Le site construit la présence globale, tandis que le tunnel organise un parcours commercial précis.",
      },
    ],
    related: ["landing-page", "generation-de-leads", "audit-site-internet"],
  },
  {
    slug: "refonte-site-internet",
    title: "Refonte de site internet : moderniser, référencer et convertir",
    metaDescription:
      "Refonte de site internet pour améliorer performance, SEO, clarté de l'offre et conversion sans perdre les acquis utiles de l'ancien site.",
    eyebrow: "Refonte web",
    h1: "Refonte de site internet : ne changez pas seulement le design.",
    intro:
      "Une refonte réussie protège ce qui fonctionne déjà et corrige ce qui limite la visibilité ou les demandes. Le nouveau design n'est qu'une partie du travail : structure, contenus, SEO, vitesse, redirections et conversion comptent autant.",
    blocks: [
      {
        heading: "Conserver les actifs SEO utiles",
        body:
          "Avant de déplacer ou supprimer une URL, il faut comprendre ce qu'elle apporte. Les redirections, les liens internes et les contenus déjà visibles peuvent préserver une partie de l'historique au lieu de repartir inutilement de zéro.",
      },
      {
        heading: "Repenser l'offre et les pages de services",
        body:
          "Une refonte est l'occasion de séparer les grandes intentions commerciales et de donner à chaque service une page claire. Cela aide à la fois le visiteur et le moteur de recherche.",
      },
      {
        heading: "Optimiser le mobile et la vitesse",
        body:
          "Une expérience lente ou difficile sur téléphone peut faire perdre une demande avant même que l'argumentaire soit lu. La performance et la lisibilité doivent être intégrées dès la conception.",
      },
      {
        heading: "Mesurer avant et après",
        body:
          "Une refonte doit avoir des indicateurs : impressions, clics organiques, formulaires, appels ou rendez-vous. Sans point de comparaison, il est difficile de savoir si le nouveau site produit réellement plus de valeur.",
      },
    ],
    faqs: [
      {
        question: "Quand faut-il refaire un site internet ?",
        answer:
          "Lorsque sa structure limite la compréhension, le SEO ou la conversion, ou lorsque les corrections successives coûtent plus cher qu'une architecture propre.",
      },
      {
        question: "Une refonte peut-elle faire perdre du référencement ?",
        answer:
          "Oui si les URL, contenus et redirections sont modifiés sans précaution. Une migration préparée réduit ce risque.",
      },
      {
        question: "Peut-on conserver le contenu de l'ancien site ?",
        answer:
          "Oui, surtout les contenus utiles et déjà visibles. Ils peuvent être retravaillés plutôt que supprimés.",
      },
    ],
    related: ["audit-site-internet", "audit-seo", "visibilite-google"],
  },
  {
    slug: "creation-site-artisan",
    title: "Création de site internet pour artisan : visibilité locale et devis",
    metaDescription:
      "Création de site internet pour artisan : pages métiers, réalisations, SEO local, Google Business et demande de devis pensée pour générer des contacts.",
    eyebrow: "Artisans",
    h1: "Création de site internet pour artisan : montrez votre savoir-faire et générez des devis.",
    intro:
      "Un artisan n'a pas besoin d'un site compliqué. Il a besoin d'être trouvé sur ses prestations et sa zone, de montrer des réalisations réelles et de permettre au prospect de demander un devis sans friction.",
    blocks: [
      {
        heading: "Une page par prestation importante",
        body:
          "Plomberie, couverture, peinture, menuiserie, rénovation ou autre métier : les services principaux doivent être expliqués séparément lorsque les clients les recherchent séparément. Cela crée des portes d'entrée Google plus précises.",
      },
      {
        heading: "Des réalisations qui rassurent",
        body:
          "Photos de chantiers, type de travaux, zone et contexte apportent une preuve beaucoup plus forte qu'une phrase générique. Elles peuvent aussi soutenir le maillage vers les pages de services concernées.",
      },
      {
        heading: "SEO local et Google Business",
        body:
          "Le site doit préciser les zones réellement servies et rester cohérent avec la fiche Google. Le but est de capter les recherches de type métier + zone sans créer des pages artificielles pour des villes où l'entreprise n'intervient pas.",
      },
      {
        heading: "Un devis facile à demander",
        body:
          "Sur mobile, le prospect doit pouvoir appeler ou envoyer une demande rapidement. Un formulaire guidé peut demander le type de chantier, la zone, le délai et quelques informations utiles sans devenir interminable.",
      },
    ],
    faqs: [
      {
        question: "Quel site internet pour un artisan ?",
        answer:
          "Un site rapide, mobile, avec des pages de prestations, des réalisations, des informations locales et un parcours de devis simple.",
      },
      {
        question: "Un artisan a-t-il besoin de SEO ?",
        answer:
          "Oui si une part importante des nouveaux clients recherche le métier ou la prestation sur Google avant de choisir un professionnel.",
      },
      {
        question: "Le site doit-il afficher les prix ?",
        answer:
          "Pas obligatoirement. Lorsque les chantiers varient beaucoup, expliquer les facteurs de prix et proposer un devis peut être plus pertinent.",
      },
    ],
    related: ["referencement-artisan", "acquisition-artisan", "referencement-local"],
  },
  {
    slug: "referencement-artisan",
    title: "Référencement artisan : être trouvé sur Google dans votre zone",
    metaDescription:
      "Référencement Google pour artisans : SEO local, pages de prestations, Google Business Profile, maillage et contenu pour attirer des demandes de devis.",
    eyebrow: "SEO artisans",
    h1: "Référencement pour artisan : apparaissez sur les recherches qui déclenchent des devis.",
    intro:
      "Le référencement d'un artisan repose sur des intentions très concrètes : un métier, une prestation, un problème et souvent une zone. Le site doit couvrir ces recherches avec des pages utiles et une preuve locale crédible.",
    blocks: [
      {
        heading: "Cibler les prestations rentables",
        body:
          "Toutes les requêtes n'ont pas la même valeur. Le plan SEO commence par les prestations que l'entreprise veut réellement vendre et les zones qu'elle peut réellement servir.",
      },
      {
        heading: "Construire des pages métiers solides",
        body:
          "Chaque page importante doit expliquer le service, les cas fréquents, le déroulement, les éléments de confiance et la manière de demander un devis. Une simple répétition de mots-clés n'apporte rien.",
      },
      {
        heading: "Renforcer les signaux locaux",
        body:
          "La fiche Google, les avis, les coordonnées, les réalisations et les mentions cohérentes de la zone d'intervention renforcent la compréhension locale de l'activité.",
      },
      {
        heading: "Suivre les requêtes qui produisent des contacts",
        body:
          "Search Console montre les recherches et les pages qui gagnent des impressions. Le suivi des formulaires et appels permet ensuite de distinguer la visibilité utile du trafic sans valeur commerciale.",
      },
    ],
    faqs: [
      {
        question: "Comment référencer un artisan sur Google ?",
        answer:
          "Avec un site techniquement propre, des pages de prestations utiles, un SEO local cohérent, une fiche Google optimisée et des preuves réelles.",
      },
      {
        question: "Combien de mots-clés faut-il cibler ?",
        answer:
          "On raisonne surtout par groupes d'intentions. Une bonne page peut couvrir plusieurs variantes proches sans avoir besoin d'une page différente pour chaque mot-clé.",
      },
      {
        question: "Faut-il créer des pages pour chaque ville ?",
        answer:
          "Seulement lorsqu'elles correspondent à une vraie zone de service et peuvent contenir une information spécifique utile au prospect.",
      },
    ],
    related: ["creation-site-artisan", "referencement-local", "google-business-profile"],
  },
  {
    slug: "acquisition-artisan",
    title: "Acquisition pour artisans : générer plus de demandes de devis",
    metaDescription:
      "Acquisition digitale pour artisans : SEO local, pages de services, Google, campagnes et tunnel de devis pour générer des prospects qualifiés.",
    eyebrow: "Leads artisans",
    h1: "Acquisition artisan : construisez un flux de demandes de devis mesurable.",
    intro:
      "L'acquisition ne consiste pas à publier partout. Pour un artisan, le système doit capter un besoin local, montrer rapidement la capacité à réaliser le chantier puis faciliter la demande de devis.",
    blocks: [
      {
        heading: "Google pour la demande déjà existante",
        body:
          "Les prospects qui recherchent directement une prestation ont une intention forte. SEO local, Google Business et campagnes peuvent capter cette demande à différents horizons.",
      },
      {
        heading: "Des pages alignées sur chaque chantier recherché",
        body:
          "Une annonce ou une recherche de couverture ne doit pas atterrir sur une page générique qui mélange tous les métiers. La page d'arrivée doit parler précisément du besoin recherché.",
      },
      {
        heading: "Qualifier le devis",
        body:
          "Type de travaux, code postal, délai et photos éventuelles peuvent réduire les échanges inutiles et donner à l'artisan un premier niveau d'information avant de rappeler.",
      },
      {
        heading: "Suivre le coût réel d'une opportunité",
        body:
          "Le système doit permettre de savoir d'où vient la demande : recherche organique, fiche Google, publicité, réseau social ou recommandation. Cela aide à investir davantage dans les canaux qui produisent des chantiers.",
      },
    ],
    faqs: [
      {
        question: "Comment obtenir plus de demandes de devis pour un artisan ?",
        answer:
          "En combinant visibilité locale, pages de prestations, preuves de réalisations et un parcours de devis rapide et mesurable.",
      },
      {
        question: "Le SEO suffit-il pour trouver des clients ?",
        answer:
          "Il peut devenir un canal important mais prend du temps. La publicité ou la prospection peuvent compléter le dispositif pendant la montée en puissance.",
      },
      {
        question: "Faut-il un site si j'ai déjà une fiche Google ?",
        answer:
          "Le site permet de couvrir davantage de recherches, montrer vos réalisations et qualifier le besoin avant le contact.",
      },
    ],
    related: ["creation-site-artisan", "referencement-artisan", "generation-de-leads"],
  },
  {
    slug: "site-internet-pme",
    title: "Création de site internet pour PME : visibilité, leads et conversion",
    metaDescription:
      "Site internet pour PME : architecture de services, SEO, conversion, génération de leads et suivi des demandes dans un système digital cohérent.",
    eyebrow: "PME",
    h1: "Site internet pour PME : faites du site un actif commercial.",
    intro:
      "Pour une PME, le site doit souvent servir plusieurs objectifs : crédibilité, référencement, présentation des offres, génération de leads et prise de contact. L'architecture doit organiser ces besoins plutôt que les empiler sur une seule page.",
    blocks: [
      {
        heading: "Structurer l'offre par besoin client",
        body:
          "Les services doivent être regroupés de manière compréhensible et chaque offre importante doit disposer d'une page capable de répondre à une intention de recherche précise.",
      },
      {
        heading: "Connecter SEO et acquisition",
        body:
          "Les pages organiques, campagnes et contenus peuvent alimenter un même système de conversion. Cela évite d'avoir un site d'un côté et des actions marketing dispersées de l'autre.",
      },
      {
        heading: "Créer des chemins de conversion adaptés",
        body:
          "Un prospect qui veut un devis, un diagnostic ou une démonstration n'a pas le même besoin. Les appels à l'action et formulaires peuvent être adaptés à la valeur et à la complexité de l'offre.",
      },
      {
        heading: "Mesurer par source et par page",
        body:
          "Le suivi doit permettre d'identifier les pages qui attirent des prospects et celles qui assistent la conversion. C'est ce qui transforme progressivement le site en actif commercial pilotable.",
      },
    ],
    faqs: [
      {
        question: "Quel type de site pour une PME ?",
        answer:
          "Un site structuré autour des offres et des parcours clients, avec des pages de services, des preuves, du SEO et des conversions mesurables.",
      },
      {
        question: "Un site PME doit-il avoir un blog ?",
        answer:
          "Seulement si des contenus peuvent répondre à de vraies questions clients et soutenir les pages commerciales. Publier sans stratégie n'est pas nécessaire.",
      },
      {
        question: "Peut-on refaire seulement une partie du site ?",
        answer:
          "Oui si l'architecture existante le permet. Les pages les plus importantes peuvent parfois être améliorées progressivement.",
      },
    ],
    related: ["generation-de-leads", "audit-site-internet", "refonte-site-internet"],
  },,
  {
    slug: "agence-marketing-digital",
    title: "Agence marketing digital : acquisition, SEO, Ads et conversion",
    metaDescription:
      "Agence marketing digital pour TPE, PME et entreprises de services : stratégie, SEO, Google Ads, Meta Ads, contenu, conversion et génération de leads.",
    eyebrow: "Marketing digital",
    h1: "Agence marketing digital : reliez visibilité, acquisition et conversion.",
    intro:
      "Le marketing digital fonctionne mieux quand les canaux ne sont pas gérés séparément. GC relie le site, le SEO, la publicité, le contenu et le parcours commercial pour que chaque action puisse contribuer à une demande, un devis ou un rendez-vous.",
    blocks: [
      {
        heading: "Une stratégie avant les canaux",
        body:
          "Le choix entre SEO, Google Ads, Meta Ads, contenu ou réseaux sociaux dépend du besoin, du cycle de vente et de la maturité de l'entreprise. Nous commençons par l'intention commerciale et les points de conversion avant de répartir l'effort entre les canaux.",
      },
      {
        heading: "Un site capable de recevoir le trafic",
        body:
          "Envoyer davantage de visiteurs vers une page confuse gaspille le budget. Les pages de services, landing pages, formulaires et preuves sont donc traités comme une partie du marketing, pas comme un chantier séparé.",
      },
      {
        heading: "Mesurer les vraies opportunités",
        body:
          "Les impressions et les clics sont des signaux intermédiaires. Le pilotage doit aller jusqu'aux formulaires, appels, rendez-vous et demandes qualifiées pour distinguer les canaux qui produisent de la valeur des canaux qui produisent seulement de l'attention.",
      },
      {
        heading: "Faire travailler SEO, Ads et contenu ensemble",
        body:
          "Les campagnes peuvent capter rapidement une intention tandis que le SEO construit une présence durable. Les contenus répondent aux objections et les données de conversion montrent ensuite quelles offres et quelles pages méritent davantage d'investissement.",
      },
    ],
    faqs: [
      {
        question: "Que fait une agence de marketing digital ?",
        answer:
          "Elle structure les canaux numériques qui servent l'acquisition et la conversion : site, SEO, publicité, contenu, réseaux sociaux, mesure et parcours commercial.",
      },
      {
        question: "Faut-il commencer par le SEO ou la publicité ?",
        answer:
          "Cela dépend de l'urgence, du budget, de la demande existante et de la qualité du site. Les deux leviers peuvent être complémentaires plutôt que concurrents.",
      },
      {
        question: "Comment mesurer le marketing digital ?",
        answer:
          "En reliant les sources de trafic aux actions commerciales qui comptent réellement : demandes de devis, formulaires qualifiés, appels et rendez-vous.",
      },
    ],
    related: ["strategie-marketing-digital", "audit-marketing-digital", "generation-de-leads"],
  },
  {
    slug: "strategie-marketing-digital",
    title: "Stratégie marketing digital : construire un plan d'acquisition mesurable",
    metaDescription:
      "Construisez une stratégie marketing digital claire : objectifs, canaux, offre, SEO, publicité, contenu, conversion, tracking et priorités.",
    eyebrow: "Stratégie digitale",
    h1: "Stratégie marketing digital : choisissez les bons canaux dans le bon ordre.",
    intro:
      "Une stratégie digitale utile transforme un objectif business en une suite d'actions mesurables. Elle précise qui attirer, avec quelle offre, sur quels canaux, vers quelles pages et avec quels indicateurs.",
    blocks: [
      {
        heading: "Partir de l'objectif commercial",
        body:
          "Avant de choisir un canal, il faut définir le résultat attendu : davantage de devis, de rendez-vous, de ventes ou de demandes qualifiées. Cela permet de choisir une métrique liée au business plutôt qu'un simple volume de vues.",
      },
      {
        heading: "Cartographier la demande",
        body:
          "Les recherches Google, les questions clients, les objections et les comportements sur les réseaux indiquent où se trouve l'intention. Cette cartographie sert à décider quelles pages, campagnes et contenus doivent être créés en premier.",
      },
      {
        heading: "Orchestrer les canaux",
        body:
          "SEO, Ads, réseaux sociaux et contenu n'ont pas le même rôle. La stratégie répartit la captation de demande existante, la création d'attention et la conversion au lieu de demander à un seul canal de tout faire.",
      },
      {
        heading: "Installer une boucle d'amélioration",
        body:
          "Chaque action produit des données : requêtes, clics, coût, formulaires, taux de conversion. Le plan est ensuite ajusté selon les signaux qui montrent une progression vers les objectifs commerciaux.",
      },
    ],
    faqs: [
      {
        question: "Que contient une stratégie marketing digital ?",
        answer:
          "Des objectifs, des audiences, une offre, des canaux prioritaires, des pages de destination, un plan de contenu, des indicateurs et un calendrier d'exécution.",
      },
      {
        question: "Combien de canaux faut-il utiliser au départ ?",
        answer:
          "Le plus souvent, mieux vaut maîtriser quelques canaux reliés à un bon parcours de conversion que disperser le budget et le temps sur toutes les plateformes.",
      },
      {
        question: "Une stratégie digitale doit-elle être revue souvent ?",
        answer:
          "Oui. Les données de trafic, de conversion et de coût doivent servir à ajuster les priorités sans changer de direction à chaque variation mineure.",
      },
    ],
    related: ["agence-marketing-digital", "audit-marketing-digital", "marketing-digital-pme"],
  },
  {
    slug: "marketing-digital-pme",
    title: "Marketing digital pour PME : visibilité, acquisition et leads",
    metaDescription:
      "Marketing digital pour PME : stratégie, site, SEO, Google Ads, Meta Ads, contenu, réseaux sociaux et conversion pour générer des opportunités mesurables.",
    eyebrow: "PME",
    h1: "Marketing digital pour PME : concentrez l'effort sur ce qui génère des opportunités.",
    intro:
      "Une PME n'a pas besoin d'être présente partout. Elle a besoin d'un système digital où le site, Google, les campagnes et le contenu servent une même promesse et une même prochaine étape.",
    blocks: [
      {
        heading: "Prioriser selon le cycle de vente",
        body:
          "Une entreprise avec une demande Google forte n'a pas la même priorité qu'une offre nouvelle qui doit d'abord créer de l'attention. Le plan marketing doit s'adapter au comportement réel des prospects.",
      },
      {
        heading: "Transformer le site en actif commercial",
        body:
          "Les pages de services, preuves, cas réels, formulaires et prises de rendez-vous doivent être pensés pour convertir le trafic provenant du SEO, des Ads et des réseaux sociaux.",
      },
      {
        heading: "Éviter la dispersion budgétaire",
        body:
          "Le marketing digital peut vite devenir une addition d'abonnements, d'outils et de campagnes. Une architecture simple aide à concentrer le budget sur les canaux qui produisent des signaux commerciaux mesurables.",
      },
      {
        heading: "Piloter avec quelques indicateurs",
        body:
          "Coût par lead, taux de conversion, volume de demandes qualifiées et source des opportunités sont généralement plus utiles que de suivre des dizaines de métriques sans lien direct avec le développement commercial.",
      },
    ],
    faqs: [
      {
        question: "Quels leviers de marketing digital pour une PME ?",
        answer:
          "Le site, le SEO, le référencement local, Google Ads, Meta Ads, le contenu, les réseaux sociaux et l'email peuvent être combinés selon l'offre et le cycle de vente.",
      },
      {
        question: "Une PME doit-elle être sur tous les réseaux sociaux ?",
        answer:
          "Non. Il est plus efficace de choisir les plateformes où se trouvent les prospects et de relier le contenu à une action commerciale claire.",
      },
      {
        question: "Comment savoir si le marketing digital est rentable ?",
        answer:
          "En suivant les coûts et le nombre d'opportunités ou de ventes attribuables aux différents canaux, avec des règles de tracking cohérentes.",
      },
    ],
    related: ["strategie-marketing-digital", "site-internet-pme", "generation-de-leads"],
  },
  {
    slug: "audit-marketing-digital",
    title: "Audit marketing digital : identifier les canaux et fuites prioritaires",
    metaDescription:
      "Audit marketing digital : analyse du site, SEO, Ads, contenu, réseaux sociaux, conversion et tracking pour identifier les priorités d'acquisition.",
    eyebrow: "Audit digital",
    h1: "Audit marketing digital : découvrez où votre acquisition perd des opportunités.",
    intro:
      "Un audit marketing digital regarde l'ensemble du parcours : comment les prospects vous découvrent, où ils arrivent, ce qui les convainc, ce qui les bloque et comment les conversions sont mesurées.",
    blocks: [
      {
        heading: "Visibilité et sources de trafic",
        body:
          "Nous examinons les portes d'entrée organiques, locales, publicitaires et sociales disponibles publiquement pour comprendre si l'entreprise couvre les recherches et les canaux cohérents avec son offre.",
      },
      {
        heading: "Message, offre et conversion",
        body:
          "Une acquisition coûteuse peut cacher un problème de page, de promesse ou de preuve. L'audit vérifie donc la continuité entre le canal, la page d'arrivée et l'action demandée au prospect.",
      },
      {
        heading: "Tracking et décisions",
        body:
          "Sans suivi des formulaires, appels ou rendez-vous, il est difficile d'arbitrer les budgets. L'audit identifie les événements et points de mesure nécessaires pour piloter les prochaines actions.",
      },
      {
        heading: "Plan d'action par impact",
        body:
          "Le résultat n'est pas une liste infinie de recommandations. Les corrections sont ordonnées pour distinguer les fuites urgentes, les opportunités de croissance et les optimisations secondaires.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre audit SEO et audit marketing digital ?",
        answer:
          "L'audit SEO se concentre sur la visibilité organique. L'audit marketing digital couvre aussi la publicité, le contenu, les réseaux sociaux, les pages de conversion et la mesure.",
      },
      {
        question: "Faut-il avoir des campagnes publicitaires pour faire un audit ?",
        answer:
          "Non. L'audit peut partir d'un site et d'une présence organique existante, puis déterminer quels canaux supplémentaires auraient du sens.",
      },
      {
        question: "Que reçoit-on après l'audit ?",
        answer:
          "Un diagnostic des principaux écarts et un ordre de priorité pour corriger les fuites et développer les canaux les plus cohérents.",
      },
    ],
    related: ["agence-marketing-digital", "audit-site-internet", "audit-seo"],
  },
  {
    slug: "marketing-local",
    title: "Marketing local : attirer plus de clients dans votre zone",
    metaDescription:
      "Marketing local pour artisans, commerces et entreprises de services : Google, SEO local, fiche établissement, contenu, Ads et conversion.",
    eyebrow: "Marketing local",
    h1: "Marketing local : soyez visible là où vos clients vous cherchent.",
    intro:
      "Le marketing local combine présence Google, référencement local, pages de services, avis, contenus et campagnes géographiques pour transformer une zone de chalandise en flux de demandes mesurables.",
    blocks: [
      {
        heading: "Capter la demande locale existante",
        body:
          "Les recherches métier + ville, service + zone et les résultats Maps concentrent une intention élevée. Le site et la fiche Google doivent répondre de manière cohérente à cette demande.",
      },
      {
        heading: "Construire de la confiance locale",
        body:
          "Avis, réalisations, photos, informations de zone et preuves réelles donnent au prospect des raisons de choisir une entreprise proche plutôt qu'un acteur générique.",
      },
      {
        heading: "Utiliser la publicité quand elle accélère le parcours",
        body:
          "Google Ads ou Meta Ads peuvent compléter le référencement naturel sur une zone précise, à condition que la page d'arrivée et le suivi des demandes soient déjà suffisamment solides.",
      },
      {
        heading: "Mesurer par zone et par service",
        body:
          "Les demandes doivent être rapprochées des services et zones ciblés afin d'identifier les combinaisons qui génèrent réellement des opportunités rentables.",
      },
    ],
    faqs: [
      {
        question: "Quels canaux sont utiles pour le marketing local ?",
        answer:
          "Google Business Profile, SEO local, pages de services, avis, Google Ads, Meta Ads et contenus locaux peuvent être combinés selon l'activité.",
      },
      {
        question: "Le marketing local convient-il aux artisans ?",
        answer:
          "Oui, particulièrement lorsque la majorité des clients recherche un prestataire dans une zone de déplacement définie.",
      },
      {
        question: "Faut-il créer une page pour chaque ville ?",
        answer:
          "Non. Les pages locales doivent être utiles, spécifiques et correspondre à de vraies zones servies plutôt qu'à une simple duplication de contenu.",
      },
    ],
    related: ["referencement-local", "google-business-profile", "marketing-digital-artisan"],
  },
  {
    slug: "publicite-google-ads",
    title: "Google Ads : campagnes d'acquisition orientées leads",
    metaDescription:
      "Google Ads pour générer des leads : structure de campagne, mots-clés, landing pages, tracking des conversions et optimisation des demandes qualifiées.",
    eyebrow: "SEA",
    h1: "Google Ads : captez une demande déjà active et mesurez chaque opportunité.",
    intro:
      "Google Ads peut accélérer l'acquisition lorsque des prospects recherchent déjà votre service. La rentabilité dépend toutefois autant des mots-clés et des annonces que de la page d'arrivée, du formulaire et du suivi des conversions.",
    blocks: [
      {
        heading: "Cibler l'intention plutôt que le volume",
        body:
          "Les requêtes commerciales, de service et locales sont souvent plus utiles que des mots-clés très larges. Une structure claire aide à faire correspondre annonces, intentions et pages d'arrivée.",
      },
      {
        heading: "Créer une landing page cohérente",
        body:
          "Le message de la page doit reprendre la promesse et le service recherchés. Une page générale oblige le prospect à refaire le chemin et peut dégrader la conversion.",
      },
      {
        heading: "Suivre les conversions utiles",
        body:
          "Formulaires, appels et rendez-vous doivent être suivis pour différencier le clic coûteux du lead qualifié. Les campagnes peuvent ensuite être optimisées selon la valeur réelle des demandes.",
      },
      {
        heading: "Faire travailler Ads et SEO ensemble",
        body:
          "Les données de recherche payante peuvent révéler des intentions intéressantes pour le SEO, tandis que les pages organiques solides améliorent aussi l'expérience globale du trafic payant.",
      },
    ],
    faqs: [
      {
        question: "Google Ads convient-il aux petites entreprises ?",
        answer:
          "Oui lorsque la demande existe et que le budget est concentré sur des recherches pertinentes, avec un suivi rigoureux des conversions.",
      },
      {
        question: "Faut-il une landing page dédiée ?",
        answer:
          "Ce n'est pas obligatoire, mais une page très cohérente avec l'annonce et le besoin du prospect peut améliorer la compréhension et la conversion.",
      },
      {
        question: "SEO ou Google Ads ?",
        answer:
          "Google Ads peut produire des données et du trafic rapidement, tandis que le SEO construit une visibilité progressive. Les deux approches peuvent fonctionner ensemble.",
      },
    ],
    related: ["landing-page", "generation-de-leads", "strategie-marketing-digital"],
  },
  {
    slug: "publicite-meta-ads",
    title: "Meta Ads : campagnes Facebook et Instagram orientées conversion",
    metaDescription:
      "Meta Ads pour générer des prospects : offre, créatifs, ciblage, landing pages, formulaires et tracking des conversions Facebook et Instagram.",
    eyebrow: "Social Ads",
    h1: "Meta Ads : transformez l'attention Facebook et Instagram en demandes.",
    intro:
      "Sur Meta, le prospect ne cherche pas toujours activement votre service. La campagne doit donc créer l'intérêt, faire comprendre l'offre rapidement puis réduire la friction entre le clic et la demande.",
    blocks: [
      {
        heading: "Commencer par une offre compréhensible",
        body:
          "Un ciblage précis ne compense pas une proposition floue. L'annonce doit présenter un problème, une promesse ou une preuve suffisamment claire pour déclencher l'attention.",
      },
      {
        heading: "Tester les angles et créatifs",
        body:
          "Vidéo courte, preuve, démonstration, avant/après ou message direct peuvent répondre à différentes objections. Les tests doivent isoler ce qui améliore réellement les demandes, pas seulement les vues.",
      },
      {
        heading: "Réduire la friction après le clic",
        body:
          "Landing page, formulaire instantané ou prise de rendez-vous doivent être choisis selon le niveau d'engagement demandé. Le parcours doit rester simple sur mobile.",
      },
      {
        heading: "Optimiser sur des conversions réelles",
        body:
          "Le coût par clic ne suffit pas. Il faut suivre le coût par lead, la qualité des demandes et, lorsque c'est possible, les rendez-vous ou ventes issus des campagnes.",
      },
    ],
    faqs: [
      {
        question: "Meta Ads fonctionne-t-il pour les entreprises locales ?",
        answer:
          "Oui pour certaines offres, notamment lorsque des visuels, une preuve locale ou une promotion peuvent créer rapidement de l'intérêt dans une zone ciblée.",
      },
      {
        question: "Facebook Ads ou Instagram Ads ?",
        answer:
          "Les deux passent par l'écosystème Meta et peuvent être testés selon l'audience, le format créatif et le comportement observé.",
      },
      {
        question: "Faut-il beaucoup de créatifs ?",
        answer:
          "Il est utile de tester plusieurs angles, mais la qualité des hypothèses et le suivi des conversions sont plus importants que la quantité brute de variantes.",
      },
    ],
    related: ["landing-page", "strategie-reseaux-sociaux", "generation-de-leads"],
  },
  {
    slug: "strategie-reseaux-sociaux",
    title: "Stratégie réseaux sociaux : contenu, acquisition et conversion",
    metaDescription:
      "Stratégie réseaux sociaux pour entreprise : positionnement, piliers de contenu, Instagram, TikTok, LinkedIn, conversion et mesure des demandes.",
    eyebrow: "Social media",
    h1: "Stratégie réseaux sociaux : publiez pour créer une prochaine action.",
    intro:
      "Une stratégie sociale utile ne se limite pas à un calendrier de publications. Elle définit les sujets, formats et appels à l'action qui transforment l'attention en visite, en demande ou en rendez-vous.",
    blocks: [
      {
        heading: "Choisir les plateformes selon le prospect",
        body:
          "Instagram, TikTok, LinkedIn et Facebook n'ont pas les mêmes usages. Le choix doit partir de l'audience, de la capacité à produire les bons formats et de l'étape du parcours que le contenu doit servir.",
      },
      {
        heading: "Construire des piliers de contenu",
        body:
          "Expertise, preuve, démonstration, réponse aux objections et coulisses peuvent former une architecture éditoriale répétable. Cela évite de publier au hasard et aide le prospect à comprendre progressivement l'offre.",
      },
      {
        heading: "Relier le contenu au site",
        body:
          "Le lien en bio, les pages de service et les landing pages doivent donner une suite à l'attention. Sans ce pont, les réseaux sociaux restent difficiles à relier à un résultat commercial.",
      },
      {
        heading: "Mesurer au-delà de l'engagement",
        body:
          "Vues, likes et abonnés peuvent aider à comprendre la distribution, mais les clics, formulaires, rendez-vous et demandes indiquent si le contenu contribue réellement à l'acquisition.",
      },
    ],
    faqs: [
      {
        question: "Quel réseau social choisir pour une entreprise ?",
        answer:
          "Celui où se trouve votre audience et où vous pouvez produire des formats cohérents avec votre offre et votre cycle de vente.",
      },
      {
        question: "Combien faut-il publier ?",
        answer:
          "La fréquence dépend des ressources et de la plateforme. La régularité et la qualité du système de contenu comptent davantage qu'un volume impossible à tenir.",
      },
      {
        question: "Comment transformer des abonnés en prospects ?",
        answer:
          "Avec des contenus liés à des problèmes réels, une offre compréhensible et une prochaine étape claire vers une page, un diagnostic ou un rendez-vous.",
      },
    ],
    related: ["content-marketing", "publicite-meta-ads", "generation-de-leads"],
  },
  {
    slug: "content-marketing",
    title: "Content marketing : créer du contenu qui attire et convertit",
    metaDescription:
      "Content marketing pour entreprise : stratégie éditoriale, SEO, réseaux sociaux, contenus commerciaux et maillage vers les pages qui génèrent des leads.",
    eyebrow: "Contenu",
    h1: "Content marketing : transformez les questions de vos prospects en portes d'entrée.",
    intro:
      "Le contenu devient utile lorsqu'il répond à une question réellement posée par le marché et conduit naturellement vers une offre, un service ou une prochaine étape pertinente.",
    blocks: [
      {
        heading: "Partir des recherches et objections",
        body:
          "Les questions de prix, de méthode, de comparaison et de choix constituent des sujets à forte valeur. Elles peuvent attirer des prospects plus tôt dans leur réflexion et renforcer les pages commerciales.",
      },
      {
        heading: "Créer plusieurs formats depuis un même sujet",
        body:
          "Un guide peut alimenter une vidéo courte, un carrousel, une FAQ ou une séquence commerciale. Cette logique réduit l'effort de production et renforce la cohérence du message.",
      },
      {
        heading: "Construire le maillage vers les pages de services",
        body:
          "Le contenu informatif ne doit pas rester isolé. Des liens contextuels orientent le lecteur vers les pages commerciales liées au problème qu'il vient d'explorer.",
      },
      {
        heading: "Mesurer les contenus qui assistent la conversion",
        body:
          "Un contenu n'a pas besoin de convertir immédiatement pour être utile. Les chemins de navigation et les conversions assistées permettent d'identifier les sujets qui participent réellement à la décision.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre content marketing et SEO ?",
        answer:
          "Le content marketing organise la création et la distribution de contenus. Le SEO est l'un des canaux qui peut leur apporter de la visibilité dans les moteurs de recherche.",
      },
      {
        question: "Quels contenus génèrent des prospects ?",
        answer:
          "Souvent ceux qui répondent à des questions proches de la décision : prix, comparaison, méthode, erreurs, délais, preuves et choix d'une solution.",
      },
      {
        question: "Faut-il publier beaucoup ?",
        answer:
          "Non. Une bibliothèque plus petite de contenus utiles et reliés aux pages commerciales peut être plus efficace qu'un grand volume sans stratégie.",
      },
    ],
    related: ["strategie-reseaux-sociaux", "visibilite-google", "strategie-marketing-digital"],
  },
  {
    slug: "automatisation-marketing",
    title: "Automatisation marketing : suivi des leads et relances",
    metaDescription:
      "Automatisation marketing pour PME et services : capture des leads, notifications, qualification, relances, rendez-vous et suivi sans perdre les prospects.",
    eyebrow: "Automatisation",
    h1: "Automatisation marketing : ne laissez plus une demande se perdre entre deux outils.",
    intro:
      "L'automatisation marketing doit enlever les tâches répétitives sans rendre le parcours impersonnel. Capture, notification, qualification et relance peuvent être reliées pour que chaque demande reçoive une suite cohérente.",
    blocks: [
      {
        heading: "Centraliser les nouvelles demandes",
        body:
          "Formulaires, campagnes et pages de diagnostic doivent alimenter un point de suivi fiable. L'objectif est d'éviter qu'un lead reste bloqué dans une boîte mail ou un outil isolé.",
      },
      {
        heading: "Qualifier avant la relance",
        body:
          "Quelques informations sur le besoin, l'objectif et le délai permettent d'adapter la prochaine étape et d'éviter des séquences identiques pour tous les prospects.",
      },
      {
        heading: "Automatiser les rappels utiles",
        body:
          "Confirmation, rappel de rendez-vous, relance après formulaire ou suivi d'une demande peuvent être automatisés lorsqu'ils apportent une information utile et respectent le consentement.",
      },
      {
        heading: "Garder une vue sur le parcours",
        body:
          "Un système simple doit permettre de savoir quelles demandes sont nouvelles, qualifiées, en rendez-vous ou sans réponse afin de mesurer les pertes et améliorer le processus.",
      },
    ],
    faqs: [
      {
        question: "Que peut-on automatiser en marketing ?",
        answer:
          "La capture des leads, certaines notifications, les rappels, la qualification, des relances et le transfert d'informations entre outils.",
      },
      {
        question: "L'automatisation remplace-t-elle le commercial ?",
        answer:
          "Non. Elle réduit surtout les tâches répétitives et facilite le suivi afin que l'équipe puisse se concentrer sur les échanges qui nécessitent une intervention humaine.",
      },
      {
        question: "Faut-il un CRM pour commencer ?",
        answer:
          "Pas toujours. Le besoin dépend du volume de leads et de la complexité du suivi, mais une source de vérité claire devient rapidement utile quand plusieurs canaux alimentent les demandes.",
      },
    ],
    related: ["generation-de-leads", "tunnel-de-vente", "strategie-marketing-digital"],
  },
  {
    slug: "marketing-digital-artisan",
    title: "Marketing digital pour artisan : visibilité locale et demandes de devis",
    metaDescription:
      "Marketing digital pour artisans : site, SEO local, Google Business, Google Ads, Meta Ads, contenu et parcours de devis pour générer des demandes.",
    eyebrow: "Artisans",
    h1: "Marketing digital pour artisan : combinez Google, preuve et demande de devis.",
    intro:
      "Pour un artisan, le marketing digital doit rester simple : être trouvé sur les prestations et les zones pertinentes, montrer des réalisations réelles et permettre au prospect de demander un devis rapidement.",
    blocks: [
      {
        heading: "Être présent quand le besoin est urgent",
        body:
          "Google, Google Maps et les pages de prestations captent une demande déjà formulée. Ce sont souvent les premières portes d'entrée à construire pour les métiers recherchés localement.",
      },
      {
        heading: "Montrer les chantiers plutôt que promettre",
        body:
          "Photos, réalisations, avis vérifiables, assurances et zones d'intervention donnent une preuve concrète du savoir-faire et réduisent l'incertitude avant la demande de devis.",
      },
      {
        heading: "Accélérer avec les campagnes",
        body:
          "Google Ads peut capter une recherche active et Meta Ads peut créer de la demande à partir de visuels ou d'offres locales. Les campagnes deviennent plus utiles lorsque le site et le suivi sont déjà solides.",
      },
      {
        heading: "Rendre le devis simple sur mobile",
        body:
          "Type de chantier, localisation, délai et photos éventuelles suffisent souvent à une première qualification. Le parcours doit être court et adapté aux prospects qui cherchent depuis leur téléphone.",
      },
    ],
    faqs: [
      {
        question: "Quel marketing digital pour un artisan ?",
        answer:
          "Le plus souvent : site de prestations, SEO local, Google Business Profile, avis, réalisations et, selon le budget, Google Ads ou Meta Ads.",
      },
      {
        question: "Faut-il être sur les réseaux sociaux ?",
        answer:
          "Ils peuvent être utiles pour montrer des chantiers et créer de la confiance, mais ils ne remplacent pas les canaux qui captent directement une recherche locale.",
      },
      {
        question: "Comment mesurer les résultats ?",
        answer:
          "En suivant les appels, formulaires et demandes de devis provenant des différents canaux plutôt que seulement les vues ou les clics.",
      },
    ],
    related: ["creation-site-artisan", "referencement-artisan", "marketing-local"],
  },
  {
    slug: "generation-leads-b2b",
    title: "Génération de leads B2B : acquisition, qualification et rendez-vous",
    metaDescription:
      "Génération de leads B2B : SEO, Google Ads, contenus, landing pages, qualification et suivi pour créer des opportunités commerciales mesurables.",
    eyebrow: "Lead generation B2B",
    h1: "Génération de leads B2B : construisez un pipeline de demandes qualifiées.",
    intro:
      "La génération de leads B2B ne consiste pas à accumuler des contacts. Elle doit attirer les bons comptes, capter un signal d'intérêt, qualifier la demande et transmettre au commercial un contexte exploitable.",
    blocks: [
      {
        heading: "Cibler les bonnes intentions",
        body:
          "Les recherches de services, comparaisons, problèmes métiers et solutions peuvent révéler une intention forte. SEO, Google Ads et contenu doivent donc être structurés autour des sujets qui rapprochent réellement le prospect d'une décision.",
      },
      {
        heading: "Créer des pages qui qualifient",
        body:
          "Une page B2B efficace précise le problème, la cible, la valeur de l'offre, la méthode et la prochaine étape. Le formulaire peut ensuite recueillir seulement les informations utiles à la qualification commerciale.",
      },
      {
        heading: "Relier marketing et vente",
        body:
          "Une demande n'a de valeur que si elle arrive au bon moment, avec assez de contexte et une relance claire. Le système doit donc connecter les campagnes, le site, le CRM ou le suivi commercial.",
      },
      {
        heading: "Mesurer la qualité, pas seulement le volume",
        body:
          "Le coût par lead est insuffisant si une majorité des contacts est hors cible. Le pilotage doit intégrer la qualification, les rendez-vous, les opportunités et, lorsque possible, les ventes.",
      },
    ],
    faqs: [
      {
        question: "Qu'est-ce qu'un lead B2B qualifié ?",
        answer:
          "Un contact professionnel qui correspond suffisamment à la cible et manifeste un besoin, un intérêt ou un contexte permettant une suite commerciale pertinente.",
      },
      {
        question: "Quels canaux génèrent des leads B2B ?",
        answer:
          "SEO, Google Ads, contenu, LinkedIn, email, prospection et partenariats peuvent être combinés selon la cible et le cycle de vente.",
      },
      {
        question: "Comment améliorer la qualité des leads ?",
        answer:
          "En affinant le ciblage, le message, la page d'arrivée, les questions de qualification et les critères transmis à l'équipe commerciale.",
      },
    ],
    related: ["agence-acquisition-b2b", "marketing-b2b", "generation-de-leads"],
  },
  {
    slug: "agence-acquisition-b2b",
    title: "Agence acquisition B2B : SEO, Ads, contenu et génération de leads",
    metaDescription:
      "Agence d'acquisition B2B : stratégie, SEO, Google Ads, landing pages, contenu, tracking et qualification pour générer des opportunités commerciales.",
    eyebrow: "Acquisition B2B",
    h1: "Agence acquisition B2B : reliez chaque canal à une opportunité commerciale.",
    intro:
      "Une acquisition B2B performante combine souvent plusieurs leviers : recherche, publicité, contenu, conversion et suivi commercial. L'enjeu est de faire travailler ces canaux dans un même parcours plutôt que de les piloter en silos.",
    blocks: [
      {
        heading: "Identifier les canaux les plus proches du revenu",
        body:
          "Pour certaines offres, Google capte une demande déjà active. Pour d'autres, il faut créer la demande avec du contenu, LinkedIn ou des campagnes. Le plan dépend du marché, du panier moyen et du cycle de décision.",
      },
      {
        heading: "Aligner message et landing pages",
        body:
          "Chaque campagne ou groupe d'intentions doit conduire vers une page cohérente. Cette continuité réduit la friction et permet de mieux comprendre quelles promesses attirent les bons prospects.",
      },
      {
        heading: "Installer une qualification exploitable",
        body:
          "Secteur, taille, besoin, délai, budget ou situation actuelle peuvent servir à orienter le lead. Le formulaire doit rester proportionné à la valeur de la demande.",
      },
      {
        heading: "Piloter sur les opportunités",
        body:
          "Le suivi idéal rapproche source, campagne, page, lead, rendez-vous et opportunité. C'est cette continuité qui permet de savoir si une hausse du trafic produit réellement plus de business.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre acquisition B2B et génération de leads B2B ?",
        answer:
          "L'acquisition couvre l'ensemble des canaux et du parcours qui attirent les prospects. La génération de leads se concentre davantage sur la transformation de cette audience en contacts qualifiés.",
      },
      {
        question: "Quels KPI suivre en acquisition B2B ?",
        answer:
          "Les leads qualifiés, rendez-vous, opportunités, coût par lead qualifié et taux de conversion sont généralement plus utiles que les clics seuls.",
      },
      {
        question: "Faut-il utiliser plusieurs canaux ?",
        answer:
          "Pas nécessairement au départ. Il est souvent préférable de maîtriser quelques leviers cohérents puis d'élargir lorsque le parcours de conversion est stable.",
      },
    ],
    related: ["generation-leads-b2b", "strategie-marketing-digital", "publicite-google-ads"],
  },
  {
    slug: "marketing-b2b",
    title: "Marketing B2B : stratégie digitale, contenu, leads et conversion",
    metaDescription:
      "Marketing B2B : stratégie, SEO, contenu, Google Ads, LinkedIn, landing pages, génération de leads et tracking pour PME et entreprises de services.",
    eyebrow: "Marketing B2B",
    h1: "Marketing B2B : transformez la visibilité en conversations commerciales.",
    intro:
      "Le marketing B2B doit accompagner une décision souvent plus longue et plus rationnelle. Les pages, contenus et campagnes doivent aider le prospect à comprendre le problème, comparer les solutions et avancer vers un échange commercial.",
    blocks: [
      {
        heading: "Couvrir les différentes étapes de décision",
        body:
          "Un prospect peut chercher une définition, un prix, une méthode, une comparaison ou directement un prestataire. Chaque étape mérite un contenu ou une page adaptée à son niveau d'intention.",
      },
      {
        heading: "Créer de la preuve sans surpromettre",
        body:
          "Méthode, démonstrations, cas réels, expertise visible et explication du processus renforcent la confiance. Les preuves doivent rester vérifiables et cohérentes avec la maturité de l'entreprise.",
      },
      {
        heading: "Relier contenu et acquisition",
        body:
          "Le contenu peut soutenir le SEO, LinkedIn, l'email et les commerciaux. Un même sujet peut devenir guide, post, séquence, FAQ et support de vente lorsqu'il répond à une objection récurrente.",
      },
      {
        heading: "Mesurer l'influence jusqu'au pipeline",
        body:
          "Les conversions B2B ne sont pas toujours immédiates. Il faut donc suivre les étapes intermédiaires : téléchargement, formulaire, rendez-vous, opportunité et évolution du pipeline.",
      },
    ],
    faqs: [
      {
        question: "Qu'est-ce qui différencie le marketing B2B du B2C ?",
        answer:
          "Le cycle de décision est souvent plus long, implique davantage de critères et peut nécessiter plusieurs interactions avant la prise de contact ou la vente.",
      },
      {
        question: "Quels contenus fonctionnent en B2B ?",
        answer:
          "Guides, comparatifs, études de cas réelles, démonstrations, réponses aux objections, contenus métier et pages de services détaillées.",
      },
      {
        question: "LinkedIn est-il obligatoire en B2B ?",
        answer:
          "Non. Il peut être utile, mais Google, l'email, le SEO, les partenariats et la prospection peuvent être tout aussi importants selon la cible.",
      },
    ],
    related: ["generation-leads-b2b", "content-marketing", "agence-acquisition-b2b"],
  },
  {
    slug: "growth-marketing",
    title: "Growth marketing : acquisition, activation et conversion mesurables",
    metaDescription:
      "Growth marketing pour PME et entreprises de services : acquisition, tests, conversion, tracking, contenu et automatisation pour accélérer la croissance.",
    eyebrow: "Growth",
    h1: "Growth marketing : expérimentez sur le parcours complet, pas seulement sur le trafic.",
    intro:
      "Le growth marketing consiste à améliorer les étapes qui relient l'acquisition au revenu : attirer, convertir, qualifier, relancer et mesurer. Les tests sont utiles lorsqu'ils répondent à une hypothèse précise et à un indicateur concret.",
    blocks: [
      {
        heading: "Trouver le principal goulot d'étranglement",
        body:
          "Avant de tester dix canaux, il faut identifier l'étape qui limite le système : manque de trafic, mauvaise intention, page faible, formulaire abandonné ou suivi commercial incomplet.",
      },
      {
        heading: "Tester des hypothèses simples",
        body:
          "Promesse, offre, landing page, formulaire, créatif, mot-clé ou séquence de relance peuvent être testés séparément pour comprendre ce qui améliore réellement le résultat.",
      },
      {
        heading: "Construire des boucles d'apprentissage",
        body:
          "Chaque test doit produire une conclusion exploitable. Les résultats alimentent ensuite les contenus, campagnes et pages afin que les apprentissages ne restent pas isolés dans un seul canal.",
      },
      {
        heading: "Éviter les vanity metrics",
        body:
          "La croissance ne se mesure pas uniquement en trafic ou en abonnés. Les leads qualifiés, rendez-vous, activation et revenu restent les signaux les plus proches du business.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre growth marketing et marketing digital ?",
        answer:
          "Le growth marketing insiste davantage sur l'expérimentation rapide, la mesure et l'optimisation du parcours complet, alors que le marketing digital couvre l'ensemble des canaux numériques.",
      },
      {
        question: "Le growth marketing convient-il aux PME ?",
        answer:
          "Oui si l'entreprise dispose d'un minimum de données et peut tester des changements sans multiplier inutilement les outils.",
      },
      {
        question: "Quels tests lancer en premier ?",
        answer:
          "Ceux qui ciblent le plus gros goulot d'étranglement du parcours : message, page, formulaire, campagne ou relance.",
      },
    ],
    related: ["strategie-marketing-digital", "automatisation-marketing", "generation-de-leads"],
  },
  {
    slug: "webmarketing",
    title: "Webmarketing : SEO, Ads, contenu et conversion pour générer des clients",
    metaDescription:
      "Webmarketing pour entreprises : site, SEO, Google Ads, réseaux sociaux, contenu, conversion et génération de leads dans une stratégie mesurable.",
    eyebrow: "Webmarketing",
    h1: "Webmarketing : transformez votre présence en système d'acquisition.",
    intro:
      "Le webmarketing regroupe les leviers qui permettent d'attirer une audience, de la convertir et de mesurer ce qui produit des opportunités. Le site reste le point central qui relie ces canaux.",
    blocks: [
      {
        heading: "Structurer la présence avant d'ajouter du trafic",
        body:
          "Le site, les pages de services, la proposition de valeur et les conversions doivent être suffisamment clairs pour accueillir le trafic venant du SEO, des Ads et des réseaux sociaux.",
      },
      {
        heading: "Choisir les canaux selon l'intention",
        body:
          "Google capte souvent une demande active, les réseaux sociaux créent de l'attention et le contenu accompagne la décision. Le mix dépend du comportement réel des prospects.",
      },
      {
        heading: "Faire circuler la preuve",
        body:
          "Avis, réalisations, expertise, FAQ et démonstrations peuvent être réutilisés entre le site, les annonces et les réseaux afin de renforcer la cohérence et la confiance.",
      },
      {
        heading: "Mesurer jusqu'à la conversion",
        body:
          "Le webmarketing devient pilotable lorsque les campagnes, les pages et les contenus sont reliés aux formulaires, appels ou rendez-vous plutôt qu'à des statistiques isolées.",
      },
    ],
    faqs: [
      {
        question: "Quelle différence entre webmarketing et marketing digital ?",
        answer:
          "Les deux termes se recouvrent largement. Webmarketing insiste souvent davantage sur les leviers liés au web : site, SEO, publicité, contenu et conversion.",
      },
      {
        question: "Quels leviers webmarketing pour une petite entreprise ?",
        answer:
          "Site, référencement local, Google Business Profile, SEO, contenu, Google Ads et réseaux sociaux selon la cible et le budget.",
      },
      {
        question: "Par quoi commencer ?",
        answer:
          "Par un objectif commercial clair, un parcours de conversion fonctionnel et les canaux où la demande est la plus proche de votre offre.",
      },
    ],
    related: ["agence-marketing-digital", "strategie-marketing-digital", "visibilite-google"],
  },
  {
    slug: "communication-digitale",
    title: "Communication digitale : contenu, réseaux sociaux et visibilité web",
    metaDescription:
      "Communication digitale pour entreprise : positionnement, site, contenu, réseaux sociaux, visibilité Google et parcours vers les demandes commerciales.",
    eyebrow: "Communication digitale",
    h1: "Communication digitale : rendez votre message cohérent sur tous les points de contact.",
    intro:
      "La communication digitale ne sert pas uniquement à publier. Elle doit rendre l'offre compréhensible, renforcer la confiance et donner une suite claire aux personnes qui découvrent l'entreprise en ligne.",
    blocks: [
      {
        heading: "Clarifier le message central",
        body:
          "Le site, les profils sociaux et les contenus doivent expliquer la même promesse avec des formulations adaptées au canal. Une communication contradictoire ou trop générale réduit la mémorisation.",
      },
      {
        heading: "Organiser les contenus par rôle",
        body:
          "Certains contenus attirent l'attention, d'autres rassurent, démontrent l'expertise ou répondent aux objections. Cette répartition évite de publier uniquement des annonces commerciales.",
      },
      {
        heading: "Relier visibilité et action",
        body:
          "Chaque canal doit proposer une prochaine étape adaptée : consulter une page, demander un diagnostic, réserver un rendez-vous ou déposer une demande de devis.",
      },
      {
        heading: "Mesurer les signaux utiles",
        body:
          "Portée et engagement aident à comprendre la distribution, mais les clics, recherches de marque et conversions montrent davantage l'effet réel de la communication.",
      },
    ],
    faqs: [
      {
        question: "Que comprend la communication digitale ?",
        answer:
          "Le site, les réseaux sociaux, les contenus, l'identité de marque en ligne, les messages, les campagnes et les parcours qui relient ces canaux.",
      },
      {
        question: "Communication digitale et marketing digital sont-ils identiques ?",
        answer:
          "Ils se recouvrent, mais la communication se concentre davantage sur le message et la perception, tandis que le marketing inclut aussi l'acquisition, la conversion et la mesure commerciale.",
      },
      {
        question: "Comment mesurer une communication digitale ?",
        answer:
          "Avec des indicateurs de portée, engagement, clics, recherches de marque, trafic direct et conversions selon les objectifs.",
      },
    ],
    related: ["strategie-reseaux-sociaux", "content-marketing", "agence-marketing-digital"],
  },
  {
    slug: "inbound-marketing",
    title: "Inbound marketing : attirer des prospects avec contenu, SEO et conversion",
    metaDescription:
      "Inbound marketing : SEO, contenus, guides, landing pages, formulaires, nurturing et conversion pour attirer des prospects avant le rendez-vous.",
    eyebrow: "Inbound",
    h1: "Inbound marketing : faites venir les prospects en répondant à leurs questions.",
    intro:
      "L'inbound marketing attire des prospects grâce à des contenus et pages qui répondent à leurs besoins avant même le premier échange commercial. Le système fonctionne lorsque chaque contenu conduit vers une prochaine étape utile.",
    blocks: [
      {
        heading: "Couvrir les questions avant l'achat",
        body:
          "Prix, comparaison, méthode, erreurs, délais et choix de solution sont autant de recherches qui peuvent attirer un prospect avant qu'il ne cherche directement un prestataire.",
      },
      {
        heading: "Créer des parcours de progression",
        body:
          "Un guide informatif peut renvoyer vers une page de service, un audit, une démonstration ou un formulaire selon le niveau d'intention. Le contenu devient ainsi une étape du parcours.",
      },
      {
        heading: "Qualifier sans forcer",
        body:
          "Le prospect doit pouvoir avancer progressivement. Les formulaires et appels à l'action sont plus efficaces lorsqu'ils correspondent à la maturité de la personne plutôt qu'à une demande commerciale immédiate systématique.",
      },
      {
        heading: "Relier contenu et pipeline",
        body:
          "Le suivi des pages consultées, formulaires et rendez-vous permet de comprendre quels contenus assistent réellement la génération d'opportunités.",
      },
    ],
    faqs: [
      {
        question: "Qu'est-ce que l'inbound marketing ?",
        answer:
          "Une méthode qui attire des prospects avec des contenus et expériences utiles plutôt que de dépendre uniquement de la prospection directe.",
      },
      {
        question: "L'inbound marketing remplace-t-il la prospection ?",
        answer:
          "Non. Les deux peuvent être complémentaires, notamment en B2B où le contenu peut rassurer les prospects approchés par d'autres canaux.",
      },
      {
        question: "Quels contenus utiliser ?",
        answer:
          "Guides, comparatifs, FAQ, études de cas réelles, pages de services et contenus répondant aux questions fréquentes des prospects.",
      },
    ],
    related: ["content-marketing", "marketing-b2b", "generation-leads-b2b"],
  },
  {
    slug: "consultant-marketing-digital",
    title: "Consultant marketing digital : audit, stratégie et plan d'acquisition",
    metaDescription:
      "Consultant marketing digital pour TPE et PME : audit, stratégie, SEO, Ads, contenu, conversion, tracking et priorités d'acquisition.",
    eyebrow: "Conseil digital",
    h1: "Consultant marketing digital : transformez vos actions dispersées en plan priorisé.",
    intro:
      "Un accompagnement stratégique sert à comprendre ce qui doit être corrigé, créé ou arrêté avant de multiplier les dépenses. Le rôle est de relier les actions digitales à un objectif commercial et à des indicateurs suivis.",
    blocks: [
      {
        heading: "Diagnostiquer avant de recommander",
        body:
          "Site, SEO, campagnes, contenus, réseaux sociaux et conversion sont examinés ensemble afin d'identifier le vrai goulot d'étranglement plutôt que de proposer automatiquement un canal.",
      },
      {
        heading: "Définir un ordre d'exécution",
        body:
          "Les actions sont classées selon leur impact potentiel, leur dépendance et leur difficulté. Cela évite d'investir dans des campagnes avant d'avoir corrigé une page ou un suivi de conversion défaillant.",
      },
      {
        heading: "Choisir les indicateurs utiles",
        body:
          "Le plan doit associer chaque levier à un signal mesurable : impressions, leads, rendez-vous, coût par demande ou opportunités selon le stade du parcours.",
      },
      {
        heading: "Transmettre une méthode réutilisable",
        body:
          "L'objectif n'est pas de créer une dépendance à un tableau de bord complexe mais de rendre les décisions plus simples grâce à une logique de test, mesure et priorisation.",
      },
    ],
    faqs: [
      {
        question: "Quand faire appel à un consultant marketing digital ?",
        answer:
          "Lorsque plusieurs actions digitales existent mais manquent de cohérence, de mesure ou de priorités claires.",
      },
      {
        question: "Consultant ou agence marketing digital ?",
        answer:
          "Le consultant se concentre souvent davantage sur le diagnostic et la stratégie, tandis qu'une agence peut aussi assurer une partie plus importante de l'exécution.",
      },
      {
        question: "Un audit est-il nécessaire avant une stratégie ?",
        answer:
          "Il est fortement utile, car il permet de partir de la situation réelle plutôt que de recommandations génériques.",
      },
    ],
    related: ["audit-marketing-digital", "strategie-marketing-digital", "agence-marketing-digital"],
  },
  {
    slug: "marketing-digital-btp",
    title: "Marketing digital BTP : visibilité Google et demandes de devis",
    metaDescription:
      "Marketing digital pour entreprises du BTP : site, SEO local, Google Business, Google Ads, contenus et parcours de devis pour générer des demandes qualifiées.",
    eyebrow: "BTP & construction",
    h1: "Marketing digital BTP : gagnez en visibilité et facilitez les demandes de devis.",
    intro:
      "Dans le bâtiment, les prospects recherchent souvent une prestation précise, des réalisations et une entreprise capable d'intervenir dans leur zone. Le marketing digital doit donc relier visibilité locale, preuve métier et demande de devis.",
    blocks: [
      {
        heading: "Couvrir les prestations qui déclenchent des recherches",
        body:
          "Rénovation, couverture, isolation, maçonnerie, menuiserie ou autres prestations doivent être expliquées séparément lorsqu'elles correspondent à des intentions différentes. Cela donne au site plusieurs portes d'entrée pertinentes.",
      },
      {
        heading: "Montrer les réalisations et le contexte",
        body:
          "Des chantiers réels, leur type, leur zone et leur objectif créent une preuve plus forte qu'une promesse générique. Ils peuvent aussi soutenir les pages de services grâce au maillage interne.",
      },
      {
        heading: "Relier SEO local, fiche Google et Ads",
        body:
          "Le référencement naturel construit la visibilité dans le temps, la fiche Google renforce la présence locale et Google Ads peut accélérer la captation de demandes sur des recherches à forte intention.",
      },
      {
        heading: "Qualifier le devis dès le formulaire",
        body:
          "Type de chantier, localisation, délai, surface ou photos éventuelles donnent assez de contexte pour prioriser les demandes sans imposer un formulaire trop long.",
      },
    ],
    faqs: [
      {
        question: "Quels leviers marketing sont utiles pour une entreprise du BTP ?",
        answer:
          "Site de prestations, SEO local, Google Business Profile, réalisations, Google Ads et contenus selon la zone et les types de chantiers recherchés.",
      },
      {
        question: "Faut-il créer une page par prestation ?",
        answer:
          "Oui lorsque les prestations correspondent à des recherches et besoins réellement distincts. Chaque page doit toutefois apporter un contenu utile et spécifique.",
      },
      {
        question: "Comment mesurer l'acquisition BTP ?",
        answer:
          "En suivant les appels, formulaires, demandes de devis et la qualité des projets par source et par prestation.",
      },
    ],
    related: ["marketing-digital-artisan", "referencement-artisan", "publicite-google-ads"],
  },
  {
    slug: "creation-site-dentiste",
    title: "Création de site internet pour dentiste et cabinet dentaire",
    metaDescription:
      "Création de site internet pour dentiste : information claire, prise de rendez-vous, SEO local, performance mobile et respect des règles professionnelles applicables.",
    eyebrow: "Cabinets dentaires",
    h1: "Création de site internet pour dentiste : informer, rassurer et faciliter le rendez-vous.",
    intro:
      "Le site d'un cabinet dentaire doit d'abord informer clairement sur le cabinet, les soins proposés, l'accès et les modalités de rendez-vous. La visibilité locale et l'expérience mobile peuvent être travaillées dans le respect des règles professionnelles applicables.",
    blocks: [
      {
        heading: "Une information lisible pour les patients",
        body:
          "Les pages doivent expliquer les soins, l'équipe, les horaires, l'accès et les modalités de rendez-vous avec un langage compréhensible, sans promesse trompeuse ni mise en scène commerciale excessive.",
      },
      {
        heading: "SEO local et pages de soins",
        body:
          "Une architecture propre aide Google à comprendre le cabinet, sa zone et ses principales activités. Les pages sont créées pour informer sur des sujets réellement recherchés, pas pour multiplier artificiellement les villes.",
      },
      {
        heading: "Un parcours mobile simple",
        body:
          "Adresse, téléphone et lien vers la prise de rendez-vous doivent être faciles à trouver depuis un smartphone. La vitesse et la lisibilité sont particulièrement importantes lorsque la visite vient d'une recherche locale.",
      },
      {
        heading: "Conformité et données",
        body:
          "Les contenus, formulaires et outils intégrés doivent être choisis en tenant compte des obligations professionnelles et de confidentialité applicables au cabinet, notamment lorsqu'une donnée de santé pourrait être concernée.",
      },
    ],
    faqs: [
      {
        question: "Un dentiste a-t-il intérêt à avoir son propre site avec Doctolib ?",
        answer:
          "Le site peut compléter la plateforme de rendez-vous en présentant le cabinet, les soins, l'accès, l'équipe et des informations utiles aux patients.",
      },
      {
        question: "Peut-on faire du SEO local pour un cabinet dentaire ?",
        answer:
          "Oui, en travaillant une information utile, la cohérence locale et les pages du cabinet dans le respect des règles professionnelles applicables.",
      },
      {
        question: "Que doit contenir un site de cabinet dentaire ?",
        answer:
          "Au minimum les informations du cabinet, l'équipe, les soins présentés de façon informative, l'accès, les horaires, les contacts et la prise de rendez-vous.",
      },
    ],
    related: ["referencement-local", "google-business-profile", "audit-site-internet"],
  },
  {
    slug: "marketing-digital-dentiste",
    title: "Marketing digital dentiste : visibilité locale et information patient",
    metaDescription:
      "Marketing digital pour cabinet dentaire : site, SEO local, Google Business, contenu informatif et prise de rendez-vous dans le respect des règles professionnelles.",
    eyebrow: "Dentaire",
    h1: "Marketing digital dentiste : développez la visibilité du cabinet sans sacrifier la conformité.",
    intro:
      "La stratégie digitale d'un cabinet dentaire doit privilégier une information fiable, une visibilité locale cohérente et un parcours simple vers le rendez-vous, tout en respectant les obligations déontologiques et réglementaires applicables.",
    blocks: [
      {
        heading: "Prioriser la présence locale",
        body:
          "Le site, la fiche Google et les informations de contact doivent être cohérents. Une présence locale claire aide les patients à identifier le cabinet, ses horaires et ses modalités d'accès.",
      },
      {
        heading: "Créer des contenus informatifs",
        body:
          "Les pages de soins et FAQ peuvent répondre aux questions fréquentes avec un ton pédagogique. Elles doivent informer sans garantie de résultat ni affirmation excessive.",
      },
      {
        heading: "Faciliter la prise de rendez-vous",
        body:
          "Le parcours peut intégrer une plateforme de rendez-vous ou un contact simple, avec une attention particulière à la confidentialité et aux données collectées.",
      },
      {
        heading: "Mesurer sans sur-collecter",
        body:
          "Il est possible de suivre les visites et clics vers la prise de rendez-vous tout en limitant la collecte de données au nécessaire et en configurant les outils de mesure de manière adaptée.",
      },
    ],
    faqs: [
      {
        question: "Le marketing digital est-il possible pour un dentiste ?",
        answer:
          "Oui, mais la communication du cabinet doit respecter les règles professionnelles applicables. La stratégie peut se concentrer sur l'information, la visibilité locale et l'accès au rendez-vous.",
      },
      {
        question: "Quels canaux privilégier ?",
        answer:
          "Le site, le SEO local et Google Business Profile sont souvent des fondations utiles. D'autres canaux doivent être évalués selon les règles applicables et le besoin du cabinet.",
      },
      {
        question: "Peut-on mesurer les rendez-vous ?",
        answer:
          "On peut mesurer certains clics ou parcours vers un outil de rendez-vous, en restant attentif aux obligations de confidentialité et aux données sensibles.",
      },
    ],
    related: ["creation-site-dentiste", "referencement-local", "audit-marketing-digital"],
  },
  {
    slug: "marketing-entreprise-nettoyage",
    title: "Marketing pour entreprise de nettoyage : SEO local et demandes de devis",
    metaDescription:
      "Marketing digital pour entreprise de nettoyage : site, SEO local, Google Ads, pages de services, secteurs d'intervention et demandes de devis.",
    eyebrow: "Nettoyage",
    h1: "Marketing entreprise de nettoyage : soyez visible sur chaque service rentable.",
    intro:
      "Une entreprise de nettoyage peut servir des besoins très différents : bureaux, copropriétés, fin de chantier, vitres ou interventions ponctuelles. Le marketing doit distinguer ces intentions et guider chaque prospect vers un devis adapté.",
    blocks: [
      {
        heading: "Séparer les services importants",
        body:
          "Une page par grande prestation aide le prospect à comprendre l'offre et donne à Google des contenus plus précis pour les recherches de nettoyage professionnel.",
      },
      {
        heading: "Travailler les zones réellement servies",
        body:
          "Le SEO local et Google Business Profile peuvent renforcer la visibilité dans les zones d'intervention, sans créer des dizaines de pages identiques pour des communes non spécifiques.",
      },
      {
        heading: "Capter les recherches urgentes avec Google Ads",
        body:
          "Certaines demandes comme une remise en état ou un nettoyage après travaux peuvent être très intentionnistes. Des campagnes ciblées peuvent compléter le SEO lorsqu'elles renvoient vers une page adaptée.",
      },
      {
        heading: "Qualifier le devis B2B ou local",
        body:
          "Type de local, surface, fréquence, zone et délai sont des informations simples qui permettent de mieux préparer la réponse commerciale.",
      },
    ],
    faqs: [
      {
        question: "Comment trouver des clients pour une entreprise de nettoyage ?",
        answer:
          "SEO local, Google Business Profile, pages de services, Google Ads et prospection B2B peuvent être combinés selon la cible.",
      },
      {
        question: "Faut-il une page par service de nettoyage ?",
        answer:
          "Oui lorsque les besoins et recherches sont distincts, par exemple nettoyage de bureaux, fin de chantier ou vitres.",
      },
      {
        question: "Comment qualifier une demande de devis ?",
        answer:
          "En demandant le type de prestation, la surface, la fréquence, la localisation et le délai lorsque ces informations sont utiles.",
      },
    ],
    related: ["marketing-local", "publicite-google-ads", "generation-leads-b2b"],
  },
  {
    slug: "marketing-evenementiel-digital",
    title: "Marketing digital événementiel : visibilité, inscriptions et leads",
    metaDescription:
      "Marketing digital événementiel : landing pages, SEO, Ads, réseaux sociaux, inscriptions, contenu et suivi pour événements et agences événementielles.",
    eyebrow: "Événementiel",
    h1: "Marketing digital événementiel : transformez l'attention avant, pendant et après l'événement.",
    intro:
      "Un événement a une fenêtre d'attention limitée. La stratégie digitale doit relier campagne, page d'inscription, contenus, rappels et suivi post-événement pour prolonger l'impact commercial.",
    blocks: [
      {
        heading: "Créer une page d'événement claire",
        body:
          "Programme, cible, date, lieu, bénéfice et inscription doivent être compris rapidement. Une landing page dédiée permet aussi de mieux mesurer les sources d'inscription.",
      },
      {
        heading: "Amplifier avec Ads et réseaux sociaux",
        body:
          "Google Ads, Meta Ads, LinkedIn ou contenus organiques peuvent être utilisés selon le public et le format de l'événement. Le message doit rester cohérent entre la campagne et la page.",
      },
      {
        heading: "Automatiser les rappels utiles",
        body:
          "Confirmation, informations pratiques et rappels avant l'événement réduisent les abandons. Après l'événement, une relance peut proposer une ressource ou une suite adaptée.",
      },
      {
        heading: "Mesurer au-delà des inscriptions",
        body:
          "Les inscriptions, présences, prises de rendez-vous et opportunités post-événement permettent de mieux évaluer l'impact qu'un simple volume de vues.",
      },
    ],
    faqs: [
      {
        question: "Quels canaux pour promouvoir un événement ?",
        answer:
          "Le choix dépend du public : Google, Meta, LinkedIn, email, partenaires, SEO et contenus peuvent être combinés.",
      },
      {
        question: "Faut-il une landing page dédiée ?",
        answer:
          "Elle est souvent utile pour centraliser l'information, l'inscription et le suivi des conversions.",
      },
      {
        question: "Comment mesurer le ROI d'un événement ?",
        answer:
          "En rapprochant les coûts des inscriptions, présences, rendez-vous, opportunités et ventes attribuables à l'événement.",
      },
    ],
    related: ["landing-page", "publicite-meta-ads", "automatisation-marketing"],
  },
  {
    slug: "marketing-digital-restaurant",
    title: "Marketing digital restaurant : SEO local, Google et réservations",
    metaDescription:
      "Marketing digital pour restaurant : Google Business, SEO local, site, réseaux sociaux, Meta Ads et parcours de réservation directe.",
    eyebrow: "Restaurants",
    h1: "Marketing digital restaurant : transformez les recherches locales en réservations.",
    intro:
      "Pour un restaurant, une grande partie de la décision se joue entre Google, Maps, avis, photos, réseaux sociaux et facilité de réservation. Le système digital doit rendre ces points de contact cohérents et rapides.",
    blocks: [
      {
        heading: "Optimiser la présence Google locale",
        body:
          "Catégorie, horaires, menu, photos, avis et site doivent être à jour. La fiche Google est souvent la première interaction avant une réservation ou un itinéraire.",
      },
      {
        heading: "Faire du site un point de conversion",
        body:
          "Menu lisible sur mobile, localisation, horaires et réservation directe doivent être accessibles immédiatement. Le site peut aussi capter les recherches de spécialité ou de quartier lorsqu'elles sont pertinentes.",
      },
      {
        heading: "Utiliser les réseaux sociaux pour créer l'envie",
        body:
          "Photos, vidéos courtes, plats, coulisses et événements peuvent attirer l'attention locale. Le contenu doit ensuite renvoyer vers une réservation ou une information utile.",
      },
      {
        heading: "Mesurer réservations et actions locales",
        body:
          "Clics vers la réservation, appels, itinéraires et visites du menu permettent de comprendre quels canaux contribuent le plus à la fréquentation.",
      },
    ],
    faqs: [
      {
        question: "Quel marketing digital pour un restaurant ?",
        answer:
          "Google Business Profile, SEO local, site mobile, avis, réseaux sociaux et éventuellement Meta Ads ou Google Ads selon la zone et le positionnement.",
      },
      {
        question: "Un restaurant a-t-il besoin d'un site avec Google Maps ?",
        answer:
          "Le site complète la fiche Google en présentant le menu, l'univers, les événements et une réservation directe sous le contrôle du restaurant.",
      },
      {
        question: "Quels contenus publier ?",
        answer:
          "Plats, nouveautés, équipe, ambiance, événements et informations utiles, avec une prochaine étape claire vers la réservation ou la visite.",
      },
    ],
    related: ["marketing-local", "google-business-profile", "strategie-reseaux-sociaux"],
  }
];

export function getSeoLandingBySlug(slug: string): SeoLanding | undefined {
  return SEO_LANDINGS.find((page) => page.slug === slug);
}
