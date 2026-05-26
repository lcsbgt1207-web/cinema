#!/bin/bash

set -u
clear

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
SCRIPT_NAME="$(basename "$0")"

ZIP_PATTERN="cinema-updates*.zip"
UPDATE_DIR="cinema-updates"
EXTRACT_DIR=".cinepro-update-extract"
DESKTOP_DIR="$HOME/Desktop"
DOWNLOADS_DIR="$HOME/Downloads"
DOWNLOADS_DIR_FR="$HOME/Téléchargements"
PROJECT_DIR="$DESKTOP_DIR/cinema"
REPO_URL="https://github.com/lcsbgt1207-web/cinema.git"

COMMIT_MESSAGE=""
UPDATE_SOURCE_DIR=""
FOUND_ZIP=""

OBSOLETE_PATHS=(
  "backend/scripts/cleanup-project.js"
  "js/catalogue-debug.js"
  "scripts/apply-cinema-update.js"
  "README-CINEMA-UPDATE.txt"
  "overlays.html"
  "js/overlays.html"
  "backend/cache"
  "backend/data/letterboxd-ratings-verified.json"
)

cleanup_temp() {
  rm -rf "$PROJECT_DIR/$UPDATE_DIR" "$PROJECT_DIR/$EXTRACT_DIR" 2>/dev/null || true
}
trap cleanup_temp EXIT

pause_exit() {
  echo ""
  read -r -p "Appuyez sur Entrée pour quitter..." _
  exit "${1:-0}"
}

say_header() {
  echo "======================================"
  echo "  CinéProche — Mise à jour automatique"
  echo "======================================"
}

find_latest_zip() {
  local latest=""
  for dir in "$DESKTOP_DIR" "$DOWNLOADS_DIR" "$DOWNLOADS_DIR_FR" "$PROJECT_DIR"; do
    if [ -d "$dir" ]; then
      local candidate
      candidate=$(find "$dir" -maxdepth 1 -type f -name "$ZIP_PATTERN" -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)
      if [ -n "$candidate" ]; then
        if [ -z "$latest" ]; then
          latest="$candidate"
        else
          local current_time candidate_time
          current_time=$(stat -c %Y "$latest" 2>/dev/null || echo 0)
          candidate_time=$(stat -c %Y "$candidate" 2>/dev/null || echo 0)
          if [ "$candidate_time" -gt "$current_time" ]; then
            latest="$candidate"
          fi
        fi
      fi
    fi
  done
  echo "$latest"
}

stop_node_processes() {
  if command -v taskkill >/dev/null 2>&1; then
    taskkill //F //IM node.exe >/dev/null 2>&1 || true
  fi
}

ensure_git_identity() {
  git config user.email >/dev/null 2>&1 || git config user.email "cineproche@example.local" || true
  git config user.name >/dev/null 2>&1 || git config user.name "CineProche Auto Update" || true
}

ask_commit_message() {
  echo ""
  echo "Nom du commit GitHub pour cette mise à jour :"
  echo "Exemple : [CinéProche] Stabilisation - mise à jour propre"
  read -r -p "> " COMMIT_MESSAGE

  if [ -z "${COMMIT_MESSAGE// }" ]; then
    COMMIT_MESSAGE="Mise à jour CinéProche automatique"
  fi
}

confirm_zip() {
  local zip_name
  zip_name="$(basename "$FOUND_ZIP")"

  echo ""
  echo "ZIP trouvé : $FOUND_ZIP"
  if command -v stat >/dev/null 2>&1; then
    echo "Date du ZIP : $(stat -c '%y' "$FOUND_ZIP" 2>/dev/null || echo 'inconnue')"
  fi

  if [ "$zip_name" != "cinema-updates.zip" ]; then
    echo ""
    echo "Attention : le ZIP ne s'appelle pas exactement cinema-updates.zip"
    echo "Nom actuel : $zip_name"
  fi

  echo ""
  read -r -p "Continuer avec ce ZIP ? [o/N] " answer
  case "${answer:-}" in
    o|O|oui|OUI|y|Y|yes|YES) ;;
    *)
      echo "Mise à jour annulée."
      pause_exit 1
      ;;
  esac
}

