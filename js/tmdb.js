/* ═══════════════════════════════════════
   CinéProche — Service TMDB
   Récupère films, affiches, synopsis
   ═══════════════════════════════════════ */

const TMDB = {

  // Films actuellement en salle en France
  async getNowPlaying(page = 1) {
    const url = `${CONFIG.TMDB_BASE_URL}/movie/now_playing?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&region=${CONFIG.REGION}&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  },

  // Films à venir en France
  async getUpcoming(page = 1) {
    const url = `${CONFIG.TMDB_BASE_URL}/movie/upcoming?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&region=${CONFIG.REGION}&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  },

  // Détails d'un film
  async getMovie(id) {
    const url = `${CONFIG.TMDB_BASE_URL}/movie/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&append_to_response=credits,release_dates`;
    const res = await fetch(url);
    return await res.json();
  },

  // Recherche par titre
  async searchMovie(query) {
    const url = `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&region=${CONFIG.REGION}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  },

  // Films populaires
  async getPopular(page = 1) {
    const url = `${CONFIG.TMDB_BASE_URL}/movie/popular?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&region=${CONFIG.REGION}&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  },

  // Top rated
  async getTopRated(page = 1) {
    const url = `${CONFIG.TMDB_BASE_URL}/movie/top_rated?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&region=${CONFIG.REGION}&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  },

  // URL de l'affiche
  posterUrl(path, size = 'w500') {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  },

  // Genres
  genreMap: {
    28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie',
    80: 'Crime', 99: 'Documentaire', 18: 'Drame', 10751: 'Famille',
    14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique',
    9648: 'Mystère', 10749: 'Romance', 878: 'Science-fiction',
    10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western'
  },

  getGenres(ids) {
    if (!ids || !ids.length) return 'Cinéma';
    return ids.slice(0, 2).map(id => this.genreMap[id] || '').filter(Boolean).join(', ');
  },

  // Formater la durée
  formatDuration(minutes) {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2,'0') : ''}` : `${m}min`;
  },

  // Note sur 5 (format Letterboxd)
  tmdbToLb(vote) {
    return (vote / 2).toFixed(1);
  }
};
