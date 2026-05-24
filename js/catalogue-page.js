// ZIP 3.9.6 — Audit et simplification du catalogue.
// Rôle : orchestrer l’affichage du catalogue proche uniquement.
// Les accès localStorage passent maintenant par js/storage.js quand il est disponible.
// Important : ce fichier ne doit pas relancer toute la logique cinéma ; il consomme les données produites par nearby-catalogue.js.

// ZIP 3.4 — Catalogue centré sur les films proches : un seul mode, données enrichies conservées.
// Sécurité : si aucun résultat proche n'existe, on garde le catalogue enrichi ZIP 3.0 puis js/data.js.
const STATIC_CATALOGUE = FILMS.filter(f => f && !f.isMock);
let catalogue = [];
let catalogueMode = 'nearby';
const LETTERBOXD_API_URL = 'http://localhost:3000/api/films-letterboxd';
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
let lastFilteredData = [];

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
  return !['a completer', 'non renseigne', 'non renseignee', '-', '—', 'n/a'].includes(normalized);
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
  const acceptedVersions = new Set(['3.7.3', '3.7.4', '3.8.1', '3.8.3', '3.8.4', '3.8.5', '3.8.6', '3.9.2', '3.9.4', '3.9.6']);
  if (payload.version && !acceptedVersions.has(String(payload.version))) return false;
  if (!Array.isArray(payload.films) || !payload.films.length) return false;
  const stamp = payload.searchDate || payload.updatedAt || payload.createdAt;
  if (getLocalDateKey(stamp) !== getLocalDateKey(new Date())) return false;

  // ZIP 3.9.6 : si l'utilisateur refait la recherche avec un autre rayon,
  // on ne doit pas réutiliser un ancien catalogue 15 km pour une recherche 50 km.
  const lastSearch = readLastNearbySearch();
  if (lastSearch) {
    const wantedRadius = Number(lastSearch.radius || 0);
    const payloadRadius = Number(payload.radius || 0);
    if (wantedRadius && payloadRadius && Math.abs(wantedRadius - payloadRadius) > 50) return false;

    const wantedAddress = normalizeRuntimeCatalogueKey(lastSearch.address || lastSearch.query || '');
    const payloadAddress = normalizeRuntimeCatalogueKey(payload.address || payload.query || '');
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
  const payload = {
    version: '3.9.6',
    source: 'active-nearby-catalogue',
    searchDate: getLocalDateKey(now),
    updatedAt: now.toISOString(),
    address: meta.address || '',
    radius: meta.radius || null,
    films,
    stats: { total: films.length }
  };
  try {
    writeStorageJson(ACTIVE_CATALOGUE_KEY, payload);
    window.CINEPRO_ACTIVE_CATALOGUE = films;
  } catch (error) {
    console.warn('[Catalogue] ZIP 3.9.6 : sauvegarde cinepro_active_catalogue impossible :', error?.message || error);
  }
  return payload;
}

function hasNearbyCatalogue() {
  return (Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) && window.CINEPRO_ACTIVE_CATALOGUE.length)
    || (Array.isArray(window.NEARBY_CATALOGUE_NEARBY_RANKED) && window.NEARBY_CATALOGUE_NEARBY_RANKED.length)
    || readStoredActiveCatalogue().length
    || readStoredNearbyCatalogue().length;
}