commit_if_needed() {
  local message="$1"
  [ -d ".git" ] || return 0

  ensure_git_identity
  git add -A >/dev/null 2>&1 || true

  if git diff --cached --quiet >/dev/null 2>&1; then
    return 0
  fi

  echo "Commit automatique : $message"
  git commit -m "$message" >/dev/null 2>&1 || {
    echo "Commit impossible, la mise à jour continue quand même."
    return 0
  }
}

sync_git_before_update() {
  [ -d ".git" ] || return 0

  echo "Synchronisation GitHub avant mise à jour..."
  commit_if_needed "Sauvegarde automatique avant mise à jour"

  git pull --rebase origin main >/dev/null 2>&1 || {
    echo "Git pull ignoré : conflit ou authentification GitHub. La mise à jour locale continue."
  }
}

push_git_after_everything() {
  [ -d ".git" ] || return 0

  echo "État Git avant commit :"
  git status --short || true

  commit_if_needed "$COMMIT_MESSAGE"

  echo "Synchronisation finale avec GitHub..."
  git pull --rebase origin main >/dev/null 2>&1 || {
    echo "Git pull final ignoré : conflit ou authentification GitHub."
  }

  git push origin main >/dev/null 2>&1 || {
    echo "Git push non effectué : connexion/authentification GitHub requise ou aucun droit d'écriture."
    echo "Les fichiers locaux sont quand même mis à jour."
    return 0
  }

  echo "GitHub mis à jour."
  echo "Dernier commit :"
  git log --oneline -1 || true
}

