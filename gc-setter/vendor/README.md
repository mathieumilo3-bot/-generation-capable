# vendor/

`supabase.js` — build UMD de `@supabase/supabase-js` **v2.116.0**, copié tel quel
depuis le paquet npm officiel (`npm pack @supabase/supabase-js@2`).

Il est servi par le site plutôt que depuis un CDN tiers pour trois raisons :
la PWA admin doit pouvoir démarrer sans dépendre d'un domaine externe, une
panne de CDN ne doit pas casser le formulaire de candidature, et le code chargé
sur une page qui manipule des données personnelles ne doit pas pouvoir changer
sous nos pieds.

Pour mettre à jour :

```sh
npm pack @supabase/supabase-js@2
tar xzf supabase-supabase-js-*.tgz
cp package/dist/umd/supabase.js gc-setter/vendor/supabase.js
```

Le bundle expose le global `supabase` (`window.supabase.createClient`).
