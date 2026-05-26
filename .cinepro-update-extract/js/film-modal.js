/* CinéProche — Module commun fiches film — ZIP 4.3.1
   Préparation sûre : ce fichier expose des helpers, sans remplacer les popups existantes.
*/
(function () {
  'use strict';

  function cleanText(value, fallback = '') {
    const text = String(value ?? '').trim();
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || ['undefined', 'null', 'nan', 'n/a', 'na', '-', '—', 'a completer', 'non renseigne', 'non renseignee'].includes(normalized)) {
      return fallback;
    }

    return text;
  }

  function firstUseful(...values) {
    for (const value of values) {
      const cleaned = cleanText(value, '');
      if (cleaned) return cleaned;
    }
    return '';
  }

  function formatYear(value) {
    const year = Number(value);
    return Number.isFinite(year) && year > 1800 ? String(year) : '';
  }

  function formatRating(value) {
    const rating = Number(value);
    return Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : null;
  }

  function normalizeFilm(film = {}) {
    const rating = formatRating(
      film.bestNote ??
      film.nearbyRatingValue ??
      film.imdb ??
      film.tmdb ??
      film.sc ??
      film.lb
    );

    return {
      id: film.id ?? film.tmdbId ?? film.imdbID ?? '',
      title: firstUseful(film.titre, film.title, film.name, 'Film sans titre'),
      originalTitle: firstUseful(film.original, film.originalTitle, film.original_title),
      year: formatYear(film.annee ?? film.year ?? film.release_year),
      genre: firstUseful(
        film.genre,
        Array.isArray(film.genres) ? film.genres.join(', ') : '',
        'Genre indisponible'
      ),
      director: firstUseful(film.real, film.realisateur, film.director, 'Réalisateur indisponible'),
      duration: firstUseful(film.duree, film.runtime, film.duration),
      cast: firstUseful(film.acteurs, film.cast),
      synopsis: firstUseful(film.synopsis, film.overview, 'Synopsis indisponible.'),
      poster: firstUseful(film.poster, film.affiche, film.image),
      rating,
      ratingLabel: rating !== null ? rating.toFixed(1) : '—',
      source: firstUseful(film.bestNoteSource, film.nearbyRatingSource, film.ratingSource, film.source)
    };
  }

  window.CINEPRO_FILM_MODAL = {
    cleanText,
    firstUseful,
    formatYear,
    formatRating,
    normalizeFilm
  };
})();