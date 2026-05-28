// CinéProche — Catalogue proche — ZIP 4.9
// Rôle : orchestrer le catalogue des films projetés près de la dernière recherche.
// Flux stable : cache avec rayon -> réhydratation runtime -> affichage via catalogue-render.js.
// Ce fichier ne gère pas le HTML du tableau et ne modifie pas les séances directement.
const STATIC_CATALOGUE = FILMS.filter(f => f && !f.isMock);
let catalogue = [];
let catalogueMode = 'nearby';
const CATALOGUE_BACKEND_BASE_URL = (window.CONFIG && CONFIG.BACKEND_BASE_URL) || 'https://cinepro-api-yal8.onrender.com';
const LETTERBOXD_API_URL = `${CATALOGUE_BACKEND_BASE_URL}/api/films-letterboxd`;
const IMDB_SYNOPSIS_API_URL = `${CATALOGUE_BACKEND_BASE_URL}/api/imdb-synopsis`;
const CATALOGUE_RECENT_MONTHS_LIMIT = 12;
const CATALOGUE_LOOKAHEAD_DAYS = Number((window.CONFIG && CONFIG.CATALOGUE_LOOKAHEAD_DAYS) || 14) || 14;
const LETTERBOXD_MIN_VALID_RATING = 0.5;
const CINEPRO_STORAGE = window.CINEPRO_STORAGE || null;
const STORAGE_KEYS = CINEPRO_STORAGE?.KEYS || {
  ACTIVE_CATALOGUE: 'cinepro_active_catalogue',
  NEARBY_RANKED_CATALOGUE: 'cinepro_nearby_ranked_catalogue',
  RUNTIME_CATALOGUE: 'cinepro_runtime_catalogue',
  LAST_NEARBY_SEARCH: 'cinepro_last_nearby_search',
  CATALOGUE_MODE: 'cinepro_catalogue_mode',
  FAVS: 'cinepro_favs',
  DEBUG: 'cinepro_debug'
};
const ACTIVE_CATALOGUE_KEY = STORAGE_KEYS.ACTIVE_CATALOGUE;
const NEARBY_RANKED_KEY = STORAGE_KEYS.NEARBY_RANKED_CATALOGUE;
const RUNTIME_CATALOGUE_KEY = STORAGE_KEYS.RUNTIME_CATALOGUE;

function readStorageJson(key, fallback = null) {
  if (CINEPRO_STORAGE?.readJSON) return CINEPRO_STORAGE.readJSON(key, fallback);
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (_) { return fallback; }
}

function writeStorageJson(key, value) {
  if (CINEPRO_STORAGE?.writeJSON) return CINEPRO_STORAGE.writeJSON(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
}

function removeStorageItem(key) {
  if (CINEPRO_STORAGE?.remove) return CINEPRO_STORAGE.remove(key);
  try { localStorage.removeItem(key); return true; } catch (_) { return false; }
}

function setStoredCatalogueMode(mode = 'nearby') {
  if (CINEPRO_STORAGE?.setCatalogueMode) return CINEPRO_STORAGE.setCatalogueMode(mode);
  try { localStorage.setItem(STORAGE_KEYS.CATALOGUE_MODE, mode); return true; } catch (_) { return false; }
}

function readCatalogueFavorites() {
  if (CINEPRO_STORAGE?.readFavorites) return CINEPRO_STORAGE.readFavorites();
  return readStorageJson(STORAGE_KEYS.FAVS, []);
}

function writeCatalogueFavorites(values) {
  if (CINEPRO_STORAGE?.writeFavorites) return CINEPRO_STORAGE.writeFavorites(values);
  return writeStorageJson(STORAGE_KEYS.FAVS, values);
}

function isCatalogueDebugEnabled() {
  const raw = CINEPRO_STORAGE?.readText ? CINEPRO_STORAGE.readText(STORAGE_KEYS.DEBUG, '') : null;
  return raw === '1' || raw === 'true' || raw === true || readStorageJson(STORAGE_KEYS.DEBUG, false) === true;
}

setStoredCatalogueMode('nearby');
const favs = new Set(readCatalogueFavorites());
let sortKey = 'imdb', sortDir = -1;
let currentPage = 1;
let pageSize = 8;
let lastCatalogueSearchTarget = null;
let catalogueLocationSearchTimer = null;
let catalogueAutoSearchStarted = false;
let catalogueSearchRunning = false;
let activeCatalogueSearchId = 0;
let lastStableCatalogueSnapshot = [];
let lastStableCatalogueMeta = null;
let lastCatalogueFilterStats = {
  sourceTotal: 0,
  kept: 0,
  excludedRecent: 0,
  unknownYearKept: 0,
  displayed: 0,
  referenceSource: 'none'
};
window.CINEPRO_CATALOGUE_FILTER_STATS = lastCatalogueFilterStats;

const LABELS = { lb:'Letterboxd', imdb:'IMDb', sc:'SensCritique', annee:'Année', titre:'Titre', real:'Réalisateur', genre:'Genre' };

function normalizePositiveRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : null;
}

function isNearbyModeActive() {
  return catalogueMode === 'nearby' && hasNearbyCatalogue();
}

function normalizeRuntimeCatalogueKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}


function isUsefulCatalogueText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (['a completer', 'synopsis a completer.', 'aucun synopsis disponible pour ce film.', 'non renseigne', 'non renseignee', '-', '—', 'n/a'].includes(normalized)) return false;
  return !isRejectedCatalogueSynopsis(text);
}

function isRejectedCatalogueSynopsis(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const rejectedPatterns = [
    'javascript est desactive',
    'enable javascript',
    'captcha',
    'robot',
    'security check',
    'access denied',
    'please verify',
    'unusual traffic',
    'imdb.com',
    'reference id'
  ];

  return rejectedPatterns.some(pattern => normalized.includes(pattern));
}

function pickUsefulCatalogueText(...values) {
  for (const value of values) {
    if (isUsefulCatalogueText(value)) return String(value).trim();
  }
  return '';
}

