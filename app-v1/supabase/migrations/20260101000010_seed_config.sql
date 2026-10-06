-- ════════════════════════════════════════════════════════════════════════
-- 0010 — Configuration initiale (idempotente). Tout est modifiable ensuite
-- depuis le back-office ou SQL : AUCUNE valeur ci-dessous n'est codée en dur
-- dans l'application.
-- ════════════════════════════════════════════════════════════════════════

insert into public.app_settings (key, value, is_public, description) values
  ('product.name',                 '"Montage"'::jsonb,                      true,  'Nom affiché (à remplacer par le nom de marque final)'),
  ('product.support_email',        '"support@example.com"'::jsonb,          true,  'Adresse support (SETUP_REQUIRED.md)'),
  ('urls.terms',                   '"https://example.com/conditions"'::jsonb, true, 'Conditions d''utilisation'),
  ('urls.privacy',                 '"https://example.com/confidentialite"'::jsonb, true, 'Politique de confidentialité'),
  ('urls.support',                 '"https://example.com/aide"'::jsonb,     true,  'Page d''aide'),
  ('urls.account_deletion',        '"https://example.com/supprimer-mon-compte"'::jsonb, true, 'URL publique de suppression (Google Play)'),
  ('urls.manage_data',             '"https://example.com/mes-donnees"'::jsonb, true, 'Gestion des données'),
  ('maintenance.enabled',          'false'::jsonb,                          true,  'Mode maintenance : bloque les nouvelles commandes'),
  ('maintenance.message',          '"Maintenance en cours. Vos vidéos et votre solde sont en sécurité."'::jsonb, true, null),
  ('app.min_version',              '{"ios":"1.0.0","android":"1.0.0","web":"1.0.0"}'::jsonb, true, 'Version minimale supportée'),
  ('wallet.currency',              '"EUR"'::jsonb,                          true,  null),
  ('wallet.min_topup_cents',       '1000'::jsonb,                           true,  'Recharge minimale (10 €)'),
  ('wallet.max_topup_cents',       '100000'::jsonb,                         true,  'Recharge maximale (web, montant libre)'),
  ('wallet.topup_presets_cents',   '[1000,2000,2500,5000,10000,25000]'::jsonb, true, 'Montants proposés'),
  ('wallet.low_balance_threshold_cents', '500'::jsonb,                      true,  'Seuil de la notification « solde presque épuisé »'),
  ('payments.auto_reload_enabled', 'true'::jsonb,                           true,  'Affichage de la recharge automatique (web/Stripe)'),
  ('payments.auto_reload_caps_cents', '[10000,25000,50000]'::jsonb,         true,  'Plafonds mensuels proposés'),
  ('payments.auto_reload_thresholds_cents', '[500,1000,2000]'::jsonb,       true,  'Seuils proposés'),
  -- Fournisseur autorisé par type de build. À valider avec docs/STORE_PAYMENT_POLICY.md avant publication.
  ('payments.providers',           '{"web":{"provider":"stripe","free_amount":true,"auto_reload":true,"saved_cards":true},
                                     "ios":{"provider":"apple","free_amount":false,"auto_reload":false,"saved_cards":false},
                                     "android":{"provider":"google","free_amount":false,"auto_reload":false,"saved_cards":false}}'::jsonb, true, 'Matrice de paiement par plateforme'),
  ('payments.store_packs',         '{"ios":[{"product_id":"wallet_topup_10","cents":1000},{"product_id":"wallet_topup_20","cents":2000},{"product_id":"wallet_topup_50","cents":5000},{"product_id":"wallet_topup_100","cents":10000}],
                                     "android":[{"product_id":"wallet_topup_10","cents":1000},{"product_id":"wallet_topup_20","cents":2000},{"product_id":"wallet_topup_50","cents":5000},{"product_id":"wallet_topup_100","cents":10000}]}'::jsonb, true, 'Packs vendus via les stores (le prix réel vient du store)'),
  ('upload.max_file_bytes',        '2147483648'::jsonb,                     true,  '2 Gio par fichier'),
  ('upload.max_total_bytes',       '8589934592'::jsonb,                     true,  '8 Gio par projet'),
  ('upload.max_files',             '20'::jsonb,                             true,  null),
  ('upload.allowed_mime_types',    '["video/mp4","video/quicktime","video/x-m4v","video/webm","image/jpeg","image/png","image/webp","image/heic","audio/mp4","audio/m4a","audio/x-m4a","audio/mpeg","audio/wav","audio/webm"]'::jsonb, true, null),
  ('features.voice_instructions',  'true'::jsonb,                           true,  'Instructions vocales'),
  ('features.organizations',       'false'::jsonb,                          true,  'UX équipe (le schéma existe déjà)'),
  ('retention.raw_days',           'null'::jsonb,                           false, 'Durée de conservation des rushs — DÉCISION BUSINESS À VALIDER (null = illimité)'),
  ('retention.renders_days',       'null'::jsonb,                           false, 'Durée de conservation des rendus — DÉCISION BUSINESS À VALIDER'),
  ('fx.usd_eur',                   '0.92'::jsonb,                           false, 'Taux USD→EUR pour convertir les coûts moteur (à actualiser)')
