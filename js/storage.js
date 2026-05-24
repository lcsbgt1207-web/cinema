// ZIP 3.9.3 — Stockage local centralisé CinéProche.
// Rôle : éviter que chaque page manipule localStorage avec ses propres clés et ses propres try/catch.
// Ce fichier est volontairement léger : il ne change pas le comportement visible, il rend seulement les accès plus sûrs et plus lisibles.

(function () {
  'use strict';

  const KEYS = Object.freeze({
    catalogueMode: 'cinepro_catalogue_mode',
    activeCatalogue: 'cinepro_active_catalogue',
    nearbyRankedCatalogue: 'cinepro_nearby_ranked_catalogue',
    runtimeCatalogue: 'cinepro_runtime_catalogue',
    lastNearbySearch: 'cinepro_last_nearby_search',
    favourites: 'cinepro_favs',
    billets: 'cinepro_billets',
    agenda: 'cinepro_agenda',
    userLat: 'cinepro_user_lat',
    userLng: 'cinepro_user_lng',
    debug: 'cinepro_debug'
  });

  function readRaw(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeRaw(key, value) {
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

  function readJSON(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      if (value === null || value === undefined || value === '') return fallback;
      return JSON.parse(value);
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

  function readArray(key) {
    const value = readJSON(key, []);
    return Array.isArray(value) ? value : [];
  }

  function readObject(key) {
    const value = readJSON(key, null);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  }

  function clearNearbyCatalogue() {
    remove(KEYS.runtimeCatalogue);
    remove(KEYS.nearbyRankedCatalogue);
    remove(KEYS.activeCatalogue);
  }

  function saveNearbyCatalogue({ runtimePayload, nearbyPayload, activePayload } = {}) {
    if (runtimePayload) writeJSON(KEYS.runtimeCatalogue, runtimePayload);
    if (nearbyPayload) writeJSON(KEYS.nearbyRankedCatalogue, nearbyPayload);
    if (activePayload) writeJSON(KEYS.activeCatalogue, activePayload);
  }

  function readActiveCataloguePayload() {
    return readObject(KEYS.activeCatalogue);
  }

  function readNearbyRankedPayload() {
    return readObject(KEYS.nearbyRankedCatalogue);
  }

  function readRuntimeCataloguePayload() {
    return readObject(KEYS.runtimeCatalogue);
  }

  function readLastNearbySearch() {
    return readObject(KEYS.lastNearbySearch);
  }

  function readFavourites() {
    return readArray(KEYS.favourites);
  }

  function writeFavourites(favourites) {
    return writeJSON(KEYS.favourites, Array.isArray(favourites) ? favourites : []);
  }

  function isDebugEnabled() {
    return readRaw(KEYS.debug, '') === '1';
  }

  window.CineProStorage = Object.freeze({
    KEYS,
    readRaw,
    writeRaw,
    remove,
    readJSON,
    writeJSON,
    readArray,
    readObject,
    clearNearbyCatalogue,
    saveNearbyCatalogue,
    readActiveCataloguePayload,
    readNearbyRankedPayload,
    readRuntimeCataloguePayload,
    readLastNearbySearch,
    readFavourites,
    writeFavourites,
    isDebugEnabled
  });
})();