function prepareCatalogueFilm(film, index = 0) {
  const copy = { ...film };
  if (copy.id === undefined || copy.id === null || copy.id === '') {
    const base = copy.tmdbId ? `runtime-tmdb-${copy.tmdbId}` : `runtime-${normalizeRuntimeCatalogueKey(copy.titre || copy.title || 'film')}-${index}`;
    copy.id = base;
  }
  copy.titre = copy.titre || copy.title || 'Film sans titre';
  copy.original = copy.original || copy.originalTitle || copy.original_title || '';
  copy.genre = pickUsefulCatalogueText(copy.genre, Array.isArray(copy.genres) ? copy.genres.join(', ') : '') || 'À compléter';
  copy.real = pickUsefulCatalogueText(copy.real, copy.realisateur, copy.director) || 'Non renseigné';
  copy.acteurs = pickUsefulCatalogueText(copy.acteurs, copy.cast) || 'Non renseigné';
  copy.synopsis = pickUsefulCatalogueText(copy.synopsis, copy.overview) || 'Synopsis à compléter.';
  copy.color = copy.color || ['p1','p2','p3','p4','p5','p6'][index % 6];
  copy.badge = copy.badge || (copy.source === 'tmdb-runtime-fusion' ? 'TMDB' : 'Catalogue');
  copy.lb = normalizePositiveRating(copy.lb);
  copy.imdb = normalizePositiveRating(copy.imdb);
  copy.tmdb = normalizePositiveRating(copy.tmdb);
  copy.sc = normalizePositiveRating(copy.sc) ?? copy.tmdb ?? null;
  copy.annee = Number.isFinite(Number(copy.annee)) ? Number(copy.annee) : (Number.isFinite(Number(copy.year)) ? Number(copy.year) : null);
  copy.isMock = false;
  return copy;
}

function getLocalDateKey(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isFreshNearbyPayload(payload) {
  // ZIP 3.8.1 : un seul catalogue proche actif, valable toute la journée.
  // On ne rejette plus un bon catalogue après 30 minutes : cela faisait retomber la page sur les 80 films.
  if (!payload || typeof payload !== 'object') return false;
  const acceptedVersions = new Set(['3.7.3', '3.7.4', '3.8.1', '3.8.3', '3.8.4', '3.8.5', '3.8.6', '3.9.2', '3.9.4', '3.9.8', '4.9.0', '4.9.1', '4.9.2', '5.0.0', '5.0.1', '5.0.2', '5.0.3', '5.2.0']);
  const payloadVersion = String(payload.version || '');
  if (payloadVersion && !acceptedVersions.has(payloadVersion) && !payloadVersion.startsWith('5.')) return false;
  if (!Array.isArray(payload.films) || !payload.films.length) return false;
  const stamp = payload.searchDate || payload.updatedAt || payload.createdAt;
  if (getLocalDateKey(stamp) !== getLocalDateKey(new Date())) return false;

  // ZIP 4.0 : le cache catalogue est lié à la dernière recherche proche.
  // Si le rayon ou l'adresse ne correspondent pas, le cache est ignoré.
  const lastSearch = readLastNearbySearch();
  if (lastSearch) {
    const wantedRadius = Number(lastSearch.radius || 0);
    const payloadRadius = Number(payload.radius || 0);

    // Un cache sans rayon n'est plus fiable quand une recherche avec rayon existe.
    if (wantedRadius && !payloadRadius) return false;
    if (wantedRadius && payloadRadius && Math.abs(wantedRadius - payloadRadius) > 50) return false;

    const wantedAddress = normalizeRuntimeCatalogueKey(lastSearch.address || lastSearch.query || '');
    const payloadAddress = normalizeRuntimeCatalogueKey(payload.address || payload.query || '');

    // Même logique pour l'adresse : éviter qu'un ancien cache sans lieu gagne sur la recherche active.
    if (wantedAddress && !payloadAddress) return false;
    if (wantedAddress && payloadAddress && wantedAddress !== payloadAddress) return false;
  }

  return true;
}

function readStoredPayload(key) {
  try {
    const payload = readStorageJson(key, null);
    return isFreshNearbyPayload(payload) && Array.isArray(payload?.films) ? payload.films : [];
  } catch (_) {
    return [];
  }
}

function readStoredActiveCatalogue() { return readStoredPayload(ACTIVE_CATALOGUE_KEY); }
function readStoredRuntimeCatalogue() { return readStoredPayload(RUNTIME_CATALOGUE_KEY); }
function readStoredNearbyCatalogue() { return readStoredPayload(NEARBY_RANKED_KEY); }

function writeActiveCatalogueFromFilms(films, meta = {}) {
  if (!Array.isArray(films) || !films.length) return null;
  const now = new Date();
  const lastSearch = readLastNearbySearch();
  const payload = {
    version: '5.2.0',
    source: meta.source || 'active-nearby-catalogue',
    searchDate: getLocalDateKey(now),
    updatedAt: now.toISOString(),
    address: meta.address || lastSearch?.address || lastSearch?.query || '',
    query: meta.query || lastSearch?.query || lastSearch?.address || '',
    radius: Number(meta.radius || lastSearch?.radius || 0) || null,
    requestId: meta.requestId || lastSearch?.requestId || null,
    films,
    stats: { total: films.length }
  };
  try {
    writeStorageJson(ACTIVE_CATALOGUE_KEY, payload);
    window.CINEPRO_ACTIVE_CATALOGUE = films;
  } catch (error) {
    console.warn('[Catalogue] ZIP 4.0 : sauvegarde cinepro_active_catalogue impossible :', error?.message || error);
  }
  return payload;
}

function hasNearbyCatalogue() {
  return (Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) && window.CINEPRO_ACTIVE_CATALOGUE.length)
    || readStoredActiveCatalogue().length;
}

function getActiveRawCatalogueSource() {
  // ZIP 4.8 : une seule source officielle pour la page Catalogue.
  // Les caches nearby/runtime ne servent plus qu'à alimenter cinepro_active_catalogue,
  // puis la page relit toujours cette source officielle.
  const active = Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) && window.CINEPRO_ACTIVE_CATALOGUE.length
    ? window.CINEPRO_ACTIVE_CATALOGUE
    : readStoredActiveCatalogue();

  if (active.length) {
    catalogueMode = 'nearby';
    setStoredCatalogueMode('nearby');
    return { source: active, label: 'catalogue proche actif' };
  }

  const nearby = Array.isArray(window.NEARBY_CATALOGUE_NEARBY_RANKED) && window.NEARBY_CATALOGUE_NEARBY_RANKED.length
    ? window.NEARBY_CATALOGUE_NEARBY_RANKED
    : readStoredNearbyCatalogue();

  if (nearby.length) {
    const payload = writeActiveCatalogueFromFilms(nearby, { source: 'nearby-ranked-promoted-to-active' });
    catalogueMode = 'nearby';
    setStoredCatalogueMode('nearby');
    return { source: payload?.films || nearby, label: 'catalogue proche actif' };
  }

  return { source: [], label: 'catalogue proche en attente de recherche' };
}

