/* ═══════════════════════════════════════
   CinéProche — Configuration API
   ═══════════════════════════════════════ */

const CONFIG = {
  GOOGLE_API_KEY: 'AIzaSyAx4ILK4VPFvYxaZX-HwpUPMEOpkQLJEmE',
  TMDB_API_KEY:   '16d984ea5d9a771088779b56497e0890',
  TMDB_BASE_URL:  'https://api.themoviedb.org/3',
  TMDB_IMG_BASE:  'https://image.tmdb.org/t/p/w500',
  TMDB_IMG_LARGE: 'https://image.tmdb.org/t/p/w780',
  OMDB_API_KEY:   '416d9175',
  OMDB_BASE_URL:  'https://www.omdbapi.com/',
  LANGUAGE:       'fr-FR',
  REGION:         'FR',
  SEARCH_RADIUS:  5000, // mètres autour de l'utilisateur
};

window.CONFIG = CONFIG;
