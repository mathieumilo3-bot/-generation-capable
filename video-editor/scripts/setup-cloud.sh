#!/usr/bin/env bash
# Installation cloud en une commande, à lancer depuis TON Mac (une seule fois,
# puis à chaque fois que tu veux redéployer — le script est rejouable) :
#
#   cd video-editor && ./scripts/setup-cloud.sh
#
# Ce qu'il fait tout seul :
#   - installe flyctl si besoin et te connecte à Fly.io (navigateur) ;
#   - crée l'app et un volume de 20 Go à Paris ;
#   - crée la clé Google Drive automatiquement si gcloud est installé et connecté ;
#   - enregistre les clés en secrets Fly (jamais dans un fichier, jamais affichées) ;
#   - déploie, puis vérifie pour de vrai que R2 répond et qu'un lien iCloud est lisible.
#
# Ce que tu fais toi (2 minutes, le script ouvre les bonnes pages) :
#   - Cloudflare : créer le bucket R2 et un jeton d'API R2, coller les 4 valeurs ;
#   - Google (si pas de gcloud) : créer une clé d'API et la coller.
#
# Compatible bash 3.2 (celui de macOS).
set -euo pipefail

cd "$(dirname "$0")/.."
if [ ! -f fly.toml ] || [ ! -f Dockerfile ]; then
  echo "Lance ce script depuis le dossier video-editor du dépôt." >&2
  exit 1
fi

REGION="${FLY_REGION:-cdg}"
VOLUME_NAME="video_editor_data"
VOLUME_SIZE_GB="${VOLUME_SIZE_GB:-20}"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
open_url() {
  printf '  → %s\n' "$1"
  if command -v open >/dev/null 2>&1; then open "$1" >/dev/null 2>&1 || true; fi
}
ask() { # ask "Question" "défaut" → réponse dans $REPLY
  local q="$1" def="${2:-}"
  if [ -n "$def" ]; then printf '  %s [%s] : ' "$q" "$def"; else printf '  %s : ' "$q"; fi
  IFS= read -r REPLY || REPLY=""
  REPLY="$(printf '%s' "$REPLY" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [ -z "$REPLY" ]; then REPLY="$def"; fi
}
ask_secret() { # saisie masquée
  printf '  %s : ' "$1"
  IFS= read -rs REPLY || REPLY=""
  printf '\n'
  REPLY="$(printf '%s' "$REPLY" | tr -d '[:space:]')"
}

# ---------------------------------------------------------------------------
bold "1/6 — Fly.io"
if ! command -v fly >/dev/null 2>&1; then
  if [ -x "$HOME/.fly/bin/flyctl" ]; then
    export PATH="$HOME/.fly/bin:$PATH"
  else
    echo "  Installation de flyctl…"
    curl -fsSL https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
  fi
fi
if ! fly auth whoami >/dev/null 2>&1; then
  echo "  Connexion à Fly.io (le navigateur va s'ouvrir ; crée un compte si besoin)…"
  fly auth login
fi
ok "connecté à Fly.io ($(fly auth whoami 2>/dev/null))"

# ---------------------------------------------------------------------------
bold "2/6 — Application et volume"
# Le nom de l'app est gardé dans fly.toml ("REMPLACE-MOI" tant qu'il n'est pas choisi).
APP="$(sed -n -E 's/^app = "(.*)"/\1/p' fly.toml | head -n1)"
app_exists() { fly apps list 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }
if [ -n "$APP" ] && [ "$APP" != "REMPLACE-MOI" ] && app_exists "$APP"; then
  ok "application existante : $APP"
else
  SUGGEST="monteur-ia-$(whoami | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9' | cut -c1-12)-$((RANDOM % 9000 + 1000))"
  while true; do
    ask "Nom de l'application (lettres minuscules, chiffres, tirets — sert d'adresse web)" "$SUGGEST"
    APP="$(printf '%s' "$REPLY" | tr '[:upper:]' '[:lower:]')"
    if ! printf '%s' "$APP" | grep -Eq '^[a-z][a-z0-9-]{2,40}$'; then
      warn "nom invalide, recommence"
      continue
    fi
    if app_exists "$APP" || fly apps create "$APP" --org personal >/dev/null 2>&1; then
      ok "application prête : $APP"
      break
    fi
    warn "« $APP » est déjà pris sur Fly.io, choisis-en un autre"
  done
  sed -i.bak -E "s/^app = \".*\"/app = \"$APP\"/" fly.toml && rm -f fly.toml.bak
  ok "fly.toml mis à jour (app = \"$APP\")"