function getBestNote(film) {
  const values = [film.bestNote, film.nearbyRatingValue, film.imdb, film.tmdb, film.sc, film.lb];
  for (const value of values) {
    const rating = normalizePositiveRating(value);
    if (rating !== null) return rating;
  }
  return null;
}

function getNearbyRatingSource(film) {
  return film.bestNoteSource || film.nearbyRatingSource || film.ratingSource || (film.tmdb ? 'TMDB' : film.imdb ? 'IMDb' : film.lb ? 'Letterboxd' : film.sc ? 'Note' : '—');
}

function getNearbyCinemaLabel(film) {
  if (film?.nextCinemaName) return String(film.nextCinemaName);
  const cinemas = Array.isArray(film.nearbyCinemas) && film.nearbyCinemas.length ? film.nearbyCinemas : (Array.isArray(film.cinemas) ? film.cinemas : []);
  return cinemas.map(c => c?.nom || c?.name || '').filter(Boolean).slice(0, 2).join(', ') || 'cinéma proche';
}

function getNearbyNextShowtimeLabel(film) {
  if (film?.nextShowtimeLabel) return String(film.nextShowtimeLabel);
  const cinemas = Array.isArray(film?.nearbyCinemas) ? film.nearbyCinemas : (Array.isArray(film?.cinemas) ? film.cinemas : []);
  for (const cinema of cinemas) {
    const structured = Array.isArray(cinema?.structuredHoraires) ? cinema.structuredHoraires : (Array.isArray(cinema?.showtimes) ? cinema.showtimes : []);
    const first = structured.find(item => item && (item.label || item.startsAt));
    if (first?.label) return String(first.label);
  }
  if (film?.hasUnparsedShowtimes) return 'Horaires à confirmer';
  return '';
}

function formatNearbyBestNote(film) {
  const rating = getBestNote(film);
  return rating !== null ? rating.toFixed(1) : '—';
}

function formatClassicRating(value, suffix = '') {
  const rating = normalizePositiveRating(value);
  return rating !== null ? `${rating.toFixed(1)}${suffix}` : '—';
}


function getCatalogueReleaseYear(film) {
  const candidates = [
    film?.annee,
    film?.year,
    film?.releaseYear,
    film?.release_year
  ];

  for (const value of candidates) {
    const year = Number(value);
    if (Number.isFinite(year) && year >= 1888 && year <= 2100) return year;
  }

  const dateCandidates = [
    film?.releaseDate,
    film?.release_date,
    film?.dateSortie,
    film?.sortie,
    film?.first_air_date
  ];

  for (const value of dateCandidates) {
    const match = String(value || '').match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return Number(match[1]);
  }

  return null;
}

function getCatalogueReleaseDate(film) {
  const candidates = [film?.releaseDate, film?.release_date, film?.dateSortie, film?.sortie, film?.first_air_date];
  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function isCatalogueLegacyFilm(film) {
  // ZIP 4.9.2 : le Catalogue garde les films proches hors nouveautés,
  // mais ne doit pas exclure abusivement une reprise / séance spéciale
  // simplement parce que les métadonnées de sortie sont incomplètes.
  const specialMarkers = [
    film?.badge,
    film?.source,
    film?.nearbyStatus,
    film?.nextCinemaName,
    film?.nextShowtimeLabel,
    film?.nearbyMatchedTitle
  ].join(' ').toLowerCase();
  if (/(culte|patrimoine|classique|reprise|retrospective|rétrospective|festival|special|spéciale|seance speciale|séance spéciale)/.test(specialMarkers)) {
    return true;
  }

  const releaseDate = getCatalogueReleaseDate(film);
  if (releaseDate) {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - CATALOGUE_RECENT_MONTHS_LIMIT);
    return releaseDate <= limit;
  }

  const year = getCatalogueReleaseYear(film);
  if (!Number.isFinite(year)) return true;
  return year < new Date().getFullYear();
}


function getCatalogueReferenceSource() {
  const runtimeActive = Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) && window.CINEPRO_ACTIVE_CATALOGUE.length
    ? window.CINEPRO_ACTIVE_CATALOGUE
    : [];
  if (runtimeActive.length) return { source: runtimeActive, label: 'active-runtime' };

  const storedActive = readStoredActiveCatalogue();
  if (storedActive.length) return { source: storedActive, label: 'active-cache' };

  return { source: [], label: 'none' };
}

function createCatalogueFilterStats(source, reference) {
  const referenceSource = Array.isArray(reference?.source) && reference.source.length ? reference.source : source;
  const sourceTotal = Array.isArray(referenceSource) ? referenceSource.filter(f => f && !f.isMock).length : 0;
  const stats = {
    sourceTotal,
    kept: 0,
    displayed: 0,
    excludedRecent: 0,
    unknownYearKept: 0,
    referenceSource: reference?.label || 'active-source'
  };

  referenceSource.forEach(film => {
    if (!film || film.isMock) return;
    const year = getCatalogueReleaseYear(film);
    if (!Number.isFinite(year)) stats.unknownYearKept++;
  });

  return stats;
}

function getCatalogueSource() {
  const active = getActiveRawCatalogueSource();
  const source = active.source;
  const reference = getCatalogueReferenceSource();
  const stats = createCatalogueFilterStats(source, reference);
  const seen = new Set();
  const merged = [];

  source.forEach((film, index) => {
    if (!film || film.isMock) return;
    const prepared = prepareCatalogueFilm(film, index);

    const key = prepared.tmdbId ? `tmdb:${prepared.tmdbId}` : normalizeRuntimeCatalogueKey(prepared.titre || prepared.original || prepared.id);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(prepared);
  });

  stats.kept = merged.length;
  stats.displayed = merged.length;
  lastCatalogueFilterStats = stats;
  window.CINEPRO_CATALOGUE_FILTER_STATS = stats;

  if (isCatalogueDebugEnabled()) {
    console.log(`[Catalogue] ZIP 5.0.1 : ${active.label} utilisé (${stats.kept}/${stats.sourceTotal} films proches gardés, ${stats.unknownYearKept} années inconnues, référence ${stats.referenceSource}).`);
  }
  return merged;
}

