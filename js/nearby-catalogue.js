/* CinéProche — Catalogue proche — ZIP 3.5
   Objectif : conserver la fusion proche + enrichir les fiches film utilisées par le Catalogue.
   - Les films reconnus dans js/data.js gardent leur note locale.
   - Les films absents trouvés sur TMDB deviennent utilisables directement dans la liste finale.
   - Ajout d'un catalogue temporaire exportable window.NEARBY_CATALOGUE_RUNTIME_DATA.
   - Aucun ajout définitif dans js/data.js : la fusion reste côté navigateur pour validation.
*/
(function () {
  'use strict';

  const NEARBY_CATALOGUE_API = 'https://cinepro-api-yal8.onrender.com';
  const tmdbRatingCache = new Map();
  const tmdbEnrichmentCache = new Map();

  function stripAccents(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeNearbyTitle(value) {
    return stripAccents(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\bpartie\b/g, 'part')
      .replace(/\bepisode\b/g, '')
      .replace(/\bfilm\b/g, '')
      .replace(/\bthe movie\b/g, '')
      .replace(/\ble film\b/g, '')
      .replace(/\bversion\b/g, '')
      .replace(/\bvf\b/g, '')
      .replace(/\bvo\b/g, '')
      .replace(/\bvost\b/g, '')
      .replace(/\bimax\b/g, '')
      .replace(/\b4dx\b/g, '')
      .replace(/\bdolby\b/g, '')
      .replace(/\bcinema\b/g, '')
      .replace(/\bcine\b/g, '')
      .replace(/\b202[0-9]\b/g, '')
      .replace(/\b19[0-9]{2}\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactNearbyTitle(value) {
    return normalizeNearbyTitle(value).replace(/\s+/g, '');
  }

  function removeLeadingArticles(value) {
    return String(value || '')
      .replace(/^(le|la|les|l|un|une|des|de|du|the|a|an)\s+/i, '')
      .trim();
  }

  function stripSequelMarkers(value) {
    return String(value || '')
      .replace(/\b(part|partie|chapter|chapitre|episode|ep)\s*(i{1,3}|iv|v|vi{0,3}|[0-9]+)\b/gi, '')
      .replace(/\b(i{2,3}|iv|v|vi{0,3}|[2-9])\b$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalNearbyTitleKey(value) {
    const normalized = normalizeNearbyTitle(value);
    const withoutArticles = removeLeadingArticles(normalized);
    return withoutArticles.replace(/\s+/g, ' ').trim() || normalized;
  }

  function titleWords(value) {
    return normalizeNearbyTitle(value).split(' ').filter(word => word.length > 1);
  }

  function getGlobalFilms() {
    if (Array.isArray(window.FILMS)) return window.FILMS;
    try { if (Array.isArray(FILMS)) return FILMS; } catch (_) {}
    return [];
  }

  let localFilmIndexCache = null;
  function buildLocalFilmIndex() {
    if (localFilmIndexCache) return localFilmIndexCache;
    const films = getGlobalFilms();
    const index = [];

    for (const film of films) {
      const titles = [
        film?.titre,
        film?.title,
        film?.name,
        film?.original,
        film?.originalTitle,
        film?.original_title
      ].filter(Boolean);

      for (const title of titles) {
        const normalized = normalizeNearbyTitle(title);
        const compact = compactNearbyTitle(title);
        if (!normalized) continue;
        index.push({ film, title, normalized, compact });
      }
    }

    localFilmIndexCache = index;
    return index;
  }

  function scoreTitleMatch(sessionTitle, candidateTitle) {
    const a = normalizeNearbyTitle(sessionTitle);
    const b = normalizeNearbyTitle(candidateTitle);
    const ca = compactNearbyTitle(sessionTitle);
    const cb = compactNearbyTitle(candidateTitle);
    const ka = canonicalNearbyTitleKey(sessionTitle);
    const kb = canonicalNearbyTitleKey(candidateTitle);

    if (!a || !b) return 0;
    if (a === b) return 100;
    if (ca === cb) return 99;
    if (ka && kb && ka === kb) return 98;

    const baseA = stripSequelMarkers(ka);
    const baseB = stripSequelMarkers(kb);
    if (baseA && baseB && baseA === baseB) return 88;

    if (a.includes(b) || b.includes(a) || ka.includes(kb) || kb.includes(ka)) {
      const shortLen = Math.min(a.length, b.length);
      const longLen = Math.max(a.length, b.length);
      const containment = Math.round(78 + (shortLen / longLen) * 17);
      return Math.min(95, containment);
    }

    const wordsA = new Set(titleWords(sessionTitle));
    const wordsB = new Set(titleWords(candidateTitle));
    const intersection = [...wordsA].filter(w => wordsB.has(w));
    if (!intersection.length) return 0;

    const maxSize = Math.max(wordsA.size, wordsB.size);
    const minSize = Math.min(wordsA.size, wordsB.size);
    const maxRatio = intersection.length / maxSize;
    const minRatio = intersection.length / minSize;
    let score = Math.round((maxRatio * 62) + (minRatio * 25));

    // Petit bonus si le mot principal est identique. Utile pour les titres avec sous-titre.
    const firstA = [...wordsA][0];
    const firstB = [...wordsB][0];
    if (firstA && firstB && firstA === firstB) score += 5;

    return Math.min(87, score);
  }

  function getLocalMatchCandidates(title, limit = 5) {
    const index = buildLocalFilmIndex();
    const byFilm = new Map();

    for (const item of index) {
      const score = scoreTitleMatch(title, item.title);
      if (!score) continue;
      const filmId = item.film?.id ?? item.film?.imdbID ?? item.title;
      const previous = byFilm.get(filmId);
      if (!previous || score > previous.score) {
        byFilm.set(filmId, { ...item, score });
      }
    }

    return Array.from(byFilm.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        film: item.film,
        titre: item.film?.titre || item.title,
        original: item.film?.original || item.film?.originalTitle || '',
        matchedTitle: item.title,
        score: item.score,
        imdb: item.film?.imdb ?? null,
        imdbID: item.film?.imdbID || ''
      }));
  }

  function findLocalFilmByTitle(title) {
    const best = getLocalMatchCandidates(title, 1)[0] || null;

    if (best && best.score >= 84) {
      return { film: best.film, matchedTitle: best.matchedTitle, score: best.score };
    }
    return null;
  }


  function getNearbyConfig() {
    if (window.CONFIG) return window.CONFIG;
    try { if (typeof CONFIG !== 'undefined') return CONFIG; } catch (_) {}
    return {};
  }

  function getTmdbImageBase(size = 'w500') {
    const cfg = getNearbyConfig();
    if (cfg.TMDB_IMG_BASE) return String(cfg.TMDB_IMG_BASE).replace(/\/$/, '');
    if (cfg.TMDB_IMG_LARGE && size !== 'w500') return String(cfg.TMDB_IMG_LARGE).replace(/\/$/, '');
    return `https://image.tmdb.org/t/p/${size}`;
  }

  function buildTmdbPosterUrl(path, size = 'w500') {
    if (!path) return '';
    if (/^https?:\/\//i.test(String(path))) return String(path);
    return `${getTmdbImageBase(size)}${String(path).startsWith('/') ? '' : '/'}${path}`;
  }

  function getMovieYear(value) {
    const text = String(value || '');
    const match = text.match(/\b(19\d{2}|20\d{2})\b/);
    return match ? Number(match[1]) : null;
  }

  function getTmdbConfigStatus() {
    const cfg = getNearbyConfig();
    return {
      hasKey: Boolean(cfg.TMDB_API_KEY),
      hasBaseUrl: Boolean(cfg.TMDB_BASE_URL),
      baseUrl: cfg.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
      language: cfg.LANGUAGE || 'fr-FR',
      region: cfg.REGION || 'FR'
    };
  }

  function getBestLocalRating(localMatch, rawMovie) {
    const localFilm = localMatch?.film || null;
    const candidates = [
      { source: 'IMDb', value: Number(localFilm?.imdb) },
      { source: 'Letterboxd', value: Number(localFilm?.lb) * 2 },
      { source: 'TMDB local', value: Number(localFilm?.tmdb ?? localFilm?.vote_average) },
      { source: 'Score local', value: Number(localFilm?.sc) },
      { source: 'IMDb brut', value: Number(rawMovie?.imdb ?? rawMovie?.imdbRating) },
      { source: 'TMDB brut', value: Number(rawMovie?.tmdb ?? rawMovie?.vote_average) },
      { source: 'Allociné brut', value: Number(rawMovie?.rating ?? rawMovie?.note ?? rawMovie?.score) }
    ];

    for (const item of candidates) {
      if (Number.isFinite(item.value) && item.value > 0) {
        return { source: item.source, value: Math.round(item.value * 10) / 10 };
      }
    }
    return null;
  }

  async function searchTmdbRating(title) {
    const enrichment = await searchTmdbEnrichment(title, { ratingOnly: true });
    if (!enrichment?.found) return null;
    const vote = Number(enrichment.tmdb ?? enrichment.voteAverage);
    if (!Number.isFinite(vote) || vote <= 0) return null;
    return {
      source: 'TMDB',
      value: Math.round(vote * 10) / 10,
      matchedTitle: enrichment.titre || enrichment.original || title,
      tmdbId: enrichment.tmdbId,
      score: enrichment.score || 0,
      posterPath: enrichment.posterPath || ''
    };
  }

  async function fetchTmdbMovieDetails(tmdbId) {
    const cfg = getNearbyConfig();
    const status = getTmdbConfigStatus();
    if (!status.hasKey || !tmdbId) return null;

    try {
      const params = new URLSearchParams({
        api_key: cfg.TMDB_API_KEY,
        language: status.language,
        append_to_response: 'external_ids,credits'
      });
      const response = await fetch(`${status.baseUrl}/movie/${encodeURIComponent(tmdbId)}?${params.toString()}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  async function searchTmdbEnrichment(title, options = {}) {
    const cacheKey = normalizeNearbyTitle(title);
    if (!cacheKey) return null;
    if (tmdbEnrichmentCache.has(cacheKey)) return tmdbEnrichmentCache.get(cacheKey);

    const cfg = getNearbyConfig();
    const status = getTmdbConfigStatus();
    if (!status.hasKey || !status.hasBaseUrl) {
      const disabled = {
        found: false,
        title,
        reason: 'CONFIG.TMDB_API_KEY ou CONFIG.TMDB_BASE_URL absent côté navigateur',
        tmdbDisabled: true
      };
      tmdbEnrichmentCache.set(cacheKey, disabled);
      return disabled;
    }

    try {
      const params = new URLSearchParams({
        api_key: cfg.TMDB_API_KEY,
        language: status.language,
        region: status.region,
        query: title,
        include_adult: 'false'
      });
      const response = await fetch(`${status.baseUrl}/search/movie?${params.toString()}`);
      if (!response.ok) throw new Error(`TMDB ${response.status}`);
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      let best = null;

      for (const result of results.slice(0, 10)) {
        const candidateTitle = result?.title || result?.name || result?.original_title || '';
        const originalTitle = result?.original_title || '';
        const score = Math.max(
          scoreTitleMatch(title, candidateTitle),
          scoreTitleMatch(title, originalTitle)
        );
        const popularity = Number(result?.popularity || 0);
        const releaseYear = getMovieYear(result?.release_date || '');
        const finalScore = score + Math.min(8, popularity / 20) + (releaseYear && releaseYear >= 2024 ? 4 : 0);
        if (!best || finalScore > best.finalScore) {
          best = { result, score, finalScore, candidateTitle, originalTitle };
        }
      }

      if (!best || best.score < 58) {
        const notFound = {
          found: false,
          title,
          reason: best ? `Score TMDB trop faible (${best.score})` : 'Aucun résultat TMDB',
          bestTitle: best?.candidateTitle || '',
          score: best?.score || 0
        };
        tmdbEnrichmentCache.set(cacheKey, notFound);
        return notFound;
      }

      const result = best.result;
      const details = options.ratingOnly ? null : await fetchTmdbMovieDetails(result.id);
      const genres = Array.isArray(details?.genres) ? details.genres.map(g => g.name).filter(Boolean) : [];
      const cast = Array.isArray(details?.credits?.cast) ? details.credits.cast.slice(0, 5).map(p => p.name).filter(Boolean) : [];
      const directors = Array.isArray(details?.credits?.crew)
        ? details.credits.crew.filter(p => p.job === 'Director').map(p => p.name).filter(Boolean)
        : [];
      const releaseDate = details?.release_date || result?.release_date || '';
      const vote = Number(details?.vote_average ?? result?.vote_average);

      const enriched = {
        found: true,
        source: 'TMDB',
        searchedTitle: title,
        titre: details?.title || result?.title || best.candidateTitle || title,
        original: details?.original_title || result?.original_title || best.originalTitle || '',
        annee: releaseDate ? Number(String(releaseDate).slice(0, 4)) || null : null,
        releaseDate,
        tmdbId: result?.id || details?.id || null,
        imdbID: details?.external_ids?.imdb_id || '',
        tmdb: Number.isFinite(vote) && vote > 0 ? Math.round(vote * 10) / 10 : null,
        voteAverage: Number.isFinite(vote) && vote > 0 ? Math.round(vote * 10) / 10 : null,
        synopsis: details?.overview || result?.overview || '',
        posterPath: details?.poster_path || result?.poster_path || '',
        poster: buildTmdbPosterUrl(details?.poster_path || result?.poster_path || ''),
        genres,
        runtime: details?.runtime || null,
        real: directors.join(', '),
        acteurs: cast.join(', '),
        score: best.score,
        tmdbRaw: options.keepRaw ? { search: result, details } : undefined
      };
      tmdbEnrichmentCache.set(cacheKey, enriched);
      return enriched;
    } catch (error) {
      const failed = {
        found: false,
        title,
        reason: error?.message || String(error),
        error: true
      };
      console.warn(`[Catalogue proche][TMDB] Enrichissement impossible pour "${title}" :`, failed.reason);
      tmdbEnrichmentCache.set(cacheKey, failed);
      return failed;
    }
  }

  async function enrichMissingMoviesWithTmdb(ranked, options = {}) {
    const missing = ranked.filter(movie => movie.enrichmentStatus === 'missing');
    const limit = Number.isFinite(Number(options.maxTmdbEnrichments)) ? Number(options.maxTmdbEnrichments) : 30;
    const results = [];
    const status = getTmdbConfigStatus();

    if (!status.hasKey || !status.hasBaseUrl) {
      console.warn('[Catalogue proche][TMDB] Enrichissement ignoré : CONFIG.TMDB_API_KEY ou CONFIG.TMDB_BASE_URL absent.', status);
      return { enriched: [], failed: missing.map(movie => ({ title: movie.title, reason: 'tmdb-config-absent' })), disabled: true };
    }

    for (const movie of missing.slice(0, limit)) {
      const enrichment = await searchTmdbEnrichment(movie.title);
      movie.tmdbEnrichment = enrichment;
      if (enrichment?.found) {
        movie.tmdbId = enrichment.tmdbId || movie.tmdbId;
        movie.tmdbDraft = enrichment;
        movie.enrichmentStatus = 'tmdb-enriched';
        movie.matchedTitle = movie.matchedTitle || enrichment.titre;
        movie.poster = movie.poster || enrichment.poster;
        if ((movie.ratingValue === null || movie.ratingValue === undefined) && enrichment.tmdb) {
          movie.ratingValue = enrichment.tmdb;
          movie.ratingSource = 'TMDB';
          movie.ratingKind = 'tmdb-enrichment';
        }
      }
      results.push({ movie, enrichment });
    }

    return {
      enriched: results.filter(item => item.enrichment?.found),
      failed: results.filter(item => !item.enrichment?.found),
      disabled: false
    };
  }

  async function resolveMovieRating(title, localMatch, rawMovie) {
    const localRating = getBestLocalRating(localMatch, rawMovie);
    if (localRating) {
      return {
        ...localRating,
        ratingKind: 'local',
        matchedTitle: localMatch?.film?.titre || localMatch?.matchedTitle || title,
        matchScore: localMatch?.score || 0
      };
    }

    const tmdbRating = await searchTmdbRating(title);
    if (tmdbRating) {
      return {
        source: tmdbRating.source,
        value: tmdbRating.value,
        ratingKind: 'tmdb',
        matchedTitle: tmdbRating.matchedTitle,
        matchScore: tmdbRating.score,
        tmdbId: tmdbRating.tmdbId,
        posterPath: tmdbRating.posterPath
      };
    }

    return null;
  }

  function firstString(...values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  function getDeep(obj, path) {
    try { return path.split('.').reduce((acc, key) => acc?.[key], obj); } catch (_) { return undefined; }
  }

  function isTechnicalShowtimeLabel(value) {
    const text = normalizeNearbyTitle(value);
    if (!text) return true;
    const compact = text.replace(/\s+/g, '');
    const blocked = new Set([
      'original', 'dubbed', 'local', 'vf', 'vo', 'vost', 'vostfr', 'version',
      'imax', '4dx', 'dolby', 'standard', 'seance', 'seances', 'showtime', 'showtimes',
      'dubbing', 'subtitled', 'subtitles', 'francais', 'french', 'english'
    ]);
    return blocked.has(text) || blocked.has(compact);
  }

  function looksLikeRealMovieTitle(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (isTechnicalShowtimeLabel(text)) return false;
    if (text.length < 2 || text.length > 140) return false;
    if (/^https?:\/\//i.test(text)) return false;
    if (/^\d{1,2}[:h]\d{0,2}$/i.test(text)) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return false;
    if (/^[A-Z]{1,3}\d{3,8}$/i.test(text)) return false;
    if (/^(vf|vo|vost|vostfr|imax|4dx|dolby|standard|version|seance|séance)$/i.test(text)) return false;
    return /[A-Za-zÀ-ÿ]/.test(text);
  }

  function keyLooksLikeMovieTitle(path = '') {
    const fullPath = String(path || '');
    const key = fullPath.split('.').pop().replace(/\[\d+\]/g, '');
    if (/diffusionVersion|version|format|language|lang|startsAt|time|date|horaire|showtimes|seances|sessions/i.test(key)) return false;
    return /^(title|titre|name|nom|label|movieTitle|filmTitle|workTitle|fullTitle|displayTitle|originalTitle|localizedTitle|primaryTitle|secondaryTitle)$/i.test(key)
      || /(movie|film|work|production|localized|original|display).*(title|titre|name|nom|label)/i.test(fullPath);
  }

  function extractMovieTitle(item) {
    if (typeof item === 'string' || typeof item === 'number') {
      const value = String(item).trim();
      return looksLikeRealMovieTitle(value) ? value : '';
    }
    if (!item || typeof item !== 'object') return '';
    return firstString(
      item.title, item.titre, item.name, item.nom, item.label, item.text,
      item.originalTitle, item.original_title, item.localizedTitle, item.localized_title,
      item.movieTitle, item.filmTitle, item.workTitle, item.fullTitle, item.displayTitle,
      item.titleText?.text, item.originalTitleText?.text, item.primaryTitle, item.secondaryTitle,
      getDeep(item, 'movie.title'), getDeep(item, 'movie.name'), getDeep(item, 'movie.titre'), getDeep(item, 'movie.label'),
      getDeep(item, 'film.title'), getDeep(item, 'film.name'), getDeep(item, 'film.titre'), getDeep(item, 'film.label'),
      getDeep(item, 'work.title'), getDeep(item, 'work.name'), getDeep(item, 'show.title'), getDeep(item, 'show.name'),
      getDeep(item, 'entity.title'), getDeep(item, 'entity.name'), getDeep(item, 'data.title'), getDeep(item, 'data.name'),
      getDeep(item, 'data.movie.title'), getDeep(item, 'data.film.title'), getDeep(item, 'node.title'), getDeep(item, 'node.name')
    );
  }

  function extractMovieObject(item) {
    if (typeof item === 'string') return { title: item };
    if (!item || typeof item !== 'object') return null;
    const candidates = [
      item.movie, item.film, item.filmShow, item.show, item.entity, item.work, item.node,
      item.movieShow, item.data?.movie, item.data?.film, item.data?.work, item.production, item
    ];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && extractMovieTitle(candidate)) return candidate;
    }
    return item;
  }

  function extractPoster(item, rawItem) {
    return firstString(
      item?.poster, item?.posterUrl, item?.poster_path, item?.image, item?.imageUrl,
      item?.cover, item?.thumbnail, rawItem?.poster, rawItem?.image,
      rawItem?.movie?.poster, rawItem?.film?.poster
    );
  }

  function startOfLocalDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getNearbyWindowBounds() {
    const start = startOfLocalDay(new Date());
    const endExclusive = new Date(start);
    // J+7 inclus = on garde tout jusqu'au début de J+8.
    endExclusive.setDate(endExclusive.getDate() + 8);
    return { start, endExclusive };
  }

  function parseShowtimeDate(value, fallbackDate = null) {
    if (value === null || value === undefined) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const text = String(value).trim();
    if (!text) return null;

    // Format ISO : 2026-05-23T17:00:00 ou 2026-05-23 17:00.
    const isoMatch = text.match(/(20\d{2}-\d{2}-\d{2})(?:[T\s]+(\d{1,2})[:h](\d{2}))?/);
    if (isoMatch) {
      const [, day, hour = '0', minute = '0'] = isoMatch;
      const parsed = new Date(`${day}T${String(hour).padStart(2, '0')}:${minute}:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Format heure seule : 17:00 ou 17h00. On rattache à la date de la séance si elle existe, sinon aujourd'hui.
    const timeMatch = text.match(/\b(\d{1,2})[:h](\d{2})\b/);
    if (timeMatch) {
      const base = fallbackDate ? startOfLocalDay(fallbackDate) : startOfLocalDay(new Date());
      base.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      return base;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isShowtimeInNearbyWindow(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
    const { start, endExclusive } = getNearbyWindowBounds();
    return date >= start && date < endExclusive;
  }

  function formatNearbyShowtime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const today = startOfLocalDay(new Date());
    const day = startOfLocalDay(date);
    const diffDays = Math.round((day - today) / 86400000);
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    if (diffDays === 0) return `Aujourd’hui à ${time}`;
    if (diffDays === 1) return `Demain à ${time}`;
    const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)} à ${time}`;
  }

  function keyLooksLikeShowtimeDate(key = '') {
    return /(startsAt|startAt|datetime|dateTime|showtime|showTime|horaire|time|date|jour|day|seance|séance|session)/i.test(String(key));
  }

  function extractShowtimeEntries(item) {
    const entries = [];
    const seenObjects = new WeakSet();

    function pushDate(rawValue, fallbackDate = null) {
      const parsed = parseShowtimeDate(rawValue, fallbackDate);
      if (!parsed || !isShowtimeInNearbyWindow(parsed)) return;
      entries.push({ date: parsed, label: formatNearbyShowtime(parsed), raw: rawValue });
    }

    function visit(node, path = '$', fallbackDate = null, depth = 0) {
      if (node === null || node === undefined || depth > 8) return;

      if (typeof node === 'string' || typeof node === 'number' || node instanceof Date) {
        if (keyLooksLikeShowtimeDate(path)) pushDate(node, fallbackDate);
        return;
      }

      if (typeof node !== 'object') return;
      if (seenObjects.has(node)) return;
      seenObjects.add(node);

      const objectDate = parseShowtimeDate(firstString(node.date, node.day, node.jour, node.showDate, node.sessionDate), fallbackDate) || fallbackDate;

      const directValues = [
        node.startsAt, node.startAt, node.start, node.datetime, node.dateTime,
        node.showtime, node.showTime, node.time, node.horaire, node.hour, node.heure
      ];
      for (const value of directValues) pushDate(value, objectDate);

      if (Array.isArray(node)) {
        node.forEach((child, index) => visit(child, `${path}[${index}]`, objectDate, depth + 1));
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        visit(value, `${path}.${key}`, objectDate, depth + 1);
      }
    }

    visit(item);

    const unique = [];
    const seen = new Set();
    for (const entry of entries.sort((a, b) => a.date - b.date)) {
      const key = entry.date.toISOString().slice(0, 16);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(entry.label);
    }
    return unique;
  }

  function extractShowtimes(item) {
    if (!item || typeof item !== 'object') return [];
    const filtered = extractShowtimeEntries(item);
    if (filtered.length) return filtered;

    // Sécurité : si l'API ne donne que des heures sans date dans un tableau classique,
    // on les rattache à aujourd'hui uniquement si elles sont exploitables.
    const possibleArrays = [item.horaires, item.times, item.showtimes, item.seances, item.sessions, item.scr, item.version?.times];
    const fallback = [];
    for (const arr of possibleArrays) {
      if (!Array.isArray(arr)) continue;
      for (const value of arr) {
        const parsed = parseShowtimeDate(typeof value === 'string' ? value : firstString(value?.startsAt, value?.time, value?.horaire));
        if (parsed && isShowtimeInNearbyWindow(parsed)) fallback.push(formatNearbyShowtime(parsed));
      }
    }
    return [...new Set(fallback)];
  }

  function normalizeShowtimeItem(rawItem) {
    const movieObject = extractMovieObject(rawItem);
    const title = extractMovieTitle(movieObject) || extractMovieTitle(rawItem);
    if (!title || !looksLikeRealMovieTitle(title)) return null;
    const horaires = extractShowtimes(rawItem);
    // ZIP 3.5 : le Catalogue ne garde que les films avec au moins une séance entre aujourd'hui et J+7.
    if (!horaires.length) return null;
    return {
      title,
      normalizedKey: normalizeNearbyTitle(title),
      rawMovie: movieObject || rawItem,
      rawItem,
      poster: extractPoster(movieObject, rawItem),
      horaires
    };
  }

  async function fetchJsonWithDebug(url, label) {
    console.log(`[Catalogue proche][DEBUG] Appel ${label} :`, url);
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    let json = null;
    let text = '';
    if (contentType.includes('application/json')) json = await response.json();
    else text = await response.text();
    console.log(`[Catalogue proche][DEBUG] Réponse ${label} :`, {
      status: response.status,
      ok: response.ok,
      contentType,
      json,
      textPreview: text ? text.slice(0, 300) : ''
    });
    if (!response.ok) throw new Error(`${label} ${response.status}`);
    return json;
  }

  function isLikelyAllocineCinemaId(value) {
    const text = String(value || '').trim();
    // Exemples observés : B0016, B0218, W9329.
    // On reste volontairement large pour ne pas rater un format Cinéro/Allociné proche.
    return /^[A-Z][0-9]{3,8}$/i.test(text) || /^[A-Z]{1,3}[0-9]{2,8}$/i.test(text);
  }

  function extractIdsFromString(value, path, candidates) {
    const text = String(value || '');
    if (!text) return;
    const matches = text.match(/\b[A-Z]{1,3}[0-9]{3,8}\b/gi) || [];
    for (const match of matches) {
      candidates.push({ id: match.toUpperCase(), path, reason: 'string-match', raw: text.slice(0, 180) });
    }
  }

  function scoreCinemaIdCandidate(candidate, cinemaName) {
    const path = String(candidate.path || '').toLowerCase();
    const raw = String(candidate.raw || '').toLowerCase();
    const normalizedCinema = normalizeNearbyTitle(cinemaName);
    let score = 0;

    if (/allocine|theater|cinema|cine|id|code/.test(path)) score += 40;
    if (/^id$|\.id$|_id$|cinemaid|cinema_id|allocineid|theater\.id/.test(path)) score += 50;
    if (/movie|film|show|session|seance|poster|image|rating|note/.test(path)) score -= 35;
    if (normalizedCinema && normalizeNearbyTitle(raw).includes(normalizedCinema.slice(0, Math.min(12, normalizedCinema.length)))) score += 25;
    if (candidate.id && /^[BW][0-9]/i.test(candidate.id)) score += 12;
    if (candidate.reason === 'direct-key') score += 15;
    return score;
  }

  function collectCinemaIdCandidates(data, cinemaName) {
    const candidates = [];
    const seenObjects = new WeakSet();
    const importantKeys = new Set([
      'id', 'cinema_id', 'cinemaId', 'allocineId', 'allocine_id', 'theaterId', 'theater_id',
      'code', 'codeAllocine', 'allocineCode', 'entityId', 'placeId'
    ]);

    function visit(node, path = '$', depth = 0) {
      if (node === null || node === undefined || depth > 10) return;

      if (typeof node === 'string' || typeof node === 'number') {
        const value = String(node).trim();
        if (isLikelyAllocineCinemaId(value)) {
          candidates.push({
            id: value.toUpperCase(),
            path,
            reason: importantKeys.has(path.split('.').pop()) ? 'direct-key' : 'value-match',
            raw: value
          });
        } else if (typeof node === 'string') {
          extractIdsFromString(node, path, candidates);
        }
        return;
      }

      if (typeof node !== 'object') return;
      if (seenObjects.has(node)) return;
      seenObjects.add(node);

      if (Array.isArray(node)) {
        node.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        const nextPath = `${path}.${key}`;
        if (importantKeys.has(key) && (typeof value === 'string' || typeof value === 'number')) {
          const id = String(value).trim();
          if (isLikelyAllocineCinemaId(id)) {
            candidates.push({ id: id.toUpperCase(), path: nextPath, reason: 'direct-key', raw: id });
          }
        }
        visit(value, nextPath, depth + 1);
      }
    }

    visit(data);

    const deduped = [];
    const seen = new Set();
    for (const candidate of candidates) {
      const key = `${candidate.id}|${candidate.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        ...candidate,
        score: scoreCinemaIdCandidate(candidate, cinemaName)
      });
    }

    return deduped.sort((a, b) => b.score - a.score);
  }

  async function getCinemaAllocineId(cinema) {
    const params = new URLSearchParams({
      name: cinema?.nom || '',
      lat: cinema?.location?.lat || '',
      lng: cinema?.location?.lng || ''
    });
    const data = await fetchJsonWithDebug(`${NEARBY_CATALOGUE_API}/search-cinema?${params}`, `search-cinema pour ${cinema?.nom}`);

    const candidates = collectCinemaIdCandidates(data, cinema?.nom || '');
    if (candidates.length) {
      console.group(`[Catalogue proche][DEBUG] IDs candidats pour ${cinema?.nom}`);
      console.table(candidates.slice(0, 20).map(candidate => ({
        id: candidate.id,
        score: candidate.score,
        chemin: candidate.path,
        raison: candidate.reason,
        aperçu: String(candidate.raw || '').slice(0, 90)
      })));
      console.groupEnd();
    }

    const best = candidates.find(candidate => candidate.score >= 0) || candidates[0] || null;
    const id = best?.id || null;

    if (id) {
      console.log(`[Catalogue proche][DEBUG] ID extrait pour ${cinema?.nom} :`, id, best);
    } else {
      console.warn(`[Catalogue proche][DEBUG] Aucun ID cinéma trouvé pour ${cinema?.nom}. JSON complet ci-dessous :`, data);
    }
    return id;
  }

  function looksLikeMovieShowtimeObject(value) {
    if (typeof value === 'string') return looksLikeRealMovieTitle(value);
    if (!value || typeof value !== 'object') return false;
    if (extractMovieTitle(value)) return true;
    const nested = extractMovieObject(value);
    return Boolean(nested && nested !== value && extractMovieTitle(nested));
  }

  function parseEmbeddedJson(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || !/^[\[{]/.test(text)) return null;
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  function collectTitleCandidatesFromHtml(html = '') {
    const candidates = [];
    const text = String(html || '');
    if (!text || !/[<>]/.test(text)) return candidates;

    const attrPatterns = [
      /(?:data-title|data-movie-title|title|alt|aria-label)=['"]([^'"]{2,140})['"]/gi,
      /<h[1-6][^>]*>([^<]{2,140})<\/h[1-6]>/gi,
      /<[^>]*(?:movie|film|title)[^>]*>([^<]{2,140})<\/[^>]+>/gi
    ];

    for (const pattern of attrPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const title = decodeHtml(match[1]);
        if (looksLikeRealMovieTitle(title)) candidates.push({ title, rawItem: { title, source: 'html' } });
      }
    }
    return candidates;
  }

  function extractSeancesArray(data) {
    // ZIP 2.9.9 : on ne suppose plus une structure précise.
    // L'API /seances peut renvoyer les films dans data, results, showtimes, movie, film,
    // ou même dans des fragments HTML/JSON imbriqués. On scanne tout récursivement.
    const found = [];
    const seenObjects = new WeakSet();

    function addCandidate(title, rawItem, path, reason) {
      const cleanTitle = String(title || '').trim();
      if (!looksLikeRealMovieTitle(cleanTitle)) return;
      found.push({
        title: cleanTitle,
        rawItem: rawItem && typeof rawItem === 'object' ? rawItem : { title: cleanTitle },
        path,
        reason
      });
    }

    function visit(node, path = '$', parent = null, depth = 0) {
      if (node === null || node === undefined || depth > 14) return;

      if (typeof node === 'string' || typeof node === 'number') {
        const value = String(node).trim();
        const parsed = parseEmbeddedJson(value);
        if (parsed) visit(parsed, `${path}{json}`, parent, depth + 1);

        for (const candidate of collectTitleCandidatesFromHtml(value)) {
          addCandidate(candidate.title, parent || candidate.rawItem, `${path}{html}`, 'html-title');
        }

        if (keyLooksLikeMovieTitle(path)) addCandidate(value, parent || { title: value }, path, 'title-key-string');
        return;
      }

      if (typeof node !== 'object') return;
      if (seenObjects.has(node)) return;
      seenObjects.add(node);

      const directTitle = extractMovieTitle(node);
      if (directTitle) addCandidate(directTitle, node, path, 'object-title');

      if (Array.isArray(node)) {
        node.forEach((item, index) => visit(item, `${path}[${index}]`, parent, depth + 1));
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        const nextPath = `${path}.${key}`;
        if ((typeof value === 'string' || typeof value === 'number') && keyLooksLikeMovieTitle(nextPath)) {
          addCandidate(value, node, nextPath, 'title-key');
        }
        visit(value, nextPath, node, depth + 1);
      }
    }

    visit(data);

    const unique = [];
    const seenKeys = new Set();
    for (const candidate of found) {
      const normalized = normalizeNearbyTitle(candidate.title);
      if (!normalized || seenKeys.has(normalized)) continue;
      seenKeys.add(normalized);
      const raw = candidate.rawItem || { title: candidate.title };
      if (raw && typeof raw === 'object' && !extractMovieTitle(raw)) {
        raw.title = candidate.title;
      }
      unique.push(raw);
    }

    if (!unique.length) {
      console.warn('[Catalogue proche][DEBUG] Aucun film extrait de /seances. JSON complet analysé :', data);
    } else {
      console.group('[Catalogue proche][DEBUG] Candidats films extraits de /seances');
      console.table(unique.slice(0, 60).map((item, index) => ({
        index,
        titre: extractMovieTitle(extractMovieObject(item)) || extractMovieTitle(item),
        cles: item && typeof item === 'object' ? Object.keys(item).slice(0, 8).join(', ') : typeof item
      })));
      console.groupEnd();
    }

    return unique;
  }

  async function getCinemaShowtimes(cinema) {
    const allocineId = await getCinemaAllocineId(cinema);
    if (!allocineId) return [];

    const requestedDate = new Date().toISOString().split('T')[0];
    const url = `${NEARBY_CATALOGUE_API}/seances-auto?id=${encodeURIComponent(allocineId)}&date=${requestedDate}&days=7`;
    const data = await fetchJsonWithDebug(url, `seances-auto pour ${cinema?.nom}`);

    console.log(`[Catalogue proche][DEBUG] JSON complet /seances-auto pour ${cinema?.nom} :`, data);
    console.log(`[Catalogue proche][DEBUG] Date demandée / date utilisée pour ${cinema?.nom} :`, {
      requestedDate: data?.requested_date || requestedDate,
      usedDate: data?.date || requestedDate,
      attempts: data?.attempts || []
    });

    const rawShowtimes = extractSeancesArray(data);
    console.log(`[Catalogue proche][DEBUG] Tableau extrait pour ${cinema?.nom} :`, rawShowtimes);
    if (rawShowtimes[0]) {
      console.log(`[Catalogue proche][DEBUG] Premier objet brut pour ${cinema?.nom} :`, rawShowtimes[0]);
      console.log(`[Catalogue proche][DEBUG] Clés premier objet pour ${cinema?.nom} :`, Object.keys(rawShowtimes[0] || {}));
    }
    return rawShowtimes.map(normalizeShowtimeItem).filter(Boolean);
  }

  function injectNearbyCatalogueStyles() {
    if (document.getElementById('nearby-catalogue-29-style')) return;
    const style = document.createElement('style');
    style.id = 'nearby-catalogue-29-style';
    style.textContent = `
      .nearby-catalogue-panel{max-width:1120px;margin:28px auto;padding:0 18px;font-family:inherit;color:#151515;}
      .nearby-catalogue-box{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:28px;box-shadow:0 18px 60px rgba(0,0,0,.08);overflow:hidden;}
      .nearby-catalogue-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:24px 26px;border-bottom:1px solid rgba(0,0,0,.07);}
      .nearby-catalogue-head h2{margin:0;font-size:24px;letter-spacing:-.03em;}
      .nearby-catalogue-head p{margin:6px 0 0;color:#777;font-size:14px;}
      .nearby-catalogue-stats{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
      .nearby-catalogue-stat{border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:9px 13px;background:#fafafa;font-size:13px;white-space:nowrap;}
      .nearby-catalogue-stat strong{font-size:16px;margin-right:4px;}
      .nearby-catalogue-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;padding:20px;}
      .nearby-movie-card{border:1px solid rgba(0,0,0,.08);border-radius:22px;padding:14px;background:#fff;display:grid;grid-template-columns:64px 1fr;gap:12px;min-height:145px;}
      .nearby-movie-poster{width:64px;height:96px;border-radius:14px;object-fit:cover;background:#f3f3f3;border:1px solid rgba(0,0,0,.06);}
      .nearby-movie-poster-empty{width:64px;height:96px;border-radius:14px;background:linear-gradient(135deg,#f5f5f5,#e9e9e9);border:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;color:#999;font-size:22px;}
      .nearby-movie-body{display:flex;flex-direction:column;gap:8px;min-width:0;}
      .nearby-movie-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
      .nearby-movie-title{font-weight:800;font-size:16px;line-height:1.2;letter-spacing:-.02em;}
      .nearby-badge{border-radius:999px;padding:6px 9px;font-size:12px;font-weight:800;white-space:nowrap;}
      .nearby-badge-rated{background:#e9f8ef;color:#147a3c;}
      .nearby-badge-new{background:#fff3d8;color:#8a5a00;}
      .nearby-movie-meta{color:#666;font-size:13px;line-height:1.45;}
      .nearby-movie-cinemas{color:#333;font-size:13px;line-height:1.45;}
      .nearby-movie-synopsis{color:#777;font-size:12.5px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .nearby-missing-box{padding:18px 24px;border-top:1px solid rgba(0,0,0,.07);background:#fafafa;}
      .nearby-missing-box h3{margin:0 0 8px;font-size:16px;}
      .nearby-missing-list{margin:0;color:#666;font-size:13px;line-height:1.6;}
      @media(max-width:720px){.nearby-catalogue-head{flex-direction:column}.nearby-catalogue-stats{justify-content:flex-start}.nearby-catalogue-list{grid-template-columns:1fr}.nearby-catalogue-panel{padding:0 12px}}
    `;
    document.head.appendChild(style);
  }

  function getRenderMount() {
    let mount = document.getElementById('nearby-catalogue-results');
    if (mount) return mount;

    mount = document.createElement('section');
    mount.id = 'nearby-catalogue-results';
    mount.className = 'nearby-catalogue-panel';

    const hero = document.querySelector('main') || document.body;
    hero.appendChild(mount);
    return mount;
  }

  function renderNearbyRankedMovies(ranked, stats) {
    if (typeof document === 'undefined') return;
    injectNearbyCatalogueStyles();
    const mount = getRenderMount();
    const missing = ranked.filter(movie => movie.enrichmentStatus === 'missing');

    const cards = ranked.map((movie, index) => {
      const hasRating = movie.ratingValue !== null && movie.ratingValue !== undefined;
      const badge = hasRating
        ? `<span class="nearby-badge nearby-badge-rated">★ ${movie.ratingValue} ${movie.ratingSource || ''}</span>`
        : (movie.enrichmentStatus === 'tmdb-enriched'
          ? '<span class="nearby-badge nearby-badge-rated">TMDB trouvé</span>'
          : '<span class="nearby-badge nearby-badge-new">À vérifier</span>');
      const cinemas = movie.cinemas.map(c => c.nom).join(', ');
      const displayTitle = movie.tmdbDraft?.titre || movie.matchedTitle || movie.title;
      const year = movie.tmdbDraft?.annee || movie.localFilm?.annee || movie.localFilm?.year || '';
      const matched = movie.localFilm
        ? `Catalogue local${year ? ` · ${year}` : ''}`
        : (movie.tmdbDraft?.titre ? `TMDB fusionné${year ? ` · ${year}` : ''}` : 'Absent du catalogue');
      const poster = movie.poster || movie.tmdbDraft?.poster || movie.localFilm?.poster || '';
      const synopsis = movie.tmdbDraft?.synopsis || movie.localFilm?.synopsis || movie.localFilm?.desc || '';
      return `
        <article class="nearby-movie-card">
          ${poster ? `<img class="nearby-movie-poster" src="${escapeHtml(poster)}" alt="Affiche ${escapeHtml(displayTitle)}" loading="lazy">` : '<div class="nearby-movie-poster-empty">🎬</div>'}
          <div class="nearby-movie-body">
            <div class="nearby-movie-top">
              <div class="nearby-movie-title">${index + 1}. ${escapeHtml(displayTitle)}</div>
              ${badge}
            </div>
            <div class="nearby-movie-meta">Séance : ${escapeHtml(movie.title)} · ${matched}</div>
            ${synopsis ? `<div class="nearby-movie-synopsis">${escapeHtml(synopsis)}</div>` : ''}
            <div class="nearby-movie-cinemas">${escapeHtml(cinemas || 'Cinéma non précisé')}</div>
          </div>
        </article>
      `;
    }).join('');

    mount.innerHTML = `
      <div class="nearby-catalogue-box">
        <div class="nearby-catalogue-head">
          <div>
            <h2>Films proches trouvés</h2>
            <p>ZIP 3.5 : uniquement les films avec une séance entre aujourd’hui et J+7, avec horaires lisibles.</p>
          </div>
          <div class="nearby-catalogue-stats">
            <div class="nearby-catalogue-stat"><strong>${stats.total}</strong> films</div>
            <div class="nearby-catalogue-stat"><strong>${stats.rated}</strong> classés</div>
            <div class="nearby-catalogue-stat"><strong>${stats.tmdbEnriched || 0}</strong> fusionnés TMDB</div>
            <div class="nearby-catalogue-stat"><strong>${stats.missing}</strong> à vérifier</div>
          </div>
        </div>
        <div class="nearby-catalogue-list">${cards || '<p>Aucun film trouvé.</p>'}</div>
        ${missing.length ? `
          <div class="nearby-missing-box">
            <h3>Films absents de js/data.js</h3>
            <p class="nearby-missing-list">${escapeHtml(missing.map(m => m.title).join(' · '))}</p>
          </div>` : ''}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function buildMissingCatalogueDraft(ranked) {
    return ranked
      .filter(movie => movie.enrichmentStatus === 'missing' || movie.enrichmentStatus === 'tmdb-enriched')
      .map((movie, index) => ({
        id: `todo-${index + 1}`,
        titre: movie.title,
        original: movie.tmdbDraft?.original || '',
        genre: movie.tmdbDraft?.genres?.join(', ') || 'À compléter',
        duree: movie.tmdbDraft?.runtime ? `${movie.tmdbDraft.runtime} min` : '',
        real: movie.tmdbDraft?.real || '',
        acteurs: movie.tmdbDraft?.acteurs || '',
        synopsis: movie.tmdbDraft?.synopsis || 'À enrichir',
        poster: movie.tmdbDraft?.poster || movie.poster || '',
        color: 'p1',
        badge: movie.enrichmentStatus === 'tmdb-enriched' ? 'TMDB trouvé' : 'À enrichir',
        lb: null,
        imdb: null,
        tmdb: movie.tmdbDraft?.tmdb ?? null,
        sc: null,
        annee: movie.tmdbDraft?.annee ?? null,
        imdbID: movie.tmdbDraft?.imdbID || '',
        tmdbId: movie.tmdbDraft?.tmdbId || movie.tmdbId || '',
        tmdbScore: movie.tmdbDraft?.score || 0,
        bestLocalCandidates: movie.bestLocalCandidates || [],
        cinemas: movie.cinemas.map(c => ({ nom: c.nom, horaires: c.horaires || [] }))
      }));
  }

  function buildEnrichedCatalogueDraft(ranked) {
    return ranked
      .filter(movie => movie.enrichmentStatus === 'tmdb-enriched' && movie.tmdbDraft?.found)
      .map((movie, index) => ({
        id: `tmdb-${movie.tmdbDraft.tmdbId || index + 1}`,
        titre: movie.tmdbDraft.titre || movie.title,
        original: movie.tmdbDraft.original || '',
        genre: movie.tmdbDraft.genres?.join(', ') || 'À compléter',
        duree: movie.tmdbDraft.runtime ? `${movie.tmdbDraft.runtime} min` : '',
        real: movie.tmdbDraft.real || '',
        acteurs: movie.tmdbDraft.acteurs || '',
        synopsis: movie.tmdbDraft.synopsis || 'À enrichir',
        poster: movie.tmdbDraft.poster || '',
        color: 'p1',
        badge: 'TMDB',
        lb: null,
        imdb: null,
        tmdb: movie.tmdbDraft.tmdb ?? null,
        sc: null,
        annee: movie.tmdbDraft.annee ?? null,
        imdbID: movie.tmdbDraft.imdbID || '',
        tmdbId: movie.tmdbDraft.tmdbId || '',
        source: 'tmdb-enrichment-draft',
        seanceTitle: movie.title,
        cinemas: movie.cinemas.map(c => ({ nom: c.nom, horaires: c.horaires || [] }))
      }));
  }


  function buildRuntimeCatalogueFusion(ranked) {
    const localFilms = getGlobalFilms().map(film => ({
      ...film,
      source: film?.source || 'local-js-data'
    }));

    const tmdbRuntimeFilms = ranked
      .filter(movie => movie.enrichmentStatus === 'tmdb-enriched' && movie.tmdbDraft?.found)
      .map(movie => ({
        id: `runtime-tmdb-${movie.tmdbDraft.tmdbId || canonicalNearbyTitleKey(movie.title)}`,
        titre: movie.tmdbDraft.titre || movie.title,
        title: movie.tmdbDraft.titre || movie.title,
        original: movie.tmdbDraft.original || '',
        originalTitle: movie.tmdbDraft.original || '',
        genre: movie.tmdbDraft.genres?.join(', ') || 'À compléter',
        genres: movie.tmdbDraft.genres || [],
        duree: movie.tmdbDraft.runtime ? `${movie.tmdbDraft.runtime} min` : '',
        runtime: movie.tmdbDraft.runtime || null,
        real: movie.tmdbDraft.real || '',
        acteurs: movie.tmdbDraft.acteurs || '',
        synopsis: movie.tmdbDraft.synopsis || '',
        poster: movie.tmdbDraft.poster || '',
        color: 'p1',
        badge: 'TMDB',
        lb: null,
        imdb: null,
        tmdb: movie.tmdbDraft.tmdb ?? null,
        sc: movie.tmdbDraft.tmdb ?? null,
        annee: movie.tmdbDraft.annee ?? null,
        year: movie.tmdbDraft.annee ?? null,
        imdbID: movie.tmdbDraft.imdbID || '',
        tmdbId: movie.tmdbDraft.tmdbId || '',
        source: 'tmdb-runtime-fusion',
        seanceTitle: movie.title,
        cinemas: movie.cinemas.map(c => ({ nom: c.nom, horaires: c.horaires || [] }))
      }));

    const seen = new Set();
    const merged = [];
    for (const film of [...localFilms, ...tmdbRuntimeFilms]) {
      const key = film?.tmdbId ? `tmdb:${film.tmdbId}` : canonicalNearbyTitleKey(film?.titre || film?.title || film?.original || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(film);
    }

    return {
      localCount: localFilms.length,
      tmdbRuntimeCount: tmdbRuntimeFilms.length,
      total: merged.length,
      films: merged,
      tmdbRuntimeFilms
    };
  }



  function buildNearbyCatalogueRankedExport(ranked) {
    return ranked.map((movie, index) => {
      const local = movie.localFilm || null;
      const tmdb = movie.tmdbDraft || null;
      const bestTitle = local?.titre || tmdb?.titre || movie.title;
      const bestOriginal = local?.original || tmdb?.original || '';
      const bestGenres = local?.genre || (Array.isArray(tmdb?.genres) ? tmdb.genres.join(', ') : '') || 'À compléter';
      const bestPoster = local?.poster || tmdb?.poster || movie.poster || '';
      const bestSynopsis = local?.synopsis || tmdb?.synopsis || 'Synopsis à compléter.';
      const bestYear = local?.annee ?? tmdb?.annee ?? null;
      const bestTmdb = Number.isFinite(Number(local?.tmdb)) ? Number(local.tmdb) : (Number.isFinite(Number(tmdb?.tmdb)) ? Number(tmdb.tmdb) : null);
      const bestImdb = Number.isFinite(Number(local?.imdb)) ? Number(local.imdb) : null;
      const bestLb = Number.isFinite(Number(local?.lb)) ? Number(local.lb) : null;
      const bestSc = Number.isFinite(Number(local?.sc)) ? Number(local.sc) : (bestTmdb ?? null);
      const bestRating = Number.isFinite(Number(movie.ratingValue)) ? Number(movie.ratingValue) : (bestImdb ?? bestTmdb ?? bestSc ?? bestLb ?? null);
      const ratingSource = movie.ratingSource || (bestImdb ? 'IMDb' : (bestTmdb ? 'TMDB' : (bestSc ? 'Note' : '—')));

      return {
        ...(local || {}),
        id: local?.id || `nearby-${tmdb?.tmdbId || canonicalNearbyTitleKey(bestTitle) || index}`,
        titre: bestTitle,
        title: bestTitle,
        original: bestOriginal,
        originalTitle: bestOriginal,
        genre: bestGenres,
        genres: Array.isArray(tmdb?.genres) ? tmdb.genres : (Array.isArray(local?.genres) ? local.genres : []),
        duree: local?.duree || (tmdb?.runtime ? `${tmdb.runtime} min` : ''),
        runtime: local?.runtime || tmdb?.runtime || null,
        real: local?.real || tmdb?.real || 'Non renseigné',
        acteurs: local?.acteurs || tmdb?.acteurs || 'Non renseigné',
        synopsis: bestSynopsis,
        poster: bestPoster,
        color: local?.color || 'p1',
        badge: local ? 'À l’affiche' : 'TMDB proche',
        lb: bestLb,
        imdb: bestImdb,
        tmdb: bestTmdb,
        sc: bestSc,
        bestNote: bestRating,
        bestNoteSource: ratingSource,
        annee: bestYear,
        year: bestYear,
        imdbID: local?.imdbID || tmdb?.imdbID || '',
        tmdbId: local?.tmdbId || tmdb?.tmdbId || movie.tmdbId || '',
        source: local ? 'nearby-local-catalogue' : 'nearby-tmdb-runtime',
        isNearbyShowing: true,
        nearbyRank: index + 1,
        nearbyStatus: movie.enrichmentStatus,
        nearbyMatchedTitle: movie.matchedTitle || tmdb?.titre || '',
        nearbyRatingValue: bestRating,
        nearbyRatingSource: ratingSource,
        nearbyCinemas: movie.cinemas.map(c => ({
          nom: c.nom,
          adresse: c.adresse || '',
          distanceKm: c.distanceKm ?? null,
          horaires: c.horaires || []
        })),
        cinemas: movie.cinemas.map(c => ({ nom: c.nom, horaires: c.horaires || [] }))
      };
    }).sort((a, b) => {
      const ar = Number(a.bestNote ?? a.nearbyRatingValue ?? 0);
      const br = Number(b.bestNote ?? b.nearbyRatingValue ?? 0);
      if (br !== ar) return br - ar;
      return String(a.titre || '').localeCompare(String(b.titre || ''), 'fr');
    });
  }

  async function getNearbyRankedMovies(options = {}) {
    if (!window.PLACES) throw new Error('PLACES n’est pas chargé. Vérifie js/places.js.');

    const nearbyConfig = getNearbyConfig();
    const radius = options.radius || nearbyConfig.SEARCH_RADIUS || 15000;
    let location = options.location || null;
    if (!location && options.address) {
      const geocoded = await window.PLACES.geocodeAddress(options.address);
      location = geocoded.location;
    }
    if (!location) location = await window.PLACES.geolocate();

    console.log('[Catalogue proche] ZIP 3.5 actif — Catalogue limité aux séances de J à J+7.');
    console.log('[Catalogue proche] Position utilisée :', location);

    const cinemas = await window.PLACES.findNearbycinemas(location, radius);
    const maxCinemas = Number.isFinite(Number(options.maxCinemas)) ? Number(options.maxCinemas) : 8;
    console.log(`[Catalogue proche] ${cinemas.length} cinéma(s) trouvé(s).`, cinemas);
    console.log(`[Catalogue proche] Analyse sur ${Math.min(cinemas.length, maxCinemas)} cinéma(s).`);

    const moviesByKey = new Map();
    const matchDebug = [];

    for (const cinema of cinemas.slice(0, maxCinemas)) {
      try {
        console.log(`[Catalogue proche] Recherche films pour ${cinema.nom}...`);
        const showtimes = await getCinemaShowtimes(cinema);
        console.log(`[Catalogue proche] ${cinema.nom} : ${showtimes.length} film(s) trouvé(s).`, showtimes);

        for (const item of showtimes) {
          const title = item.title;
          const key = canonicalNearbyTitleKey(item.normalizedKey || title);
          if (!key) continue;

          const localCandidates = getLocalMatchCandidates(title, 3);
          const localMatch = localCandidates[0]?.score >= 84 ? { film: localCandidates[0].film, matchedTitle: localCandidates[0].matchedTitle, score: localCandidates[0].score } : null;
          const rating = await resolveMovieRating(title, localMatch, item.rawMovie);
          const enrichmentStatus = localMatch ? 'catalogue' : 'missing';

          matchDebug.push({
            seances: title,
            catalogue: localMatch?.film?.titre || localMatch?.matchedTitle || 'ABSENT',
            statut: enrichmentStatus === 'catalogue' ? 'Classé' : 'À enrichir',
            scoreLocal: localMatch?.score || localCandidates[0]?.score || 0,
            meilleursCandidats: localCandidates.map(c => `${c.titre} (${c.score})`).join(' | ') || '—',
            note: rating?.value ?? '—',
            source: rating?.source ?? '—',
            provenance: rating?.ratingKind || 'aucune',
            cinema: cinema.nom
          });

          if (!moviesByKey.has(key)) {
            moviesByKey.set(key, {
              title,
              localFilm: localMatch?.film || null,
              matchedTitle: localMatch?.film?.titre || localMatch?.matchedTitle || rating?.matchedTitle || null,
              matchScore: Math.max(localMatch?.score || 0, rating?.matchScore || 0),
              poster: localMatch?.film?.poster || item.poster || (rating?.posterPath && window.CONFIG?.TMDB_IMG_BASE ? `${CONFIG.TMDB_IMG_BASE}${rating.posterPath}` : ''),
              ratingValue: rating?.value ?? null,
              ratingSource: rating?.source ?? null,
              ratingKind: rating?.ratingKind || null,
              enrichmentStatus,
              tmdbId: rating?.tmdbId || null,
              bestLocalCandidates: localCandidates.map(c => ({ titre: c.titre, original: c.original, score: c.score, imdb: c.imdb, imdbID: c.imdbID })),
              cinemas: [],
              rawShowtimes: []
            });
          } else {
            const existing = moviesByKey.get(key);
            if (!existing.localFilm && localMatch?.film) {
              existing.localFilm = localMatch.film;
              existing.matchedTitle = localMatch.film.titre || localMatch.matchedTitle;
              existing.enrichmentStatus = 'catalogue';
            }
            const existingRating = Number(existing.ratingValue || 0);
            const newRating = Number(rating?.value || 0);
            if ((!existing.ratingValue && rating) || newRating > existingRating) {
              existing.ratingValue = rating.value;
              existing.ratingSource = rating.source;
              existing.ratingKind = rating.ratingKind;
              existing.tmdbId = rating.tmdbId || existing.tmdbId;
              existing.matchedTitle = existing.matchedTitle || rating.matchedTitle;
            }
            existing.matchScore = Math.max(existing.matchScore || 0, localMatch?.score || 0, rating?.matchScore || 0);
          }

          const movie = moviesByKey.get(key);
          if (!movie.cinemas.some(c => c.nom === cinema.nom)) {
            movie.cinemas.push({
              nom: cinema.nom,
              adresse: cinema.adresse,
              distanceKm: cinema.dist,
              horaires: item.horaires || []
            });
          }
          movie.rawShowtimes.push(item.rawItem || item);
        }
      } catch (error) {
        console.warn(`[Catalogue proche][DEBUG] Impossible de charger les films pour ${cinema.nom} :`, error?.message || error);
      }
    }

    const ranked = Array.from(moviesByKey.values()).sort((a, b) => {
      if (a.ratingValue === null && b.ratingValue === null) return a.title.localeCompare(b.title, 'fr');
      if (a.ratingValue === null) return 1;
      if (b.ratingValue === null) return -1;
      return b.ratingValue - a.ratingValue;
    });

    const tmdbEnrichment = await enrichMissingMoviesWithTmdb(ranked, options);

    ranked.sort((a, b) => {
      if (a.ratingValue === null && b.ratingValue === null) return a.title.localeCompare(b.title, 'fr');
      if (a.ratingValue === null) return 1;
      if (b.ratingValue === null) return -1;
      return b.ratingValue - a.ratingValue;
    });

    const stats = {
      total: ranked.length,
      rated: ranked.filter(movie => movie.ratingValue !== null && movie.ratingValue !== undefined).length,
      local: ranked.filter(movie => movie.ratingKind === 'local').length,
      tmdb: ranked.filter(movie => movie.ratingKind === 'tmdb').length,
      missing: ranked.filter(movie => movie.enrichmentStatus === 'missing').length,
      tmdbEnriched: ranked.filter(movie => movie.enrichmentStatus === 'tmdb-enriched').length
    };

    const missingDraft = buildMissingCatalogueDraft(ranked);
    const enrichedDraft = buildEnrichedCatalogueDraft(ranked);
    const runtimeFusion = buildRuntimeCatalogueFusion(ranked);
    const nearbyRankedCatalogue = buildNearbyCatalogueRankedExport(ranked);

    console.log(`[Catalogue proche] Résultat ZIP 3.4 : ${stats.total} film(s), ${stats.rated} avec note, ${stats.tmdbEnriched} film(s) fusionné(s) TMDB, ${stats.missing} à vérifier.`);
    console.group('[Catalogue proche] Debug correspondances titres');
    console.table(matchDebug);
    console.groupEnd();

    if (missingDraft.length) {
      console.warn('[Catalogue proche] Films absents de js/data.js — brouillon prêt pour futur enrichissement :', missingDraft);
      console.group('[Catalogue proche] Meilleurs candidats locaux pour les films à enrichir');
      console.table(missingDraft.map(item => ({
        film: item.titre,
        cinemas: item.cinemas.map(c => c.nom).join(', '),
        choix1: item.bestLocalCandidates?.[0] ? `${item.bestLocalCandidates[0].titre} (${item.bestLocalCandidates[0].score})` : '—',
        choix2: item.bestLocalCandidates?.[1] ? `${item.bestLocalCandidates[1].titre} (${item.bestLocalCandidates[1].score})` : '—',
        choix3: item.bestLocalCandidates?.[2] ? `${item.bestLocalCandidates[2].titre} (${item.bestLocalCandidates[2].score})` : '—'
      })));
      console.groupEnd();
    }

    if (tmdbEnrichment && !tmdbEnrichment.disabled) {
      console.group('[Catalogue proche][TMDB] Résultat enrichissement films absents');
      console.table(ranked.filter(movie => movie.enrichmentStatus === 'tmdb-enriched' || movie.enrichmentStatus === 'missing').map(movie => ({
        film: movie.title,
        statut: movie.enrichmentStatus === 'tmdb-enriched' ? 'TMDB trouvé' : 'À vérifier',
        titreTmdb: movie.tmdbDraft?.titre || movie.tmdbEnrichment?.bestTitle || '—',
        scoreTmdb: movie.tmdbDraft?.score || movie.tmdbEnrichment?.score || '—',
        noteTmdb: movie.tmdbDraft?.tmdb ?? '—',
        annee: movie.tmdbDraft?.annee ?? '—',
        synopsis: movie.tmdbDraft?.synopsis ? 'oui' : 'non',
        affiche: movie.tmdbDraft?.poster ? 'oui' : 'non'
      })));
      console.groupEnd();
    }

    if (enrichedDraft.length) {
      console.warn('[Catalogue proche][TMDB] Brouillon Catalogue enrichi prêt : window.NEARBY_CATALOGUE_ENRICHED_DRAFT', enrichedDraft);
    }

    console.group('[Catalogue proche] Fusion runtime Catalogue + TMDB');
    console.log('Catalogue local :', runtimeFusion.localCount, 'films');
    console.log('Films TMDB ajoutés temporairement :', runtimeFusion.tmdbRuntimeCount);
    console.log('Total runtime exportable :', runtimeFusion.total);
    console.table(runtimeFusion.tmdbRuntimeFilms.map(film => ({
      titre: film.titre,
      annee: film.annee || '—',
      note: film.tmdb || '—',
      tmdbId: film.tmdbId || '—',
      synopsis: film.synopsis ? 'oui' : 'non',
      affiche: film.poster ? 'oui' : 'non'
    })));
    console.groupEnd();

    console.table(ranked.map((movie, index) => ({
      rang: index + 1,
      film: movie.title,
      statut: movie.enrichmentStatus === 'tmdb-enriched' ? 'TMDB fusionné' : (movie.enrichmentStatus === 'missing' ? 'À vérifier' : 'Catalogue'),
      catalogue: movie.localFilm ? (movie.matchedTitle || 'Catalogue') : (movie.tmdbDraft?.titre ? 'TMDB runtime' : 'ABSENT'),
      tmdb: movie.tmdbDraft?.titre || '—',
      scoreMatch: movie.matchScore || '—',
      meilleurCandidat: movie.enrichmentStatus === 'missing' ? (movie.bestLocalCandidates?.[0] ? `${movie.bestLocalCandidates[0].titre} (${movie.bestLocalCandidates[0].score})` : '—') : '—',
      note: movie.ratingValue ?? '—',
      source: movie.ratingSource ?? '—',
      cinemas: movie.cinemas.map(c => c.nom).join(', ')
    })));

    window.NEARBY_RANKED_MOVIES_LAST_RESULT = ranked;
    window.NEARBY_CATALOGUE_MISSING_DRAFT = missingDraft;
    window.NEARBY_CATALOGUE_ENRICHED_DRAFT = enrichedDraft;
    window.NEARBY_CATALOGUE_RUNTIME_DATA = runtimeFusion.films;
    window.NEARBY_CATALOGUE_RUNTIME_TMDB_ONLY = runtimeFusion.tmdbRuntimeFilms;
    window.NEARBY_CATALOGUE_NEARBY_RANKED = nearbyRankedCatalogue;
    window.NEARBY_TMDB_ENRICHMENT_CACHE = tmdbEnrichmentCache;
    window.NEARBY_CATALOGUE_STATS = { ...stats, runtimeTotal: runtimeFusion.total, runtimeTmdbAdded: runtimeFusion.tmdbRuntimeCount };

    try {
      const storedPayload = {
        version: '3.4',
        updatedAt: new Date().toISOString(),
        films: runtimeFusion.films,
        tmdbRuntimeFilms: runtimeFusion.tmdbRuntimeFilms,
        stats: window.NEARBY_CATALOGUE_STATS
      };
      const nearbyPayload = {
        version: '3.4',
        updatedAt: new Date().toISOString(),
        address: options.address || '',
        radius,
        films: nearbyRankedCatalogue,
        stats: { total: nearbyRankedCatalogue.length, rated: nearbyRankedCatalogue.filter(f => Number.isFinite(Number(f.bestNote))).length }
      };
      localStorage.setItem('cinepro_runtime_catalogue', JSON.stringify(storedPayload));
      localStorage.setItem('cinepro_nearby_ranked_catalogue', JSON.stringify(nearbyPayload));
      console.log(`[Catalogue proche] ZIP 3.4 : catalogue runtime sauvegardé pour catalogue.html (${runtimeFusion.total} films).`);
      window.dispatchEvent(new CustomEvent('nearby-catalogue-runtime-ready', { detail: storedPayload }));
      window.dispatchEvent(new CustomEvent('nearby-catalogue-ranked-ready', { detail: nearbyPayload }));
    } catch (storageError) {
      console.warn('[Catalogue proche] Impossible de sauvegarder le catalogue runtime :', storageError?.message || storageError);
    }

    renderNearbyRankedMovies(ranked, { ...stats, runtimeTotal: runtimeFusion.total, runtimeTmdbAdded: runtimeFusion.tmdbRuntimeCount });
    return ranked;
  }

  function initNearbyCatalogueGoogleMaps() {
    try {
      window.PLACES?.init();
      console.log('[Catalogue proche] Google Maps/Places prêt. Test possible avec :');
      console.log("getNearbyRankedMovies({ address: 'Cergy', radius: 15000 })");
    } catch (error) {
      console.warn('[Catalogue proche] Initialisation impossible :', error?.message || error);
    }
  }

  window.getNearbyRankedMovies = getNearbyRankedMovies;
  window.initNearbyCatalogueGoogleMaps = initNearbyCatalogueGoogleMaps;
})();
