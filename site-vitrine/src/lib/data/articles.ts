export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  readingTime: string;
  publishedAt: string;
  content: string[];
};

export const ARTICLES: Article[] = [
  {
    slug: "pourquoi-un-beau-site-ne-suffit-plus",
    title: "Pourquoi un beau site ne suffit plus.",
    excerpt:
      "Le design ne fait plus la différence à lui seul. Ce qui compte, c'est ce que le site déclenche chez le visiteur.",
    readingTime: "4 min",
    publishedAt: "2026-02-10",
    content: [
      "Pendant longtemps, avoir un site propre et moderne suffisait à se distinguer. Ce n'est plus vrai : la majorité des entreprises ont aujourd'hui un site correct, parfois même élégant. Le design seul n'est plus un avantage compétitif, c'est un prérequis.",
      "La vraie question n'est plus « est-ce que mon site est beau ? » mais « est-ce que mon site produit quelque chose ? ». Un visiteur qui arrive, regarde, et repart sans laisser de trace n'a rien coûté à l'entreprise en apparence — mais il représente une opportunité perdue.",
      "Un site qui fonctionne comme un système pose une question claire au visiteur, y répond en quelques secondes, puis lui propose une action évidente. C'est cette mécanique, plus que l'esthétique, qui transforme une visite en opportunité commerciale.",
      "Concrètement, cela veut dire repenser chaque page autour d'un objectif unique plutôt que d'empiler de l'information. Moins de texte, plus d'intention. C'est ce déplacement — du site vitrine au système — qui fait la différence aujourd'hui.",
    ],
  },
  {
    slug: "instagram-canal-acquisition",
    title: "Comment transformer Instagram en canal d'acquisition.",
    excerpt:
      "Publier régulièrement ne suffit pas à générer des demandes. Il manque un pont entre l'audience et la prise de contact.",
    readingTime: "5 min",
    publishedAt: "2026-03-04",
    content: [
      "Beaucoup d'entreprises locales publient sur Instagram sans que cela se traduise en rendez-vous ou en ventes. La raison est presque toujours la même : il n'existe pas de pont clair entre l'audience qui regarde et l'action qui compte.",
      "Un like ou un commentaire n'est pas un client. Le canal d'acquisition existe seulement quand chaque contenu ramène systématiquement vers un point de conversion unique — une prise de rendez-vous, un devis, une réservation — et non vers une conversation privée qui dépend de la disponibilité de quelqu'un pour répondre.",
      "Le lien en bio doit être traité comme une page à part entière, pensée pour convertir, et non comme un simple renvoi vers la page d'accueil générale du site.",
      "Une fois ce pont posé, chaque publication devient mesurable : on sait combien de clics elle génère, combien de ces clics deviennent des prises de contact, et donc si le contenu produit réellement de la valeur commerciale.",
    ],
  },
  {
    slug: "erreurs-perte-demandes-entreprise-locale",
    title: "Les erreurs qui font perdre des demandes à une entreprise locale.",
    excerpt:
      "La plupart des pertes ne viennent pas d'un manque de visibilité, mais de frictions invisibles dans le parcours.",
    readingTime: "6 min",
    publishedAt: "2026-04-18",
    content: [
      "Une entreprise locale qui manque de demandes pense souvent avoir un problème de visibilité. Dans la majorité des cas, le problème se situe plus loin dans le parcours : le visiteur arrive, mais abandonne avant d'agir.",
      "Les frictions les plus courantes sont simples : un numéro de téléphone difficile à trouver sur mobile, un formulaire trop long, une page qui met plus de trois secondes à charger, ou une offre qui n'est pas comprise en un coup d'œil.",
      "Chacune de ces frictions coûte cher, silencieusement, parce qu'elle n'apparaît dans aucune statistique évidente. Le visiteur ne se plaint pas : il part simplement vers un concurrent dont le parcours est plus fluide.",
      "Avant d'investir davantage dans l'acquisition de trafic, il est presque toujours plus rentable de corriger ces frictions. Amener plus de visiteurs vers un parcours qui fuit ne fait qu'amplifier la perte.",
    ],
  },
  {
    slug: "site-vitrine-ou-systeme-acquisition",
    title: "Site vitrine ou système d'acquisition ?",
    excerpt:
      "Les deux se ressemblent, mais ne servent pas le même objectif. La confusion coûte cher aux entreprises locales.",
    readingTime: "5 min",
    publishedAt: "2026-05-22",
    content: [
      "Un site vitrine a pour objectif d'exister : présenter l'entreprise, ses coordonnées, son activité. Un système d'acquisition a un objectif différent : transformer une visite en opportunité commerciale mesurable.",
      "Les deux peuvent avoir la même apparence. La différence se joue dans la structure : un système d'acquisition est construit autour d'un parcours précis, avec une action attendue à chaque étape, et des points de mesure qui permettent de savoir ce qui fonctionne.",
      "Un site vitrine se contente d'informer ; un système d'acquisition est pensé pour convertir. Ce n'est pas une question de budget, mais de méthode : la manière dont chaque page est conçue, reliée aux autres, et orientée vers une seule question — que doit faire le visiteur ensuite ?",
      "Comprendre cette différence est la première étape avant tout projet digital, parce qu'elle détermine des choix très concrets : structure du site, contenu de chaque page, et outils à connecter derrière.",
    ],
  },
  {
    slug: "prix-creation-site-internet",
    title: "Prix d’un site internet : que payez-vous vraiment ?",
    excerpt:
      "Comprendre le prix d’un site vitrine ou d’un site orienté acquisition : structure, contenu, SEO, conversion, suivi et coûts récurrents.",
    readingTime: "7 min",
    publishedAt: "2026-09-20",
    content: [
      "Le prix d’un site internet varie fortement parce que le mot « site » recouvre des réalités différentes. Une présence de quelques pages, un site avec plusieurs offres, un système de génération de leads et une plateforme métier ne demandent ni le même travail ni les mêmes objectifs.",
      "Avant de comparer deux devis, il faut regarder ce qui est réellement inclus : architecture des pages, rédaction, design, développement, responsive mobile, performance, référencement technique, pages de services, suivi des conversions, formulaire de devis et accompagnement après mise en ligne.",
      "Un prix bas peut convenir à une entreprise qui veut simplement une présence minimale. Il devient moins intéressant si le site doit ensuite être reconstruit pour créer des pages SEO, connecter un système de suivi ou transformer les visites en demandes.",
      "À l’inverse, un projet plus complet n’est utile que si les éléments supplémentaires servent un objectif commercial réel. Ajouter des animations, des pages ou des outils sans impact sur la visibilité, la confiance ou la conversion n’améliore pas mécaniquement la rentabilité.",
      "Pour décider, partez du résultat attendu : être crédible quand on cherche votre nom, capter des recherches Google, générer des devis, prendre des rendez-vous ou soutenir des campagnes. Le bon périmètre dépend de cette priorité.",
      "Un diagnostic avant devis permet souvent d’éviter deux erreurs : surpayer des fonctions inutiles ou sous-dimensionner le projet au point de devoir recommencer quelques mois plus tard.",
    ],
  },
  {
    slug: "comment-etre-visible-sur-google",
    title: "Comment être visible sur Google quand vos clients cherchent vos services ?",
    excerpt:
      "Les étapes essentielles pour améliorer la visibilité Google d’une entreprise : indexation, pages de services, SEO local, contenu et suivi.",
    readingTime: "8 min",
    publishedAt: "2026-09-20",
    content: [
      "Être visible sur Google ne commence pas par répéter des mots-clés. Il faut d’abord que Google puisse explorer le site, comprendre chaque page et identifier clairement les services proposés.",
      "La deuxième étape consiste à créer une page utile pour chaque grande intention commerciale. Si vos clients cherchent séparément plusieurs prestations, une page d’accueil unique aura rarement la profondeur nécessaire pour répondre précisément à toutes ces recherches.",
      "Pour une activité locale, la cohérence entre le site et Google Business Profile compte aussi : nom, activité, services, zone d’intervention, coordonnées, avis et pages associées doivent être fiables et à jour.",
      "Le contenu informatif sert ensuite à répondre aux questions qui apparaissent avant l’achat : prix, méthode, délais, différences entre solutions, erreurs à éviter. Ces contenus peuvent renforcer les pages commerciales lorsqu’ils sont reliés par un maillage interne logique.",
      "La visibilité doit enfin être mesurée. Google Search Console permet d’observer les requêtes, impressions, clics et pages qui progressent. Les formulaires et prises de rendez-vous permettent de distinguer les visites utiles du trafic qui ne produit aucune opportunité.",
      "Le SEO est progressif : l’objectif est de construire une architecture qui couvre les intentions importantes, améliore la qualité des pages et gagne de l’autorité avec le temps, plutôt que de chercher une astuce unique pour monter instantanément.",
    ],
  },
  {
    slug: "seo-local-artisan",
    title: "SEO local pour artisan : comment être trouvé sur métier + ville",
    excerpt:
      "Méthode de référencement local pour artisan : prestations, zones réelles, Google Business, réalisations, avis et demandes de devis.",
    readingTime: "8 min",
    publishedAt: "2026-09-20",
    content: [
      "Pour un artisan, beaucoup de recherches Google sont directement liées à une prestation et à une zone : couvreur, plombier, électricien, rénovation, peinture ou menuiserie associés à une ville ou à un secteur proche.",
      "La première priorité est donc de disposer de pages solides pour les prestations réellement vendues. Chaque page doit expliquer le besoin, le type d’intervention, les éléments qui rassurent et la manière de demander un devis.",
      "La zone d’intervention doit être décrite honnêtement. Créer des dizaines de pages copiées en changeant seulement le nom d’une commune apporte peu de valeur et peut donner un site artificiel. Une page locale doit exister parce qu’elle peut réellement aider le prospect.",
      "Google Business Profile complète le site : catégories pertinentes, services, photos de réalisations, avis et coordonnées cohérentes renforcent la présence locale et donnent une seconde porte d’entrée vers l’entreprise.",
      "Les réalisations sont particulièrement utiles pour un artisan. Une vraie photo, un type de chantier et une zone donnent de la preuve au visiteur et peuvent aussi créer des liens naturels vers les pages de prestations concernées.",
      "Enfin, il faut mesurer les demandes de devis provenant du SEO local. Une meilleure position n’est intéressante que si elle attire les bons chantiers et transforme les recherches en appels ou formulaires qualifiés.",
    ],
  },
  {
    slug: "optimiser-google-business-profile",
    title: "Comment optimiser Google Business Profile pour une entreprise locale",
    excerpt:
      "Catégories, services, avis, photos, cohérence avec le site et suivi : les bases d’une fiche Google Business Profile réellement utile.",
    readingTime: "7 min",
    publishedAt: "2026-09-20",
    content: [
      "Google Business Profile est souvent la première chose qu’un prospect voit lorsqu’il recherche une entreprise locale. Une fiche incomplète ou incohérente peut donc faire perdre le contact avant même la visite du site.",
      "Commencez par les fondamentaux : catégorie principale précise, catégories secondaires réellement pertinentes, horaires à jour, coordonnées fiables et description claire. Évitez d’ajouter des services qui ne correspondent pas à l’activité réelle.",
      "Les photos doivent montrer l’entreprise telle qu’elle existe : équipe, lieu, réalisations ou interventions selon le métier. Elles rassurent davantage que des visuels génériques et donnent au prospect une meilleure idée de ce qu’il peut attendre.",
      "Les avis sont un autre signal de confiance. Il est utile d’y répondre de manière régulière et professionnelle. L’objectif n’est pas uniquement d’augmenter le nombre d’étoiles mais de montrer une activité réelle et suivie.",
      "Le lien vers le site doit conduire vers une expérience cohérente. Si la fiche parle d’un service précis mais que le site oblige le visiteur à chercher l’information, une partie de l’intention est perdue.",
      "Suivez enfin les actions : clics vers le site, appels, itinéraires et demandes. Ces données permettent de comprendre si l’optimisation améliore réellement la capacité de la fiche à générer des contacts.",
    ],
  },
  {
    slug: "prix-referencement-seo",
    title: "Prix du référencement SEO : ce qui fait réellement varier le budget",
    excerpt:
      "Audit, technique, contenu, pages de services, SEO local et autorité : comprendre les postes qui déterminent le prix d’un accompagnement SEO.",
    readingTime: "7 min",
    publishedAt: "2026-09-20",
    content: [
      "Le prix du référencement SEO dépend surtout de l’état du site, du nombre d’intentions à couvrir, de la concurrence et du travail nécessaire pour produire des pages réellement utiles.",
      "Un site techniquement propre avec quelques services locaux n’a pas les mêmes besoins qu’un site national comportant des dizaines d’offres. Un audit permet de distinguer ce qui doit être corrigé de ce qui doit être créé.",
      "Le budget peut inclure plusieurs chantiers : correction technique, recherche d’intentions, création ou réécriture de pages, maillage interne, contenu informatif, SEO local, suivi Search Console et développement de signaux d’autorité.",
      "Le nombre de mots-clés n’est pas un bon indicateur de prix à lui seul. Une seule page peut couvrir plusieurs variantes proches si elle traite correctement l’intention. Multiplier artificiellement les pages augmente le volume de travail sans forcément améliorer les résultats.",
      "Pour une entreprise locale, les priorités sont souvent plus simples : pages de prestations, Google Business Profile, preuves, zones réellement servies et suivi des demandes. Le budget doit être concentré là où une progression peut produire des contacts.",
      "Avant de choisir un accompagnement, demandez ce qui sera réellement livré et comment les résultats seront observés. Un plan SEO doit pouvoir être relié à des pages, des actions et des indicateurs concrets.",
    ],
  },
  {
    slug: "site-internet-artisan-guide",
    title: "Site internet pour artisan : les pages indispensables pour générer des devis",
    excerpt:
      "Accueil, prestations, réalisations, zones, avis et demande de devis : structure recommandée d’un site internet pour artisan.",
    readingTime: "8 min",
    publishedAt: "2026-09-20",
    content: [
      "Le site d’un artisan doit répondre rapidement à quatre questions : quel métier, quelles prestations, quelle zone d’intervention et comment demander un devis. Tout le reste vient soutenir ces réponses.",
      "La page d’accueil présente la promesse principale et oriente vers les prestations importantes. Elle ne doit pas essayer de détailler tous les travaux possibles dans un seul bloc.",
      "Les pages de prestations sont essentielles pour le référencement et la conversion. Elles permettent de parler précisément d’une toiture, d’une rénovation, d’une installation électrique ou d’un autre besoin, avec les informations attendues par le prospect.",
      "Une galerie de réalisations apporte une preuve directe. Elle est encore plus utile si chaque chantier est rattaché à un type de prestation et, lorsque c’est pertinent, à une zone réellement servie.",
      "Les avis, assurances, certifications réelles, coordonnées et modalités de contact réduisent l’incertitude. Sur mobile, l’appel ou le formulaire de devis doivent rester accessibles sans chercher longtemps.",
      "Enfin, le formulaire doit demander seulement ce qui aide à préparer la réponse : nature du chantier, localisation, délai et éventuellement photos. Un site d’artisan performant n’est pas celui qui contient le plus d’informations, mais celui qui transforme une recherche en demande exploitable.",
    ],
  },
  {
    slug: "generer-demandes-devis-en-ligne",
    title: "Comment générer plus de demandes de devis en ligne",
    excerpt:
      "Trafic qualifié, pages de services, preuves, formulaire et suivi : les leviers pour transformer davantage de visiteurs en demandes de devis.",
    readingTime: "8 min",
    publishedAt: "2026-09-20",
    content: [
      "Pour obtenir plus de demandes de devis, il faut regarder l’ensemble du parcours. Ajouter un formulaire à une page qui attire le mauvais trafic ou n’inspire pas confiance ne résout pas le problème.",
      "La première étape est l’intention : attirer des personnes qui cherchent réellement le service proposé. Les pages SEO, Google Business Profile, campagnes ou contenus doivent orienter le prospect vers une page cohérente avec son besoin.",
      "La page doit ensuite rendre l’offre compréhensible rapidement. Une promesse claire, quelques preuves et une explication du déroulement réduisent les questions qui bloquent la prise de contact.",
      "Le formulaire doit être court mais utile. Le type de projet, la zone, le délai et un moyen de contact suffisent souvent pour une première qualification. Demander trop d’informations trop tôt peut créer une friction inutile.",
      "La confirmation compte aussi : après l’envoi, expliquez ce qui va se passer, dans quel délai une réponse est généralement apportée et quelle est la prochaine étape.",
      "Enfin, mesurez le taux de passage entre visite, démarrage du formulaire et envoi. Si les visiteurs arrivent mais ne commencent jamais le devis, le problème est probablement différent de celui d’un formulaire commencé puis abandonné.",
    ],
  },
  {
    slug: "refonte-site-seo-erreurs",
    title: "Refonte de site : 7 erreurs SEO qui peuvent faire perdre votre visibilité",
    excerpt:
      "URL supprimées, redirections oubliées, contenus effacés et maillage cassé : les risques SEO à éviter pendant une refonte de site.",
    readingTime: "8 min",
    publishedAt: "2026-09-20",
    content: [
      "Une refonte peut améliorer un site, mais elle peut aussi effacer une partie de sa visibilité si l’ancien contenu est remplacé sans inventaire. Les URL déjà indexées doivent être étudiées avant la mise en ligne.",
      "Première erreur : changer toutes les URL sans redirections. Lorsqu’une page utile disparaît, l’ancienne adresse doit généralement rediriger vers la destination la plus pertinente plutôt que vers la page d’accueil par défaut.",
      "Deuxième erreur : supprimer les contenus qui attirent déjà des impressions simplement parce qu’ils paraissent anciens. Ils peuvent souvent être améliorés, regroupés ou réorganisés sans perdre leur sujet.",
      "Troisième erreur : casser le maillage interne. Les liens entre pages indiquent quels sujets sont liés et quelles pages sont importantes. Une nouvelle navigation doit conserver une logique claire.",
      "Quatrième erreur : mettre en production des balises noindex, un robots.txt de préproduction ou des canoniques vers l’ancien domaine. Ces détails techniques peuvent neutraliser une grande partie du travail de refonte.",
      "Enfin, mesurez avant et après : pages indexées, requêtes, clics, conversions et erreurs. Une migration réussie n’est pas seulement un nouveau design visible le jour du lancement ; c’est une transition contrôlée de l’ancien système vers le nouveau.",
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
