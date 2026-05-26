/* CinéProche — Audit catalogue — ZIP 4.6
   Outil console volontairement discret.
   Utilisation : F12 → Console → CINEPRO_DEBUG_CATALOGUE.audit()
*/
(function () {
  'use strict';

  const STORAGE_KEYS = (window.CINEPRO_STORAGE && window.CINEPRO_STORAGE.KEYS) || {
    ACTIVE_CATALOGUE: 'cinepro_active_catalogue',
    NEARBY_RANKED_CATALOGUE: 'cinepro_nearby_ranked_catalogue',
    RUNTIME_CATALOGUE: 'cinepro_runtime_catalogue',
    LAST_NEARBY_SEARCH: 'cinepro_last_nearby_search',
    CATALOGUE_MODE: 'cinepro_catalogue_mode',
    FAVS: 'cinepro_favs',
    DEBUG: 'cinepro_debug'
  };

  function readJSON(key, fallback = null) {
    try {
      if (window.CINEPRO_STORAGE && typeof window.CINEPRO_STORAGE.readJSON === 'function') {
        return window.CINEPRO_STORAGE.readJSON(key, fallback);
      }
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function getFilmCount(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload && payload.films)) return payload.films.length;
    return 0;
  }

  function summarizePayload(label, key) {
    const payload = readJSON(key, null);
    return {
      cache: label,
      key,
      exists: Boolean(payload),
      films: getFilmCount(payload),
      version: payload && payload.version || '',
      source: payload && payload.source || '',
      radius: payload && payload.radius || '',
      address: payload && (payload.address || payload.query) || '',
      searchDate: payload && payload.searchDate || '',
      updatedAt: payload && payload.updatedAt || '',
      createdAt: payload && payload.createdAt || ''
    };
  }



  function pickFirstArray(...values) {
    for (const value of values) {
      if (Array.isArray(value) && value.length) return value;
    }
    return [];
  }

  function getPayloadFilms(key) {
    const payload = readJSON(key, null);
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload && payload.films)) return payload.films;
    return [];
  }

  function getDiagnosticFilms() {
    return pickFirstArray(
      Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) ? window.CINEPRO_ACTIVE_CATALOGUE : [],
      getPayloadFilms(STORAGE_KEYS.ACTIVE_CATALOGUE),
      Array.isArray(window.NEARBY_CATALOGUE_NEARBY_RANKED) ? window.NEARBY_CATALOGUE_NEARBY_RANKED : [],
      getPayloadFilms(STORAGE_KEYS.NEARBY_RANKED_CATALOGUE),
      Array.isArray(window.NEARBY_CATALOGUE_RUNTIME_DATA) ? window.NEARBY_CATALOGUE_RUNTIME_DATA : [],
      getPayloadFilms(STORAGE_KEYS.RUNTIME_CATALOGUE)
    );
  }

  function detectFilmYear(film) {
    const direct = [film?.annee, film?.year, film?.releaseYear, film?.release_year];
    for (const value of direct) {
      const year = Number(value);
      if (Number.isFinite(year) && year >= 1888 && year <= 2100) return year;
    }
    const dated = [film?.releaseDate, film?.release_date, film?.dateSortie, film?.sortie, film?.first_air_date];
    for (const value of dated) {
      const match = String(value || '').match(/\b(19\d{2}|20\d{2})\b/);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function getFilmTitle(film) {
    return film?.titre || film?.title || film?.name || film?.original || film?.originalTitle || 'Film sans titre';
  }

  function getFilmCinema(film) {
    const cinemas = Array.isArray(film?.nearbyCinemas) && film.nearbyCinemas.length ? film.nearbyCinemas : (Array.isArray(film?.cinemas) ? film.cinemas : []);
    return cinemas.map(c => c?.nom || c?.name || c?.title || '').filter(Boolean).slice(0, 2).join(', ');
  }

  function getFilmBestNote(film) {
    const values = [film?.bestNote, film?.nearbyRatingValue, film?.imdb, film?.tmdb, film?.sc, film?.lb];
    for (const value of values) {
      const rating = Number(value);
      if (Number.isFinite(rating) && rating > 0) return Math.round(rating * 10) / 10;
    }
    return '';
  }

  function buildExclusionRows() {
    const films = getDiagnosticFilms();
    return films.filter(film => film && !film.isMock).map((film, index) => {
      const year = detectFilmYear(film);
      const kept = !Number.isFinite(year) || year <= 2024;
      const rawYearFields = [film?.annee, film?.year, film?.releaseYear, film?.release_year, film?.releaseDate, film?.release_date, film?.dateSortie, film?.sortie]
        .filter(value => value !== undefined && value !== null && value !== '')
        .join(' | ');
      return {
        index: index + 1,
        titre: getFilmTitle(film),
        anneeDetectee: Number.isFinite(year) ? year : 'inconnue',
        garde: kept ? 'oui' : 'non',
        raison: kept ? (Number.isFinite(year) ? `gardé : année ${year}` : 'gardé : année inconnue') : `exclu : année ${year}`,
        cinema: getFilmCinema(film),
        source: film?.source || film?.sourceType || film?.badge || film?.bestNoteSource || film?.nearbyRatingSource || '',
        note: getFilmBestNote(film),
        champsAnnee: rawYearFields
      };
    });
  }

  function exclusions() {
    const rows = buildExclusionRows();
    const kept = rows.filter(row => row.garde === 'oui').length;
    const excluded = rows.length - kept;
    console.group('[CinéProche] Diagnostic exclusions Catalogue ZIP 4.7.7');
    console.log(`${rows.length} films analysés · ${kept} gardés · ${excluded} exclus`);
    console.table(rows);
    console.groupEnd();
    return rows;
  }

  function audit() {
    const lastSearch = readJSON(STORAGE_KEYS.LAST_NEARBY_SEARCH, null);
    const rows = [
      summarizePayload('active', STORAGE_KEYS.ACTIVE_CATALOGUE),
      summarizePayload('nearby-ranked', STORAGE_KEYS.NEARBY_RANKED_CATALOGUE),
      summarizePayload('runtime', STORAGE_KEYS.RUNTIME_CATALOGUE)
    ];

    const expectedRadius = Number(lastSearch && lastSearch.radius || 0);
    const mismatches = rows
      .filter(row => row.exists && expectedRadius && Number(row.radius || 0) && Number(row.radius) !== expectedRadius)
      .map(row => ({ cache: row.cache, cacheRadius: row.radius, lastSearchRadius: expectedRadius }));

    console.group('[CinéProche] Audit catalogue ZIP 4.7.7');
    console.log('Dernière recherche proche :', lastSearch || 'Aucune');
    console.table(rows);
    if (mismatches.length) {
      console.warn('Incohérence rayon détectée :', mismatches);
    } else {
      console.log('Aucune incohérence rayon évidente détectée dans les caches présents.');
    }
    const runtime = {
      CINEPRO_ACTIVE_CATALOGUE: Array.isArray(window.CINEPRO_ACTIVE_CATALOGUE) ? window.CINEPRO_ACTIVE_CATALOGUE.length : 0,
      NEARBY_CATALOGUE_NEARBY_RANKED: Array.isArray(window.NEARBY_CATALOGUE_NEARBY_RANKED) ? window.NEARBY_CATALOGUE_NEARBY_RANKED.length : 0,
      NEARBY_CATALOGUE_RUNTIME_DATA: Array.isArray(window.NEARBY_CATALOGUE_RUNTIME_DATA) ? window.NEARBY_CATALOGUE_RUNTIME_DATA.length : 0
    };
    console.log('Variables runtime :', runtime);
    console.log('Stats filtre Catalogue :', window.CINEPRO_CATALOGUE_FILTER_STATS || {
  sourceTotal: 0,
  kept: 0,
  excludedRecent: 0,
  unknownYearKept: 0,
  displayed: 0,
  referenceSource: 'none'
});
    console.table(buildExclusionRows());
    console.groupEnd();

    return { lastSearch, caches: rows, mismatches, runtime }; 
  }

  function clearCatalogueCaches() {
    if (window.CINEPRO_STORAGE && typeof window.CINEPRO_STORAGE.clearCatalogueCaches === 'function') {
      window.CINEPRO_STORAGE.clearCatalogueCaches();
    } else {
      [STORAGE_KEYS.ACTIVE_CATALOGUE, STORAGE_KEYS.NEARBY_RANKED_CATALOGUE, STORAGE_KEYS.RUNTIME_CATALOGUE].forEach(key => {
        try { localStorage.removeItem(key); } catch (_) {}
      });
    }
    console.info('[CinéProche] Caches catalogue supprimés. Relance une recherche pour reconstruire le catalogue proche.');
  }

  window.CINEPRO_DEBUG_CATALOGUE = { audit, exclusions, clearCatalogueCaches, keys: STORAGE_KEYS };
})();
