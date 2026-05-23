CinéProche — Zip 3.4

Objectif : enrichir la fiche film sans casser le mode unique “Films proches classés”.

Modifications principales :
- La popup film affiche maintenant la meilleure note disponible avec sa source.
- La popup conserve réalisateur, genres, durée, année, titre original, affiche et synopsis.
- Le mode Catalogue applique aussi le cache IMDb FR au clic sur un film proche.
- La zone “Séances proches” affiche les cinémas proches et les horaires quand ils sont présents dans les données runtime.
- Le mode “Films proches classés” reste prioritaire et ne perd pas les données enrichies après changement de recherche, filtre ou pagination.

Fichiers modifiés :
- js/data.js
- js/data.backup.js
- js/nearby-catalogue.js
- catalogue.html
- html/catalogue.html
- css/style.css
- css/style.backup.css

Installation :
1. Dézipper cinema-updates.zip.
2. Remplacer les fichiers du projet par ceux du ZIP.
3. Lancer le backend si besoin : cd backend && npm start
4. Ouvrir le site et tester Catalogue > Films proches classés.
