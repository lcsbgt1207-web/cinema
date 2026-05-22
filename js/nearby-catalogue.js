/* CinéProche — Catalogue proche — ZIP 2.5
   Objectif unique :
   - corriger l'assemblage des films récupérés par /seances
   - accepter plusieurs formats d'objets film
   - éviter l'erreur "Cannot read properties of undefined (reading 'title')"
   - garder le test console getNearbyRankedMovies(...)
*/

(function () {
  'use strict';

  const NEARBY_CATALOGUE_API = 'https://cinepro-api-yal8.onrender.com';

  function normalizeNearbyTitle(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getGlobalFilms() {
    if (Array.isArray(window.FILMS)) return window.FILMS;
    try {
      if (Array.isArray(FILMS)) return FILMS;
    } catch (_) {}
    return [];
  }

  function findLocalFilmByTitle(title) {
    const key = normalizeNearbyTitle(title);
    if (!key) return null;

    return getGlobalFilms().find(f => {
      return normalizeNearbyTitle(f?.titre) === key ||
             normalizeNearbyTitle(f?.title) === key ||
             normalizeNearbyTitle(f?.name) === key ||
             normalizeNearbyTitle(f?.original) === key ||
             normalizeNearbyTitle(f?.originalTitle) === key ||
             normalizeNearbyTitle(f?.original_title) === key;
    }) || null;
  }

  function getBestNearbyRating(localFilm, rawMovie) {
    const sources = [
      { source: 'IMDb', value: Number(localFilm?.imdb ?? rawMovie?.imdb ?? rawMovie?.imdbRating) },
      { source: 'Letterboxd', value: Number(localFilm?.lb ?? localFilm?.letterboxd ?? rawMovie?.lb ?? rawMovie?.letterboxd) * 2 },
      { source: 'TMDB', value: Number(localFilm?.tmdb ?? localFilm?.vote_average ?? rawMovie?.tmdb ?? rawMovie?.vote_average) },
      { source: 'Allociné', value: Number(rawMovie?.rating ?? rawMovie?.note ?? rawMovie?.score) }
    ];

    for (const item of sources) {
      if (Number.isFinite(item.value) && item.value > 0) return item;
    }
    return null;
  }

  function firstString(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  function getDeep(obj, path) {
    try {
      return path.split('.').reduce((acc, key) => acc?.[key], obj);
    } catch (_) {
      return undefined;
    }
  }

  function extractMovieObject(item) {
    if (!item || typeof item !== 'object') return null;

    const candidates = [
      item.movie,
      item.film,
      item.filmShow,
      item.show,
      item.entity,
      item.work,
      item.movieShow,
      item.data?.movie,
      item.data?.film,
      item.production,
      item
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object') {
        const title = extractMovieTitle(candidate);
        if (title) return candidate;
      }
    }

    return item;
  }

  function extractMovieTitle(item) {
    if (!item || typeof item !== 'object') return '';

    return firstString(
      item.title,
      item.titre,
      item.name,
      item.nom,
      item.label,
      item.originalTitle,
      item.original_title,
      item.movieTitle,
      item.filmTitle,
      item.fullTitle,
      item.displayTitle,
      getDeep(item, 'movie.title'),
      getDeep(item, 'movie.name'),
      getDeep(item, 'movie.titre'),
      getDeep(item, 'film.title'),
      getDeep(item, 'film.name'),
      getDeep(item, 'film.titre'),
      getDeep(item, 'show.title'),
      getDeep(item, 'show.name'),
      getDeep(item, 'entity.title'),
      getDeep(item, 'entity.name'),
      getDeep(item, 'data.title'),
      getDeep(item, 'data.name')
    );
  }

  function extractPoster(item, rawItem) {
    return firstString(
      item?.poster,
      item?.posterUrl,
      item?.poster_path,
      item?.image,
      item?.imageUrl,
      item?.cover,
      item?.thumbnail,
      rawItem?.poster,
      rawItem?.image,
      rawItem?.movie?.poster,
      rawItem?.film?.poster
    );
  }

  function extractShowtimes(item) {
    if (!item || typeof item !== 'object') return [];

    const possibleArrays = [
      item.horaires,
      item.times,
      item.showtimes,
      item.seances,
      item.sessions,
      item.scr,
      item.version?.times
    ];

    for (const arr of possibleArrays) {
      if (Array.isArray(arr)) return arr;
    }

    if (typeof item.time === 'string') return [item.time];
    if (typeof item.horaire === 'string') return [item.horaire];

    return [];
  }

  function normalizeShowtimeItem(rawItem) {
    const movieObject = extractMovieObject(rawItem);
    const title = extractMovieTitle(movieObject) || extractMovieTitle(rawItem);

    if (!title) {
      return null;
    }

    return {
      title,
      normalizedKey: normalizeNearbyTitle(title),
      rawMovie: movieObject || rawItem,
      rawItem,
      poster: extractPoster(movieObject, rawItem),
      horaires: extractShowtimes(rawItem)
    };
  }

  async function fetchJsonWithDebug(url, label) {
    console.log(`[Catalogue proche][DEBUG] Appel ${label} :`, url);

    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    let json = null;
    let text = '';

    if (contentType.includes('application/json')) {
      json = await response.json();
    } else {
      text = await response.text();
    }

    console.log(`[Catalogue proche][DEBUG] Réponse ${label} :`, {
      status: response.status,
      ok: response.ok,
      contentType,
      json,
      textPreview: text ? text.slice(0, 300) : ''
    });

    if (!response.ok) throw new Error(`${label} ${response.status}`);
    return json;
  }

  async function getCinemaAllocineId(cinema) {
    const params = new URLSearchParams({
      name: cinema?.nom || '',
      lat: cinema?.location?.lat || '',
      lng: cinema?.location?.lng || ''
    });

    const data = await fetchJsonWithDebug(`${NEARBY_CATALOGUE_API}/search-cinema?${params}`, `search-cinema pour ${cinema?.nom}`);
    const id = data?.id || data?.cinema_id || data?.cinemaId || data?.allocineId || data?.theater?.id || null;

    if (id) {
      console.log(`[Catalogue proche][DEBUG] ID extrait pour ${cinema?.nom} :`, id);
    } else {
      console.warn(`[Catalogue proche][DEBUG] Aucun ID cinéma trouvé pour ${cinema?.nom}.`);
    }

    return id;
  }

  function extractSeancesArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.seances)) return data.seances;
    if (Array.isArray(data?.sessions)) return data.sessions;
    if (Array.isArray(data?.showtimes)) return data.showtimes;
    if (Array.isArray(data?.movies)) return data.movies;
    if (Array.isArray(data?.films)) return data.films;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  async function getCinemaShowtimes(cinema) {
    const allocineId = await getCinemaAllocineId(cinema);
    if (!allocineId) return [];

    const today = new Date().toISOString().split('T')[0];
    const data = await fetchJsonWithDebug(`${NEARBY_CATALOGUE_API}/seances?id=${encodeURIComponent(allocineId)}&date=${today}`, `seances pour ${cinema?.nom}`);

    const rawShowtimes = extractSeancesArray(data);
    console.log(`[Catalogue proche][DEBUG] Tableau extrait pour ${cinema?.nom} :`, rawShowtimes);

    if (rawShowtimes[0]) {
      console.log(`[Catalogue proche][DEBUG] Premier objet brut pour ${cinema?.nom} :`, rawShowtimes[0]);
      console.log(`[Catalogue proche][DEBUG] Clés premier objet pour ${cinema?.nom} :`, Object.keys(rawShowtimes[0] || {}));
    }

    const normalized = rawShowtimes
      .map(normalizeShowtimeItem)
      .filter(Boolean);

    if (rawShowtimes.length && !normalized.length) {
      console.warn(`[Catalogue proche][DEBUG] ${rawShowtimes.length} objet(s) reçu(s), mais aucun titre lisible pour ${cinema?.nom}.`);
    }

    return normalized;
  }

  async function getNearbyRankedMovies(options = {}) {
    if (!window.PLACES) {
      throw new Error('PLACES n’est pas chargé. Vérifie js/places.js.');
    }

    const radius = options.radius || window.CONFIG?.SEARCH_RADIUS || 15000;
    let location = options.location || null;

    if (!location && options.address) {
      const geocoded = await window.PLACES.geocodeAddress(options.address);
      location = geocoded.location;
    }

    if (!location) {
      location = await window.PLACES.geolocate();
    }

    console.log('[Catalogue proche] ZIP 2.5 actif.');
    console.log('[Catalogue proche] Position utilisée :', location);

    const cinemas = await window.PLACES.findNearbycinemas(location, radius);
    console.log(`[Catalogue proche] ${cinemas.length} cinéma(s) trouvé(s).`, cinemas);

    const maxCinemas = Number.isFinite(Number(options.maxCinemas)) ? Number(options.maxCinemas) : 8;
    console.log(`[Catalogue proche] Test debug sur ${Math.min(cinemas.length, maxCinemas)} cinéma(s).`);

    const moviesByKey = new Map();

    for (const cinema of cinemas.slice(0, maxCinemas)) {
      try {
        console.log(`[Catalogue proche] Recherche films pour ${cinema.nom}...`);
        const showtimes = await getCinemaShowtimes(cinema);

        console.log(`[Catalogue proche] ${cinema.nom} : ${showtimes.length} film(s) trouvé(s).`, showtimes);

        for (const item of showtimes) {
          const title = item.title;
          const key = item.normalizedKey || normalizeNearbyTitle(title);
          if (!key) continue;

          const localFilm = findLocalFilmByTitle(title);
          const rating = getBestNearbyRating(localFilm, item.rawMovie);

          if (!moviesByKey.has(key)) {
            moviesByKey.set(key, {
              title,
              localFilm,
              poster: localFilm?.poster || item.poster || '',
              ratingValue: rating?.value ?? null,
              ratingSource: rating?.source ?? null,
              cinemas: [],
              rawShowtimes: []
            });
          }

          const movie = moviesByKey.get(key);

          if (!movie.cinemas.some(c => c.nom === cinema.nom)) {
            movie.cinemas.push({
              nom: cinema.nom,
              adresse: cinema.adresse,
              distanceKm: cinema.dist,
              horaires: item.horaires || []
            });
          }

          movie.rawShowtimes.push(item.rawItem || item);
        }
      } catch (error) {
        console.warn(`[Catalogue proche][DEBUG] Impossible de charger les films pour ${cinema.nom} :`, error?.message || error);
      }
    }

    const ranked = Array.from(moviesByKey.values()).sort((a, b) => {
      if (a.ratingValue === null && b.ratingValue === null) {
        return a.title.localeCompare(b.title, 'fr');
      }
      if (a.ratingValue === null) return 1;
      if (b.ratingValue === null) return -1;
      return b.ratingValue - a.ratingValue;
    });

    console.log(`[Catalogue proche] Résultat étape 2.5 : ${ranked.length} film(s) proche(s) assemblé(s).`);

    console.table(ranked.map((movie, index) => ({
      rang: index + 1,
      film: movie.title,
      note: movie.ratingValue ?? '—',
      source: movie.ratingSource ?? '—',
      cinemas: movie.cinemas.map(c => c.nom).join(', ')
    })));

    return ranked;
  }

  function initNearbyCatalogueGoogleMaps() {
    try {
      window.PLACES?.init();
      console.log('[Catalogue proche] Google Maps/Places prêt. Test possible avec :');
      console.log("getNearbyRankedMovies({ address: 'Cergy', radius: 15000 })");
    } catch (error) {
      console.warn('[Catalogue proche] Initialisation impossible :', error?.message || error);
    }
  }

  window.getNearbyRankedMovies = getNearbyRankedMovies;
  window.initNearbyCatalogueGoogleMaps = initNearbyCatalogueGoogleMaps;
})();
