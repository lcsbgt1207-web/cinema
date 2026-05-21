#!/bin/bash

set -u

clear

echo "======================================"
echo "  CinéProche — Mise à jour automatique"
echo "======================================"

ZIP_PATTERN="cinema-updates*.zip"
UPDATE_DIR="cinema-updates"
DESKTOP_DIR="$HOME/Desktop"
DOWNLOADS_DIR="$HOME/Downloads"
DOWNLOADS_DIR_FR="$HOME/Téléchargements"
PROJECT_DIR="$DESKTOP_DIR/cinema"
REPO_URL="https://github.com/Icsbgt1207-web/cinema.git"

pause_exit() {
  echo ""
  read -p "Appuyez sur Entrée pour quitter..."
  exit "${1:-0}"
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
  if ! git config user.email >/dev/null 2>&1; then
    git config user.email "cineproche@example.local" || true
  fi
  if ! git config user.name >/dev/null 2>&1; then
    git config user.name "CineProche Auto Update" || true
  fi
}

commit_if_needed() {
  local message="$1"
  if [ ! -d ".git" ]; then
    return 0
  fi

  ensure_git_identity
  git add -A >/dev/null 2>&1 || true

  if git diff --cached --quiet >/dev/null 2>&1; then
    return 0
  fi

  echo "Commit automatique : $message"
  git commit -m "$message" >/dev/null 2>&1 || {
    echo "Commit impossible, mais la mise à jour continue."
    return 0
  }
}

sync_git_before_update() {
  if [ ! -d ".git" ]; then
    return 0
  fi

  echo "Vérification Git..."

  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
    commit_if_needed "Sauvegarde automatique avant mise à jour"
  fi

  echo "Récupération de la dernière version GitHub..."
  git pull --rebase origin main >/dev/null 2>&1 || {
    echo "Git pull ignoré : conflit ou authentification GitHub. La mise à jour locale continue."
  }
}

push_git_after_update() {
  if [ ! -d ".git" ]; then
    return 0
  fi

  commit_if_needed "Mise à jour CinéProche automatique"

  echo "Envoi vers GitHub..."
  git push origin main >/dev/null 2>&1 || {
    echo "Git push non effectué : connexion/authentification GitHub requise ou aucun droit d'écriture."
    echo "Tes fichiers locaux sont quand même mis à jour."
    return 0
  }

  echo "GitHub mis à jour."
}

copy_dir() {
  local name="$1"
  local src="$PROJECT_DIR/$UPDATE_DIR/$name"
  local dest="$PROJECT_DIR/$name"

  if [ -d "$src" ]; then
    echo "Copie du dossier $name/"
    mkdir -p "$dest"
    cp -R "$src"/. "$dest"/
  fi
}

copy_file() {
  local name="$1"
  local src="$PROJECT_DIR/$UPDATE_DIR/$name"
  local dest="$PROJECT_DIR/$name"

  if [ -f "$src" ]; then
    echo "Copie du fichier $name"
    cp "$src" "$dest"
  fi
}

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
  echo "Mets le ZIP sur le Bureau ou dans Téléchargements puis relance ./update.sh."
  pause_exit 1
fi

echo "ZIP trouvé : $FOUND_ZIP"

stop_node_processes

rm -rf "$PROJECT_DIR/$UPDATE_DIR"
echo "Extraction du ZIP..."
unzip -o "$FOUND_ZIP" -d "$PROJECT_DIR" || pause_exit 1

if [ ! -d "$PROJECT_DIR/$UPDATE_DIR" ]; then
  echo "Erreur : le dossier $UPDATE_DIR est introuvable après extraction."
  pause_exit 1
fi

copy_dir "html"
copy_dir "css"
copy_dir "js"
copy_dir "img"
copy_dir "backend"
copy_dir "api"
copy_dir "scrapers"
copy_dir "data"

copy_file "README.md"
copy_file "index.html"
copy_file "catalogue.html"
copy_file "nouveautes.html"
copy_file "resultats.html"
copy_file "agenda.html"
copy_file "profil.html"
copy_file "overlays.html"
copy_file "update.sh"
copy_file ".gitignore"
copy_file ".env.example"

rm -rf "$PROJECT_DIR/$UPDATE_DIR"

echo "Nettoyage du ZIP de mise à jour..."
rm -f "$FOUND_ZIP" 2>/dev/null || true

push_git_after_update

if [ -f "$PROJECT_DIR/backend/package.json" ]; then
  echo "Backend détecté."

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Node.js/npm n'est pas installé sur ce PC."
    echo "Ce n'est pas bloquant : le site et Git sont mis à jour."
    echo "Installe Node.js plus tard si tu veux lancer l'API locale Letterboxd."
    echo "======================================"
    echo "  Mise à jour terminée"
    echo "======================================"
    pause_exit 0
  fi

  cd "$PROJECT_DIR/backend" || pause_exit 1
  echo "Installation automatique des dépendances backend..."
  npm install || echo "npm install échoué, la mise à jour locale reste valide."

  echo "Scraping automatique de Letterboxd..."
  npm run scrape || echo "Scraping échoué, lancement de l'API avec les anciennes données si disponibles."

  echo "======================================"
  echo "  Mise à jour terminée"
  echo "======================================"
  echo "Lancement API locale..."
  echo "Garde cette fenêtre Git Bash ouverte."
  npm start || pause_exit 0
else
  echo "======================================"
  echo "  Mise à jour terminée"
  echo "======================================"
  pause_exit 0
fi