function updateCatalogueModeControl() {
  const select = document.getElementById('catalogue-mode-filter');
  if (!select) return;
  catalogueMode = 'nearby';
  setStoredCatalogueMode('nearby');
  select.value = 'nearby';
  const nearbyOption = select.querySelector('option[value="nearby"]');
  if (nearbyOption) {
    const count = (Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) && window.CINEPRO_ACTIVE_CATALOGUE.length)
      ? window.CINEPRO_ACTIVE_CATALOGUE.length
      : readStoredActiveCatalogue().length;
    const stats = window.CINEPRO_CATALOGUE_FILTER_STATS || lastCatalogueFilterStats;
    nearbyOption.textContent = count ? `Films proches — ${count}` : 'Films proches — lance une recherche';
  }
}

function setCatalogueMode(_mode) {
  // Le menu Catalogue reste centré sur : “Quels bons films passent près de moi ?”.
  catalogueMode = 'nearby';
  setStoredCatalogueMode('nearby');
  sortKey = 'bestNote';
  sortDir = -1;
  currentPage = 1;
  refreshCatalogueFromRuntime();
}
window.setCatalogueMode = setCatalogueMode;

function getCatalogueSelectedRadius() {
  const select = document.getElementById('radius-filter');
  const raw = select?.value || select?.selectedOptions?.[0]?.textContent || '15';
  const km = Number(String(raw).match(/\d+/)?.[0] || 15);
  return Math.max(1000, km * 1000);
}

function setCatalogueSearchStatus(message, type = 'info') {
  const status = document.getElementById('catalogue-search-status');
  if (!status) return;
  const clean = String(message || '').trim();
  status.textContent = clean;
  status.hidden = !clean;
  status.className = 'catalogue-search-status';
  if (clean) status.classList.add(`is-${type}`);
}

function clearCatalogueSearchStatus() {
  setCatalogueSearchStatus('');
}

function rememberStableCatalogue(meta = {}) {
  if (Array.isArray(catalogue) && catalogue.length) {
    lastStableCatalogueSnapshot = catalogue.slice();
    lastStableCatalogueMeta = { ...meta, count: catalogue.length, savedAt: new Date().toISOString() };
  }
}

function restoreStableCatalogueIfPossible(message = '') {
  if (!Array.isArray(lastStableCatalogueSnapshot) || !lastStableCatalogueSnapshot.length) return false;
  catalogue = lastStableCatalogueSnapshot.slice();
  currentPage = 1;
  filterTable();
  if (message) setCatalogueSearchStatus(message, 'warning');
  return true;
}

function formatCatalogueSearchSummary(address, radius, filmsCount) {
  const radiusKm = Math.round(Number(radius || getCatalogueSelectedRadius()) / 1000);
  const stats = window.NEARBY_CATALOGUE_STATS || {};
  const extraction = stats.extraction || {};
  const cinemasFound = Number(extraction.cinemasFound || stats.cinemasFound || 0);
  const cinemasAnalysed = Number(extraction.cinemasAnalysed || stats.cinemasAnalysed || 0);
  const parts = [`${filmsCount} film${filmsCount > 1 ? 's' : ''} proche${filmsCount > 1 ? 's' : ''}`];
  if (address) parts.push(`près de ${address}`);
  parts.push(`rayon ${radiusKm} km`);
  if (cinemasFound || cinemasAnalysed) {
    parts.push(`${cinemasAnalysed || cinemasFound}/${cinemasFound || cinemasAnalysed} cinéma${(cinemasFound || cinemasAnalysed) > 1 ? 's' : ''} analysé${(cinemasAnalysed || cinemasFound) > 1 ? 's' : ''}`);
  }
  return `Recherche terminée : ${parts.join(' · ')}.`;
}

function writeLastNearbySearch(payload = {}) {
  const clean = {
    query: String(payload.query || payload.address || '').trim(),
    address: String(payload.address || payload.query || '').trim(),
    location: payload.location && Number.isFinite(Number(payload.location.lat)) && Number.isFinite(Number(payload.location.lng))
      ? { lat: Number(payload.location.lat), lng: Number(payload.location.lng) }
      : null,
    radius: Number(payload.radius || 0) || getCatalogueSelectedRadius(),
    lookaheadDays: Number(payload.lookaheadDays || CATALOGUE_LOOKAHEAD_DAYS) || CATALOGUE_LOOKAHEAD_DAYS,
    requestId: payload.requestId || null,
    updatedAt: new Date().toISOString(),
    searchDate: new Date().toISOString().slice(0, 10)
  };
  try {
    if (CINEPRO_STORAGE?.writeJSON) {
      CINEPRO_STORAGE.writeJSON(STORAGE_KEYS.LAST_NEARBY_SEARCH, clean);
      return clean;
    }
    localStorage.setItem(STORAGE_KEYS.LAST_NEARBY_SEARCH, JSON.stringify(clean));
  } catch (_) {}
  return clean;
}

function waitForCatalogueSearchServices(timeout = 12000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const placesReady = Boolean(window.PLACES && window.PLACES.geocoder && window.PLACES.placesService);
      const catalogueReady = typeof window.getNearbyRankedMovies === 'function' || typeof getNearbyRankedMovies === 'function';
      if (placesReady && catalogueReady) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        reject(new Error('Google Maps/Places ou le catalogue proche ne sont pas encore prêts.'));
        return;
      }
      setTimeout(check, 250);
    };
    check();
  });
}

function getNearbyRankedMoviesSafe() {
  if (typeof window.getNearbyRankedMovies === 'function') return window.getNearbyRankedMovies;
  if (typeof getNearbyRankedMovies === 'function') return getNearbyRankedMovies;
  return null;
}

function isCatalogueSearchCurrent(searchId) {
  return Number(searchId) === Number(activeCatalogueSearchId);
}

