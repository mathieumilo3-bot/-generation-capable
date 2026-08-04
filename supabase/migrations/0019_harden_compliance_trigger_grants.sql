-- 0015 a créé enforce_seller_compliance_before_payout() (fonction déclencheur
-- pour trg_payouts_require_compliance) sans revoke explicite — contrairement
-- à toutes les autres fonctions SECURITY DEFINER de ce fichier, qui révoquent
-- systématiquement EXECUTE de public/anon avant de le regranter sélectivement.
-- Repéré par get_advisors (anon_security_definer_function_executable) lors
-- de la revue de sécurité post-déploiement.
--
-- Risque réel : faible (PostgREST n'expose pas les fonctions retournant
-- "trigger" comme endpoint /rpc/, et un appel SQL direct échouerait de toute
-- façon — NEW n'existe pas hors contexte de trigger) mais corrigé par
-- cohérence avec le reste du schéma (défense en profondeur : ne jamais
-- laisser un GRANT PUBLIC implicite sur une fonction SECURITY DEFINER).
revoke all on function public.enforce_seller_compliance_before_payout() from public;
revoke all on function public.enforce_seller_compliance_before_payout() from anon;
revoke all on function public.enforce_seller_compliance_before_payout() from authenticated;
-- Le trigger lui-même continue de fonctionner : son exécution passe par le
-- moteur de triggers de Postgres, pas par un appel EXECUTE direct d'un rôle.