fi

if fly volumes list --app "$APP" 2>/dev/null | grep -q "$VOLUME_NAME"; then
  ok "volume $VOLUME_NAME déjà présent"
else
  fly volumes create "$VOLUME_NAME" --app "$APP" --region "$REGION" --size "$VOLUME_SIZE_GB" --yes >/dev/null
  ok "volume $VOLUME_NAME créé ($VOLUME_SIZE_GB Go, région $REGION)"
fi

EXISTING_SECRETS="$(fly secrets list --app "$APP" 2>/dev/null || true)"
has_secret() { printf '%s' "$EXISTING_SECRETS" | grep -q "^$1[[:space:]]" || printf '%s' "$EXISTING_SECRETS" | grep -q "[[:space:]]$1[[:space:]]"; }
SECRETS=""
add_secret() { SECRETS="${SECRETS}$1=$2
"; }

# ---------------------------------------------------------------------------
bold "3/6 — Cloudflare R2 (stockage des vidéos)"
SKIP_R2="non"
if has_secret R2_ACCESS_KEY_ID; then
  ask "Des clés R2 sont déjà enregistrées. Les garder ? (o/n)" "o"
  case "$REPLY" in o|O|oui|y|Y) SKIP_R2="oui" ;; esac
fi
if [ "$SKIP_R2" = "oui" ]; then
  ok "clés R2 conservées"
else
  cat <<'TXT'
  Dans le tableau de bord Cloudflare (les pages s'ouvrent) :
    a) R2 → si demandé, active R2 (10 Go gratuits, carte bancaire demandée par Cloudflare)
    b) « Create bucket » → nom : clients-medias → Create
    c) R2 → « Manage API tokens » → « Create Account API token »
         Permissions : Object Read & Write — Spécifier le bucket : clients-medias → Create
    d) Garde la page ouverte : elle affiche l'Access Key ID et le Secret Access Key UNE SEULE FOIS.
       L'Account ID est affiché sur la page d'accueil R2 (ou dans l'URL du tableau de bord).
TXT
  open_url "https://dash.cloudflare.com/?to=/:account/r2/overview"
  open_url "https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
  while true; do
    ask "Account ID Cloudflare (32 caractères, ou colle l'URL de l'endpoint S3)" ""
    ACCOUNT_ID="$(printf '%s' "$REPLY" | grep -Eo '[0-9a-f]{32}' | head -n1 || true)"
    [ -n "$ACCOUNT_ID" ] && break
    warn "je ne trouve pas d'Account ID (32 caractères hexadécimaux) dans ce que tu as collé"
  done
  ask "Nom du bucket" "clients-medias"
  BUCKET="$REPLY"
  ask "Access Key ID" ""
  R2_KEY="$REPLY"
  ask_secret "Secret Access Key (la saisie reste invisible)"
  R2_SECRET="$REPLY"
  if [ -z "$R2_KEY" ] || [ -z "$R2_SECRET" ]; then
    warn "clés R2 incomplètes — les fichiers resteront sur le disque du serveur tant qu'elles manquent (relance le script plus tard)"
  else
    add_secret R2_ACCOUNT_ID "$ACCOUNT_ID"
    add_secret R2_BUCKET "$BUCKET"
    add_secret R2_ACCESS_KEY_ID "$R2_KEY"
    add_secret R2_SECRET_ACCESS_KEY "$R2_SECRET"
    ok "clés R2 prêtes à être enregistrées"
  fi
fi

# ---------------------------------------------------------------------------
bold "4/6 — Clé Google Drive (alternative à iCloud)"
DRIVE_KEY=""
if has_secret GOOGLE_DRIVE_API_KEY; then
  ask "Une clé Google Drive est déjà enregistrée. La garder ? (o/n)" "o"
  case "$REPLY" in o|O|oui|y|Y) DRIVE_KEY="(conservée)" ;; esac
