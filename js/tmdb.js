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
<<<<<<< HEAD
=======
    const year = film?.release_date ? String(film.release_date).slice(0, 4) : String(film?.year || '').trim();

>>>>>>> c63a9c3342a63001a67db95bc183c0fcafd23711
    const tmdbFallback = String(film?.overview || '').trim();
    const isBadSynopsis = (value = '') => /javascript est désactivé|javascript est desactive|enable javascript|robot|captcha|verify you are human|access denied|request blocked/i.test(String(value).toLowerCase());

    if (!imdbId && !title) return tmdbFallback;

    const cacheIdentity = imdbId || (tmdbId ? `tmdb-${tmdbId}` : `${title.toLowerCase()}-${year}`);
    const cacheKey = `cinepro_synopsis_v90_cache_omdb_then_tmdb_${cacheIdentity}`;

<<<<<<< HEAD
    // 1. Cache localStorage
    const cacheKey = `cinepro_omdb_v2_${imdbId || tmdbId}`;
=======
>>>>>>> c63a9c3342a63001a67db95bc183c0fcafd23711
    try {
      if (!localStorage.getItem('cinepro_synopsis_cache_cleaned_v90')) {
        Object.keys(localStorage)
          .filter(key => key.startsWith('cinepro_imdb_synopsis_') || key.startsWith('cinepro_synopsis_'))
          .forEach(key => localStorage.removeItem(key));
        localStorage.setItem('cinepro_synopsis_cache_cleaned_v90', '1');
      }
      const cached = localStorage.getItem(cacheKey);
      if (cached && !isBadSynopsis(cached)) return cached;
      if (cached && isBadSynopsis(cached)) localStorage.removeItem(cacheKey);
    } catch {}

<<<<<<< HEAD
    // 2. Si pas d'imdbId, le récupérer via TMDB
    let resolvedImdbId = imdbId;
    if (!resolvedImdbId && tmdbId) {
      try {
        const extRes = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${tmdbId}?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=external_ids`);
        const extData = await extRes.json();
        resolvedImdbId = String(extData?.external_ids?.imdb_id || '').trim();
      } catch {}
    }

    // 3. Appel OMDb direct (fonctionne depuis le navigateur, pas besoin de serveur local)
    if (resolvedImdbId && /^tt\d+$/.test(resolvedImdbId)) {
      try {
        const url = `https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${resolvedImdbId}&plot=short&r=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const plot = String(data?.Plot || '').trim();
          if (plot && !isBad(plot)) {
            // Traduction Google Translate gratuite
            let synopsis = plot;
            try {
              const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'fr', dt: 't', q: plot });
              const tRes = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
              if (tRes.ok) {
                const tData = await tRes.json();
                const translated = Array.isArray(tData?.[0]) ? tData[0].map(p => p?.[0] || '').join('').trim() : '';
                if (translated && translated.length > 20) synopsis = translated;
              }
            } catch {}
            try { localStorage.setItem(cacheKey, synopsis); } catch {}
            return synopsis;
          }
        }
      } catch {}
    }

    // 4. Fallback TMDB (synopsis en français déjà dispo)
    if (tmdbFallback && !isBad(tmdbFallback)) {
      try { localStorage.setItem(cacheKey, tmdbFallback); } catch {}
      return tmdbFallback;
=======
    try {
      const params = new URLSearchParams();
      if (imdbId) params.set('imdbId', imdbId);
      if (tmdbId) params.set('tmdbId', tmdbId);
      if (title) params.set('title', title);
      if (originalTitle) params.set('originalTitle', originalTitle);
      if (year) params.set('year', year);

      params.set('mode', 'live-imdb-official-then-tmdb');
      params.set('live', '1');
      // Au clic, le backend tente maintenant IMDb officiel d'abord, puis TMDB seulement si IMDb bloque.
      params.set('_', String(Date.now()));
      const res = await fetch(`http://localhost:3000/api/imdb-synopsis?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return '';

      const data = await res.json();
      const synopsis = String(data?.synopsis || '').trim();
      const finalSynopsis = synopsis && !isBadSynopsis(synopsis) ? synopsis : tmdbFallback;
      if (!finalSynopsis || isBadSynopsis(finalSynopsis)) return '';

      try { localStorage.setItem(cacheKey, finalSynopsis); } catch {}
      return finalSynopsis;
    } catch (error) {
      console.warn('Synopsis IMDb indisponible, fallback TMDB utilisé.', error);
      return tmdbFallback && !isBadSynopsis(tmdbFallback) ? tmdbFallback : '';
>>>>>>> c63a9c3342a63001a67db95bc183c0fcafd23711
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
