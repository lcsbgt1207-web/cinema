/* ═══════════════════════════════════════
   CinéProche — Intégration OMDb
   Récupère les vraies notes IMDb + affiches + synopsis courts OMDb
   ═══════════════════════════════════════ */

const OMDB_CACHE_KEY = 'cinepro_omdb_cache_imdb_fr_v4';


const OMDB_PLOTS_FR = {
  'tt0068646': "Le patriarche vieillissant d'une dynastie criminelle new-yorkaise transmet peu à peu son empire clandestin à son fils réticent.",
  'tt0050083': "Un juré tente de convaincre les onze autres qu'un adolescent accusé de meurtre n'est peut-être pas coupable.",
  'tt0816692': "Une équipe d'explorateurs traverse un trou de ver dans l'espace pour tenter d'assurer la survie de l'humanité.",
  'tt6751668': "Une famille pauvre s'infiltre dans le quotidien d'une famille aisée, déclenchant une série d'événements imprévisibles.",
  'tt0047396': "Un photographe immobilisé observe ses voisins depuis sa fenêtre et soupçonne l'un d'eux d'avoir commis un meurtre.",
  'tt3612616': "Une mère veuve tente d'élever seule son fils impulsif, jusqu'à l'arrivée d'une voisine qui bouleverse leur équilibre.",
  'tt8613070': "Une peintre est chargée de réaliser le portrait de mariage d'une jeune femme, sans que celle-ci ne pose officiellement.",
  'tt3891064': "Une jeune pilote voyage accidentellement dans le temps et tente de prévenir une catastrophe, mais personne ne la croit.",
  'tt0465538': "Un ingénieur se retrouve piégé dans une guerre psychologique lorsqu'un procureur tente de le faire condamner pour tentative de meurtre.",
  'tt10617124': "Des assistantes sociales accueillent des femmes sans-abri et cherchent des solutions quand leur centre risque de fermer.",
  'tt0093409': "Dans les années 1950, une femme au foyer découvre une passion interdite qui remet en question toute sa vie.",
  'tt0109830': "Un homme simple traverse plusieurs décennies d'histoire américaine sans jamais perdre son innocence ni sa sincérité.",
  'tt1375666': "Un voleur capable d'entrer dans les rêves reçoit une mission impossible : implanter une idée dans l'esprit d'une cible."
};

function getFrenchPlot(film, omdb) {
  if (omdb?.imdbID && OMDB_PLOTS_FR[omdb.imdbID]) return OMDB_PLOTS_FR[omdb.imdbID];
  return film.synopsis || omdb?.plot || '';
}

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
  const synopsisFr = getFrenchPlot(film, omdb);
  if (synopsisFr) film.synopsis = synopsisFr;

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
