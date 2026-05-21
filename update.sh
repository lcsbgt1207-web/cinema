#!/bin/bash
set -e

echo "======================================"
echo "  CinéProche — Mise à jour automatique"
echo "======================================"
UPDATE_DIR="cinema-updates"
DESKTOP_DIR="$HOME/Desktop"
PROJECT_DIR="$DESKTOP_DIR/cinema"
REPO_URL="https://github.com/Icsbgt1207-web/cinema.git"
find_latest_zip() {
  python -c "import os,glob; home=os.path.expanduser('~'); folders=[os.path.join(home,'Desktop'),os.path.join(home,'Downloads'),os.path.join(home,'Téléchargements'),os.path.join(home,'Desktop','cinema')]; files=[]; [files.extend(glob.glob(os.path.join(f,'cinema-updates*.zip'))) for f in folders]; files=[x for x in files if os.path.isfile(x)]; print(max(files,key=os.path.getmtime) if files else '')"
}
if ! command -v git >/dev/null 2>&1; then echo "Erreur : Git introuvable."; read -p "Appuyez sur Entrée pour quitter..."; exit 1; fi
if ! command -v unzip >/dev/null 2>&1; then echo "Erreur : unzip introuvable."; read -p "Appuyez sur Entrée pour quitter..."; exit 1; fi
mkdir -p "$DESKTOP_DIR"
if [ ! -d "$PROJECT_DIR/.git" ]; then echo "Première installation : clonage du dépôt..."; cd "$DESKTOP_DIR"; [ -d "$PROJECT_DIR" ] || git clone "$REPO_URL" "$PROJECT_DIR"; fi
cd "$PROJECT_DIR"
if [ -d ".git" ]; then git pull --rebase origin main || true; fi
FOUND_ZIP=$(find_latest_zip)
if [ -z "$FOUND_ZIP" ]; then echo "Aucun cinema-updates*.zip trouvé sur Bureau/Téléchargements."; read -p "Appuyez sur Entrée pour quitter..."; exit 1; fi
echo "ZIP trouvé : $FOUND_ZIP"
rm -rf "$UPDATE_DIR"
unzip -o "$FOUND_ZIP" -d "$PROJECT_DIR"
if [ ! -d "$UPDATE_DIR" ]; then echo "Erreur : le dossier $UPDATE_DIR est introuvable après extraction."; echo "Le ZIP doit contenir un dossier cinema-updates/."; read -p "Appuyez sur Entrée pour quitter..."; exit 1; fi
copy_dir(){ if [ -d "$UPDATE_DIR/$1" ]; then echo "Copie du dossier $1/"; rm -rf "$PROJECT_DIR/$1"; mkdir -p "$(dirname "$PROJECT_DIR/$1")"; cp -R "$UPDATE_DIR/$1" "$PROJECT_DIR/$1"; fi; }
copy_file(){ if [ -f "$UPDATE_DIR/$1" ]; then echo "Copie du fichier $1"; cp "$UPDATE_DIR/$1" "$PROJECT_DIR/$1"; fi; }
copy_dir html; copy_dir css; copy_dir js; copy_dir img; copy_dir backend; copy_dir api; copy_dir scrapers; copy_dir data
copy_file README.md; copy_file index.html; copy_file .env.example; copy_file update.sh
rm -rf "$PROJECT_DIR/$UPDATE_DIR"
if [ -f "$PROJECT_DIR/update.sh" ]; then cp "$PROJECT_DIR/update.sh" "$DESKTOP_DIR/update.sh"; chmod +x "$DESKTOP_DIR/update.sh"; fi
if [ -f "$PROJECT_DIR/backend/package.json" ]; then
  if ! command -v npm >/dev/null 2>&1; then echo "Erreur : npm introuvable. Installe Node.js."; read -p "Appuyez sur Entrée pour quitter..."; exit 1; fi
  cd "$PROJECT_DIR/backend"
  npm install
  echo "Scraping automatique de Letterboxd..."
  npm run scrape || echo "Scraping échoué, API lancée quand même."
  echo "Mise à jour terminée. Lancement API locale..."
  npm start
fi
