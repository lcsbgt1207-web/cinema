/* CinéProche — TMDB + OMDb
   TMDB = affiche + informations du popup + ID IMDb fiable
   OMDb = vraie note IMDb du tableau, récupérée avec l'ID IMDb quand possible
*/

const OMDB_CACHE_KEY = 'cinepro_omdb_cache_v8_preserve_local_imdb';
const TMDB_CACHE_KEY = 'cinepro_tmdb_cache_v7_fr_synopsis';

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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchTitle(film) {
  return film.original && film.original.trim() ? film.original.trim() : film.titre.trim();
}

function normalizeRating(value) {
  const rating = Number.parseFloat(value);
  return Number.isFinite(rating) ? rating : null;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`;
}

function chooseBestTmdbResult(results, film) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const wantedTitle = normalizeText(searchTitle(film));
  const wantedFrenchTitle = normalizeText(film.titre);
  const wantedYear = film.annee ? Number(film.annee) : null;

  return results
    .map(movie => {
      const title = normalizeText(movie.title);
      const originalTitle = normalizeText(movie.original_title);
      const releaseYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;

      let score = 0;
      if (title === wantedTitle || originalTitle === wantedTitle) score += 80;
      if (title === wantedFrenchTitle || originalTitle === wantedFrenchTitle) score += 70;
      if (title.includes(wantedTitle) || wantedTitle.includes(title)) score += 20;
      if (wantedYear && releaseYear === wantedYear) score += 60;
      if (wantedYear && releaseYear && Math.abs(releaseYear - wantedYear) <= 1) score += 15;
      if (movie.poster_path) score += 8;
      score += Math.min(Number(movie.popularity || 0), 50) / 10;

      return { movie, score };
    })
    .sort((a, b) => b.score - a.score)[0].movie;
}

async function fetchTmdbFilm(film) {
  const title = searchTitle(film);
  const cacheKey = `${normalizeText(title)}-${film.annee || ''}`;
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
    const movie = chooseBestTmdbResult(searchData.results, film);

    if (!movie) {
      cache[cacheKey] = null;
      writeCache(TMDB_CACHE_KEY, cache);
      return null;
    }

    const detailParams = new URLSearchParams({
      api_key: CONFIG.TMDB_API_KEY,
      language: CONFIG.LANGUAGE,
      append_to_response: 'credits,external_ids'
    });

    const detailResponse = await fetch(`${CONFIG.TMDB_BASE_URL}/movie/${movie.id}?${detailParams.toString()}`);
    const detail = await detailResponse.json();

    const director = detail.credits?.crew?.find(person => person.job === 'Director');
    const actors = detail.credits?.cast?.slice(0, 4).map(actor => actor.name).join(', ');

    const result = {
      tmdbID: detail.id,
      imdbID: detail.external_ids?.imdb_id || null,
      titre: detail.title || film.titre,
      original: detail.original_title || film.original,
      // On garde les synopsis français écrits dans data.js.
      // TMDB reste utilisé pour les affiches et les infos techniques.
      synopsis: film.synopsis || detail.overview || '',
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

async function fetchOmdbById(imdbID) {
  if (!imdbID) return null;

  const cacheKey = `id-${imdbID}`;
  const cache = readCache(OMDB_CACHE_KEY);
  if (cache[cacheKey] !== undefined) return cache[cacheKey];

  try {
    const params = new URLSearchParams({
      apikey: CONFIG.OMDB_API_KEY,
      i: imdbID,
      r: 'json'
    });

    const response = await fetch(`${CONFIG.OMDB_BASE_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.Response !== 'True') {
      cache[cacheKey] = null;
      writeCache(OMDB_CACHE_KEY, cache);
      return null;
    }

    const result = {
      imdbID: data.imdbID || imdbID,
      imdbRating: normalizeRating(data.imdbRating)
    };

    cache[cacheKey] = result;
    writeCache(OMDB_CACHE_KEY, cache);
    return result;
  } catch (error) {
    console.error('Erreur OMDb ID :', imdbID, error);
    return null;
  }
}

async function fetchOmdbByTitle(film) {
  const title = searchTitle(film);
  const cacheKey = `title-${normalizeText(title)}-${film.annee || ''}`;
  const cache = readCache(OMDB_CACHE_KEY);
  if (cache[cacheKey] !== undefined) return cache[cacheKey];

  try {
    const params = new URLSearchParams({
      apikey: CONFIG.OMDB_API_KEY,
      t: title,
      r: 'json'
    });

    if (film.annee) params.set('y', film.annee);

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
    console.error('Erreur OMDb titre :', film.titre, error);
    return null;
  }
}

function getLocalImdbRating(film) {
  const rating = Number.parseFloat(film?.imdb);
  return Number.isFinite(rating) ? Math.round(rating * 10) / 10 : null;
}

function applyDataToFilm(film, tmdb, omdb) {
  // On garde toujours la note IMDb déjà présente dans js/data.js.
  // OMDb peut la mettre à jour si une clé API est disponible, mais un échec API
  // ne doit jamais remplacer une vraie note IMDb par un tiret.
  const localImdbRating = getLocalImdbRating(film);

  film.omdbLoaded = true;

  if (tmdb) {
    film.tmdbID = tmdb.tmdbID;
    film.imdbID = tmdb.imdbID || film.imdbID;
    film.titre = tmdb.titre || film.titre;
    film.original = tmdb.original || film.original;
    // Ne pas remplacer nos synopsis français par ceux de TMDB.
    film.synopsis = film.synopsis || tmdb.synopsis;
    film.poster = tmdb.poster || film.poster;
    film.annee = tmdb.annee || film.annee;
    film.duree = tmdb.duree || film.duree;
    film.genre = tmdb.genre || film.genre;
    film.real = tmdb.real || film.real;
    film.acteurs = tmdb.acteurs || film.acteurs;
  }

  if (omdb && Number.isFinite(omdb.imdbRating)) {
    film.imdbID = omdb.imdbID || film.imdbID;
    film.imdb = Math.round(omdb.imdbRating * 10) / 10;
  } else if (localImdbRating !== null) {
    film.imdb = localImdbRating;
  } else {
    film.imdb = null;
  }

  return film;
}

async function enrichFilmsWithOmdb(films, onProgress) {
  for (let index = 0; index < films.length; index++) {
    const film = films[index];

    if (film.isMock) {
      film.omdbLoaded = true;
      film.imdb = null;
      if (typeof onProgress === 'function') onProgress(index + 1, films.length, film);
      continue;
    }

    const tmdb = await fetchTmdbFilm(film);
    const imdbID = tmdb?.imdbID || film.imdbID || null;
    const omdb = imdbID ? await fetchOmdbById(imdbID) : await fetchOmdbByTitle(film);

    applyDataToFilm(film, tmdb, omdb);

    if (typeof onProgress === 'function') {
      onProgress(index + 1, films.length, film);
    }
  }

  return films;
}

// Update générée : IMDb local conservé si OMDb est indisponible + affiches TMDB conservées.