on conflict (key) do nothing;

-- Tarifs V1 (centimes). Les durées « min–max » sont exclusives en bas, inclusives en haut.
insert into public.pricing_rules (mode, bucket_key, label, duration_min_sec, duration_max_sec, price_cents, sort_order) values
  ('edit_rushes', 'lt_30s',  'Moins de 30 s', 0,   30,  242, 1),
  ('edit_rushes', '30_60s',  '30–60 s',       30,  60,  484, 2),
  ('edit_rushes', '1_2min',  '1–2 min',       60,  120, 700, 3),
  ('edit_rushes', '2_3min',  '2–3 min',       120, 180, 950, 4),
  ('autonomous',  'lt_30s',  '30 s ou moins', 0,   30,  290, 1),
  ('autonomous',  '30_60s',  '30–60 s',       30,  60,  580, 2),
  -- DÉCISION PROVISOIRE (à valider par le business) : une modification coûte 1,21 €.
  ('revision',    'default', 'Modification',  0,   180, 121, 1)
on conflict (mode, bucket_key, effective_from) do nothing;

insert into public.editing_methods (slug, name, description, version, recommended, advanced, sort_order, capabilities, configuration, engine_config) values
  ('automatique', 'Automatique', 'L''IA choisit le montage le plus adapté.', 1, true, false, 1,
    '{"modes":["edit_rushes"]}', '{"badge":"Recommandé"}', '{"preset_id":"preset_dynamic_social"}'),
  ('mode-reference', 'Mode Référence', 'Reproduit la grammaire de montage de vos références.', 1, false, false, 2,
    '{"modes":["edit_rushes"],"requires_references":true}', '{}', '{"preset_id":"preset_dynamic_social","use_references":true}'),
  ('personnalise', 'Personnalisé', 'Expliquez exactement ce que vous voulez.', 1, false, false, 3,
    '{"modes":["edit_rushes"],"requires_instructions":true}', '{}', '{"preset_id":"preset_dynamic_social"}'),
  ('sobre-premium', 'Sobre et premium', 'Un montage posé, élégant, sans effet superflu.', 1, false, true, 10,
    '{"modes":["edit_rushes"]}', '{}', '{"preset_id":"preset_premium_clean"}'),
  ('tres-dynamique', 'Très dynamique', 'Rythme rapide et coupes marquées.', 1, false, true, 11,
    '{"modes":["edit_rushes"]}', '{}', '{"preset_id":"preset_aggressive_hype"}')
on conflict (slug) do nothing;

-- Capacités RÉELLES du moteur actuel (voir docs/AUDIT.md) : la création autonome n'existe pas encore.
insert into public.engine_capabilities (engine_version, capabilities, active) values
  ('video-editor-1.0', '{
    "autonomous_creation": false,
    "aspect_ratios": ["9:16"],
    "max_duration_sec": 180,
    "reference_mode": true,
    "revisions": {"enabled": true, "commands": ["shorter","faster","slower","more_zooms","less_zooms"]},
    "voice_instructions": true
  }'::jsonb, true)
on conflict do nothing;