resolve_update_source_dir() {
  if [ -d "$PROJECT_DIR/$EXTRACT_DIR/$UPDATE_DIR" ]; then
    UPDATE_SOURCE_DIR="$PROJECT_DIR/$EXTRACT_DIR/$UPDATE_DIR"
    echo "Structure ZIP détectée : dossier $UPDATE_DIR/"
    return 0
  fi

  local first_level_dirs=()
  while IFS= read -r dir; do
    first_level_dirs+=("$dir")
  done < <(find "$PROJECT_DIR/$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

  if [ "${#first_level_dirs[@]}" -eq 1 ]; then
    UPDATE_SOURCE_DIR="${first_level_dirs[0]}"
    echo "Structure ZIP détectée : dossier racine $(basename "$UPDATE_SOURCE_DIR")/"
    return 0
  fi

  UPDATE_SOURCE_DIR="$PROJECT_DIR/$EXTRACT_DIR"
  echo "Structure ZIP détectée : contenu directement à la racine du ZIP."
  return 0
}

remove_obsolete_from_dir() {
  local base_dir="$1"
  local rel

  for rel in "${OBSOLETE_PATHS[@]}"; do
    rm -rf "$base_dir/$rel" 2>/dev/null || true
  done
}

copy_dir() {
  local name="$1"
  local src="$UPDATE_SOURCE_DIR/$name"
  local dest="$PROJECT_DIR/$name"

  if [ -d "$src" ]; then
    echo "Copie du dossier $name/"
    mkdir -p "$dest"
    cp -R "$src"/. "$dest"/
  fi
}

copy_file() {
  local name="$1"
  local src="$UPDATE_SOURCE_DIR/$name"
  local dest="$PROJECT_DIR/$name"

  if [ ! -f "$src" ]; then
    return 0
  fi

  if [ "$name" = "$SCRIPT_NAME" ]; then
    echo "Copie du fichier $name ignorée pendant l'exécution pour éviter l'auto-remplacement."
    return 0
  fi

  echo "Copie du fichier $name"
  cp "$src" "$dest"
}

cleanup_obsolete_project_files() {
  echo "Nettoyage des fichiers parasites du projet..."

  rm -rf "$PROJECT_DIR/cinema-main"
  rm -rf "$PROJECT_DIR/html"
  rm -f "$PROJECT_DIR/cinema-update.zip"
  rm -f "$PROJECT_DIR/cinema-updates.zip"
  rm -f "$PROJECT_DIR/[Cin#U00e9Proche]"

  remove_obsolete_from_dir "$PROJECT_DIR"

  find "$PROJECT_DIR" \
    -path "$PROJECT_DIR/.git" -prune -o \
    -path "$PROJECT_DIR/backend/node_modules" -prune -o \
    -path "$PROJECT_DIR/node_modules" -prune -o \
    \( -name "*.backup.*" -o -name "*.bak" -o -name "cinema-update*.zip" -o -name "cinema-updates*.zip" \) \
    -type f -print -delete 2>/dev/null || true
}

cleanup_project_structure() {
  echo "Nettoyage de la structure du projet..."

  rm -rf "$PROJECT_DIR/cinema-main"
  find "$PROJECT_DIR" -maxdepth 1 -type f \( -name 'cinema-update*.zip' -o -name 'cinema-updates*.zip' \) -delete 2>/dev/null || true
  find "$PROJECT_DIR" -type f \( -name '*.backup.js' -o -name '*.backup.css' -o -name '*.backup.*' -o -name '*.bak' \) -delete 2>/dev/null || true
  rm -f "$PROJECT_DIR/html/catalogue.html"
  rm -f "$PROJECT_DIR/[Cin#U00e9Proche]"

  remove_obsolete_from_dir "$PROJECT_DIR"
}

install_backend_if_present() {
  if [ ! -f "$PROJECT_DIR/backend/package.json" ]; then
    return 0
  fi

  echo "Backend détecté."

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Node.js/npm non détecté : étape backend ignorée."
    return 0
  fi

  cd "$PROJECT_DIR/backend" || pause_exit 1
  echo "Installation automatique des dépendances backend..."
  npm install || echo "npm install échoué, la mise à jour locale reste valide."

  echo "Scraping Letterboxd ignoré."
  echo "Pour mettre à jour les notes Letterboxd manuellement :"
  echo "cd ~/Desktop/cinema/backend && npm run scrape"
  cd "$PROJECT_DIR" || pause_exit 1
}

start_backend_if_possible() {
  if [ ! -f "$PROJECT_DIR/backend/package.json" ]; then
    pause_exit 0
  fi

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    pause_exit 0
  fi

  cd "$PROJECT_DIR/backend" || pause_exit 0
  echo "Lancement API locale..."
  echo "Garde cette fenêtre Git Bash ouverte."
  npm start || pause_exit 0
}

say_header

if ! command -v git >/dev/null 2>&1; then
  echo "Erreur : Git n'est pas installé ou pas détecté."
  pause_exit 1
fi

if ! command -v unzip >/dev/null 2>&1; then
  echo "Erreur : unzip n'est pas disponible dans Git Bash."
  pause_exit 1
fi

mkdir -p "$DESKTOP_DIR"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Première installation : clonage du dépôt..."
  git clone "$REPO_URL" "$PROJECT_DIR" || pause_exit 1
fi

cd "$PROJECT_DIR" || pause_exit 1

sync_git_before_update

FOUND_ZIP=$(find_latest_zip)
if [ -z "$FOUND_ZIP" ]; then
  echo "Aucun cinema-updates*.zip trouvé."
  echo "Télécharge le ZIP, laisse-le dans Téléchargements, puis relance ./update.sh."
  pause_exit 1
fi

confirm_zip
ask_commit_message
stop_node_processes

cleanup_temp
mkdir -p "$PROJECT_DIR/$EXTRACT_DIR"

echo "Extraction du ZIP..."
unzip -o "$FOUND_ZIP" -d "$PROJECT_DIR/$EXTRACT_DIR" >/dev/null || pause_exit 1

resolve_update_source_dir
remove_obsolete_from_dir "$UPDATE_SOURCE_DIR"
cleanup_obsolete_project_files

copy_dir "html"
copy_dir "css"
copy_dir "js"
copy_dir "img"
copy_dir "backend"
copy_dir "api"
copy_dir "scrapers"
copy_dir "data"

copy_file ".gitignore"
copy_file ".nojekyll"
copy_file "README.md"
copy_file "index.html"
copy_file "catalogue.html"
copy_file "nouveautes.html"
copy_file "resultats.html"
copy_file "agenda.html"
copy_file "portfolio.html"
copy_file "profil.html"
copy_file ".env.example"
copy_file "$SCRIPT_NAME"

cleanup_project_structure

echo "Fichiers modifiés après copie :"
git status --short || true

echo "Nettoyage du ZIP de mise à jour..."
rm -f "$FOUND_ZIP" 2>/dev/null || true

install_backend_if_present
push_git_after_everything

echo "======================================"
echo "  Mise à jour terminée"
echo "======================================"

start_backend_if_possible
