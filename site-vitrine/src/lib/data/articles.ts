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
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
