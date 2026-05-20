/* CinéProche — OMDb + TMDB
   OMDb = vraie note IMDb dans le tableau
   TMDB = affiche + informations du popup
*/

const OMDB_CACHE_KEY = 'cinepro_omdb_cache_v2';
const TMDB_CACHE_KEY = 'cinepro_tmdb_cache_v1';

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function writeCache(key, cache) {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (error) {
    console.warn('Cache non sauvegardé :', error);
  }
}

function searchTitle(film) {
  return film.original && film.original.trim() ? film.original.trim() : film.titre.trim();
}

function normalizeRating(value) {
  const rating = Number.parseFloat(value);
  return Number.isFinite(rating) ? rating : null;
}

async function fetchOmdbFilm(film) {
  const title = searchTitle(film);
  const cacheKey = `${title.toLowerCase()}-${film.annee || ''}`;
  const cache = readCache(OMDB_CACHE_KEY);

  if (cache[cacheKey] !== undefined) return cache[cacheKey];

  const params = new URLSearchParams({
    apikey: CONFIG.OMDB_API_KEY,
    t: title,
    r: 'json'
  });

  if (film.annee) params.set('y', film.annee);

  try {
    const response = await fetch(`${CONFIG.OMDB_BASE_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.Response !== 'True') {
      cache[cacheKey] = null;
      writeCache(OMDB_CACHE_KEY, cache);
      return null;
    }

    const result = {
      imdbID: data.imdbID || null,
      imdbRating: normalizeRating(data.imdbRating)
    };

    cache[cacheKey] = result;
    writeCache(OMDB_CACHE_KEY, cache);
    return result;
  } catch (error) {
    console.error('Erreur OMDb :', film.titre, error);
    return null;
  }
}

async function fetchTmdbFilm(film) {
  const title = searchTitle(film);
  const cacheKey = `${title.toLowerCase()}-${film.annee || ''}`;
  const cache = readCache(TMDB_CACHE_KEY);

  if (cache[cacheKey] !== undefined) return cache[cacheKey];

  try {
    const searchParams = new URLSearchParams({
      api_key: CONFIG.TMDB_API_KEY,
      language: CONFIG.LANGUAGE,
      query: title
    });

    if (film.annee) searchParams.set('year', film.annee);

    const searchResponse = await fetch(`${CONFIG.TMDB_BASE_URL}/search/movie?${searchParams.toString()}`);
    const searchData = await searchResponse.json();

    const movie = searchData.results && searchData.results.length ? searchData.results[0] : null;

    if (!movie) {
      cache[cacheKey] = null;
      writeCache(TMDB_CACHE_KEY, cache);
      return null;
    }

    const detailParams = new URLSearchParams({
      api_key: CONFIG.TMDB_API_KEY,
      language: CONFIG.LANGUAGE,
      append_to_response: 'credits'
    });

    const detailResponse = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movie.id}?${detailParams.toString()}`);
    const detail = await detailResponse.json();

    const director = detail.credits?.crew?.find(person => person.job === 'Director');
    const actors = detail.credits?.cast?.slice(0, 4).map(actor => actor.name).join(', ');

    const result = {
      tmdbID: detail.id,
      titre: detail.title || film.titre,
      original: detail.original_title || film.original,
      synopsis: detail.overview || film.synopsis,
      poster: detail.poster_path ? `${CONFIG.TMDB_IMG_BASE}${detail.poster_path}` : null,
      annee: detail.release_date ? Number.parseInt(detail.release_date.slice(0, 4), 10) : film.annee,
      duree: detail.runtime ? formatDuration(detail.runtime) : film.duree,
      genre: detail.genres?.length ? detail.genres[0].name : film.genre,
      real: director ? director.name : film.real,
      acteurs: actors || film.acteurs
    };

    cache[cacheKey] = result;
    writeCache(TMDB_CACHE_KEY, cache);
    return result;
  } catch (error) {
    console.error('Erreur TMDB :', film.titre, error);
    return null;
  }
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
}

function applyDataToFilm(film, omdb, tmdb) {
  film.omdbLoaded = true;

  if (omdb && Number.isFinite(omdb.imdbRating)) {
    film.imdbID = omdb.imdbID;
    film.imdb = omdb.imdbRating;
  } else {
    film.imdb = null;
  }

  if (tmdb) {
    film.tmdbID = tmdb.tmdbID;
    film.titre = tmdb.titre || film.titre;
    film.original = tmdb.original || film.original;
    film.synopsis = tmdb.synopsis || film.synopsis;
    film.poster = tmdb.poster || film.poster;
    film.annee = tmdb.annee || film.annee;
    film.duree = tmdb.duree || film.duree;
    film.genre = tmdb.genre || film.genre;
    film.real = tmdb.real || film.real;
    film.acteurs = tmdb.acteurs || film.acteurs;
  }

  return film;
}

async function enrichFilmsWithOmdb(films, onProgress) {
  for (let index = 0; index < films.length; index++) {
    const film = films[index];

    const [omdb, tmdb] = await Promise.all([
      fetchOmdbFilm(film),
      fetchTmdbFilm(film)
    ]);

    applyDataToFilm(film, omdb, tmdb);

    if (typeof onProgress === 'function') {
      onProgress(index + 1, films.length, film);
    }
  }

  return films;
}