function getActiveRawCatalogueSource() {
  // ZIP 3.4 : le Catalogue est centré sur les films proches.
  // On utilise toujours en priorité la liste complète enrichie des films proches,
  // afin de ne jamais perdre réalisateur, genre, affiche, année ou note après un changement de filtre.
  const active = Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) && window.CINEPRO_ACTIVE_CATALOGUE.length
    ? window.CINEPRO_ACTIVE_CATALOGUE
    : readStoredActiveCatalogue();

  const nearby = Array.isArray(window.NEARBY_CATALOGUE_NEARBY_RANKED) && window.NEARBY_CATALOGUE_NEARBY_RANKED.length
    ? window.NEARBY_CATALOGUE_NEARBY_RANKED
    : readStoredNearbyCatalogue();

  const runtime = Array.isArray(window.NEARBY_CATALOGUE_RUNTIME_DATA) && window.NEARBY_CATALOGUE_RUNTIME_DATA.length
    ? window.NEARBY_CATALOGUE_RUNTIME_DATA
    : readStoredRuntimeCatalogue();

  if (active.length) {
    catalogueMode = 'nearby';
    setStoredCatalogueMode('nearby');
    return { source: active, label: 'catalogue proche actif' };
  }

  if (nearby.length) {
    writeActiveCatalogueFromFilms(nearby);
    catalogueMode = 'nearby';
    setStoredCatalogueMode('nearby');
    return { source: nearby, label: 'films proches classés' };
  }
  // ZIP 3.8.1 : en mode films proches, on ne retombe plus sur les 80 films classiques.
  // Tant que la recherche proche n'a pas produit cinepro_active_catalogue, on affiche un état d'attente.
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
  const cinemas = Array.isArray(film.nearbyCinemas) && film.nearbyCinemas.length ? film.nearbyCinemas : (Array.isArray(film.cinemas) ? film.cinemas : []);
  return cinemas.map(c => c?.nom || c?.name || '').filter(Boolean).slice(0, 2).join(', ') || 'cinéma proche';
}

function formatNearbyBestNote(film) {
  const rating = getBestNote(film);
  return rating !== null ? rating.toFixed(1) : '—';
}

function formatClassicRating(value, suffix = '') {
  const rating = normalizePositiveRating(value);
  return rating !== null ? `${rating.toFixed(1)}${suffix}` : '—';
}

function getCatalogueSource() {
  const active = getActiveRawCatalogueSource();
  const source = active.source;
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

  if (isCatalogueDebugEnabled()) {
    console.log(`[Catalogue] ZIP 3.9.6 : ${active.label} utilisé (${merged.length} films).`);
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
      : (readStoredActiveCatalogue().length || ((Array.isArray(window.NEARBY_CATALOGUE_NEARBY_RANKED) && window.NEARBY_CATALOGUE_NEARBY_RANKED.length)
        ? window.NEARBY_CATALOGUE_NEARBY_RANKED.length
        : readStoredNearbyCatalogue().length));
    nearbyOption.textContent = count ? `Films proches classés — ${count} films` : 'Films proches classés — lance une recherche';
  }
}

function setCatalogueMode(_mode) {
  // ZIP 3.4 : on supprime le mode “Tous les films” du parcours utilisateur.
  // Le menu Catalogue doit répondre à : “Quels bons films passent près de moi ?”.
  catalogueMode = 'nearby';
  setStoredCatalogueMode('nearby');
  sortKey = 'bestNote';
  sortDir = -1;
  currentPage = 1;
  refreshCatalogueFromRuntime();
}
window.setCatalogueMode = setCatalogueMode;

function refreshCatalogueFromRuntime() {
  updateCatalogueModeControl();
  catalogue = getCatalogueSource();
  refreshCinemaFilterOptions();
  currentPage = 1;
  filterTable();
}

window.addEventListener('nearby-catalogue-runtime-ready', () => {
  refreshCatalogueFromRuntime();
});

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

function getCatalogueCinemas(film) {
  const cinemas = Array.isArray(film?.nearbyCinemas) ? film.nearbyCinemas : (Array.isArray(film?.cinemas) ? film.cinemas : []);
  return cinemas.filter(Boolean);
}

function getCatalogueDistance(film) {
  const distances = getCatalogueCinemas(film)
    .map(cinema => Number(cinema.distanceKm ?? cinema.dist ?? cinema.distance ?? NaN))
    .filter(Number.isFinite);
  return distances.length ? Math.min(...distances) : null;
}

