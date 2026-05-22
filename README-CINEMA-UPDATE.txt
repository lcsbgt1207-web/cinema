Mise à jour cinéma — synopsis IMDb / OMDb

Ce zip ajoute une correction durable pour /api/imdb-synopsis :
- cache local par imdbId ;
- support OMDb via OMDB_API_KEY ;
- plus de fallback silencieux TMDB quand IMDb/OMDb est indisponible ;
- message clair côté réponse API si aucune clé OMDb n'est configurée.

Utilisation :
1. Dézippe cinema-updates.zip sur ton Bureau.
2. Lance comme d'habitude : cd ~/Desktop && ./update.sh
3. Ajoute ta clé OMDb dans le fichier .env du backend :
   OMDB_API_KEY=ta_cle_omdb
4. Redémarre le backend.

La clé OMDb est gratuite sur https://www.omdbapi.com/apikey.aspx