function setCatalogueSearchButtonLoading(isLoading) {
  const button = document.getElementById('catalogue-search-btn');
  if (!button) return;
  button.disabled = Boolean(isLoading);
  button.innerHTML = isLoading
    ? '<i class="ti ti-loader"></i><span>Recherche…</span>'
    : '<i class="ti ti-search"></i><span>Rechercher</span>';
}

function getCatalogueTypedAddress() {
  const input = document.getElementById('search-input');
  return String(input?.value || '').trim();
}

async function runCatalogueLocationSearch(target = {}) {
  const searchId = ++activeCatalogueSearchId;
  window.CINEPRO_ACTIVE_CATALOGUE_REQUEST_ID = searchId;

  const radius = getCatalogueSelectedRadius();
  const input = document.getElementById('search-input');
  const typedAddress = getCatalogueTypedAddress();
  const address = String(target.address || typedAddress || '').trim();
  const location = address
    ? null
    : (target.location && Number.isFinite(Number(target.location.lat)) && Number.isFinite(Number(target.location.lng))
      ? { lat: Number(target.location.lat), lng: Number(target.location.lng) }
      : null);
  if (!address && !location) {
    setCatalogueSearchStatus('Entrez une ville ou autorisez votre position pour lancer une recherche.', 'warning');
    return false;
  }

  rememberStableCatalogue({ reason: 'before-new-search', address, radius });
  catalogueSearchRunning = true;
  setCatalogueSearchButtonLoading(true);
  lastCatalogueSearchTarget = { address, location };
  if (input && address) input.value = address;

  const pendingSearch = { address, location, radius, lookaheadDays: CATALOGUE_LOOKAHEAD_DAYS, requestId: searchId };
  const targetLabel = address || 'votre position';
  const radiusKm = Math.round(radius / 1000);
  setCatalogueSearchStatus(`Recherche en cours près de ${targetLabel} — rayon ${radiusKm} km. Les résultats actuels restent affichés pendant le chargement.`, 'loading');

  try {
    await waitForCatalogueSearchServices();
    if (!isCatalogueSearchCurrent(searchId)) return false;

    const searchFn = getNearbyRankedMoviesSafe();
    if (!searchFn) throw new Error('Recherche catalogue indisponible.');

    const options = location
      ? { location, radius, lookaheadDays: CATALOGUE_LOOKAHEAD_DAYS, requestId: searchId }
      : { address, radius, lookaheadDays: CATALOGUE_LOOKAHEAD_DAYS, requestId: searchId };

    const ranked = await searchFn(options);
    if (!isCatalogueSearchCurrent(searchId)) return false;

    const returnedCount = Array.isArray(ranked) ? ranked.length : 0;
    if (!returnedCount) {
      const restored = restoreStableCatalogueIfPossible(`Aucun nouveau film exploitable trouvé près de ${targetLabel}. Les anciens résultats sont conservés pour éviter un écran vide.`);
      if (!restored) {
        catalogue = [];
        currentPage = 1;
        filterTable();
        setCatalogueSearchStatus(`Aucun film proche trouvé près de ${targetLabel} pour ce rayon.`, 'warning');
      }
      return false;
    }

    writeLastNearbySearch(pendingSearch);
    catalogue = getCatalogueSource();
    sortKey = 'bestNote';
    sortDir = -1;
    currentPage = 1;
    filterTable();
    rememberStableCatalogue({ reason: 'successful-search', address, radius });
    setCatalogueSearchStatus(formatCatalogueSearchSummary(address, radius, catalogue.length), 'success');
    return true;
  } catch (error) {
    if (!isCatalogueSearchCurrent(searchId)) return false;
    console.warn('[Catalogue] Phase 2 : recherche autonome impossible :', error?.message || error);
    const targetLabel = address || 'votre position';
    const restored = restoreStableCatalogueIfPossible(`Recherche impossible près de ${targetLabel}. Les anciens résultats sont conservés.`);
    if (!restored) {
      setCatalogueSearchStatus('Recherche impossible. Autorisez la position ou entrez une ville pour voir les films proches des prochains jours.', 'error');
    }
    return false;
  } finally {
    if (isCatalogueSearchCurrent(searchId)) {
      catalogueSearchRunning = false;
      setCatalogueSearchButtonLoading(false);
    }
  }
}

function scheduleCatalogueLocationSearch() {
  // Phase 2 : la saisie met seulement à jour la cible.
  // La vraie recherche part avec le bouton Rechercher ou la touche Entrée.
  const address = getCatalogueTypedAddress();
  if (address) lastCatalogueSearchTarget = { address, location: null };
  window.clearTimeout(catalogueLocationSearchTimer);
}

