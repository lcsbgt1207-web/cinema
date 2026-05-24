/* CinéProche — Stockage local partagé — ZIP 3.9.4
   Objectif : éviter que chaque page manipule localStorage avec ses propres clés.
   Ce fichier est volontairement simple : il expose des fonctions sûres et non bloquantes.
*/
(function () {
  'use strict';

  const KEYS = {
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
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '') return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function readText(key, fallback = '') {
    try {
      const raw = localStorage.getItem(key);
      return raw === null || raw === undefined ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  }

  function writeText(key, value) {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (_) {
      return false;
    }
  }

  function readLastNearbySearch() {
    const payload = readJSON(KEYS.LAST_NEARBY_SEARCH, null);
    return payload && typeof payload === 'object' ? payload : null;
  }

  function readFavorites() {
    const favorites = readJSON(KEYS.FAVS, []);
    return Array.isArray(favorites) ? favorites : [];
  }

  function writeFavorites(values) {
    return writeJSON(KEYS.FAVS, Array.isArray(values) ? values : []);
  }

  function setCatalogueMode(mode = 'nearby') {
    return writeText(KEYS.CATALOGUE_MODE, mode);
  }

  function clearCatalogueCaches() {
    remove(KEYS.ACTIVE_CATALOGUE);
    remove(KEYS.NEARBY_RANKED_CATALOGUE);
    remove(KEYS.RUNTIME_CATALOGUE);
  }

  window.CINEPRO_STORAGE = {
    KEYS,
    readJSON,
    writeJSON,
    readText,
    writeText,
    remove,
    readLastNearbySearch,
    readFavorites,
    writeFavorites,
    setCatalogueMode,
    clearCatalogueCaches
  };
})();