function collectCatalogueShowtimeText(film) {
  const parts = [];
  for (const cinema of getCatalogueCinemas(film)) {
    if (Array.isArray(cinema.horaires)) parts.push(...cinema.horaires);
    if (Array.isArray(cinema.showtimes)) parts.push(...cinema.showtimes.map(item => JSON.stringify(item)));
    if (Array.isArray(cinema.rawShowtimes)) parts.push(...cinema.rawShowtimes.map(item => JSON.stringify(item)));
  }
  if (Array.isArray(film?.horaires)) parts.push(...film.horaires);
  if (Array.isArray(film?.rawShowtimes)) parts.push(...film.rawShowtimes.map(item => JSON.stringify(item)));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function getCatalogueShowtimesCount(film) {
  let count = 0;
  for (const cinema of getCatalogueCinemas(film)) {
    if (Array.isArray(cinema.horaires)) count += cinema.horaires.length;
    else if (Array.isArray(cinema.showtimes)) count += cinema.showtimes.length;
    else if (Array.isArray(cinema.rawShowtimes)) count += cinema.rawShowtimes.length;
  }
  if (!count && Array.isArray(film?.horaires)) count += film.horaires.length;
  if (!count && Array.isArray(film?.rawShowtimes)) count += film.rawShowtimes.length;
  return count || null;
}

function catalogueMatchesFormat(film, wantedFormat) {
  if (!wantedFormat) return true;
  const text = collectCatalogueShowtimeText(film);
  if (!text) return true;
  if (wantedFormat === 'vo') return /\b(vo|vost|vostf|vostfr|version originale)\b/i.test(text);
  if (wantedFormat === 'vf') return /\b(vf|version française|version francaise)\b/i.test(text) || !/\b(vo|vost|vostf|vostfr)\b/i.test(text);
  return true;
}

function catalogueMatchesTime(film, wantedTime) {
  if (!wantedTime) return true;
  const text = collectCatalogueShowtimeText(film);
  const matches = [...text.matchAll(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g)].map(match => Number(match[1]));
  if (!matches.length) return true;
  if (wantedTime === 'morning') return matches.some(hour => hour < 12);
  if (wantedTime === 'afternoon') return matches.some(hour => hour >= 12 && hour < 18);
  if (wantedTime === 'evening') return matches.some(hour => hour >= 18);
  return true;
}

function catalogueMatchesCinema(film, wantedCinema) {
  if (!wantedCinema) return true;
  return getCatalogueCinemas(film).some(cinema => normalizeRuntimeCatalogueKey(cinema.nom || cinema.name || '') === wantedCinema);
}

function refreshCinemaFilterOptions() {
  const select = document.getElementById('cinema-filter');
  if (!select) return;
  const current = select.value;
  const cinemas = new Map();
  for (const film of catalogue) {
    for (const cinema of getCatalogueCinemas(film)) {
      const label = cinema.nom || cinema.name || '';
      const key = normalizeRuntimeCatalogueKey(label);
      if (key && !cinemas.has(key)) cinemas.set(key, label);
    }
  }
  const options = ['<option value="">Tous les cinémas</option>']
    .concat([...cinemas.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([key, label]) => `<option value="${key}">${label}</option>`));
  select.innerHTML = options.join('');
  if ([...cinemas.keys()].includes(current)) select.value = current;
}

function syncRadiusControlFromLastSearch() {
  const select = document.getElementById('radius-filter');
  if (!select) return;
  const lastSearch = readLastNearbySearch();
  const radius = Number(lastSearch?.radius || 15000);
  const supported = [5000, 15000, 30000, 50000];
  const closest = supported.reduce((best, value) => Math.abs(value - radius) < Math.abs(best - radius) ? value : best, 15000);
  select.value = String(closest);
}

function getCurrentCatalogueRadius() {
  const select = document.getElementById('radius-filter');
  return Number(select?.value || readLastNearbySearch()?.radius || 15000) || 15000;
}

function getSortValue(film, key) {
  if (key === 'bestNote') return getBestNote(film);
  if (key === 'distance') return getCatalogueDistance(film);
  if (key === 'showtimesCount') return getCatalogueShowtimesCount(film);
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
    nearbyMode: isNearbyModeActive(),
    favs,
    formatNearbyBestNote,
    getNearbyRatingSource,
    getNearbyCinemaLabel,
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
  const q = document.getElementById('search-input').value.toLowerCase();
  const g = document.getElementById('genre-filter')?.value || '';
  const d = document.getElementById('decade-filter')?.value || '';
  const format = document.getElementById('format-filter')?.value || '';
  const time = document.getElementById('time-filter')?.value || '';
  const cinema = document.getElementById('cinema-filter')?.value || '';
  let data = catalogue.filter(f =>
    (!q || String(f.titre || '').toLowerCase().includes(q) || String(f.real || '').toLowerCase().includes(q) || String(f.original || '').toLowerCase().includes(q)) &&
    (!g || String(f.genre || '').toLowerCase().includes(g.toLowerCase())) &&
    decadeMatch(f.annee, d) &&
    catalogueMatchesFormat(f, format) &&
    catalogueMatchesTime(f, time) &&
    catalogueMatchesCinema(f, cinema)
  );
  if (catalogueMode === 'nearby' && sortKey === 'imdb') sortKey = 'bestNote';
  data.sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    return compareValues(va, vb) * sortDir;
  });
  renderTable(data);
  updateIcons();
}

