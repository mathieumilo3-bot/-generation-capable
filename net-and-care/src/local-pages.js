/* ===========================================================================
   Pages locales — contenu.
   ---------------------------------------------------------------------------
   Une page par couple « prestation × ville », ciblée sur une requête réelle :
   nettoyage canapé Cannes, nettoyage canapé Antibes, nettoyage matelas Cannes…

   Ce ne sont pas des pages de remplissage. Chacune répond à ce qu'un habitant
   de CETTE ville cherche vraiment : ses quartiers, son type de logement, ses
   contraintes (location saisonnière à Cannes, humidité dans l'arrière-pays
   grassois, sable et sel à Juan-les-Pins). Google déclasse les pages locales
   clonées ; un prospect, lui, reconnaît immédiatement une page écrite pour
   quelqu'un d'autre.

   AJOUTER UNE VILLE : dupliquer un bloc, puis réécrire l'intégralité des
   textes. Si l'on n'a rien de spécifique à dire, ne pas créer la page.
   =========================================================================== */

const LIENS = {
  canapeCannes: { href: '/nettoyage-canape-cannes', texte: 'Nettoyage de canapé à Cannes' },
  canapeAntibes: { href: '/nettoyage-canape-antibes', texte: 'Nettoyage de canapé à Antibes' },
  canapeGrasse: { href: '/nettoyage-canape-grasse', texte: 'Nettoyage de canapé à Grasse' },
  matelasCannes: { href: '/nettoyage-matelas-cannes', texte: 'Nettoyage de matelas à Cannes' },
  tapisCannes: { href: '/nettoyage-tapis-cannes', texte: 'Nettoyage de tapis à Cannes' },
  moquetteCannes: { href: '/nettoyage-moquette-cannes', texte: 'Nettoyage de moquette à Cannes' },
  chantierCannes: { href: '/nettoyage-fin-de-chantier-cannes', texte: 'Nettoyage fin de chantier à Cannes' },
  devis: { href: '/devis', texte: 'Simulateur de devis' }
};

