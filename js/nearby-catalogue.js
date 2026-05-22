/*
  CinéProche — Catalogue proche — ZIP 2.3

  Objectif unique : DEBUG.
  On ne change pas encore le Catalogue visuel.
  On veut comprendre pourquoi un cinéma proche retourne 0 film.

  Test console :
  getNearbyRankedMovies({ address: 'Cergy', radius: 15000 })
*/

const NEARBY_CATALOGUE_API = window.CINEPRO_API || 'https://cinepro-api-yal8.onrender.com';

function normalizeNearbyTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getLocalFilmsSafe() {
  if (Array.isArray(window.FILMS)) return window.FILMS;
  if (typeof FILMS !== 'undefined' && Array.isArray(FILMS)) return FILMS;
  return [];
}

function findLocalFilmByTitle(title) {
  const key = normalizeNearbyTitle(title);
  if (!key) return null;

  return getLocalFilmsSafe().find(f => {
    return normalizeNearbyTitle(f.titre || f.title) === key ||
           normalizeNearbyTitle(f.original || f.original_title) === key;
  }) || null;
}

function getBestNearbyRating(localFilm) {
  if (!localFilm) return null;

  const imdb = Number(localFilm.imdb);
  const lb = Number(localFilm.lb);
  const tmdb = Number(localFilm.tmdb || localFilm.vote_average);

  if (Number.isFinite(imdb) && imdb > 0) return { source: 'IMDb', value: imdb };
  if (Number.isFinite(lb) && lb > 0) return { source: 'Letterboxd', value: lb * 2 };
  if (Number.isFinite(tmdb) && tmdb > 0) return { source: 'TMDB', value: tmdb };

  return null;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchDebugJson(url, label) {
  console.log(`[Catalogue proche][DEBUG] Appel ${label} :`, url);

  const response = await fetchWithTimeout(url, {}, 15000);
  const text = await response.text();
  const json = safeJsonParse(text);

  console.log(`[Catalogue proche][DEBUG] Réponse ${label} :`, {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
    json,
    rawTextPreview: text.slice(0, 1000)
  });

  if (!response.ok) {
    throw new Error(`${label} HTTP ${response.status}`);
  }

  return json ?? { rawText: text };
}

function extractCinemaId(data) {
  if (!data || typeof data !== 'object') return null;

  // Formats possibles selon le backend.
  return data.id ||
         data.allocineId ||
         data.cinemaId ||
         data.theaterId ||
         data?.cinema?.id ||
         data?.result?.id ||
         data?.results?.[0]?.id ||
         data?.results?.[0]?.allocineId ||
         null;
}

function extractShowtimesArray(data) {
  if (!data || typeof data !== 'object') return [];

  const candidates = [
    data.seances,
    data.showtimes,
    data.movies,
    data.films,
    data.results,
    data.data,
    data?.cinema?.seances,
    data?.cinema?.films
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function extractShowtimeHours(showtimes = []) {
  const hours = new Set();

  for (const showtime of showtimes || []) {
    const startsAt = showtime?.startsAt || showtime?.date || showtime?.time || showtime?.horaire || '';
    if (!startsAt) continue;

    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) {
      if (typeof startsAt === 'string') hours.add(startsAt);
      continue;
    }

    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    hours.add(`${h}h${m}`);
  }

  return Array.from(hours).sort();
}

function normalizeShowtimeItem(item) {
  const title = item?.title || item?.name || item?.titre || item?.movieTitle || item?.film || item?.movie?.title || item?.movie?.name || '';
  return {
    ...item,
    title,
    horaires: item?.horaires || item?.times || item?.showtimes || extractShowtimeHours(item?.sessions || item?.seances || [])
  };
}

async function getCinemaAllocineId(cinema) {
  const params = new URLSearchParams({
    name: cinema.nom || '',
    address: cinema.adresse || '',
    lat: cinema.location?.lat || '',
    lng: cinema.location?.lng || ''
  });

  const url = `${NEARBY_CATALOGUE_API}/search-cinema?${params.toString()}`;
  const data = await fetchDebugJson(url, `search-cinema pour ${cinema.nom}`);
  const id = extractCinemaId(data);

  console.log(`[Catalogue proche][DEBUG] ID extrait pour ${cinema.nom} :`, id);
  return { id, raw: data };
}

async function getCinemaShowtimes(cinema) {
  console.groupCollapsed(`[Catalogue proche][DEBUG] Cinéma testé : ${cinema.nom}`);
  console.log('[Catalogue proche][DEBUG] Objet cinéma envoyé :', cinema);

  try {
    const found = await getCinemaAllocineId(cinema);

    if (!found.id) {
      console.warn(`[Catalogue proche][DEBUG] Aucun ID cinéma trouvé pour : ${cinema.nom}`);
      console.warn('[Catalogue proche][DEBUG] Réponse brute search-cinema :', found.raw);
      return [];
    }

    const today = new Date().toISOString().split('T')[0];
    const url = `${NEARBY_CATALOGUE_API}/seances?id=${encodeURIComponent(found.id)}&date=${today}`;
    const data = await fetchDebugJson(url, `seances pour ${cinema.nom}`);
    const rawFilms = extractShowtimesArray(data);

    console.log(`[Catalogue proche][DEBUG] Tableau extrait pour ${cinema.nom} :`, rawFilms);

    const films = rawFilms
      .map(normalizeShowtimeItem)
      .filter(item => item.title);

    if (!films.length) {
      console.warn(`[Catalogue proche][DEBUG] 0 film après normalisation pour ${cinema.nom}.`);
      console.warn('[Catalogue proche][DEBUG] Réponse brute seances :', data);
    }

    return films;
  } finally {
    console.groupEnd();
  }
}

async function getNearbyRankedMovies(options = {}) {
  if (!window.PLACES && typeof PLACES === 'undefined') {
    throw new Error('PLACES n’est pas chargé. Vérifie js/places.js.');
  }

  const places = window.PLACES || PLACES;
  const config = window.CONFIG || (typeof CONFIG !== 'undefined' ? CONFIG : {});
  const radius = options.radius || config.SEARCH_RADIUS || 15000;
  const maxCinemas = options.maxCinemas || 8;

  if (!places.geocoder || !places.placesService) {
    places.init();
  }

  let location = options.location || null;

  if (!location && options.address) {
    const geocoded = await places.geocodeAddress(options.address);
    location = geocoded.location;
  }

  if (!location) {
    location = await places.geolocate();
  }

  console.log('[Catalogue proche] ZIP 2.3 DEBUG actif.');
  console.log('[Catalogue proche] Position utilisée :', location);

  const cinemas = await places.findNearbycinemas(location, radius);
  console.log(`[Catalogue proche] ${cinemas.length} cinéma(s) trouvé(s).`, cinemas);
  console.log(`[Catalogue proche] Test debug sur ${Math.min(cinemas.length, maxCinemas)} cinéma(s).`);

  const moviesByKey = new Map();

  for (const cinema of cinemas.slice(0, maxCinemas)) {
    try {
      console.log(`[Catalogue proche] Recherche films pour ${cinema.nom}...`);
      const showtimes = await getCinemaShowtimes(cinema);
      console.log(`[Catalogue proche] ${cinema.nom} : ${showtimes.length} film(s) trouvé(s).`, showtimes);

      for (const item of showtimes) {
        const title = item.title || item.name || item.titre || '';
        const key = normalizeNearbyTitle(title);
        if (!key) continue;

        const localFilm = findLocalFilmByTitle(title);
        const rating = getBestNearbyRating(localFilm);

        if (!moviesByKey.has(key)) {
          moviesByKey.set(key, {
            title,
            localFilm,
            ratingValue: rating?.value ?? null,
            ratingSource: rating?.source ?? null,
            cinemas: [],
            rawShowtimes: []
          });
        }

        const movie = moviesByKey.get(key);
        movie.cinemas.push({
          nom: cinema.nom,
          adresse: cinema.adresse,
          distanceKm: cinema.dist,
          horaires: item.horaires || []
        });
        movie.rawShowtimes.push(item);
      }
    } catch (error) {
      console.warn(`[Catalogue proche][DEBUG] Impossible de charger les films pour ${cinema.nom} :`, error.message || error);
    }
  }

  const ranked = Array.from(moviesByKey.values()).sort((a, b) => {
    if (a.ratingValue === null && b.ratingValue === null) return a.title.localeCompare(b.title, 'fr');
    if (a.ratingValue === null) return 1;
    if (b.ratingValue === null) return -1;
    return b.ratingValue - a.ratingValue;
  });

  console.log(`[Catalogue proche] Résultat étape 2.3 : ${ranked.length} film(s) proche(s) assemblé(s).`);
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
    const places = window.PLACES || (typeof PLACES !== 'undefined' ? PLACES : null);
    if (!places) throw new Error('PLACES absent');
    places.init();
    console.log('[Catalogue proche] Google Maps/Places prêt. Test possible avec :');
    console.log("getNearbyRankedMovies({ address: 'Cergy', radius: 15000 })");
  } catch (error) {
    console.warn('[Catalogue proche] Initialisation impossible :', error.message || error);
  }
}

window.getNearbyRankedMovies = getNearbyRankedMovies;
window.initNearbyCatalogueGoogleMaps = initNearbyCatalogueGoogleMaps;
