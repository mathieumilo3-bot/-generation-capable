// netlify/functions/_lib/compliance/contracts.js
//
// Texte intégral des deux contrats (Vendeur / Ambassadeur), transcrit tel
// quel depuis les documents fournis (GCContratVendeur.docx /
// GCContratAmbassadeur.docx), avec :
//   1. Les blancs du document original (".........") remplacés par des
//      jetons {{PLACEHOLDER}} remplis à partir du dossier administratif
//      (voir render()).
//   2. Deux articles supplémentaires ajoutés avant le bloc de signature —
//      Article 16 (sécurité / lutte contre la fraude / CGU-Confidentialité-
//      Plan de rémunération) et Article 17 (valeur juridique de la
//      signature électronique) — demandés explicitement par Génération
//      Capable, absents du document original.
//
// ⚠️ Ce texte reste, comme l'indique le document original, un PROJET rédigé
// avec assistance IA : il doit être relu et validé par un avocat ou juriste
// avant toute signature ayant une valeur contractuelle réelle. Rien ici ne
// remplace cette validation.
//
// L'identité légale de la Société (SIRET, adresse, représentant) n'est PAS
// connue avec certitude par ce code — elle est injectée via des variables
// d'environnement Netlify (COMPANY_LEGAL_REP_NAME, COMPANY_LEGAL_REP_TITLE,
// COMPANY_SIRET, COMPANY_ADDRESS) plutôt que fabriquée : tant qu'elles ne
// sont pas configurées, le contrat généré l'indique EXPLICITEMENT en toutes
// lettres plutôt que d'afficher une valeur inventée qui aurait l'air correcte.

function companyInfo() {
  return {
    repName: process.env.COMPANY_LEGAL_REP_NAME || '[NOM DU REPRÉSENTANT LÉGAL — À CONFIGURER : variable Netlify COMPANY_LEGAL_REP_NAME]',
    repTitle: process.env.COMPANY_LEGAL_REP_TITLE || '[QUALITÉ DU REPRÉSENTANT — À CONFIGURER : variable Netlify COMPANY_LEGAL_REP_TITLE]',
    siret: process.env.COMPANY_SIRET || '[SIRET GÉNÉRATION CAPABLE — À CONFIGURER : variable Netlify COMPANY_SIRET]',
    address: process.env.COMPANY_ADDRESS || '[ADRESSE DU SIÈGE — À CONFIGURER : variable Netlify COMPANY_ADDRESS]',
  };
}