function sortTable(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = -1; }
  currentPage = 1;
  const select = document.getElementById('sort-filter');
  if (select && ['bestNote', 'distance', 'annee', 'showtimesCount'].includes(key)) select.value = key;
  filterTable();
}

function changeCatalogueSort(key) {
  sortKey = key || 'bestNote';
  sortDir = sortKey === 'distance' ? 1 : -1;
  currentPage = 1;
  filterTable();
}

window.changeCatalogueSort = changeCatalogueSort;

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

  // ZIP 3.9.6 : on enrichit uniquement les films visibles sur la page.
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
    console.warn('[Catalogue] ZIP 3.9.6 : enrichissement visible TMDB ignoré :', error?.message || error);
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
    if (isCatalogueDebugEnabled()) console.log(`[Catalogue] ZIP 3.9.6 : notes Letterboxd mises à jour (${updated}).`);
    return true;
  } catch (error) {
    console.warn('API Letterboxd non disponible, catalogue statique utilisé :', error.message);
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

function clearNearbyCatalogueRuntimeState() {
  try {
    removeStorageItem(RUNTIME_CATALOGUE_KEY);
    removeStorageItem(NEARBY_RANKED_KEY);
    removeStorageItem(ACTIVE_CATALOGUE_KEY);
    if (CINEPRO_STORAGE?.clearCatalogueCaches) CINEPRO_STORAGE.clearCatalogueCaches();
    window.CINEPRO_ACTIVE_CATALOGUE = [];
    window.NEARBY_CATALOGUE_NEARBY_RANKED = [];
    window.NEARBY_CATALOGUE_RUNTIME_DATA = [];
    catalogue = [];
    lastFilteredData = [];
  } catch (_) {}
}

function getActiveCataloguePayload() {
  return readStorageJson(ACTIVE_CATALOGUE_KEY, null);
}

function hasFreshNearbyCatalogueForLastSearch() {
  const payload = getActiveCataloguePayload();
  return isFreshNearbyPayload(payload) && Array.isArray(payload?.films) && payload.films.length > 0;
}

async function rebuildNearbyCatalogueFromLastSearch({ force = false, radius = null } = {}) {
  const lastSearch = readLastNearbySearch();
  if (!lastSearch) return false;
  if (typeof getNearbyRankedMovies !== 'function' || !window.PLACES) return false;
  if (nearbyAutoBuildRunning) return true;

  const nextRadius = Number(radius || lastSearch.radius || 15000) || 15000;
  const nextSearch = { ...lastSearch, radius: nextRadius };
  if (CINEPRO_STORAGE?.writeLastNearbySearch) CINEPRO_STORAGE.writeLastNearbySearch(nextSearch);
  else writeStorageJson(STORAGE_KEYS.LAST_NEARBY_SEARCH, nextSearch);

  if (force) clearNearbyCatalogueRuntimeState();
  nearbyAutoBuildRunning = true;
  try {
    const countLabel = document.getElementById('count-label');
    if (countLabel) countLabel.textContent = `Reconstruction ${Math.round(nextRadius / 1000)} km…`;
    await getNearbyRankedMovies({
      address: nextSearch.address || nextSearch.query || '',
      location: nextSearch.location || null,
      radius: nextRadius,
      forceRefresh: force
    });
    catalogue = getCatalogueSource();
    refreshCinemaFilterOptions();
    sortKey = 'bestNote';
    sortDir = -1;
    currentPage = 1;
    filterTable();
    return true;
  } catch (error) {
    console.warn('[Catalogue] ZIP 3.9.6 : reconstruction catalogue proche impossible :', error?.message || error);
    return false;
  } finally {
    nearbyAutoBuildRunning = false;
  }
}

async function autoBuildNearbyCatalogueFromLastSearch() {
  if (hasFreshNearbyCatalogueForLastSearch() || nearbyAutoBuildRunning) return true;
  clearNearbyCatalogueRuntimeState();
  return rebuildNearbyCatalogueFromLastSearch({ force: true });
}

function changeCatalogueRadius(value) {
  const radius = Number(value) || 15000;
  const lastSearch = readLastNearbySearch();
  if (!lastSearch) {
    const countLabel = document.getElementById('count-label');
    if (countLabel) countLabel.textContent = 'Lance d’abord une recherche depuis l’accueil';
    return;
  }
  rebuildNearbyCatalogueFromLastSearch({ force: true, radius });
}

function refreshNearbyCatalogue() {
  rebuildNearbyCatalogueFromLastSearch({ force: true, radius: getCurrentCatalogueRadius() });
}

window.changeCatalogueRadius = changeCatalogueRadius;
window.refreshNearbyCatalogue = refreshNearbyCatalogue;
function scheduleNearbyCatalogueAutoBuild() {
  let tries = 0;
  const timer = setInterval(async () => {
    tries += 1;
    if (hasFreshNearbyCatalogueForLastSearch()) {
      clearInterval(timer);
      return;
    }
    const done = await autoBuildNearbyCatalogueFromLastSearch();
    if (done || tries >= 10) clearInterval(timer);
  }, 900);
}

window.addEventListener('nearby-catalogue-ranked-ready', () => {
  catalogue = getCatalogueSource();
  refreshCinemaFilterOptions();
  sortKey = 'bestNote';
  sortDir = -1;
  currentPage = 1;
  filterTable();
});

window.addEventListener('cinepro-active-catalogue-ready', (event) => {
  if (Array.isArray(event?.detail?.films) && event.detail.films.length) {
    window.CINEPRO_ACTIVE_CATALOGUE = event.detail.films;
  }
  catalogueMode = 'nearby';
  setStoredCatalogueMode('nearby');
  catalogue = getCatalogueSource();
  refreshCinemaFilterOptions();
  sortKey = 'bestNote';
  sortDir = -1;
  currentPage = 1;
  filterTable();
});

async function initCatalogue() {
  // ZIP 3.8.1 : on lance la reconstruction proche dès le début.
  // Si aucune donnée proche n'est prête, le tableau affiche un état d'attente au lieu des 80 films classiques.
  scheduleNearbyCatalogueAutoBuild();

  // 1) Afficher immédiatement la meilleure source disponible. Le mode utilisateur reste Films proches.
  updateCatalogueModeControl();
  syncRadiusControlFromLastSearch();
  catalogue = getCatalogueSource();
  refreshCinemaFilterOptions();
  sortKey = 'bestNote'; sortDir = -1;
  filterTable();

  // 2) Letterboxd ne bloque plus l'ouverture du catalogue.
  // Si l'API locale n'est pas lancée, on garde le catalogue proche tel quel.
  loadLetterboxdCatalogue()
    .then(() => filterTable())
    .catch((error) => console.warn('Letterboxd ignoré, catalogue local conservé :', error?.message || error));

  // 3) ZIP 3.9.6 : l'enrichissement TMDB/OMDb est déclenché par renderTable()
  // uniquement sur les films visibles de la page courante.
}

initCatalogue();
