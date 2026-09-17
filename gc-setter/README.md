# GC Setter — page publique + espace admin

Site Netlify **gc-setter** (ID `5c20f4b0-764e-43b5-88e5-4401375873b2`,
https://gc-setter.netlify.app).

## Le flux, en une ligne

```
candidat → / (formulaire public, rôle anon, INSERT seul)
         → Supabase · public.setter_applications        ← une seule table
         → /admin (dashboard privé, Supabase Auth + RLS)
```

Aucune seconde base, aucune table miroir, aucun second formulaire :
`gc-config.js` porte l'URL du projet et la clé publishable, les trois pages
s'en servent.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page publique de candidature (auto-suffisante, CSS inline) |
| `admin.html` / `admin.css` / `admin.js` | dashboard administrateur |
| `onboarding.html` | page remise au candidat accepté (`/onboarding?token=…`) |
| `gc-config.js` | URL Supabase, clé publishable, libellés, liste des admins |
| `vendor/supabase.js` | `@supabase/supabase-js` v2 servi par le site (voir `vendor/README.md`) |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA installable sur iPhone, démarre sur `/admin` |
| `netlify.toml` | rewrites `/admin` et `/onboarding`, en-têtes de sécurité |
| `supabase/setter-admin.sql` | RLS, jeton d'onboarding, trigger, temps réel |

## Mise en service

### 1. Base de données

Exécuter `supabase/setter-admin.sql` dans le SQL Editor du projet
**setter-hunter** (`wscuqzjhmpyytsczqbjb`). Le script est idempotent.

Il remplace notamment la policy `staff full access`, qui ouvrait
`setter_applications` à **tout** compte authentifié, par des policies limitées
aux e-mails présents dans `setter_admins`.

Pour ajouter ou retirer un administrateur ensuite :

```sql
insert into public.setter_admins (email) values ('autre@exemple.com');
delete from public.setter_admins where email = 'autre@exemple.com';
```

Penser à répercuter la même liste dans `ADMIN_EMAILS` (`gc-config.js`) : c'est
le garde-fou d'interface, la RLS reste l'autorisation qui compte.

### 2. Compte administrateur

Le dashboard n'ouvre aucun compte lui-même (`shouldCreateUser: false`).
Créer le compte une fois dans **Supabase → Authentication → Users → Add user**
avec l'e-mail administrateur, puis se connecter sur `/admin` soit par mot de
passe, soit via « Recevoir un code par e-mail ».

### 3. Déploiement Netlify

Le site est servi en statique, sans build : publier le contenu de ce dossier à
la racine du site existant.

```sh
netlify deploy --site 5c20f4b0-764e-43b5-88e5-4401375873b2 --dir gc-setter --prod
```

⚠️ Un déploiement Netlify remplace l'intégralité du site. Le dossier doit donc
toujours contenir `index.html` : ne déployer que `admin.html` ferait disparaître
la page publique.

## Vérifier après déploiement

1. `/` affiche le formulaire candidat.
2. `/admin` affiche l'écran de connexion admin — **jamais** le formulaire candidat.
3. Une candidature test envoyée depuis `/` apparaît dans `setter_applications`
   (`select * from setter_applications order by created_at desc limit 1;`).
4. Elle apparaît immédiatement dans « À traiter » sur `/admin`, sans rechargement.
5. « Accepter » passe le statut à `accepted` et fait apparaître le lien
   d'onboarding, qui s'ouvre sur `/onboarding?token=…`.

## Notifications

Le dashboard écoute `postgres_changes` sur `setter_applications` : toute
insertion déclenche un toast « Nouvelle candidature » et met la liste à jour.
Le bouton 🔔 demande en plus l'autorisation des notifications système.

Sur iPhone, l'API Notification n'est disponible **que** si le site a été ajouté
à l'écran d'accueil (Partager → « Sur l'écran d'accueil »). Hors PWA installée,
le toast reste la seule notification — c'est une limite d'iOS, pas du code.
