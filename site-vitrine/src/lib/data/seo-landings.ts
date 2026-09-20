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
  },
];

export function getSeoLandingBySlug(slug: string): SeoLanding | undefined {
  return SEO_LANDINGS.find((page) => page.slug === slug);
}