fi
if [ -z "$DRIVE_KEY" ] && command -v gcloud >/dev/null 2>&1 && [ -n "$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)" ]; then
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
  ask "gcloud est connecté — créer la clé automatiquement dans le projet Google Cloud" "${PROJECT:-}"
  PROJECT="$REPLY"
  if [ -n "$PROJECT" ] &&
    gcloud services enable drive.googleapis.com apikeys.googleapis.com --project "$PROJECT" >/dev/null 2>&1 &&
    gcloud services api-keys create --project "$PROJECT" --display-name="monteur-ia-drive" --api-target=service=drive.googleapis.com >/dev/null 2>&1; then
    KEY_NAME="$(gcloud services api-keys list --project "$PROJECT" --filter='displayName=monteur-ia-drive' --format='value(name)' 2>/dev/null | head -n1)"
    DRIVE_KEY="$(gcloud services api-keys get-key-string "$KEY_NAME" --format='value(keyString)' 2>/dev/null || true)"
  fi
  if [ -n "$DRIVE_KEY" ]; then ok "clé Drive créée automatiquement (limitée à l'API Drive)"; else warn "création automatique impossible — on passe en manuel"; fi
fi
if [ -z "$DRIVE_KEY" ]; then
  cat <<'TXT'
  Dans Google Cloud (les pages s'ouvrent ; crée un projet si on te le demande, gratuit) :
    a) Active « Google Drive API » (bouton ACTIVER)
    b) Identifiants → « Créer des identifiants » → « Clé API »
    c) « Modifier la clé » → Restrictions d'API → Google Drive API → Enregistrer
    d) Copie la clé (elle commence par AIza…)
  Appuie sur Entrée sans rien coller pour passer (iCloud fonctionne sans cette clé).
TXT
  open_url "https://console.cloud.google.com/apis/library/drive.googleapis.com"
  open_url "https://console.cloud.google.com/apis/credentials"
  ask_secret "Clé d'API Google Drive (invisible)"
  DRIVE_KEY="$REPLY"
fi
if [ -n "$DRIVE_KEY" ] && [ "$DRIVE_KEY" != "(conservée)" ]; then
  add_secret GOOGLE_DRIVE_API_KEY "$DRIVE_KEY"
  ok "clé Drive prête à être enregistrée"
elif [ "$DRIVE_KEY" = "(conservée)" ]; then
  ok "clé Drive conservée"
else
  warn "pas de clé Drive : seuls les liens iCloud seront importables (relance le script pour l'ajouter)"
fi

# ---------------------------------------------------------------------------
bold "5/6 — Secrets et déploiement"
if [ -n "$SECRETS" ]; then
  # Via l'entrée standard : les valeurs n'apparaissent ni à l'écran ni dans la liste des processus.
  printf '%s' "$SECRETS" | fly secrets import --app "$APP" --stage >/dev/null
  ok "secrets enregistrés chez Fly (chiffrés, jamais écrits dans le dépôt)"
fi
fly deploy --app "$APP" --remote-only --ha=false
ok "déployé"

# ---------------------------------------------------------------------------
bold "6/6 — Vérifications sur le serveur"
fly ssh console --app "$APP" -C "node /app/packages/ingest/dist/cli.js storage-check" || warn "R2 ne répond pas comme prévu — voir le message ci-dessus, puis relance le script"
ask "Colle un lien iCloud ou Google Drive de test (ou Entrée pour passer)" ""
if [ -n "$REPLY" ]; then
  fly ssh console --app "$APP" -C "node /app/packages/ingest/dist/cli.js check '$REPLY'" || warn "lien non lisible automatiquement — voir le message ci-dessus"
fi

bold "Terminé"
echo "  Bibliothèque client : https://$APP.fly.dev/library"
echo "  Upload classique    : https://$APP.fly.dev/"
echo "  Redéployer plus tard : ./scripts/setup-cloud.sh (les réglages existants sont conservés)"
