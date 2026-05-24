ZIP 3.8.2 — Nettoyage catalogue

Modification faite :
- Le gros JavaScript inline de catalogue.html a été déplacé dans js/catalogue-page.js.
- catalogue.html garde uniquement la structure HTML et les balises script externes.
- Le nouveau fichier est appelé avec : js/catalogue-page.js?v=3.8.2

Ce qui n'a pas été modifié :
- Les séances
- VF / VO
- Google Maps
- TMDB / OMDb / Letterboxd
- La logique de films proches classés
- Le comportement visible du catalogue

Contrôle effectué :
- Syntaxe JavaScript vérifiée avec node --check sur js/catalogue-page.js.
- L'ordre de chargement des scripts est conservé : config, data, omdb, tmdb, places, nearby-catalogue, catalogue-page, puis Google Maps.
