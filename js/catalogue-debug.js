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

    console.group('[CinéProche] Audit catalogue ZIP 4.7.2');
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

  window.CINEPRO_DEBUG_CATALOGUE = { audit, clearCatalogueCaches, keys: STORAGE_KEYS };
})();