function fmtDate(d) {
  if (!d) return '[date non renseignée]';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '[date non renseignée]';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function blank(v) {
  return v && String(v).trim().length > 0 ? String(v).trim() : '[non renseigné]';
}

const VENDEUR_TEMPLATE = `Génération Capable
CONTRAT DE VENDEUR
Contrat de prestation commerciale indépendante

Entre les soussignés :

{{COMPANY_REP_NAME}}, entrepreneur individuel exerçant sous le régime de la micro-entreprise, immatriculé(e) sous le numéro SIRET {{COMPANY_SIRET}}, domicilié(e) {{COMPANY_ADDRESS}}, exerçant son activité sous le nom commercial « GÉNÉRATION CAPABLE »,
Ci-après dénommée « la Société » ou « Génération Capable »,
D'une part,

ET :

{{SIGNER_FULL_NAME}}, né(e) le {{SIGNER_BIRTH_DATE}} à {{SIGNER_BIRTH_PLACE}}, demeurant {{SIGNER_ADDRESS}}, de nationalité {{SIGNER_NATIONALITY}}, exerçant sous le statut de {{SIGNER_LEGAL_STATUS}}, SIRET {{SIGNER_SIRET}},
Ci-après dénommé(e) « le Vendeur »,
D'autre part,

Ci-après dénommées ensemble « les Parties » et individuellement « une Partie ».

Il a été préalablement exposé ce qui suit :

Génération Capable édite une plateforme de formation à la vente et à la prospection commerciale et commercialise à ce titre plusieurs offres. Dans le cadre du développement commercial de ses offres, la Société souhaite s'appuyer sur des vendeurs indépendants. C'est dans ce contexte que les Parties se sont rapprochées et ont convenu de conclure le présent contrat (ci-après le « Contrat »).

Ceci exposé, il a été convenu ce qui suit :

ARTICLE 1 — OBJET DU CONTRAT
Le présent Contrat a pour objet de définir les conditions et modalités selon lesquelles le Vendeur développe commercialement les offres proposées par Génération Capable, dans les conditions définies par la Société, en contrepartie d'une rémunération sous forme de commissions définie à l'Article 4.

ARTICLE 2 — MISSIONS DU VENDEUR
Le Vendeur s'engage à :
prospecter activement de nouveaux clients potentiels pour le compte de Génération Capable ;
présenter fidèlement les offres de la Société, leurs conditions et leurs tarifs, sans formuler de promesses non autorisées par la Société ;
accompagner les prospects jusqu'à la finalisation de la vente, dans le respect des procédures commerciales définies par la Société ;
respecter les procédures commerciales, scripts et méthodologies communiqués par Génération Capable ;
préserver en toutes circonstances l'image et la réputation de Génération Capable.

ARTICLE 3 — DURÉE DU CONTRAT
Le présent Contrat est conclu pour une durée indéterminée à compter de sa signature par les deux Parties (ci-après la « Date d'Effet »). Il pourra être résilié à tout moment par chacune des Parties dans les conditions prévues à l'Article 10.

ARTICLE 4 — COMMISSIONS
Les commissions dues au Vendeur sont calculées selon la grille officielle de rémunération en vigueur, communiquée séparément par la Société et pouvant être mise à jour à tout moment, sous réserve d'une notification préalable au Vendeur selon un délai raisonnable.
Le versement des commissions intervient après validation définitive des ventes concernées (notamment expiration du délai de rétractation applicable et encaissement effectif des sommes dues par le client), selon la périodicité et les délais prévus par la grille de rémunération en vigueur.
Le Vendeur est seul responsable de la déclaration et du paiement des charges sociales et fiscales afférentes aux commissions perçues au titre du présent Contrat, et s'engage à fournir à la Société toute facture conforme à la réglementation applicable.

ARTICLE 5 — INDÉPENDANCE — ABSENCE DE LIEN DE SUBORDINATION
Le Vendeur agit en qualité de prestataire indépendant. Il/elle organise librement son activité, ses méthodes de travail, son emploi du temps et ses moyens, sans lien de subordination juridique à l'égard de la Société. Le présent Contrat ne saurait en aucun cas être interprété comme créant une relation de travail salarié, un contrat de mandat, une société en participation ou une coentreprise entre les Parties.
Le Vendeur déclare exercer son activité sous un statut juridique l'autorisant légalement à percevoir les rémunérations prévues au présent Contrat (notamment le statut de micro-entrepreneur/auto-entrepreneur, ou toute autre structure individuelle ou sociétaire équivalente) et s'engage à fournir à la Société, sur simple demande, tout justificatif de ce statut ainsi que, le cas échéant, toute facture conforme à la réglementation en vigueur.
En aucun cas, le Vendeur n'est habilité(e) à recevoir, encaisser ou conserver, sous quelque forme que ce soit (espèces, virement, chèque, carte bancaire ou tout autre moyen de paiement), les sommes dues par les clients ou prospects au titre des offres de Génération Capable. Le paiement des offres s'effectue exclusivement via les moyens de paiement sécurisés mis à disposition par la Société sur sa plateforme. Le Vendeur ne dispose d'aucun mandat, exprès ou tacite, pour agir, négocier ou conclure une vente au nom et pour le compte de la Société, ni pour percevoir un paiement en son nom ou pour son compte.

ARTICLE 6 — CONFIDENTIALITÉ
Le Vendeur s'engage à conserver strictement confidentielles toutes informations, données, documents, stratégies commerciales, marketing, financières ou techniques, ainsi que toute information relative aux clients, prospects, ambassadeurs, vendeurs ou partenaires de la Société, dont il/elle pourrait avoir connaissance dans le cadre de l'exécution du présent Contrat.
Cette obligation de confidentialité perdure pendant toute la durée du Contrat et pendant une durée de deux (2) ans à compter de sa cessation, quelle qu'en soit la cause. Elle ne s'applique pas aux informations tombées dans le domaine public autrement que par la faute de le Vendeur, ni à celles dont la divulgation serait exigée par une autorité compétente ou par la loi.

ARTICLE 7 — PROPRIÉTÉ INTELLECTUELLE
Les marques, logos, noms de domaine, vidéos, supports pédagogiques, documents, méthodologies (notamment la méthode ADN GC et le référentiel A.C.C.E.P.T.E.R.), interfaces, contenus écrits, visuels et audiovisuels de Génération Capable demeurent, en toutes circonstances, la propriété exclusive de la Société.
Le présent Contrat ne confère à le Vendeur aucun droit de propriété intellectuelle sur ces éléments, mais uniquement un droit d'usage limité, non exclusif, non cessible et non transmissible, strictement nécessaire à l'exécution de ses missions et pendant la seule durée du Contrat. Tout contenu créé par le Vendeur dans le cadre de la promotion de Génération Capable (visuels, vidéos, publications, textes) devra respecter la charte éditoriale et l'image de marque communiquées par la Société, laquelle se réserve le droit d'en demander la modification ou le retrait à tout moment.

ARTICLE 8 — PROTECTION DES DONNÉES PERSONNELLES
Chacune des Parties s'engage à respecter la réglementation applicable en matière de protection des données à caractère personnel, notamment le Règlement (UE) 2016/679 du 27 avril 2016 (« RGPD ») et la loi n° 78-17 du 6 janvier 1978 modifiée. Le Vendeur s'engage à ne traiter les données personnelles auxquelles il/elle pourrait avoir accès dans le cadre du Contrat (prospects, clients, membres, ambassadeurs) que pour les seuls besoins de l'exécution de ses missions, et à ne pas les conserver, réutiliser ou transmettre à un tiers au-delà de cette finalité.

ARTICLE 9 — IMAGE ET NON-DÉNIGREMENT
Le Vendeur s'engage à représenter la Société avec professionnalisme et loyauté, à ne tenir aucun propos dénigrant, diffamatoire ou trompeur à l'égard de Génération Capable, de ses dirigeants, de ses collaborateurs ou de ses offres — y compris après la cessation du Contrat — et à ne diffuser aucune information trompeuse ou mensongère sur les offres, résultats, tarifs ou méthodes de Génération Capable.

ARTICLE 10 — RÉSILIATION
Le présent Contrat pourra être résilié à tout moment par l'une ou l'autre des Parties, sans avoir à justifier d'un motif, moyennant le respect d'un préavis de quinze (15) jours calendaires notifié par écrit (lettre recommandée avec accusé de réception, ou tout autre moyen conférant date certaine, y compris courrier électronique avec accusé de réception).
En cas de manquement grave de l'une des Parties à l'une quelconque de ses obligations résultant du Contrat — notamment en cas de diffusion d'informations trompeuses, d'atteinte à l'image de la Société ou de violation de la confidentialité — l'autre Partie pourra résilier le Contrat de plein droit, sans préavis ni indemnité, huit (8) jours après une mise en demeure restée infructueuse, sauf faute d'une particulière gravité justifiant une résiliation immédiate.
La résiliation du Contrat, pour quelque cause que ce soit, emporte cessation immédiate du droit pour le Vendeur d'utiliser les marques, contenus et outils de la Société, ainsi que du versement de toute rémunération au titre d'actions postérieures à la date de résiliation, sous réserve des commissions déjà acquises et non contestées à cette date.

ARTICLE 11 — FORCE MAJEURE
Aucune des Parties ne pourra être tenue responsable envers l'autre d'un manquement à l'une quelconque de ses obligations au titre du présent Contrat qui résulterait d'un cas de force majeure tel que défini par la loi française et la jurisprudence des tribunaux français.

ARTICLE 12 — DIVISIBILITÉ DES CLAUSES
Si l'une quelconque des clauses du présent Contrat était déclarée nulle ou inapplicable par une juridiction compétente, les autres clauses conserveraient leur pleine force obligatoire. Les Parties s'efforceraient alors, de bonne foi, de remplacer la clause invalidée par une clause valide s'en approchant le plus possible dans son esprit et ses effets économiques.

ARTICLE 13 — INTÉGRALITÉ DE L'ACCORD
Le présent Contrat, ainsi que ses éventuelles annexes, constitue l'intégralité de l'accord entre les Parties relatif à son objet, et annule et remplace tout accord antérieur, écrit ou verbal, portant sur le même objet. Toute modification du Contrat devra faire l'objet d'un avenant écrit signé par les deux Parties.

ARTICLE 14 — LOI APPLICABLE ET JURIDICTION COMPÉTENTE
Le présent Contrat est soumis au droit français. En cas de différend relatif à sa validité, son interprétation ou son exécution, les Parties s'efforceront de le résoudre à l'amiable. À défaut d'accord amiable dans un délai de trente (30) jours à compter de la première réclamation écrite, le litige sera porté devant les juridictions compétentes du ressort du siège social de la Société, sauf disposition d'ordre public contraire.

ARTICLE 15 — ÉLECTION DE DOMICILE
Pour l'exécution du présent Contrat, les Parties font élection de domicile aux adresses indiquées en tête des présentes. Toute modification d'adresse devra être notifiée sans délai à l'autre Partie.

ARTICLE 16 — SÉCURITÉ, LUTTE CONTRE LA FRAUDE ET INTÉGRITÉ DU RÉSEAU
Le Vendeur s'engage à ne créer ni utiliser qu'un seul compte sur la plateforme Génération Capable. La création ou l'utilisation de plusieurs comptes par une même personne physique, directement ou par personne interposée, est strictement interdite et constitue un manquement grave au sens de l'Article 10.
Il est interdit au Vendeur de se parrainer lui-même, de parrainer un compte qu'il contrôle directement ou indirectement, ou de recourir à tout procédé destiné à générer artificiellement des prospects, des ventes, des adhésions ou des commissions (comptes fictifs, fausses ventes, remboursements organisés, ou tout autre procédé frauduleux).
En cas de fraude avérée ou de manquement aux engagements du présent article, la Société se réserve le droit d'annuler les commissions concernées, sans préavis ni indemnité, et de résilier le Contrat de plein droit dans les conditions de l'Article 10.
En cas de fraude suspectée, la Société peut suspendre immédiatement et de plein droit l'accès du Vendeur à la plateforme ainsi que le versement de toute commission, le temps nécessaire à la réalisation des vérifications utiles. Cette suspension conservatoire n'est pas une résiliation et ne prive pas le Vendeur de son droit d'être informé des motifs de la suspension et d'y répondre.
Le Vendeur reconnaît avoir pris connaissance des Conditions Générales d'Utilisation, de la Politique de Confidentialité et du Plan de Rémunération de Génération Capable, disponibles sur la plateforme, et s'engage à les respecter. Ces documents complètent le présent Contrat et en font partie intégrante.

ARTICLE 17 — SIGNATURE ÉLECTRONIQUE
Les Parties reconnaissent expressément la validité juridique de la signature électronique apposée sur la plateforme Génération Capable, conformément aux articles 1366 et 1367 du Code civil. Cette signature identifie de manière fiable son auteur et garantit le lien avec l'acte auquel elle s'attache.
Chaque signature est horodatée et accompagnée des éléments de preuve suivants, conservés par la Société : date et heure de signature, adresse IP du signataire, identifiant du compte utilisateur, version exacte du contrat signé, ainsi qu'une image de la signature manuscrite électronique. Ces éléments constituent, entre les Parties, une preuve recevable de l'accord du Vendeur sur les termes du présent Contrat.

Fait électroniquement via la plateforme Génération Capable, le {{SIGNATURE_DATE}}.
En deux (2) exemplaires originaux numériques, dont un remis à chacune des Parties.

Pour la société GÉNÉRATION CAPABLE                    Pour LE VENDEUR
{{COMPANY_REP_NAME}}                                   {{SIGNER_FULL_NAME}}
En qualité de {{COMPANY_REP_TITLE}}

« Lu et approuvé, bon pour accord »                    « Lu et approuvé, bon pour accord »
Signature électronique certifiée                       Signature électronique certifiée

---
Projet de contrat établi à titre indicatif par assistance IA, sur la base des éléments fournis par Génération Capable. Ce document ne constitue pas un avis juridique et doit impérativement être relu, complété et validé par un avocat ou juriste avant toute signature.`;

const AMBASSADEUR_TEMPLATE = `Génération Capable
CONTRAT D'AMBASSADEUR
Contrat de partenariat commercial indépendant

Entre les soussignés :

{{COMPANY_REP_NAME}}, entrepreneur individuel exerçant sous le régime de la micro-entreprise, immatriculé(e) sous le numéro SIRET {{COMPANY_SIRET}}, domicilié(e) {{COMPANY_ADDRESS}}, exerçant son activité sous le nom commercial « GÉNÉRATION CAPABLE »,
Ci-après dénommée « la Société » ou « Génération Capable »,
D'une part,

ET :

{{SIGNER_FULL_NAME}}, né(e) le {{SIGNER_BIRTH_DATE}} à {{SIGNER_BIRTH_PLACE}}, demeurant {{SIGNER_ADDRESS}}, de nationalité {{SIGNER_NATIONALITY}}, exerçant le cas échéant sous le statut de {{SIGNER_LEGAL_STATUS}}, SIRET {{SIGNER_SIRET}},
Ci-après dénommé(e) « l'Ambassadeur »,
D'autre part,

Ci-après dénommées ensemble « les Parties » et individuellement « une Partie ».

Il a été préalablement exposé ce qui suit :

Génération Capable édite une plateforme de formation à la vente et à la prospection commerciale intégrant un accompagnement par intelligence artificielle. Dans le cadre du développement de sa notoriété et de son écosystème, la Société souhaite s'appuyer sur un réseau d'ambassadeurs indépendants chargés de promouvoir ses offres. C'est dans ce contexte que les Parties se sont rapprochées et ont convenu de conclure le présent contrat (ci-après le « Contrat »).

Ceci exposé, il a été convenu ce qui suit :

ARTICLE 1 — OBJET DU CONTRAT
Le présent Contrat a pour objet de définir les conditions et modalités de la collaboration entre Génération Capable et l'Ambassadeur, dans le cadre de laquelle ce dernier promeut Génération Capable, crée du contenu, partage son lien personnel de parrainage et contribue au développement de l'écosystème de la Société, en contrepartie d'une rémunération définie à l'Article 4.

ARTICLE 2 — MISSIONS DE L'AMBASSADEUR
L'Ambassadeur s'engage à :
représenter positivement Génération Capable auprès de son audience et de ses contacts ;
publier régulièrement du contenu relatif à Génération Capable, conformément aux recommandations éditoriales communiquées par la Société ;
partager son lien personnel de parrainage auprès de prospects susceptibles d'être intéressés par les offres de la Société ;
respecter l'image de marque, la charte éditoriale et les valeurs du projet Génération Capable ;
ne diffuser aucune information trompeuse, mensongère ou de nature à induire un tiers en erreur sur les offres, résultats ou méthodes de la Société.

ARTICLE 3 — DURÉE DU CONTRAT
Le présent Contrat est conclu pour une durée indéterminée à compter de sa signature par les deux Parties (ci-après la « Date d'Effet »). Il pourra être résilié à tout moment par chacune des Parties dans les conditions prévues à l'Article 10.

ARTICLE 4 — RÉMUNÉRATION
L'Ambassadeur est rémunéré conformément au plan de rémunération en vigueur, communiqué séparément par Génération Capable et pouvant évoluer à tout moment, sous réserve d'une notification préalable à l'Ambassadeur selon un délai raisonnable.
Les modalités de calcul, de validation et de versement des commissions sont définies par Génération Capable. Les sommes dues à l'Ambassadeur lui seront versées selon la périodicité prévue par le plan de rémunération en vigueur, sous réserve de la validation définitive des actions concernées (adhésions, ventes) et, le cas échéant, de la réception d'une facture conforme à la réglementation applicable.
L'Ambassadeur est seul responsable de la déclaration et du paiement des charges sociales et fiscales afférentes aux sommes perçues au titre du présent Contrat.

ARTICLE 5 — INDÉPENDANCE — ABSENCE DE LIEN DE SUBORDINATION
L'Ambassadeur agit en qualité de prestataire indépendant. Il/elle organise librement son activité, ses méthodes de travail, son emploi du temps et ses moyens, sans lien de subordination juridique à l'égard de la Société. Le présent Contrat ne saurait en aucun cas être interprété comme créant une relation de travail salarié, un contrat de mandat, une société en participation ou une coentreprise entre les Parties.
L'Ambassadeur déclare exercer son activité sous un statut juridique l'autorisant légalement à percevoir les rémunérations prévues au présent Contrat (notamment le statut de micro-entrepreneur/auto-entrepreneur, ou toute autre structure individuelle ou sociétaire équivalente) et s'engage à fournir à la Société, sur simple demande, tout justificatif de ce statut ainsi que, le cas échéant, toute facture conforme à la réglementation en vigueur.
En aucun cas, l'Ambassadeur n'est habilité(e) à recevoir, encaisser ou conserver, sous quelque forme que ce soit (espèces, virement, chèque, carte bancaire ou tout autre moyen de paiement), les sommes dues par les clients ou prospects au titre des offres de Génération Capable. Le paiement des offres s'effectue exclusivement via les moyens de paiement sécurisés mis à disposition par la Société sur sa plateforme. L'Ambassadeur ne dispose d'aucun mandat, exprès ou tacite, pour agir, négocier ou conclure une vente au nom et pour le compte de la Société, ni pour percevoir un paiement en son nom ou pour son compte.

ARTICLE 6 — CONFIDENTIALITÉ
L'Ambassadeur s'engage à conserver strictement confidentielles toutes informations, données, documents, stratégies commerciales, marketing, financières ou techniques, ainsi que toute information relative aux clients, prospects, ambassadeurs, vendeurs ou partenaires de la Société, dont il/elle pourrait avoir connaissance dans le cadre de l'exécution du présent Contrat.
Cette obligation de confidentialité perdure pendant toute la durée du Contrat et pendant une durée de deux (2) ans à compter de sa cessation, quelle qu'en soit la cause. Elle ne s'applique pas aux informations tombées dans le domaine public autrement que par la faute de l'Ambassadeur, ni à celles dont la divulgation serait exigée par une autorité compétente ou par la loi.

ARTICLE 7 — PROPRIÉTÉ INTELLECTUELLE
Les marques, logos, noms de domaine, vidéos, supports pédagogiques, documents, méthodologies (notamment la méthode ADN GC et le référentiel A.C.C.E.P.T.E.R.), interfaces, contenus écrits, visuels et audiovisuels de Génération Capable demeurent, en toutes circonstances, la propriété exclusive de la Société.
Le présent Contrat ne confère à l'Ambassadeur aucun droit de propriété intellectuelle sur ces éléments, mais uniquement un droit d'usage limité, non exclusif, non cessible et non transmissible, strictement nécessaire à l'exécution de ses missions et pendant la seule durée du Contrat. Tout contenu créé par l'Ambassadeur dans le cadre de la promotion de Génération Capable (visuels, vidéos, publications, textes) devra respecter la charte éditoriale et l'image de marque communiquées par la Société, laquelle se réserve le droit d'en demander la modification ou le retrait à tout moment.

ARTICLE 8 — PROTECTION DES DONNÉES PERSONNELLES
Chacune des Parties s'engage à respecter la réglementation applicable en matière de protection des données à caractère personnel, notamment le Règlement (UE) 2016/679 du 27 avril 2016 (« RGPD ») et la loi n° 78-17 du 6 janvier 1978 modifiée. L'Ambassadeur s'engage à ne traiter les données personnelles auxquelles il/elle pourrait avoir accès dans le cadre du Contrat (prospects, clients, membres, ambassadeurs) que pour les seuls besoins de l'exécution de ses missions, et à ne pas les conserver, réutiliser ou transmettre à un tiers au-delà de cette finalité.

ARTICLE 9 — IMAGE ET NON-DÉNIGREMENT
L'Ambassadeur s'engage à représenter la Société avec professionnalisme et loyauté, à ne tenir aucun propos dénigrant, diffamatoire ou trompeur à l'égard de Génération Capable, de ses dirigeants, de ses collaborateurs ou de ses offres — y compris après la cessation du Contrat — et à ne diffuser aucune information trompeuse ou mensongère sur les offres, résultats, tarifs ou méthodes de Génération Capable.

ARTICLE 10 — RÉSILIATION
Le présent Contrat pourra être résilié à tout moment par l'une ou l'autre des Parties, sans avoir à justifier d'un motif, moyennant le respect d'un préavis de quinze (15) jours calendaires notifié par écrit (lettre recommandée avec accusé de réception, ou tout autre moyen conférant date certaine, y compris courrier électronique avec accusé de réception).
En cas de manquement grave de l'une des Parties à l'une quelconque de ses obligations résultant du Contrat — notamment en cas de diffusion d'informations trompeuses, d'atteinte à l'image de la Société ou de violation de la confidentialité — l'autre Partie pourra résilier le Contrat de plein droit, sans préavis ni indemnité, huit (8) jours après une mise en demeure restée infructueuse, sauf faute d'une particulière gravité justifiant une résiliation immédiate.
La résiliation du Contrat, pour quelque cause que ce soit, emporte cessation immédiate du droit pour l'Ambassadeur d'utiliser les marques, contenus et outils de la Société, ainsi que du versement de toute rémunération au titre d'actions postérieures à la date de résiliation, sous réserve des commissions déjà acquises et non contestées à cette date.

ARTICLE 11 — FORCE MAJEURE
Aucune des Parties ne pourra être tenue responsable envers l'autre d'un manquement à l'une quelconque de ses obligations au titre du présent Contrat qui résulterait d'un cas de force majeure tel que défini par la loi française et la jurisprudence des tribunaux français.

ARTICLE 12 — DIVISIBILITÉ DES CLAUSES
Si l'une quelconque des clauses du présent Contrat était déclarée nulle ou inapplicable par une juridiction compétente, les autres clauses conserveraient leur pleine force obligatoire. Les Parties s'efforceraient alors, de bonne foi, de remplacer la clause invalidée par une clause valide s'en approchant le plus possible dans son esprit et ses effets économiques.

ARTICLE 13 — INTÉGRALITÉ DE L'ACCORD
Le présent Contrat, ainsi que ses éventuelles annexes, constitue l'intégralité de l'accord entre les Parties relatif à son objet, et annule et remplace tout accord antérieur, écrit ou verbal, portant sur le même objet. Toute modification du Contrat devra faire l'objet d'un avenant écrit signé par les deux Parties.

ARTICLE 14 — LOI APPLICABLE ET JURIDICTION COMPÉTENTE
Le présent Contrat est soumis au droit français. En cas de différend relatif à sa validité, son interprétation ou son exécution, les Parties s'efforceront de le résoudre à l'amiable. À défaut d'accord amiable dans un délai de trente (30) jours à compter de la première réclamation écrite, le litige sera porté devant les juridictions compétentes du ressort du siège social de la Société, sauf disposition d'ordre public contraire.

ARTICLE 15 — ÉLECTION DE DOMICILE
Pour l'exécution du présent Contrat, les Parties font élection de domicile aux adresses indiquées en tête des présentes. Toute modification d'adresse devra être notifiée sans délai à l'autre Partie.

ARTICLE 16 — SÉCURITÉ, LUTTE CONTRE LA FRAUDE ET INTÉGRITÉ DU RÉSEAU
L'Ambassadeur s'engage à ne créer ni utiliser qu'un seul compte sur la plateforme Génération Capable. La création ou l'utilisation de plusieurs comptes par une même personne physique, directement ou par personne interposée, est strictement interdite et constitue un manquement grave au sens de l'Article 10.
Il est interdit à l'Ambassadeur de se parrainer lui-même, de parrainer un compte qu'il contrôle directement ou indirectement, ou de recourir à tout procédé destiné à générer artificiellement des prospects, des ventes, des adhésions ou des commissions (comptes fictifs, fausses adhésions, remboursements organisés, ou tout autre procédé frauduleux).
En cas de fraude avérée ou de manquement aux engagements du présent article, la Société se réserve le droit d'annuler les commissions concernées, sans préavis ni indemnité, et de résilier le Contrat de plein droit dans les conditions de l'Article 10.
En cas de fraude suspectée, la Société peut suspendre immédiatement et de plein droit l'accès de l'Ambassadeur à la plateforme ainsi que le versement de toute commission, le temps nécessaire à la réalisation des vérifications utiles. Cette suspension conservatoire n'est pas une résiliation et ne prive pas l'Ambassadeur de son droit d'être informé des motifs de la suspension et d'y répondre.
L'Ambassadeur reconnaît avoir pris connaissance des Conditions Générales d'Utilisation, de la Politique de Confidentialité et du Plan de Rémunération de Génération Capable, disponibles sur la plateforme, et s'engage à les respecter. Ces documents complètent le présent Contrat et en font partie intégrante.

ARTICLE 17 — SIGNATURE ÉLECTRONIQUE
Les Parties reconnaissent expressément la validité juridique de la signature électronique apposée sur la plateforme Génération Capable, conformément aux articles 1366 et 1367 du Code civil. Cette signature identifie de manière fiable son auteur et garantit le lien avec l'acte auquel elle s'attache.
Chaque signature est horodatée et accompagnée des éléments de preuve suivants, conservés par la Société : date et heure de signature, adresse IP du signataire, identifiant du compte utilisateur, version exacte du contrat signé, ainsi qu'une image de la signature manuscrite électronique. Ces éléments constituent, entre les Parties, une preuve recevable de l'accord de l'Ambassadeur sur les termes du présent Contrat.

Fait électroniquement via la plateforme Génération Capable, le {{SIGNATURE_DATE}}.
En deux (2) exemplaires originaux numériques, dont un remis à chacune des Parties.

Pour la société GÉNÉRATION CAPABLE                    Pour L'AMBASSADEUR
{{COMPANY_REP_NAME}}                                   {{SIGNER_FULL_NAME}}
En qualité de {{COMPANY_REP_TITLE}}

« Lu et approuvé, bon pour accord »                    « Lu et approuvé, bon pour accord »
Signature électronique certifiée                       Signature électronique certifiée

---
Projet de contrat établi à titre indicatif par assistance IA, sur la base des éléments fournis par Génération Capable. Ce document ne constitue pas un avis juridique et doit impérativement être relu, complété et validé par un avocat ou juriste avant toute signature.`;

// Version courante — change dès que le texte du contrat change. Une
// modification du texte doit toujours créer une NOUVELLE version (jamais
// réutiliser un identifiant déjà signé par quelqu'un) : contract_signatures
// est unique sur (user_id, role, contract_version), et le PDF signé doit
// toujours pouvoir être retracé jusqu'au texte exact qui a été accepté.
const CONTRACT_VERSIONS = {
  vendeur: 'vendeur-v1.0',
  ambassadeur: 'ambassadeur-v1.0',
};

const TEMPLATES = {
  vendeur: VENDEUR_TEMPLATE,
  ambassadeur: AMBASSADEUR_TEMPLATE,
};

// Construit le texte final à partir du profil (compliance_profiles),
// de l'email du compte et de la date de signature. Renvoie aussi
// filled_fields (snapshot exact à journaliser avec la signature).
function renderContract(role, profile, email, signedAt = new Date()) {
  const tpl = TEMPLATES[role];
  if (!tpl) throw new Error(`Rôle de contrat inconnu: ${role}`);
  const company = companyInfo();

  const fields = {
    COMPANY_REP_NAME: company.repName,
    COMPANY_REP_TITLE: company.repTitle,
    COMPANY_SIRET: company.siret,
    COMPANY_ADDRESS: company.address,
    SIGNER_FULL_NAME: `${blank(profile.first_name)} ${blank(profile.last_name)}`.trim(),
    SIGNER_BIRTH_DATE: fmtDate(profile.birth_date),
    SIGNER_BIRTH_PLACE: blank(profile.birth_place),
    SIGNER_ADDRESS: blank(profile.address),
    SIGNER_NATIONALITY: blank(profile.nationality),
    SIGNER_LEGAL_STATUS: blank(profile.legal_status),
    SIGNER_SIRET: blank(profile.siret),
    SIGNATURE_DATE: fmtDate(signedAt),
  };

  let text = tpl;
  for (const [key, value] of Object.entries(fields)) {
    text = text.split(`{{${key}}}`).join(value);
  }

  return { text, filledFields: fields, version: CONTRACT_VERSIONS[role], email };
}

module.exports = { renderContract, CONTRACT_VERSIONS, TEMPLATES, companyInfo };
