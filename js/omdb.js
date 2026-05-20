/* ═══════════════════════════════════════
   CinéProche — Intégration OMDb
   Récupère les vraies notes IMDb + affiches + synopsis courts OMDb
   ═══════════════════════════════════════ */

const OMDB_CACHE_KEY = 'cinepro_omdb_cache_imdb_short_v2';

function readOmdbCache() {
  try {
    return JSON.parse(localStorage.getItem(OMDB_CACHE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function writeOmdbCache(cache) {
  try {
    localStorage.setItem(OMDB_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Cache OMDb non sauvegardé :', error);
  }
}

function normalizeOmdbRating(value) {
  const rating = Number.parseFloat(value);
  return Number.isFinite(rating) ? rating : null;
}

function getOmdbSearchTitle(film) {
  // OMDb fonctionne souvent mieux avec le titre original anglais quand il existe.
  return film.original && film.original.trim() ? film.original.trim() : film.titre.trim();
}

async function fetchOmdbFilm(film) {
  if (!window.CONFIG || !CONFIG.OMDB_API_KEY) {
    console.warn('Clé OMDb absente dans js/config.js');
    return null;
  }

  const searchTitle = getOmdbSearchTitle(film);
  const cacheKey = `${searchTitle.toLowerCase()}-${film.annee || ''}`;
  const cache = readOmdbCache();

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  const params = new URLSearchParams({
    apikey: CONFIG.OMDB_API_KEY,
    t: searchTitle,
    plot: 'short',
    r: 'json'
  });

  if (film.annee) {
    params.set('y', film.annee);
  }

  try {
    const response = await fetch(`${CONFIG.OMDB_BASE_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.Response !== 'True') {
      cache[cacheKey] = null;
      writeOmdbCache(cache);
      return null;
    }

    const normalized = {
      imdbID: data.imdbID || null,
      imdbRating: normalizeOmdbRating(data.imdbRating),
      poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
      title: data.Title && data.Title !== 'N/A' ? data.Title : null,
      year: data.Year && data.Year !== 'N/A' ? Number.parseInt(data.Year, 10) : null,
      runtime: data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : null,
      genre: data.Genre && data.Genre !== 'N/A' ? data.Genre : null,
      director: data.Director && data.Director !== 'N/A' ? data.Director : null,
      actors: data.Actors && data.Actors !== 'N/A' ? data.Actors : null,
      plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : null
    };

    cache[cacheKey] = normalized;
    writeOmdbCache(cache);
    return normalized;
  } catch (error) {
    console.error('Erreur OMDb pour', film.titre, error);
    return null;
  }
}

function applyOmdbDataToFilm(film, omdb) {
  film.omdbLoaded = true;

  if (!omdb) {
    film.omdbFound = false;
    film.imdb = null;
    return film;
  }

  film.omdbFound = true;
  film.imdbID = omdb.imdbID;
  film.imdb = omdb.imdbRating;
  film.poster = omdb.poster;

  // On garde le titre français du catalogue, mais on enrichit les détails du popup.
  if (omdb.runtime) film.duree = omdb.runtime.replace(' min', ' min');
  if (omdb.year) film.annee = omdb.year;
  if (omdb.director) film.real = omdb.director;
  if (omdb.actors) film.acteurs = omdb.actors;
  if (omdb.plot) film.synopsis = omdb.plot;

  return film;
}

async function enrichFilmsWithOmdb(films, onProgress) {
  for (let index = 0; index < films.length; index++) {
    const film = films[index];
    const omdb = await fetchOmdbFilm(film);
    applyOmdbDataToFilm(film, omdb);

    if (typeof onProgress === 'function') {
      onProgress(index + 1, films.length, film);
    }
  }

  return films;
}
