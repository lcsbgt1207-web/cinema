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
    const url = `${CONFIG.TMDB_BASE_URL}/movie/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}&append_to_response=credits,release_dates,external_ids`;
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


  // Synopsis IMDb via le backend local CinéProche.
  // Important : aucune correspondance forcée en dur.
  // Chaque film est identifié par son imdb_id TMDB, puis par son titre + année en secours.
  async getImdbSynopsis(film) {
    const imdbId = String(film?.external_ids?.imdb_id || film?.imdb_id || film?.imdbID || '').trim();
    const title = String(film?.title || film?.name || film?.original_title || '').trim();
    const originalTitle = String(film?.original_title || '').trim();
    const tmdbId = String(film?.id || film?.tmdbID || '').trim();
    const year = film?.release_date ? String(film.release_date).slice(0, 4) : String(film?.year || '').trim();

    if (!imdbId && !title) return '';

    const cacheIdentity = imdbId || (tmdbId ? `tmdb-${tmdbId}` : `${title.toLowerCase()}-${year}`);
    const cacheKey = `cinepro_imdb_synopsis_v16_imdb_main_fr_${cacheIdentity}`;

    try {
      if (!localStorage.getItem('cinepro_imdb_synopsis_fr_cache_cleaned_v2')) {
        Object.keys(localStorage)
          .filter(key => key.startsWith('cinepro_imdb_synopsis_v14_') || key.startsWith('cinepro_imdb_synopsis_v15_') || key.startsWith('cinepro_imdb_synopsis_v16_'))
          .forEach(key => localStorage.removeItem(key));
        localStorage.setItem('cinepro_imdb_synopsis_fr_cache_cleaned_v2', '1');
      }
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch {}

    try {
      const params = new URLSearchParams();
      if (imdbId) params.set('imdbId', imdbId);
      if (tmdbId) params.set('tmdbId', tmdbId);
      if (title) params.set('title', title);
      if (originalTitle) params.set('originalTitle', originalTitle);
      if (year) params.set('year', year);

      const res = await fetch(`http://localhost:3000/api/imdb-synopsis?${params.toString()}`);
      if (!res.ok) return '';

      const data = await res.json();
      const synopsis = String(data?.synopsis || '').trim();
      if (!synopsis) return '';

      try { localStorage.setItem(cacheKey, synopsis); } catch {}
      return synopsis;
    } catch (error) {
      console.warn('Synopsis IMDb indisponible, fallback local utilisé.', error);
      return '';
    }
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