module.exports = [

  /* ------------------------------------------------- CANAPÉ · CANNES ---- */
  {
    slug: 'nettoyage-canape-cannes',
    ville: 'Cannes',
    preselect: 'canape',
    visuel: 'canape',
    priorite: 0.95,
    title: 'Nettoyage de canapé à Cannes — devis en 60 s | Net & Care',
    description: 'Nettoyage de canapé à domicile à Cannes : injection-extraction, taches, odeurs, tissu et microfibre. Estimation immédiate, intervention sous 48 h.',
    serviceNom: 'Nettoyage de canapé à domicile',
    h1: 'Nettoyage de canapé à Cannes',
    h1Html: 'Nettoyage de canapé <em class="accent-serif">à Cannes</em>',
    accroche: 'Injection-extraction professionnelle à domicile, du Suquet à la Bocca. Taches de vin, auréoles, poils d\'animaux et odeurs traitées en profondeur — sans déplacer votre canapé.',
    altAvant: 'Canapé en tissu taché dans un appartement cannois, avant nettoyage',
    altApres: 'Le même canapé après nettoyage par injection-extraction à Cannes',
    simH2: 'Combien coûte le nettoyage de votre canapé à Cannes ?',
    tarifsTitre: 'Tarifs nettoyage de canapé à Cannes',
    faqTitre: 'Nettoyage de canapé à Cannes : vos questions',
    ctaTitre: 'Votre canapé cannois, comme neuf',
    reassurance: [
      'Intervention à domicile sous 48 h',
      'Déplacement inclus dans tout Cannes',
      'Séchage en 4 à 6 h'
    ],
    zoneTexte: 'Du Suquet aux immeubles de la Croisette, des résidences de la Californie aux appartements de la Bocca : Net&nbsp;&amp;&nbsp;Care intervient dans tous les quartiers cannois, y compris dans les immeubles anciens sans ascenseur — le matériel est conçu pour être monté à la main.',
    quartiers: ['La Croisette', 'Le Suquet', 'Cannes La Bocca', 'La Californie', 'Petit Juas', 'Croix-des-Gardes', 'Prado-République', 'Carnot', 'Palm Beach', 'Ranguin', 'Le Cannet', 'Mandelieu-la-Napoule'],
    sections: [
      {
        titre: 'Un canapé cannois ne vieillit pas comme les autres',
        corps: `<p>Entre le sel porté par le vent, le sable ramené de la plage et la lumière
          directe des baies vitrées, un canapé en tissu vieillit vite sur le littoral. Les fibres
          se chargent d'un dépôt fin, gris, qui ne part pas à l'aspirateur : c'est lui qui donne
          cet aspect terne aux assises, bien avant l'apparition de la moindre tache.</p>
          <p>Le nettoyage par injection-extraction règle précisément ce problème. Une solution
          adaptée à la fibre est injectée sous pression dans le tissu, puis immédiatement
          réaspirée avec les salissures dissoutes. Contrairement au nettoyage vapeur seul, la
          saleté sort du canapé au lieu d'être repoussée vers la mousse.</p>`
      },
      {
        titre: 'Locations saisonnières : le passage entre deux séjours',
        corps: `<p>Cannes vit au rythme des locations courte durée et des congrès. Un canapé de
          location encaisse en une saison ce qu'un canapé familial encaisse en cinq ans. Net&nbsp;&amp;&nbsp;Care
          travaille avec des propriétaires et des conciergeries cannoises sur des créneaux serrés :
          intervention le matin, appartement relouable le soir.</p>
          <p>Si vous gérez plusieurs biens, indiquez-le dans le simulateur ou sur WhatsApp : un
          tarif de passage récurrent est établi selon le volume et la fréquence.</p>`
      },
      {
        titre: 'Tissu, microfibre, velours, Alcantara : une méthode par matière',
        corps: `<p>Toutes les fibres ne supportent pas le même traitement. Un velours mal rincé
          marque définitivement ; une microfibre trop mouillée garde des auréoles ; un Alcantara
          demande un produit neutre et un brossage dans le sens du poil. Avant toute chose, la
          matière est identifiée et le produit testé sur une zone cachée.</p>
          <p>Les cas les plus fréquents à Cannes : taches de vin et de nourriture sur les assises,
          auréoles de transpiration sur les têtières, poils et odeurs d'animaux, traces de crème
          solaire. Envoyez une photo via le simulateur : vous saurez avant l'intervention ce qui
          partira totalement et ce qui laissera une trace résiduelle.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Canapé 2 places', detail: 'Tissu, microfibre ou velours', prix: '79 €' },
      { quoi: 'Canapé 3 places', detail: 'Le format le plus demandé', prix: '110 €' },
      { quoi: 'Canapé d\'angle', detail: '5 places, méridienne comprise', prix: '175 €' },
      { quoi: 'Fauteuil', detail: 'À l\'unité, avec le canapé', prix: '45 €' },
      { quoi: 'Chaise en tissu', detail: 'À l\'unité, minimum 60 €', prix: '15 €' },
      { quoi: 'Traitement anti-acariens', detail: 'En complément du nettoyage', prix: '25 €' }
    ],
    faq: [
      {
        q: 'Combien coûte le nettoyage d\'un canapé 3 places à Cannes ?',
        r: '<p>Comptez environ 110 à 140 € pour un canapé 3 places en usage courant, déplacement inclus dans Cannes. Le prix varie selon le tissu, le niveau de salissure et les options choisies. Le simulateur vous donne une fourchette immédiate.</p>'
      },
      {
        q: 'Faut-il déplacer le canapé avant votre arrivée ?',
        r: '<p>Non. Il suffit de dégager environ un mètre autour du canapé et de libérer une prise électrique. Les sols sont protégés avant le début du travail.</p>'
      },
      {
        q: 'Combien de temps dure l\'intervention ?',
        r: '<p>Entre 45 minutes et 2 heures selon la taille du canapé et l\'état du tissu. Le séchage complet demande ensuite 4 à 6 heures : en aérant, la pièce reste utilisable le jour même.</p>'
      },
      {
        q: 'Intervenez-vous à La Bocca et dans les étages sans ascenseur ?',
        r: '<p>Oui, dans tous les quartiers de Cannes, y compris La Bocca, Le Suquet et les immeubles anciens sans ascenseur. Signalez simplement l\'étage dans le champ « précisions » du simulateur.</p>'
      },
      {
        q: 'Puis-je faire nettoyer un canapé en location saisonnière entre deux locataires ?',
        r: '<p>Oui, c\'est une demande fréquente à Cannes. L\'intervention se planifie sur un créneau court, le matin ou en début d\'après-midi, pour que le logement soit relouable le jour même.</p>'
      }
    ],
    liens: [LIENS.matelasCannes, LIENS.tapisCannes, LIENS.canapeAntibes, LIENS.canapeGrasse, LIENS.chantierCannes, LIENS.devis]
  },

  /* ------------------------------------------------ CANAPÉ · ANTIBES ---- */
  {
    slug: 'nettoyage-canape-antibes',
    ville: 'Antibes',
    preselect: 'canape',
    visuel: 'canape',
    priorite: 0.9,
    title: 'Nettoyage de canapé à Antibes et Juan-les-Pins | Net & Care',
    description: 'Nettoyage de canapé à domicile à Antibes, Juan-les-Pins et au Cap : taches, sable, odeurs d\'animaux. Estimation en 60 s, intervention sous 48 h.',
    serviceNom: 'Nettoyage de canapé à domicile',
    h1: 'Nettoyage de canapé à Antibes',
    h1Html: 'Nettoyage de canapé <em class="accent-serif">à Antibes</em>',
    accroche: 'Du Vieil Antibes au Cap, de Juan-les-Pins aux Semboules : nettoyage en profondeur de vos canapés et fauteuils à domicile, sable et sel compris.',
    altAvant: 'Canapé en tissu encrassé à Antibes, avant intervention',
    altApres: 'Canapé antibois après nettoyage professionnel en profondeur',
    simH2: 'Combien coûte le nettoyage de votre canapé à Antibes ?',
    tarifsTitre: 'Tarifs nettoyage de canapé à Antibes',
    faqTitre: 'Nettoyage de canapé à Antibes : vos questions',
    ctaTitre: 'Un canapé impeccable à Antibes',
    reassurance: [
      'Antibes, Juan-les-Pins, Cap d\'Antibes',
      'Devis gratuit, déplacement inclus',
      'Intervention sous 48 h'
    ],
    zoneTexte: 'Net&nbsp;&amp;&nbsp;Care couvre l\'ensemble de la commune : les ruelles du Vieil Antibes où le stationnement impose d\'intervenir tôt, les villas du Cap, les résidences de Juan-les-Pins et les quartiers résidentiels de La Fontonne et des Semboules.',
    quartiers: ['Vieil Antibes', 'Juan-les-Pins', 'Cap d\'Antibes', 'La Fontonne', 'Les Semboules', 'Saint-Jean', 'Les Combes', 'Port Vauban', 'Rabiac', 'Vallauris', 'Golfe-Juan', 'Biot'],
    sections: [
      {
        titre: 'Le sable, l\'ennemi discret des canapés antibois',
        corps: `<p>À deux pas de la Gravette ou de la Pinède, le sable finit toujours par arriver
          dans le salon. Fin et abrasif, il descend au fond des coussins et scie littéralement les
          fibres à chaque assise. Un canapé de bord de mer perd sa tenue bien plus vite qu'un
          canapé d'appartement urbain — et l'aspirateur domestique n'atteint jamais cette
          profondeur.</p>
          <p>L'injection-extraction va chercher ce dépôt jusque dans la mousse et le ressort. Le
          tissu retrouve sa souplesse, et surtout sa couleur d'origine : la plupart des clients
          découvrent que leur canapé n'était pas « beige » mais bien plus clair.</p>`
      },
      {
        titre: 'Villas du Cap, appartements de Juan : deux besoins différents',
        corps: `<p>Sur le Cap d'Antibes, les demandes portent souvent sur de grands ensembles —
          canapé d'angle, fauteuils de salon, banquettes de terrasse — et sur du textile de
          qualité qui mérite un traitement doux plutôt qu'un détachage agressif.</p>
          <p>À Juan-les-Pins, la location saisonnière domine : il faut aller vite, entre deux
          arrivées, et traiter en priorité les odeurs et les taches visibles. Dans les deux cas,
          le prix est annoncé avant l'intervention et le créneau est confirmé par téléphone.</p>`
      },
      {
        titre: 'Animaux, allergies : ce que le nettoyage change vraiment',
        corps: `<p>Un canapé absorbe les poils, les squames et l'humidité — les trois conditions
          qui font prospérer les acariens. Sur le littoral antibois, l'humidité ambiante élevée
          accentue le phénomène toute l'année.</p>
          <p>Le nettoyage en profondeur retire la matière organique dont vivent les acariens ;
          le traitement anti-acariens en option prolonge ensuite l'effet plusieurs mois. C'est la
          combinaison la plus efficace pour un foyer avec un animal ou une personne allergique.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Canapé 2 places', detail: 'Tissu, microfibre ou velours', prix: '79 €' },
      { quoi: 'Canapé 3 places', detail: 'Le format le plus demandé', prix: '110 €' },
      { quoi: 'Canapé d\'angle', detail: '5 places, méridienne comprise', prix: '175 €' },
      { quoi: 'Fauteuil', detail: 'À l\'unité, avec le canapé', prix: '45 €' },
      { quoi: 'Salon complet', detail: 'Canapé 3 places + 2 fauteuils', prix: '190 €' },
      { quoi: 'Traitement anti-acariens', detail: 'Recommandé avec animaux', prix: '25 €' }
    ],
    faq: [
      {
        q: 'Intervenez-vous à Juan-les-Pins et au Cap d\'Antibes ?',
        r: '<p>Oui, l\'ensemble de la commune d\'Antibes est couvert, Juan-les-Pins et le Cap compris, ainsi que Vallauris, Golfe-Juan et Biot. Le déplacement est inclus dans le prix annoncé.</p>'
      },
      {
        q: 'Le stationnement est compliqué dans le Vieil Antibes, est-ce un problème ?',
        r: '<p>Non, mais cela se prépare : les interventions dans le centre historique sont planifiées en début de matinée. Précisez l\'adresse exacte dans le simulateur, le créneau sera adapté.</p>'
      },
      {
        q: 'Pouvez-vous enlever une odeur d\'animal incrustée ?',
        r: '<p>Dans la grande majorité des cas, oui. Un traitement enzymatique détruit les composés responsables de l\'odeur au lieu de les masquer avec un parfum. Une photo du canapé et une description de l\'odeur permettent de vous répondre honnêtement avant de venir.</p>'
      },
      {
        q: 'Quel délai pour une intervention à Antibes ?',
        r: '<p>En général sous 48 h. Pour une location entre deux séjours, l\'option « intervention urgente » du simulateur permet un passage sous 24 h si un créneau est disponible.</p>'
      }
    ],
    liens: [LIENS.canapeCannes, LIENS.matelasCannes, LIENS.tapisCannes, LIENS.canapeGrasse, LIENS.moquetteCannes, LIENS.devis]
  },

  /* ------------------------------------------------- CANAPÉ · GRASSE ---- */
  {
    slug: 'nettoyage-canape-grasse',
    ville: 'Grasse',
    preselect: 'canape',
    visuel: 'canape',
    priorite: 0.9,
    title: 'Nettoyage de canapé à Grasse et alentours | Net & Care',
    description: 'Nettoyage de canapé à domicile à Grasse, Mouans-Sartoux, Valbonne et Pégomas. Taches, humidité, odeurs : estimation en 60 s et devis gratuit.',
    serviceNom: 'Nettoyage de canapé à domicile',
    h1: 'Nettoyage de canapé à Grasse',
    h1Html: 'Nettoyage de canapé <em class="accent-serif">à Grasse</em>',
    accroche: 'Maisons de village, villas de l\'arrière-pays, appartements du centre historique : Net&nbsp;&amp; Care se déplace dans tout le pays grassois avec son matériel professionnel.',
    altAvant: 'Canapé de salon encrassé à Grasse, avant nettoyage',
    altApres: 'Canapé grassois après nettoyage en profondeur',
    simH2: 'Combien coûte le nettoyage de votre canapé à Grasse ?',
    tarifsTitre: 'Tarifs nettoyage de canapé à Grasse',
    faqTitre: 'Nettoyage de canapé à Grasse : vos questions',
    ctaTitre: 'Redonnez vie à votre salon grassois',
    reassurance: [
      'Grasse et communes de l\'arrière-pays',
      'Devis gratuit et sans engagement',
      'Traitement des odeurs d\'humidité'
    ],
    zoneTexte: 'Du centre historique aux hameaux de Plascassier et Magagnosc, Net&nbsp;&amp;&nbsp;Care intervient dans tout le pays grassois, jusqu\'à Mouans-Sartoux, Valbonne, Pégomas et Auribeau-sur-Siagne. Les accès difficiles et les maisons de village en étage sont habituels ici : le matériel est prévu pour.',
    quartiers: ['Centre historique', 'Saint-Jacques', 'Magagnosc', 'Plascassier', 'Saint-Antoine', 'Les Aspres', 'La Paoute', 'Saint-Claude', 'Mouans-Sartoux', 'Valbonne', 'Pégomas', 'Auribeau-sur-Siagne'],
    sections: [
      {
        titre: 'L\'humidité de l\'arrière-pays, un problème différent du littoral',
        corps: `<p>À Grasse et dans les communes environnantes, le vrai adversaire n'est pas le
          sable mais l'humidité. Les maisons de village aux murs épais, les pièces peu exposées
          et les hivers frais favorisent une odeur de renfermé qui s'installe dans les textiles —
          et parfois de petites taches de moisissure au dos des coussins plaqués contre un mur.</p>
          <p>Ces cas se traitent, mais pas avec un simple shampooing : il faut un produit
          fongicide adapté, une extraction poussée et un séchage maîtrisé. Un canapé mal séché
          dans une pièce humide ressort plus odorant qu'avant.</p>`
      },
      {
        titre: 'Des logements qui ne se ressemblent pas',
        corps: `<p>Le pays grassois mêle appartements du centre ancien, maisons de village en
          étages étroits et villas avec grands salons. Chacun impose ses contraintes : escalier en
          colimaçon, absence de place de stationnement, salon en enfilade. Tout cela se règle en
          amont, au moment du rappel téléphonique, jamais le jour de l'intervention.</p>
          <p>Indiquez simplement l'étage, la présence d'un ascenseur et les difficultés d'accès
          dans le champ « précisions » du simulateur : le créneau et le matériel sont adaptés en
          conséquence, sans supplément.</p>`
      },
      {
        titre: 'Un canapé familial, pas un canapé de passage',
        corps: `<p>À la différence de Cannes ou de Juan-les-Pins, la clientèle grassoise est
          majoritairement résidente : le canapé est utilisé tous les jours, depuis des années,
          souvent par toute la famille. Les demandes portent moins sur une tache unique que sur
          une remise à neuf générale — assises affaissées de couleur, têtières marquées, odeurs
          diffuses.</p>
          <p>C'est précisément ce que l'injection-extraction traite le mieux : elle ne cible pas
          une tache, elle relance l'ensemble du textile. Le résultat est souvent le plus
          spectaculaire sur ces canapés-là.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Canapé 2 places', detail: 'Tissu, microfibre ou velours', prix: '79 €' },
      { quoi: 'Canapé 3 places', detail: 'Le format le plus demandé', prix: '110 €' },
      { quoi: 'Canapé d\'angle', detail: '5 places, méridienne comprise', prix: '175 €' },
      { quoi: 'Fauteuil', detail: 'À l\'unité, avec le canapé', prix: '45 €' },
      { quoi: 'Traitement anti-moisissure', detail: 'Selon diagnostic sur photo', prix: 'Sur devis' },
      { quoi: 'Imperméabilisation', detail: 'Protection après nettoyage', prix: '35 €' }
    ],
    faq: [
      {
        q: 'Vous déplacez-vous jusqu\'à Grasse depuis Cannes ?',
        r: '<p>Oui, Grasse fait partie de la zone d\'intervention habituelle, tout comme Mouans-Sartoux, Valbonne, Pégomas et Auribeau-sur-Siagne. Le déplacement est inclus dans le prix annoncé.</p>'
      },
      {
        q: 'Mon canapé sent l\'humidité, est-ce récupérable ?',
        r: '<p>Le plus souvent oui, à condition de traiter la cause et pas seulement l\'odeur : extraction en profondeur, produit adapté, puis séchage accéléré. Envoyez une photo via le simulateur pour obtenir une réponse franche avant l\'intervention.</p>'
      },
      {
        q: 'Ma maison de village n\'a pas d\'ascenseur, est-ce un supplément ?',
        r: '<p>Non. Le matériel est transportable à la main et les étages sans ascenseur sont la norme dans le centre de Grasse. Signalez-le simplement pour que le créneau soit correctement calibré.</p>'
      },
      {
        q: 'Combien de temps le canapé reste-t-il inutilisable ?',
        r: '<p>4 à 6 heures de séchage en moyenne, un peu plus dans une pièce humide ou en hiver. En aérant et en chauffant légèrement la pièce, le canapé est réutilisable le soir même.</p>'
      }
    ],
    liens: [LIENS.canapeCannes, LIENS.canapeAntibes, LIENS.matelasCannes, LIENS.tapisCannes, LIENS.chantierCannes, LIENS.devis]
  },

  /* ------------------------------------------------ MATELAS · CANNES ---- */
  {
    slug: 'nettoyage-matelas-cannes',
    ville: 'Cannes',
    preselect: 'matelas',
    visuel: 'matelas',
    priorite: 0.95,
    title: 'Nettoyage de matelas à Cannes — anti-acariens | Net & Care',
    description: 'Nettoyage de matelas à domicile à Cannes : auréoles, urine, transpiration, traitement anti-acariens. Estimation immédiate, intervention sous 48 h.',
    serviceNom: 'Nettoyage de matelas à domicile',
    h1: 'Nettoyage de matelas à Cannes',
    h1Html: 'Nettoyage de matelas <em class="accent-serif">à Cannes</em>',
    accroche: 'Auréoles, transpiration, urine, acariens : un matelas se nettoie en profondeur, chez vous, sans être déplacé ni emporté en atelier.',
    altAvant: 'Matelas taché avant nettoyage à Cannes',
    altApres: 'Matelas après nettoyage et traitement anti-acariens à Cannes',
    simH2: 'Combien coûte le nettoyage de votre matelas à Cannes ?',
    tarifsTitre: 'Tarifs nettoyage de matelas à Cannes',
    faqTitre: 'Nettoyage de matelas à Cannes : vos questions',
    ctaTitre: 'Dormez sur un matelas vraiment propre',
    reassurance: [
      'Traitement anti-acariens en option',
      'Intervention à domicile sous 48 h',
      'Séchage en 4 à 6 h'
    ],
    zoneTexte: 'Net&nbsp;&amp;&nbsp;Care intervient dans tous les quartiers de Cannes ainsi qu\'au Cannet, à Mandelieu-la-Napoule, Mougins et Théoule-sur-Mer. Les interventions en résidence et en location saisonnière sont planifiées sur créneau court.',
    quartiers: ['La Croisette', 'Le Suquet', 'Cannes La Bocca', 'La Californie', 'Petit Juas', 'Prado-République', 'Le Cannet', 'Mandelieu-la-Napoule', 'Mougins', 'Théoule-sur-Mer'],
    sections: [
      {
        titre: 'Ce qu\'un matelas accumule en une seule année',
        corps: `<p>Un adulte transpire en moyenne plusieurs dizaines de centilitres par nuit.
          Cette humidité traverse le drap, pénètre le coutil et alimente une population
          d'acariens qui se nourrit des cellules de peau. À Cannes, l'humidité ambiante du
          littoral ralentit encore le séchage naturel du matelas — le phénomène s'accélère.</p>
          <p>Retourner le matelas ou l'aspirer ne change rien à ce qui est à l'intérieur. Seule
          une extraction en profondeur, suivie d'un séchage rapide, retire réellement la matière
          organique et l'humidité résiduelle.</p>`
      },
      {
        titre: 'Locations saisonnières et résidences secondaires',
        corps: `<p>À Cannes, beaucoup de matelas ne servent que quelques semaines par an — mais à
          des dizaines de personnes différentes. Entre deux séjours, un passage de nettoyage
          protège la réputation du logement bien plus efficacement qu'une simple alèse changée :
          les voyageurs remarquent immédiatement une odeur ou une auréole.</p>
          <p>Pour les résidences secondaires fermées plusieurs mois, le combiné nettoyage +
          anti-acariens en début et en fin de saison évite l'odeur de renfermé caractéristique
          d'un matelas resté dans une pièce close.</p>`
      },
      {
        titre: 'Urine, sang, transpiration : les cas traitables',
        corps: `<p>Les taches d'origine organique demandent un traitement enzymatique, pas un
          détachant classique : les enzymes décomposent la matière responsable de la tache et de
          l'odeur. C'est ce qui permet de traiter durablement une énurésie d'enfant ou un accident
          d'animal, là où un produit ménager ne fait que déplacer le problème.</p>
          <p>Les taches anciennes, déjà oxydées, peuvent laisser une ombre résiduelle. C'est dit
          avant l'intervention, sur la base de la photo transmise dans le simulateur — jamais
          découvert après paiement.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Matelas 1 place', detail: '90 × 190, une face', prix: '69 €' },
      { quoi: 'Matelas 2 places', detail: '140 × 190, une face', prix: '89 €' },
      { quoi: 'Matelas Queen / King', detail: '160 × 200 ou 180 × 200', prix: '99 €' },
      { quoi: 'Traitement anti-acariens', detail: 'En complément du nettoyage', prix: '25 €' },
      { quoi: 'Sommier tapissier', detail: 'Avec le matelas', prix: '35 €' },
      { quoi: 'Tête de lit en tissu', detail: 'Avec le matelas', prix: '25 €' }
    ],
    faq: [
      {
        q: 'Combien coûte le nettoyage d\'un matelas 2 places à Cannes ?',
        r: '<p>À partir de 89 € pour un matelas 140 × 190, déplacement inclus dans Cannes. Le traitement anti-acariens s\'ajoute pour 25 €. Le simulateur calcule la fourchette exacte selon l\'état du matelas.</p>'
      },
      {
        q: 'Une tache d\'urine ancienne part-elle vraiment ?',
        r: '<p>Un traitement enzymatique élimine l\'odeur dans la quasi-totalité des cas. La trace visible part le plus souvent aussi, sauf si elle est très ancienne et oxydée : une ombre légère peut alors subsister. Une photo permet de vous le dire avant l\'intervention.</p>'
      },
      {
        q: 'Le matelas est-il emporté en atelier ?',
        r: '<p>Non, tout se fait chez vous. Le matelas n\'est ni démonté ni transporté : il reste sur son sommier, et vous récupérez un lit utilisable le soir même.</p>'
      },
      {
        q: 'À quelle fréquence faire nettoyer un matelas ?',
        r: '<p>Une fois par an pour un usage quotidien, deux fois en cas d\'allergie ou d\'animal dormant sur le lit. Pour une location saisonnière, entre chaque saison au minimum.</p>'
      },
      {
        q: 'Peut-on dormir dessus le soir même ?',
        r: '<p>Oui dans la plupart des cas : comptez 4 à 6 heures de séchage. Une intervention le matin permet de se coucher normalement le soir. En cas de doute, l\'intervention est planifiée en début de journée.</p>'
      }
    ],
    liens: [LIENS.canapeCannes, LIENS.tapisCannes, LIENS.moquetteCannes, LIENS.canapeAntibes, LIENS.chantierCannes, LIENS.devis]
  },

  /* -------------------------------------------------- TAPIS · CANNES ---- */
  {
    slug: 'nettoyage-tapis-cannes',
    ville: 'Cannes',
    preselect: 'tapis',
    visuel: 'tapis',
    priorite: 0.9,
    title: 'Nettoyage de tapis à Cannes — laine, orient, synthétique | Net & Care',
    description: 'Nettoyage de tapis à domicile à Cannes : laine, coton, synthétique, tapis d\'orient. Méthode adaptée à la fibre, estimation immédiate, devis gratuit.',
    serviceNom: 'Nettoyage de tapis à domicile',
    h1: 'Nettoyage de tapis à Cannes',
    h1Html: 'Nettoyage de tapis <em class="accent-serif">à Cannes</em>',
    accroche: 'Laine, coton, synthétique ou tapis d\'orient : chaque fibre a sa méthode. Nettoyage à domicile, sans rétrécissement ni décoloration.',
    altAvant: 'Tapis en laine encrassé avant nettoyage à Cannes',
    altApres: 'Tapis en laine ravivé après nettoyage à Cannes',
    simH2: 'Combien coûte le nettoyage de votre tapis à Cannes ?',
    tarifsTitre: 'Tarifs nettoyage de tapis à Cannes',
    faqTitre: 'Nettoyage de tapis à Cannes : vos questions',
    ctaTitre: 'Vos tapis retrouvent leurs couleurs',
    reassurance: [
      'Méthode adaptée à chaque fibre',
      'Nettoyage à domicile ou en atelier',
      'Devis gratuit sur photo'
    ],
    zoneTexte: 'Intervention dans tout Cannes et les communes voisines. Pour les tapis fragiles ou de grande valeur — soie, tapis d\'orient noués main — une prise en charge en atelier peut être proposée après diagnostic sur photo.',
    quartiers: ['La Croisette', 'Le Suquet', 'Cannes La Bocca', 'La Californie', 'Carnot', 'Croix-des-Gardes', 'Le Cannet', 'Mougins', 'Mandelieu-la-Napoule', 'Vallauris'],
    sections: [
      {
        titre: 'Un tapis retient dix fois plus que ce que l\'on voit',
        corps: `<p>Un tapis de salon fonctionne comme un filtre : il capte la poussière, le sable
          et les particules qui circulent dans la pièce. À Cannes, où les fenêtres restent
          ouvertes une grande partie de l'année, ce dépôt s'accumule vite au pied des fibres —
          là où l'aspirateur ne descend pas.</p>
          <p>Le nettoyage en profondeur remet les fibres debout et fait remonter les couleurs
          d'origine. C'est le motif qui change le plus visiblement : les zones de passage
          cessent de trancher avec le reste du tapis.</p>`
      },
      {
        titre: 'Laine, synthétique, soie : ce qui change tout',
        corps: `<p>La laine supporte mal les produits alcalins et les températures élevées : mal
          traitée, elle feutre et perd son moelleux. Les tapis synthétiques acceptent un
          traitement plus soutenu. Les tapis d'orient noués main, souvent teints avec des
          colorants sensibles, imposent un test de migration des couleurs avant tout contact avec
          l'eau — faute de quoi le rouge file dans le beige, de manière irréversible.</p>
          <p>C'est pourquoi le simulateur demande la matière : elle détermine la méthode, le
          produit et le prix. Si vous ne la connaissez pas, indiquez-le et joignez une photo du
          tapis et de son envers.</p>`
      },
      {
        titre: 'Tapis sous table, tapis d\'entrée, tapis de chambre',
        corps: `<p>Les trois se salissent différemment. Sous une table, ce sont les taches
          alimentaires et le gras ; à l'entrée, le sable et les traces de semelles ; en chambre,
          la poussière fine et les acariens. La méthode et la durée d'intervention s'adaptent —
          et le prix aussi, puisqu'il est calculé à la surface réelle.</p>
          <p>Pour plusieurs tapis, le simulateur permet d'indiquer le nombre de pièces : le tarif
          au mètre carré est appliqué à l'ensemble, ce qui rend le passage groupé nettement plus
          intéressant qu'une intervention par tapis.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Tapis synthétique', detail: 'Au mètre carré, minimum 60 €', prix: '18 €/m²' },
      { quoi: 'Tapis en laine', detail: 'Traitement doux, au mètre carré', prix: '22 €/m²' },
      { quoi: 'Tapis d\'orient / soie', detail: 'Après diagnostic sur photo', prix: 'Sur devis' },
      { quoi: 'Tapis 2 × 1,5 m', detail: 'Format courant, synthétique', prix: '60 €' },
      { quoi: 'Descente de lit', detail: 'À l\'unité, avec un autre tapis', prix: '25 €' },
      { quoi: 'Imperméabilisation', detail: 'Protection anti-taches', prix: '35 €' }
    ],
    faq: [
      {
        q: 'Mon tapis en laine risque-t-il de rétrécir ?',
        r: '<p>Non, à condition d\'utiliser un produit à pH neutre, une eau tiède et une extraction poussée pour éviter que la fibre reste gorgée d\'eau. C\'est précisément ce qui distingue un nettoyage professionnel d\'un shampooing de location.</p>'
      },
      {
        q: 'Le nettoyage se fait-il chez moi ?',
        r: '<p>Oui dans la majorité des cas. Pour un tapis d\'orient noué main, en soie, ou très imprégné, une prise en charge en atelier est parfois préférable : la solution est proposée après diagnostic sur photo, jamais imposée.</p>'
      },
      {
        q: 'Combien de temps un tapis met-il à sécher ?',
        r: '<p>4 à 8 heures selon l\'épaisseur et la fibre. Un tapis en laine épais demande plus de temps qu\'un synthétique ras. La pièce reste utilisable, il suffit d\'éviter de marcher sur le tapis pendant le séchage.</p>'
      },
      {
        q: 'Les couleurs peuvent-elles déteindre ?',
        r: '<p>Un test de migration des couleurs est réalisé systématiquement sur une zone discrète avant traitement. Si le tapis présente un risque, vous êtes prévenu et une méthode alternative, à faible humidité, est proposée.</p>'
      }
    ],
    liens: [LIENS.moquetteCannes, LIENS.canapeCannes, LIENS.matelasCannes, LIENS.canapeAntibes, LIENS.chantierCannes, LIENS.devis]
  },

  /* ----------------------------------------------- MOQUETTE · CANNES ---- */
  {
    slug: 'nettoyage-moquette-cannes',
    ville: 'Cannes',
    preselect: 'moquette',
    visuel: 'moquette',
    priorite: 0.8,
    title: 'Nettoyage de moquette à Cannes — bureaux et hôtels | Net & Care',
    description: 'Nettoyage de moquette à Cannes : bureaux, hôtels, locations, parties communes. Séchage rapide, intervention en dehors des heures d\'ouverture.',
    serviceNom: 'Nettoyage de moquette',
    h1: 'Nettoyage de moquette à Cannes',
    h1Html: 'Nettoyage de moquette <em class="accent-serif">à Cannes</em>',
    accroche: 'Bureaux, hôtels, locations saisonnières et parties communes : une moquette remise à neuf, et des locaux réutilisables dès le lendemain.',
    altAvant: 'Moquette de bureau encrassée avant nettoyage à Cannes',
    altApres: 'Moquette de bureau après nettoyage professionnel à Cannes',
    simH2: 'Combien coûte le nettoyage de votre moquette à Cannes ?',
    tarifsTitre: 'Tarifs nettoyage de moquette à Cannes',
    faqTitre: 'Nettoyage de moquette à Cannes : vos questions',
    ctaTitre: 'Une moquette remise à neuf, sans fermer',
    reassurance: [
      'Intervention hors heures d\'ouverture',
      'Séchage rapide, locaux utilisables',
      'Devis au m² sur plan ou photo'
    ],
    zoneTexte: 'Bureaux du centre, hôtels du front de mer, résidences de tourisme et parties communes de copropriétés : Net&nbsp;&amp;&nbsp;Care intervient dans tout Cannes et les communes voisines, y compris en soirée ou le week-end pour ne pas interrompre l\'activité.',
    quartiers: ['Centre-ville', 'La Croisette', 'Palais des Festivals', 'Cannes La Bocca', 'Carnot', 'Prado-République', 'Le Cannet', 'Mandelieu-la-Napoule', 'Mougins', 'Vallauris'],
    sections: [
      {
        titre: 'La moquette professionnelle s\'use d\'abord aux mêmes endroits',
        corps: `<p>Dans un bureau ou un hall d'hôtel, l'usure n'est jamais uniforme : entrée,
          couloir, devant l'ascenseur, sous les fauteuils d'accueil. Ce sont ces quelques mètres
          carrés qui donnent à l'ensemble un air fatigué, alors que 80&nbsp;% de la surface est
          encore en bon état.</p>
          <p>Un nettoyage par injection-extraction traite l'ensemble mais concentre l'effort sur
          ces zones de passage. Résultat : la moquette redevient homogène, sans avoir à la
          remplacer — une dépense sans commune mesure.</p>`
      },
      {
        titre: 'Cannes, ville de congrès : des fenêtres d\'intervention étroites',
        corps: `<p>Entre deux salons, un hôtel ou un espace de réception ne peut pas rester
          indisponible 48 heures. Les interventions se planifient donc en soirée, la nuit ou le
          week-end, avec une méthode à faible taux d'humidité lorsque le délai de remise en
          service est très court.</p>
          <p>Pour les surfaces importantes, indiquez le métrage dans le simulateur : au-delà de
          100 m², un devis chiffré est établi rapidement, avec un tarif dégressif et un planning
          compatible avec votre activité.</p>`
      },
      {
        titre: 'Copropriétés et locations : les parties communes',
        corps: `<p>Couloirs, paliers et escaliers moquettés d'immeubles cannois concentrent le
          sable et la poussière apportés de l'extérieur. Un passage annuel suffit généralement à
          maintenir l'aspect, et coûte bien moins cher qu'une réfection.</p>
          <p>Syndics, conciergeries et gestionnaires : un tarif contractuel peut être établi sur
          la base d'un passage récurrent. Précisez-le dans le champ « précisions » du
          simulateur.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Moquette de bureau', detail: 'Au mètre carré, minimum 120 €', prix: '7 €/m²' },
      { quoi: 'Grande surface', detail: 'Au-delà de 100 m², dégressif', prix: 'Sur devis' },
      { quoi: 'Escalier moquetté', detail: 'Par volée, environ 15 marches', prix: '60 €' },
      { quoi: 'Chambre d\'hôtel', detail: 'Moquette seule, par chambre', prix: '45 €' },
      { quoi: 'Intervention de nuit', detail: 'Supplément horaire décalé', prix: 'Sur devis' },
      { quoi: 'Contrat d\'entretien', detail: 'Passages planifiés à l\'année', prix: 'Tarif contractuel' }
    ],
    faq: [
      {
        q: 'Peut-on utiliser les locaux le lendemain ?',
        r: '<p>Oui. Avec une extraction correcte et une ventilation, une moquette de bureau est sèche en 6 à 10 heures. Une intervention en fin de journée permet une reprise normale le lendemain matin.</p>'
      },
      {
        q: 'Intervenez-vous le soir ou le week-end ?',
        r: '<p>Oui, c\'est même la norme pour les bureaux, hôtels et commerces cannois. Le créneau est convenu lors du rappel, avec un supplément uniquement en cas d\'horaire de nuit.</p>'
      },
      {
        q: 'Comment est calculé le prix pour une grande surface ?',
        r: '<p>Au mètre carré, avec un tarif dégressif au-delà de 100 m². Un plan, un métrage ou quelques photos suffisent à établir un devis ferme sans visite préalable.</p>'
      },
      {
        q: 'Les taches de café et d\'encre partent-elles ?',
        r: '<p>Le café part dans la quasi-totalité des cas. L\'encre et certains colorants alimentaires dépendent de l\'ancienneté et de la fibre : ils sont traités avec un détachant ciblé, et le résultat attendu vous est annoncé avant l\'intervention.</p>'
      }
    ],
    liens: [LIENS.tapisCannes, LIENS.chantierCannes, LIENS.canapeCannes, LIENS.matelasCannes, LIENS.canapeAntibes, LIENS.devis]
  },

  /* ------------------------------------------ FIN DE CHANTIER · CANNES -- */
  {
    slug: 'nettoyage-fin-de-chantier-cannes',
    ville: 'Cannes',
    preselect: 'chantier',
    visuel: 'moquette',
    priorite: 0.85,
    title: 'Nettoyage fin de chantier à Cannes — remise en état | Net & Care',
    description: 'Nettoyage fin de chantier à Cannes : poussières fines, traces de peinture, vitrerie, sols. Bien livrable immédiatement. Devis gratuit au m².',
    serviceNom: 'Nettoyage de fin de chantier et remise en état',
    h1: 'Nettoyage fin de chantier à Cannes',
    h1Html: 'Nettoyage fin de chantier <em class="accent-serif">à Cannes</em>',
    accroche: 'Après travaux, un logement n\'est pas livrable tant qu\'il reste de la poussière de plâtre. Remise en état complète pour agences, propriétaires et artisans.',
    altAvant: 'Sol d\'appartement en fin de chantier avant remise en état',
    altApres: 'Appartement cannois livrable après nettoyage de fin de chantier',
    simH2: 'Combien coûte votre nettoyage de fin de chantier ?',
    tarifsTitre: 'Tarifs nettoyage fin de chantier à Cannes',
    faqTitre: 'Fin de chantier à Cannes : vos questions',
    ctaTitre: 'Un bien livrable dès demain',
    reassurance: [
      'Intervention en équipe',
      'Devis au m², évacuation comprise',
      'Bien livrable immédiatement'
    ],
    zoneTexte: 'Appartements rénovés du centre, villas de la Californie, locaux commerciaux et biens destinés à la location saisonnière : Net&nbsp;&amp;&nbsp;Care intervient dans tout Cannes et les communes voisines, en coordination avec les artisans ou l\'agence.',
    quartiers: ['Centre-ville', 'La Croisette', 'Le Suquet', 'La Californie', 'Cannes La Bocca', 'Petit Juas', 'Le Cannet', 'Mandelieu-la-Napoule', 'Mougins', 'Théoule-sur-Mer'],
    sections: [
      {
        titre: 'La poussière de chantier ne se balaie pas, elle se retire',
        corps: `<p>La poussière de plâtre et de ponçage est si fine qu'elle se redépose pendant
          des jours : nettoyée une fois, elle réapparaît le lendemain sur les plinthes, les
          rebords et les vitres. C'est ce qui fait échouer la plupart des remises en état
          improvisées, et ce qui fait repousser une livraison ou une visite.</p>
          <p>La méthode professionnelle consiste à travailler de haut en bas, à aspirer avec des
          filtres adaptés plutôt qu'à balayer, et à traiter les surfaces dans un ordre précis.
          Le bien est alors réellement propre, pas propre en apparence.</p>`
      },
      {
        titre: 'Agences, propriétaires, artisans : trois attentes différentes',
        corps: `<p>Une agence immobilière cannoise veut un bien photographiable et visitable
          immédiatement. Un propriétaire veut emménager sans repasser derrière. Un artisan veut
          livrer son chantier sans y consacrer deux jours de main-d'œuvre.</p>
          <p>Dans les trois cas, la prestation est calibrée à la surface et au niveau de
          finition attendu, avec une date de livraison ferme. Pour les chantiers récurrents, un
          tarif contractuel est établi.</p>`
      },
      {
        titre: 'Ce que comprend une remise en état complète',
        corps: `<p>Dépoussiérage complet des murs, plafonds et plinthes ; retrait des traces de
          peinture, colle et adhésif sur vitres, sols et menuiseries ; nettoyage et lustrage des
          sols selon leur nature ; vitrerie intérieure ; sanitaires et cuisine détartrés et
          désinfectés ; évacuation des petits déchets résiduels.</p>
          <p>Les textiles laissés sur place — moquettes, canapés livrés avant les finitions —
          peuvent être traités dans la même intervention. Précisez-le dans le simulateur pour
          qu'ils soient intégrés au devis.</p>`
      }
    ],
    tarifs: [
      { quoi: 'Appartement après travaux', detail: 'Au mètre carré, minimum 250 €', prix: '6 €/m²' },
      { quoi: 'Villa / maison', detail: 'Surface importante, dégressif', prix: 'Sur devis' },
      { quoi: 'Local commercial', detail: 'Au mètre carré', prix: '5 €/m²' },
      { quoi: 'Vitrerie seule', detail: 'Intérieur, au mètre carré', prix: '4 €/m²' },
      { quoi: 'Moquette incluse', detail: 'En complément de la remise en état', prix: '7 €/m²' },
      { quoi: 'Chantier récurrent', detail: 'Agences et artisans', prix: 'Tarif contractuel' }
    ],
    faq: [
      {
        q: 'Sous quel délai pouvez-vous intervenir après la fin des travaux ?',
        r: '<p>Généralement sous 48 h, et plus rapidement pour un bien à livrer ou à photographier. Indiquez la date de livraison souhaitée dans le simulateur : le créneau est calé dessus.</p>'
      },
      {
        q: 'Le prix comprend-il l\'évacuation des déchets ?',
        r: '<p>Les petits déchets résiduels et les emballages sont évacués. Les gravats, sanitaires déposés ou grands volumes relèvent d\'une benne : ils sont chiffrés à part, et signalés avant l\'intervention.</p>'
      },
      {
        q: 'Faut-il que l\'électricité et l\'eau soient raccordées ?',
        r: '<p>Oui, l\'accès à une prise et à un point d\'eau est nécessaire. Si le bien n\'est pas encore raccordé, signalez-le : une solution autonome peut être prévue, avec un supplément.</p>'
      },
      {
        q: 'Travaillez-vous avec des agences et des conciergeries ?',
        r: '<p>Oui, notamment sur des biens destinés à la location saisonnière cannoise. Un tarif contractuel et un interlocuteur unique sont mis en place dès qu\'il y a récurrence.</p>'
      }
    ],
    liens: [LIENS.moquetteCannes, LIENS.canapeCannes, LIENS.matelasCannes, LIENS.tapisCannes, LIENS.canapeAntibes, LIENS.devis]
  }
];