function submitCatalogueLocationSearch() {
  const address = getCatalogueTypedAddress();
  if (address.length >= 3) {
    lastCatalogueSearchTarget = { address, location: null };
    return runCatalogueLocationSearch({ address });
  }

  const restored = lastCatalogueSearchTarget || hydrateCatalogueSearchTargetFromStorage();
  if (restored?.address || restored?.location) {
    return runCatalogueLocationSearch(restored);
  }

  if (navigator.geolocation) {
    setCatalogueSearchStatus('Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        lastCatalogueSearchTarget = { address: '', location };
        runCatalogueLocationSearch({ location });
      },
      () => {
        setCatalogueSearchStatus('Entrez une ville ou autorisez la position pour lancer une recherche.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
    return true;
  }

  setCatalogueSearchStatus('Entrez une ville pour lancer une recherche.');
  return false;
}
window.submitCatalogueLocationSearch = submitCatalogueLocationSearch;

function handleCatalogueSearchKey(event) {
  if (event?.key === 'Enter') {
    event.preventDefault();
    submitCatalogueLocationSearch();
  }
}
window.handleCatalogueSearchKey = handleCatalogueSearchKey;

function handleCatalogueRadiusChange() {
  const radiusKm = Math.round(getCatalogueSelectedRadius() / 1000);
  const address = getCatalogueTypedAddress();
  if (address.length >= 3) {
    lastCatalogueSearchTarget = { address, location: null };
    setCatalogueSearchStatus(`Rayon ${radiusKm} km sélectionné. Cliquez sur Rechercher pour actualiser le Catalogue.`);
    return;
  }

  const restored = lastCatalogueSearchTarget || hydrateCatalogueSearchTargetFromStorage();
  if (restored?.address || restored?.location) {
    lastCatalogueSearchTarget = restored;
    setCatalogueSearchStatus(`Rayon ${radiusKm} km sélectionné. Cliquez sur Rechercher pour actualiser le Catalogue.`);
    return;
  }

  setCatalogueSearchStatus('Rayon sélectionné. Entrez une ville ou autorisez la position pour lancer une recherche.');
}
window.handleCatalogueRadiusChange = handleCatalogueRadiusChange;

function startCatalogueAutonomousSearch() {
  if (catalogueAutoSearchStarted) return;
  catalogueAutoSearchStarted = true;
  if (!navigator.geolocation) {
    setCatalogueSearchStatus('Autorisez votre position ou entrez une ville pour afficher les films proches des prochains jours.');
    return;
  }
  setCatalogueSearchStatus('Autorisez votre position pour afficher les films proches des prochains jours…');
  navigator.geolocation.getCurrentPosition(
    position => {
      runCatalogueLocationSearch({
        location: { lat: position.coords.latitude, lng: position.coords.longitude }
      });
    },
    () => {
      setCatalogueSearchStatus('Position refusée. Entrez une ville pour afficher les films proches des prochains jours.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

function refreshCatalogueFromRuntime() {
  updateCatalogueModeControl();
  const nextCatalogue = getCatalogueSource();
  if ((!Array.isArray(nextCatalogue) || !nextCatalogue.length) && catalogueSearchRunning && Array.isArray(catalogue) && catalogue.length) {
    // Pendant une recherche, on ne remplace pas une liste visible par un écran vide.
    return;
  }
  catalogue = nextCatalogue;
  currentPage = 1;
  filterTable();
  rememberStableCatalogue({ reason: 'runtime-refresh' });
}


function decadeMatch(annee, f) {
  if (!f || !annee) return true;
  if (f === 'Années 2020') return annee >= 2020;
  if (f === 'Années 2010') return annee >= 2010 && annee < 2020;
  if (f === 'Années 2000') return annee >= 2000 && annee < 2010;
  if (f === 'Années 1990') return annee >= 1990 && annee < 2000;
  if (f === 'Avant 1990') return annee < 1990;
  return true;
}

function formatImdbNote(film) {
  if (film.isMock) return '—';
  return formatClassicRating(film.imdb, ' ★');
}

function getSortValue(film, key) {
  if (key === 'bestNote') return getBestNote(film);
  if (isNearbyModeActive()) {
    if (key === 'lb') return getBestNote(film);
    if (key === 'imdb') return getNearbyRatingSource(film);
    if (key === 'sc') return getNearbyCinemaLabel(film);
  }
  if (key === 'imdb' && (film.isMock || normalizePositiveRating(film.imdb) === null)) return null;
  if (key === 'lbRank') return film.lbRank ?? null;
  return film[key] ?? null;
}

function compareValues(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' });
  }

  return a > b ? 1 : a < b ? -1 : 0;
}

function renderTable(data) {
  lastFilteredData = data;
  const renderer = window.CINEPRO_CATALOGUE_RENDER;
  if (!renderer || typeof renderer.renderTable !== 'function') {
    console.error('[Catalogue] Renderer catalogue manquant : js/catalogue-render.js');
    return;
  }

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  renderer.renderTable({
    data,
    currentPage,
    pageSize,
    catalogueMode,
    lookaheadDays: CATALOGUE_LOOKAHEAD_DAYS,
    preserveCountLabels: true,
    nearbyMode: isNearbyModeActive(),
    favs,
    formatNearbyBestNote,
    getNearbyRatingSource,
    getNearbyCinemaLabel,
    getNearbyNextShowtimeLabel,
    formatClassicRating,
    formatImdbNote
  });

  scheduleVisibleCatalogueEnrichment();
}

function changePage(page) {
  currentPage = page;
  renderTable(lastFilteredData);
}

function changePageSize(value) {
  pageSize = Number(value) || 8;
  currentPage = 1;
  filterTable();
}

function updateIcons() {
  ['titre','real','lb','imdb','sc','annee'].forEach(k => {
    const el = document.getElementById('icon-' + k);
    if (!el) return;
    el.className = k === sortKey ? (sortDir === -1 ? 'ti ti-chevron-down' : 'ti ti-chevron-up') : 'ti ti-selector';
  });
}

function filterTable() {
  const q = '';
  const g = document.getElementById('genre-filter').value;
  const d = document.getElementById('decade-filter').value;

  let data = catalogue.filter(f =>
    (!q || String(f.titre || '').toLowerCase().includes(q) || String(f.real || '').toLowerCase().includes(q) || String(f.original || '').toLowerCase().includes(q)) &&
    (!g || String(f.genre || '').toLowerCase().includes(g.toLowerCase())) &&
    decadeMatch(f.annee, d)
  );

  if (catalogueMode === 'nearby' && sortKey === 'imdb') sortKey = 'bestNote';

  data.sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    return compareValues(va, vb) * sortDir;
  });

  const stats = window.CINEPRO_CATALOGUE_FILTER_STATS || lastCatalogueFilterStats;
  stats.displayed = data.length;
  window.CINEPRO_CATALOGUE_FILTER_STATS = stats;

  const countLabel = document.getElementById('count-label');
  const filmCount = document.getElementById('film-count');
  const total = Number(stats?.sourceTotal || 0);

  const label = `${data.length} film${data.length > 1 ? 's' : ''} proche${data.length > 1 ? 's' : ''}`;
  const detailLabel = total && total !== data.length
    ? `${label} · ${total} films proches trouvés avant filtres`
    : label;

  if (countLabel) {
    countLabel.textContent = label;
    countLabel.title = detailLabel;
  }
  if (filmCount) {
    filmCount.textContent = label;
    filmCount.title = detailLabel;
  }

  renderTable(data);
  updateIcons();
}

function sortTable(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = -1; }
  currentPage = 1;
  filterTable();
}

function toggleFav(id, btn) {
  id = String(id);
  if (favs.has(id)) { favs.delete(id); btn.classList.remove('active'); }
  else { favs.add(id); btn.classList.add('active'); }
  writeCatalogueFavorites([...favs]);
}



function slugToTitle(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function makeLetterboxdFilm(film, index) {
  const title = film.title || film.titre || slugToTitle(film.letterboxdSlug) || 'Film Letterboxd';
  return {
    id: 900000 + (Number(film.rank) || index + 1),
    titre: title,
    original: '',
    genre: 'Letterboxd',
    duree: '—',
    real: 'Non renseigné',
    acteurs: 'Non renseigné',
    synopsis: `Film importé depuis l’API Letterboxd locale. Rang Letterboxd : #${film.rank || index + 1}.`,
    color: ['p1','p2','p3','p4','p5','p6'][index % 6],
    badge: 'Letterboxd',
    lbRank: Number(film.rank) || index + 1,
    lb: Number.isFinite(Number(film.letterboxdRating)) ? Number(film.letterboxdRating) : null,
    imdb: null,
    sc: null,
    annee: null,
    cinemas: [],
    letterboxdUrl: film.letterboxdUrl || (film.letterboxdSlug ? `https://letterboxd.com/film/${film.letterboxdSlug}/` : null),
    sourceType: film.sourceType || 'api-letterboxd',
    isApiFilm: true,
    isMock: false
  };
}

function normalizeFilmKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(the|le|la|les|l')\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function applyLetterboxdRatings(apiFilms) {
  if (!Array.isArray(apiFilms) || !apiFilms.length) return 0;

  let updated = 0;
  for (const film of catalogue) {
    const keys = [film.titre, film.original].map(normalizeFilmKey).filter(Boolean);
    const match = apiFilms.find(apiFilm => {
      const apiKeys = [apiFilm.title, apiFilm.titre, apiFilm.original, apiFilm.letterboxdSlug]
        .map(normalizeFilmKey)
        .filter(Boolean);
      return keys.some(key => apiKeys.includes(key));
    });

    const rating = Number(match?.letterboxdRating ?? match?.lb ?? match?.rating);
    // Sécurité importante : Letterboxd ne doit JAMAIS remplacer une vraie note
    // par null, 0 ou une donnée invalide. Si le scrape rate, on garde data.js.
    if (Number.isFinite(rating) && rating >= LETTERBOXD_MIN_VALID_RATING) {
      film.lb = Math.round(rating * 10) / 10;
      updated++;
    }
  }
  return updated;
}

function needsCatalogueTmdbRefresh(film) {
  if (!film || film.isApiFilm || film.isMock) return false;

  const hasReal = isUsefulCatalogueText(film.real) || isUsefulCatalogueText(film.realisateur) || isUsefulCatalogueText(film.director);
  const hasGenre = isUsefulCatalogueText(film.genre) || (Array.isArray(film.genres) && film.genres.length > 0);
  const hasPoster = isUsefulCatalogueText(film.poster) || isUsefulCatalogueText(film.affiche);

  // ZIP 3.8.6 : on évite de refaire TMDB/OMDb sur les films déjà complets.
  // Le chargement long venait surtout d'appels API relancés sur tout le catalogue.
  return !hasReal || !hasGenre || !hasPoster;
}

function getVisibleCatalogueRows() {
  const start = (currentPage - 1) * pageSize;
  return lastFilteredData.slice(start, start + pageSize);
}

let catalogueBackgroundEnrichmentRunning = false;
async function enrichCatalogueInBackground() {
  if (catalogueBackgroundEnrichmentRunning || typeof enrichFilmsWithOmdb !== 'function') return;

  // ZIP 3.9.4 : on enrichit uniquement les films visibles sur la page.
  // Avant, le catalogue pouvait relancer TMDB/OMDb sur 20+ films d'un coup,
  // ce qui donnait une attente ressentie de 1 à 2 minutes.
  const visibleRows = getVisibleCatalogueRows();
  const candidates = visibleRows.filter(needsCatalogueTmdbRefresh).slice(0, pageSize);
  if (!candidates.length) return;

  catalogueBackgroundEnrichmentRunning = true;
  const countLabel = document.getElementById('film-count');

  try {
    if (countLabel) countLabel.textContent = `${catalogue.length} films proches · infos visibles…`;

    await enrichFilmsWithOmdb(candidates, (done, total) => {
      if (done === total) filterTable();
      if (countLabel) countLabel.textContent = `${catalogue.length} films proches · infos visibles ${done}/${total}`;
    });

    writeActiveCatalogueFromFilms(catalogue, { source: 'tmdb-visible-background-refresh' });
    filterTable();
  } catch (error) {
    console.warn('[Catalogue] ZIP 4.0 : enrichissement visible TMDB ignoré :', error?.message || error);
  } finally {
    catalogueBackgroundEnrichmentRunning = false;
    updateCatalogueModeControl();
  }
}

function scheduleVisibleCatalogueEnrichment() {
  window.clearTimeout(window.__cineproVisibleCatalogueEnrichmentTimer);
  window.__cineproVisibleCatalogueEnrichmentTimer = window.setTimeout(() => {
    enrichCatalogueInBackground();
  }, 150);
}

async function loadLetterboxdCatalogue() {
  const countLabel = document.getElementById('film-count');
  if (countLabel) countLabel.textContent = 'Chargement Letterboxd…';

  // Important : Letterboxd ne sert maintenant qu'à mettre à jour les notes.
  // On garde toujours le catalogue local pour les affiches, synopsis, réalisateurs et genres.
  catalogue = getCatalogueSource();

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);
    const response = await fetch(LETTERBOXD_API_URL, { cache: 'no-store', signal: controller.signal });
    window.clearTimeout(timeout);
    if (!response.ok) throw new Error('API indisponible');

    const payload = await response.json();
    const apiFilms = Array.isArray(payload.films) ? payload.films : [];
    const updated = applyLetterboxdRatings(apiFilms);
    if (isCatalogueDebugEnabled()) console.log(`[Catalogue] ZIP 4.0 : notes Letterboxd mises à jour (${updated}).`);
    return true;
  } catch (error) {
    if (isCatalogueDebugEnabled()) console.info('[Catalogue] API Letterboxd locale indisponible, catalogue statique utilisé.');
    return false;
  }
}

function openCatalogueFilmPopup(id) {
  const wantedId = String(id);
  const film = catalogue.find(f => String(f.id) === wantedId) || FILMS.find(f => String(f.id) === wantedId);
  if (!film) return;

  if (typeof buildPopupHTML === 'function') {
    const popup = document.getElementById('film-popup');
    const overlay = document.getElementById('film-overlay');
    if (!popup || !overlay) return;
    popup.innerHTML = buildPopupHTML(film);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // ZIP 3.4 : même priorité synopsis que le Catalogue classique.
    // On garde l'affichage instantané, puis on remplace par le cache IMDb FR si disponible.
    if (typeof loadCachedSynopsisForCatalogue === 'function' && typeof setCataloguePopupSynopsis === 'function') {
      loadCachedSynopsisForCatalogue(film).then((synopsis) => {
        setCataloguePopupSynopsis(popup, synopsis || film.synopsis || film.overview || 'Aucun synopsis disponible pour ce film.');
      });
    }
    return;
  }

  openFilmPopup(id);
}



function readLastNearbySearch() {
  try {
    if (CINEPRO_STORAGE?.readLastNearbySearch) return CINEPRO_STORAGE.readLastNearbySearch();
    const payload = readStorageJson(STORAGE_KEYS.LAST_NEARBY_SEARCH, null);
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

let nearbyAutoBuildRunning = false;
async function autoBuildNearbyCatalogueFromLastSearch() {
  if (hasNearbyCatalogue() || nearbyAutoBuildRunning || catalogueSearchRunning) return true;
  // ZIP 3.8.1 : avant de reconstruire, on nettoie les caches périmés.
  try {
    removeStorageItem(RUNTIME_CATALOGUE_KEY);
    removeStorageItem(NEARBY_RANKED_KEY);
    removeStorageItem(ACTIVE_CATALOGUE_KEY);
  } catch (_) {}
  const lastSearch = readLastNearbySearch();
  if (!lastSearch) return false;
  if (typeof getNearbyRankedMovies !== 'function' || !window.PLACES) return false;

  nearbyAutoBuildRunning = true;
  try {
    if (isCatalogueDebugEnabled()) console.log('[Catalogue] ZIP 4.0 : génération automatique du catalogue proche depuis la dernière recherche.', lastSearch);
    const searchId = ++activeCatalogueSearchId;
    window.CINEPRO_ACTIVE_CATALOGUE_REQUEST_ID = searchId;
    await getNearbyRankedMovies({
      address: lastSearch.address || lastSearch.query || '',
      location: lastSearch.location || null,
      radius: Number(lastSearch.radius) || 15000,
      requestId: searchId
    });
    if (!isCatalogueSearchCurrent(searchId)) return false;
    catalogue = getCatalogueSource();
    sortKey = 'bestNote';
    sortDir = -1;
    currentPage = 1;
    filterTable();
    return true;
  } catch (error) {
    console.warn('[Catalogue] ZIP 4.0 : génération automatique impossible pour le moment :', error?.message || error);
    return false;
  } finally {
    nearbyAutoBuildRunning = false;
  }
}

function scheduleNearbyCatalogueAutoBuild() {
  let tries = 0;
  const timer = setInterval(async () => {
    tries += 1;
    if (hasNearbyCatalogue()) {
      clearInterval(timer);
      return;
    }
    const done = await autoBuildNearbyCatalogueFromLastSearch();
    if (done || tries >= 10) clearInterval(timer);
  }, 900);
}

function isActiveCatalogueEventCurrent(payload = {}) {
  const requestId = Number(payload?.requestId || 0);
  if (requestId && !isCatalogueSearchCurrent(requestId)) return false;
  return true;
}

window.addEventListener('nearby-catalogue-runtime-ready', (event) => {
  if (!isActiveCatalogueEventCurrent(event?.detail)) return;
  refreshCatalogueFromRuntime();
});

window.addEventListener('nearby-catalogue-ranked-ready', (event) => {
  if (!isActiveCatalogueEventCurrent(event?.detail)) return;
  if (Array.isArray(event?.detail?.films) && event.detail.films.length) {
    writeActiveCatalogueFromFilms(event.detail.films, {
      source: 'nearby-ranked-promoted-to-active',
      address: event.detail.address || '',
      radius: event.detail.radius || null,
      requestId: event.detail.requestId || null
    });
  }
  catalogue = getCatalogueSource();
  sortKey = 'bestNote';
  sortDir = -1;
  currentPage = 1;
  filterTable();
});

window.addEventListener('cinepro-active-catalogue-ready', (event) => {
  if (!isActiveCatalogueEventCurrent(event?.detail)) return;
  if (Array.isArray(event?.detail?.films) && event.detail.films.length) {
    window.CINEPRO_ACTIVE_CATALOGUE = event.detail.films;
  }
  catalogueMode = 'nearby';
  setStoredCatalogueMode('nearby');
  catalogue = getCatalogueSource();
  sortKey = 'bestNote';
  sortDir = -1;
  currentPage = 1;
  filterTable();
});

async function initCatalogue() {
  // ZIP 5.0.3 : on réhydrate la dernière recherche pour que le changement de rayon
  // puisse relancer une vraie recherche même si la page s'ouvre d'abord sur le cache.
  hydrateCatalogueSearchTargetFromStorage();

  // Phase 2 v2 : on ne lance plus de grosse recherche automatique au chargement.
  // L'utilisateur valide avec Rechercher ou Entrée ; le cache actif reste affiché si disponible.
  updateCatalogueModeControl();
  catalogue = getCatalogueSource();
  sortKey = 'bestNote'; sortDir = -1;
  filterTable();
  rememberStableCatalogue({ reason: 'initial-load' });
  if (!catalogue.length) {
    setCatalogueSearchStatus('Entrez une ville puis cliquez sur Rechercher pour afficher les films proches.', 'info');
  }

  // 2) Letterboxd ne bloque plus l'ouverture du catalogue.
  // Si l'API locale n'est pas lancée, on garde le catalogue proche tel quel.
  loadLetterboxdCatalogue()
    .then(() => filterTable())
    .catch((error) => console.warn('Letterboxd ignoré, catalogue local conservé :', error?.message || error));

  // 3) ZIP 3.9.4 : l'enrichissement TMDB/OMDb est déclenché par renderTable()
  // uniquement sur les films visibles de la page courante.
}

initCatalogue();
