/* CinéProche — Catalogue proche — ZIP 2.6
   Objectif unique :
   - associer les films proches récupérés via les séances avec les notes du catalogue local FILMS
   - afficher le taux de correspondance
   - lister les films non reconnus
   - ne pas encore modifier l'affichage HTML du Catalogue
*/

(function () {
  'use strict';

  const NEARBY_CATALOGUE_API = 'https://cinepro-api-yal8.onrender.com';

  function stripAccents(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeNearbyTitle(value) {
    return stripAccents(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\bpartie\b/g, 'part')
      .replace(/\bepisode\b/g, '')
      .replace(/\bfilm\b/g, '')
      .replace(/\bthe movie\b/g, '')
      .replace(/\ble film\b/g, '')
      .replace(/\bversion\b/g, '')
      .replace(/\bvf\b/g, '')
      .replace(/\bvo\b/g, '')
      .replace(/\bvost\b/g, '')
      .replace(/\bvostfr\b/g, '')
      .replace(/\bimax\b/g, '')
      .replace(/\b4dx\b/g, '')
      .replace(/\bdolby\b/g, '')
      .replace(/\bcinema\b/g, '')
      .replace(/\bcine\b/g, '')
      .replace(/\b202[0-9]\b/g, '')
      .replace(/\b19[0-9]{2}\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactNearbyTitle(value) {
    return normalizeNearbyTitle(value).replace(/\s+/g, '');
  }

  function getGlobalFilms() {
    if (Array.isArray(window.FILMS)) return window.FILMS;
    try {
      if (Array.isArray(FILMS)) return FILMS;
    } catch (_) {}
    return [];
  }

  function buildLocalFilmIndex() {
    const films = getGlobalFilms();
    const index = [];

    for (const film of films) {
      const titles = [
        film?.titre,
        film?.title,
        film?.name,
        film?.original,
        film?.originalTitle,
        film?.original_title
      ].filter(Boolean);

      for (const title of titles) {
        const normalized = normalizeNearbyTitle(title);
        const compact = compactNearbyTitle(title);
        if (!normalized) continue;

        index.push({
          film,
          title,
          normalized,
          compact
        });
      }
    }

    return index;
  }

  function scoreTitleMatch(sessionTitle, candidateTitle) {
    const a = normalizeNearbyTitle(sessionTitle);
    const b = normalizeNearbyTitle(candidateTitle);
    const ca = compactNearbyTitle(sessionTitle);
    const cb = compactNearbyTitle(candidateTitle);

    if (!a || !b) return 0;
    if (a === b) return 100;
    if (ca === cb) return 98;

    if (a.includes(b) || b.includes(a)) {
      const shortLen = Math.min(a.length, b.length);
      const longLen = Math.max(a.length, b.length);
      return Math.round(82 + (shortLen / longLen) * 12);
    }

    const wordsA = new Set(a.split(' ').filter(w => w.length > 1));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
    const intersection = [...wordsA].filter(w => wordsB.has(w));

    if (!intersection.length) return 0;

    const ratio = intersection.length / Math.max(wordsA.size, wordsB.size);
    return Math.round(ratio * 80);
  }

  function findLocalFilmByTitle(title) {
    const index = buildLocalFilmIndex();
    let best = null;

    for (const item of index) {
      const score = scoreTitleMatch(title, item.title);
      if (!best || score > best.score) {
        best = { ...item, score };
      }
    }

    if (best && best.score >= 82) {
      return {
        film: best.film,
        matchedTitle: best.title,
        score: best.score
      };
    }

    return null;
  }

  function getBestNearbyRating(localMatch, rawMovie) {
    const localFilm = localMatch?.film || null;

    const candidates = [
      { source: 'IMDb', value: Number(localFilm?.imdb) },
      { source: 'Letterboxd', value: Number(localFilm?.lb) * 2 },
      { source: 'TMDB', value: Number(localFilm?.tmdb ?? localFilm?.vote_average) },
      { source: 'Score local', value: Number(localFilm?.sc) },
      { source: 'IMDb brut', value: Number(rawMovie?.imdb ?? rawMovie?.imdbRating) },
      { source: 'TMDB brut', value: Number(rawMovie?.tmdb ?? rawMovie?.vote_average) },
      { source: 'Allociné brut', value: Number(rawMovie?.rating ?? rawMovie?.note ?? rawMovie?.score) }
    ];

    for (const item of candidates) {
      if (Number.isFinite(item.value) && item.value > 0) {
        return {
          source: item.source,
          value: Math.round(item.value * 10) / 10
        };
      }
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

    console.log('[Catalogue proche] ZIP 2.6 actif.');
    console.log('[Catalogue proche] Position utilisée :', location);

    const cinemas = await window.PLACES.findNearbycinemas(location, radius);
    console.log(`[Catalogue proche] ${cinemas.length} cinéma(s) trouvé(s).`, cinemas);

    const maxCinemas = Number.isFinite(Number(options.maxCinemas)) ? Number(options.maxCinemas) : 8;
    console.log(`[Catalogue proche] Test debug sur ${Math.min(cinemas.length, maxCinemas)} cinéma(s).`);

    const moviesByKey = new Map();
    const matchDebug = [];
    const unmatchedTitles = new Set();

    for (const cinema of cinemas.slice(0, maxCinemas)) {
      try {
        console.log(`[Catalogue proche] Recherche films pour ${cinema.nom}...`);
        const showtimes = await getCinemaShowtimes(cinema);

        console.log(`[Catalogue proche] ${cinema.nom} : ${showtimes.length} film(s) trouvé(s).`, showtimes);

        for (const item of showtimes) {
          const title = item.title;
          const key = item.normalizedKey || normalizeNearbyTitle(title);
          if (!key) continue;

          const localMatch = findLocalFilmByTitle(title);
          const rating = getBestNearbyRating(localMatch, item.rawMovie);

          matchDebug.push({
            seances: title,
            catalogue: localMatch?.film?.titre || localMatch?.matchedTitle || 'NON TROUVÉ',
            score: localMatch?.score || 0,
            note: rating?.value ?? '—',
            source: rating?.source ?? '—',
            cinema: cinema.nom
          });

          if (!localMatch) {
            unmatchedTitles.add(title);
          }

          if (!moviesByKey.has(key)) {
            moviesByKey.set(key, {
              title,
              localFilm: localMatch?.film || null,
              matchedTitle: localMatch?.film?.titre || localMatch?.matchedTitle || null,
              matchScore: localMatch?.score || 0,
              poster: localMatch?.film?.poster || item.poster || '',
              ratingValue: rating?.value ?? null,
              ratingSource: rating?.source ?? null,
              cinemas: [],
              rawShowtimes: []
            });
          } else {
            const existing = moviesByKey.get(key);

            if (!existing.localFilm && localMatch?.film) {
              existing.localFilm = localMatch.film;
              existing.matchedTitle = localMatch.film.titre || localMatch.matchedTitle;
              existing.matchScore = localMatch.score || 0;
            }

            if (existing.ratingValue === null && rating) {
              existing.ratingValue = rating.value;
              existing.ratingSource = rating.source;
            }
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

    const matchedCount = ranked.filter(movie => movie.localFilm).length;
    const unmatchedCount = ranked.length - matchedCount;

    console.log(`[Catalogue proche] Résultat étape 2.6 : ${ranked.length} film(s) proche(s) assemblé(s).`);
    console.log(`[Catalogue proche] Correspondances catalogue : ${matchedCount}/${ranked.length}. Sans correspondance : ${unmatchedCount}.`);

    console.group('[Catalogue proche] Debug correspondances titres');
    console.table(matchDebug);
    console.groupEnd();

    if (unmatchedTitles.size) {
      console.warn('[Catalogue proche] Films non reconnus dans js/data.js :', Array.from(unmatchedTitles));
    } else {
      console.log('[Catalogue proche] Tous les films proches ont une correspondance dans js/data.js.');
    }

    console.table(ranked.map((movie, index) => ({
      rang: index + 1,
      film: movie.title,
      catalogue: movie.matchedTitle || 'NON TROUVÉ',
      scoreMatch: movie.matchScore || '—',
      note: movie.ratingValue ?? '—',
      source: movie.ratingSource ?? '—',
      cinemas: movie.cinemas.map(c => c.nom).join(', ')
    })));

    window.NEARBY_RANKED_MOVIES_LAST_RESULT = ranked;
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
