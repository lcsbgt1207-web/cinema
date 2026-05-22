/* CinéProche — Catalogue proche — ZIP 2.8
   Objectif unique :
   - garder le moteur 2.7
   - ajouter un debug détaillé des notes
   - priorité : IMDb local -> OMDb/IMDb si clé navigateur disponible -> TMDB secours
   - expliquer précisément pourquoi un film reste sans note
   - ne pas encore modifier l'affichage HTML du Catalogue
*/

(function () {
  'use strict';

  const NEARBY_CATALOGUE_API = 'https://cinepro-api-yal8.onrender.com';
  const tmdbRatingCache = new Map();
  const omdbRatingCache = new Map();

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
        index.push({ film, title, normalized, compact });
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

  function getClosestLocalTitles(title, limit = 5) {
    return buildLocalFilmIndex()
      .map(item => ({
        titreCatalogue: item.title,
        score: scoreTitleMatch(title, item.title),
        imdb: item.film?.imdb ?? '—',
        tmdb: item.film?.tmdb ?? '—'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function findLocalFilmByTitle(title) {
    const candidates = getClosestLocalTitles(title, 1);
    const best = candidates[0];

    if (best && best.score >= 82) {
      const match = buildLocalFilmIndex().find(item => item.title === best.titreCatalogue);
      return {
        film: match?.film || null,
        matchedTitle: best.titreCatalogue,
        score: best.score
      };
    }

    return null;
  }

  function getBestLocalRating(localMatch, rawMovie) {
    const localFilm = localMatch?.film || null;

    const candidates = [
      { source: 'IMDb', value: Number(localFilm?.imdb) },
      { source: 'Letterboxd', value: Number(localFilm?.lb) * 2 },
      { source: 'TMDB local', value: Number(localFilm?.tmdb ?? localFilm?.vote_average) },
      { source: 'Score local', value: Number(localFilm?.sc) },
      { source: 'IMDb brut', value: Number(rawMovie?.imdb ?? rawMovie?.imdbRating) },
      { source: 'TMDB brut', value: Number(rawMovie?.tmdb ?? rawMovie?.vote_average) },
      { source: 'Allociné brut', value: Number(rawMovie?.rating ?? rawMovie?.note ?? rawMovie?.score) }
    ];

    for (const item of candidates) {
      if (Number.isFinite(item.value) && item.value > 0) {
        return { source: item.source, value: Math.round(item.value * 10) / 10 };
      }
    }

    return null;
  }

  async function searchOmdbRating(title) {
    const cacheKey = normalizeNearbyTitle(title);
    if (!cacheKey) return null;
    if (omdbRatingCache.has(cacheKey)) return omdbRatingCache.get(cacheKey);

    const apiKey = window.CONFIG?.OMDB_API_KEY || '';
    if (!apiKey) {
      const skipped = { skipped: true, reason: 'CONFIG.OMDB_API_KEY vide côté navigateur' };
      omdbRatingCache.set(cacheKey, null);
      console.log(`[Catalogue proche][OMDb] ${title} : ignoré (${skipped.reason}).`);
      return null;
    }

    try {
      const base = window.CONFIG?.OMDB_BASE_URL || 'https://www.omdbapi.com/';
      const url = `${base}?apikey=${encodeURIComponent(apiKey)}&t=${encodeURIComponent(title)}&type=movie&r=json`;
      console.log(`[Catalogue proche][OMDb] Appel pour "${title}" :`, url.replace(apiKey, '***'));
      const response = await fetch(url);
      const data = await response.json();

      console.log(`[Catalogue proche][OMDb] Réponse pour "${title}" :`, data);

      if (data?.Response === 'False') {
        omdbRatingCache.set(cacheKey, null);
        return null;
      }

      const imdbRating = Number(data?.imdbRating);
      if (!Number.isFinite(imdbRating) || imdbRating <= 0) {
        omdbRatingCache.set(cacheKey, null);
        return null;
      }

      const result = {
        source: 'IMDb via OMDb',
        value: Math.round(imdbRating * 10) / 10,
        matchedTitle: data?.Title || title,
        imdbId: data?.imdbID || '',
        score: scoreTitleMatch(title, data?.Title || title)
      };

      omdbRatingCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.warn(`[Catalogue proche][OMDb] Erreur pour "${title}" :`, error?.message || error);
      omdbRatingCache.set(cacheKey, null);
      return null;
    }
  }

  async function searchTmdbRating(title) {
    const cacheKey = normalizeNearbyTitle(title);
    if (!cacheKey) return null;
    if (tmdbRatingCache.has(cacheKey)) return tmdbRatingCache.get(cacheKey);

    if (!window.CONFIG?.TMDB_API_KEY || !window.CONFIG?.TMDB_BASE_URL) {
      console.warn(`[Catalogue proche][TMDB] Impossible pour "${title}" : CONFIG.TMDB_API_KEY ou CONFIG.TMDB_BASE_URL absent.`);
      tmdbRatingCache.set(cacheKey, null);
      return null;
    }

    try {
      const url = `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE || 'fr-FR'}&region=${CONFIG.REGION || 'FR'}&query=${encodeURIComponent(title)}`;
      console.log(`[Catalogue proche][TMDB] Appel pour "${title}" :`, url.replace(CONFIG.TMDB_API_KEY, '***'));

      const response = await fetch(url);
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];

      console.log(`[Catalogue proche][TMDB] "${title}" → ${results.length} résultat(s).`, results.slice(0, 5).map(item => ({
        id: item.id,
        title: item.title,
        original_title: item.original_title,
        release_date: item.release_date,
        vote_average: item.vote_average,
        score_title: scoreTitleMatch(title, item.title || ''),
        score_original: scoreTitleMatch(title, item.original_title || '')
      })));

      let best = null;

      for (const result of results.slice(0, 8)) {
        const candidateTitle = result?.title || result?.name || result?.original_title || '';
        const score = Math.max(
          scoreTitleMatch(title, candidateTitle),
          scoreTitleMatch(title, result?.original_title || '')
        );

        if (!best || score > best.score) {
          best = { result, score, candidateTitle };
        }
      }

      if (!best) {
        console.warn(`[Catalogue proche][TMDB] Aucun résultat TMDB pour "${title}".`);
        tmdbRatingCache.set(cacheKey, null);
        return null;
      }

      if (best.score < 55) {
        console.warn(`[Catalogue proche][TMDB] Match rejeté pour "${title}" : meilleur score ${best.score}.`, {
          meilleurTitre: best.candidateTitle,
          original: best.result?.original_title
        });
        tmdbRatingCache.set(cacheKey, null);
        return null;
      }

      const vote = Number(best.result?.vote_average);
      if (!Number.isFinite(vote) || vote <= 0) {
        console.warn(`[Catalogue proche][TMDB] Match trouvé pour "${title}", mais note invalide :`, {
          titre: best.candidateTitle,
          vote_average: best.result?.vote_average
        });
        tmdbRatingCache.set(cacheKey, null);
        return null;
      }

      const rating = {
        source: 'TMDB',
        value: Math.round(vote * 10) / 10,
        matchedTitle: best.result?.title || best.result?.original_title || best.candidateTitle,
        tmdbId: best.result?.id,
        score: best.score,
        posterPath: best.result?.poster_path || ''
      };

      console.log(`[Catalogue proche][TMDB] Note trouvée pour "${title}" → "${rating.matchedTitle}" : ${rating.value}/10`);
      tmdbRatingCache.set(cacheKey, rating);
      return rating;
    } catch (error) {
      console.warn(`[Catalogue proche][TMDB] Recherche impossible pour "${title}" :`, error?.message || error);
      tmdbRatingCache.set(cacheKey, null);
      return null;
    }
  }

  async function resolveMovieRating(title, localMatch, rawMovie) {
    const localRating = getBestLocalRating(localMatch, rawMovie);
    if (localRating) {
      return {
        ...localRating,
        ratingKind: 'local',
        matchedTitle: localMatch?.film?.titre || localMatch?.matchedTitle || title,
        matchScore: localMatch?.score || 0
      };
    }

    const omdbRating = await searchOmdbRating(title);
    if (omdbRating) {
      return {
        source: omdbRating.source,
        value: omdbRating.value,
        ratingKind: 'omdb',
        matchedTitle: omdbRating.matchedTitle,
        matchScore: omdbRating.score,
        imdbId: omdbRating.imdbId
      };
    }

    const tmdbRating = await searchTmdbRating(title);
    if (tmdbRating) {
      return {
        source: tmdbRating.source,
        value: tmdbRating.value,
        ratingKind: 'tmdb',
        matchedTitle: tmdbRating.matchedTitle,
        matchScore: tmdbRating.score,
        tmdbId: tmdbRating.tmdbId,
        posterPath: tmdbRating.posterPath
      };
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
    if (!title) return null;

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

    if (contentType.includes('application/json')) json = await response.json();
    else text = await response.text();

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

    if (id) console.log(`[Catalogue proche][DEBUG] ID extrait pour ${cinema?.nom} :`, id);
    else console.warn(`[Catalogue proche][DEBUG] Aucun ID cinéma trouvé pour ${cinema?.nom}.`);

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

    const normalized = rawShowtimes.map(normalizeShowtimeItem).filter(Boolean);

    if (rawShowtimes.length && !normalized.length) {
      console.warn(`[Catalogue proche][DEBUG] ${rawShowtimes.length} objet(s) reçu(s), mais aucun titre lisible pour ${cinema?.nom}.`);
    }

    return normalized;
  }

  async function getNearbyRankedMovies(options = {}) {
    if (!window.PLACES) throw new Error('PLACES n’est pas chargé. Vérifie js/places.js.');

    const radius = options.radius || window.CONFIG?.SEARCH_RADIUS || 15000;
    let location = options.location || null;

    if (!location && options.address) {
      const geocoded = await window.PLACES.geocodeAddress(options.address);
      location = geocoded.location;
    }

    if (!location) location = await window.PLACES.geolocate();

    console.log('[Catalogue proche] ZIP 2.8 actif.');
    console.log('[Catalogue proche] Position utilisée :', location);

    const cinemas = await window.PLACES.findNearbycinemas(location, radius);
    console.log(`[Catalogue proche] ${cinemas.length} cinéma(s) trouvé(s).`, cinemas);

    const maxCinemas = Number.isFinite(Number(options.maxCinemas)) ? Number(options.maxCinemas) : 8;
    console.log(`[Catalogue proche] Test debug sur ${Math.min(cinemas.length, maxCinemas)} cinéma(s).`);

    const moviesByKey = new Map();
    const matchDebug = [];
    const unmatchedTitles = new Set();
    const closestDebug = [];

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
          const closestLocal = getClosestLocalTitles(title, 3);
          const rating = await resolveMovieRating(title, localMatch, item.rawMovie);

          matchDebug.push({
            seances: title,
            catalogue: localMatch?.film?.titre || localMatch?.matchedTitle || 'NON TROUVÉ',
            scoreLocal: localMatch?.score || 0,
            note: rating?.value ?? '—',
            source: rating?.source ?? '—',
            provenance: rating?.ratingKind || 'aucune',
            matchNote: rating?.matchedTitle || '—',
            cinema: cinema.nom
          });

          if (!localMatch) {
            unmatchedTitles.add(title);
            closestDebug.push({
              filmSeances: title,
              choix1: closestLocal[0] ? `${closestLocal[0].titreCatalogue} (${closestLocal[0].score})` : '—',
              choix2: closestLocal[1] ? `${closestLocal[1].titreCatalogue} (${closestLocal[1].score})` : '—',
              choix3: closestLocal[2] ? `${closestLocal[2].titreCatalogue} (${closestLocal[2].score})` : '—'
            });
          }

          if (!moviesByKey.has(key)) {
            moviesByKey.set(key, {
              title,
              localFilm: localMatch?.film || null,
              matchedTitle: localMatch?.film?.titre || localMatch?.matchedTitle || rating?.matchedTitle || null,
              matchScore: Math.max(localMatch?.score || 0, rating?.matchScore || 0),
              poster: localMatch?.film?.poster || item.poster || (rating?.posterPath ? `${CONFIG.TMDB_IMG_BASE}${rating.posterPath}` : ''),
              ratingValue: rating?.value ?? null,
              ratingSource: rating?.source ?? null,
              ratingKind: rating?.ratingKind || null,
              tmdbId: rating?.tmdbId || null,
              imdbId: rating?.imdbId || null,
              cinemas: [],
              rawShowtimes: []
            });
          } else {
            const existing = moviesByKey.get(key);

            if (!existing.localFilm && localMatch?.film) {
              existing.localFilm = localMatch.film;
              existing.matchedTitle = localMatch.film.titre || localMatch.matchedTitle;
            }

            const existingRating = Number(existing.ratingValue || 0);
            const newRating = Number(rating?.value || 0);
            if ((!existing.ratingValue && rating) || newRating > existingRating) {
              existing.ratingValue = rating.value;
              existing.ratingSource = rating.source;
              existing.ratingKind = rating.ratingKind;
              existing.tmdbId = rating.tmdbId || existing.tmdbId;
              existing.imdbId = rating.imdbId || existing.imdbId;
              existing.matchedTitle = existing.matchedTitle || rating.matchedTitle;
            }

            existing.matchScore = Math.max(existing.matchScore || 0, localMatch?.score || 0, rating?.matchScore || 0);
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
      if (a.ratingValue === null && b.ratingValue === null) return a.title.localeCompare(b.title, 'fr');
      if (a.ratingValue === null) return 1;
      if (b.ratingValue === null) return -1;
      return b.ratingValue - a.ratingValue;
    });

    const localCount = ranked.filter(movie => movie.ratingKind === 'local').length;
    const omdbCount = ranked.filter(movie => movie.ratingKind === 'omdb').length;
    const tmdbCount = ranked.filter(movie => movie.ratingKind === 'tmdb').length;
    const noRatingCount = ranked.filter(movie => movie.ratingValue === null).length;

    console.log(`[Catalogue proche] Résultat étape 2.8 : ${ranked.length} film(s) proche(s) assemblé(s).`);
    console.log(`[Catalogue proche] Notes trouvées : local=${localCount}, OMDb/IMDb=${omdbCount}, TMDB=${tmdbCount}, sans note=${noRatingCount}.`);

    console.group('[Catalogue proche] Debug correspondances titres + notes');
    console.table(matchDebug);
    console.groupEnd();

    console.group('[Catalogue proche] Debug meilleurs matchs locaux pour les films non reconnus');
    console.table(closestDebug);
    console.groupEnd();

    if (unmatchedTitles.size) {
      console.warn('[Catalogue proche] Films absents de js/data.js :', Array.from(unmatchedTitles));
    }

    console.table(ranked.map((movie, index) => ({
      rang: index + 1,
      film: movie.title,
      catalogue: movie.matchedTitle || 'NON TROUVÉ',
      scoreMatch: movie.matchScore || '—',
      note: movie.ratingValue ?? '—',
      source: movie.ratingSource ?? '—',
      provenance: movie.ratingKind ?? '—',
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
