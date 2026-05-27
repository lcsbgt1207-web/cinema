/* ═══════════════════════════════════════
   CinéProche — Configuration API
   ═══════════════════════════════════════ */

const CONFIG = {
  GOOGLE_API_KEY: 'AIzaSyAx4ILK4VPFvYxaZX-HwpUPMEOpkQLJEmE',
  TMDB_API_KEY:   '16d984ea5d9a771088779b56497e0890',
  TMDB_BASE_URL:  'https://api.themoviedb.org/3',
  TMDB_IMG_BASE:  'https://image.tmdb.org/t/p/w500',
  TMDB_IMG_LARGE: 'https://image.tmdb.org/t/p/w780',
  OMDB_BASE_URL:   'https://www.omdbapi.com/',
  OMDB_API_KEY:    '', // Optionnel côté navigateur. Le synopsis passe surtout par backend/.env
  LANGUAGE:       'fr-FR',
  REGION:         'FR',
  SEARCH_RADIUS:  15000, // mètres autour de l'utilisateur (défaut 15km)

  // ZIP 4.8 : URLs backend centralisées.
  // En local on utilise le backend lancé sur localhost:3000 ; en production, Render.
  BACKEND_LOCAL_URL: 'http://localhost:3000',
  BACKEND_PROD_URL: 'https://cinepro-api-yal8.onrender.com',

  // ZIP 4.9 : paramètres Catalogue à venir.
  CATALOGUE_LOOKAHEAD_DAYS: 21,
  CATALOGUE_MAX_CINEMAS: {
    tiny: 16,
    small: 24,
    medium: 48,
    large: 80
  }
};

CONFIG.BACKEND_BASE_URL = (() => {
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return CONFIG.BACKEND_LOCAL_URL;
    }
  } catch (_) {}
  return CONFIG.BACKEND_PROD_URL;
})();
