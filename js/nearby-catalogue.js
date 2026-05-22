/* CinéProche — Étape 2 : récupération des films proches classés
   Objectif de ce fichier : tester les données dans la console, sans modifier l'affichage du Catalogue. */

const NEARBY_CATALOGUE_API = 'https://cinepro-api-yal8.onrender.com';

function normalizeNearbyTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findLocalFilmByTitle(title) {
  const key = normalizeNearbyTitle(title);
  if (!key || !Array.isArray(window.FILMS || FILMS)) return null;
  return (window.FILMS || FILMS).find(f => {
    return normalizeNearbyTitle(f.titre) === key || normalizeNearbyTitle(f.original) === key;
  }) || null;
}

function getBestNearbyRating(localFilm) {
  if (!localFilm) return null;
  const imdb = Number(localFilm.imdb);
  const lb = Number(localFilm.lb);
  const tmdb = Number(localFilm.tmdb || localFilm.vote_average);

  if (Number.isFinite(imdb)) return { source: 'IMDb', value: imdb };
  if (Number.isFinite(lb)) return { source: 'Letterboxd', value: lb * 2 };
  if (Number.isFinite(tmdb)) return { source: 'TMDB', value: tmdb };
  return null;
}

async function getCinemaAllocineId(cinema) {
  const params = new URLSearchParams({
    name: cinema.nom || '',
    lat: cinema.location?.lat || '',
    lng: cinema.location?.lng || ''
  });

  const response = await fetch(`${NEARBY_CATALOGUE_API}/search-cinema?${params}`);
  if (!response.ok) throw new Error(`search-cinema ${response.status}`);
  const data = await response.json();
  return data.id || null;
}

async function getCinemaShowtimes(cinema) {
  const allocineId = await getCinemaAllocineId(cinema);
  if (!allocineId) return [];

  const today = new Date().toISOString().split('T')[0];
  const response = await fetch(`${NEARBY_CATALOGUE_API}/seances?id=${allocineId}&date=${today}`);
  if (!response.ok) throw new Error(`seances ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.seances) ? data.seances : [];
}

async function getNearbyRankedMovies(options = {}) {
  if (!window.PLACES) throw new Error('PLACES n’est pas chargé. Vérifie js/places.js.');

  const radius = options.radius || CONFIG.SEARCH_RADIUS || 15000;
  let location = options.location || null;

  if (!location && options.address) {
    const geocoded = await PLACES.geocodeAddress(options.address);
    location = geocoded.location;
  }

  if (!location) {
    location = await PLACES.geolocate();
  }

  console.log('[Catalogue proche] Position utilisée :', location);

  const cinemas = await PLACES.findNearbycinemas(location, radius);
  console.log(`[Catalogue proche] ${cinemas.length} cinéma(s) trouvé(s).`, cinemas);

  const moviesByKey = new Map();

  for (const cinema of cinemas.slice(0, options.maxCinemas || 8)) {
    try {
      const showtimes = await getCinemaShowtimes(cinema);
      console.log(`[Catalogue proche] ${cinema.nom} : ${showtimes.length} film(s).`);

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
          horaires: item.horaires || item.times || []
        });
        movie.rawShowtimes.push(item);
      }
    } catch (error) {
      console.warn(`[Catalogue proche] Impossible de charger ${cinema.nom} :`, error.message);
    }
  }

  const ranked = Array.from(moviesByKey.values()).sort((a, b) => {
    if (a.ratingValue === null && b.ratingValue === null) return a.title.localeCompare(b.title, 'fr');
    if (a.ratingValue === null) return 1;
    if (b.ratingValue === null) return -1;
    return b.ratingValue - a.ratingValue;
  });

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
    PLACES.init();
    console.log('[Catalogue proche] Google Maps/Places prêt. Test possible avec :');
    console.log("getNearbyRankedMovies({ address: 'Cergy', radius: 15000 })");
  } catch (error) {
    console.warn('[Catalogue proche] Initialisation impossible :', error.message);
  }
}

window.getNearbyRankedMovies = getNearbyRankedMovies;
window.initNearbyCatalogueGoogleMaps = initNearbyCatalogueGoogleMaps;
