/* CinéProche — Catalogue proche — ZIP 2.9.6
   Objectif unique : nettoyer les faux titres et fiabiliser la liste des films des séances.
   - Les films reconnus dans js/data.js gardent leur note locale.
   - Les films non reconnus ne restent plus vides : badge "À enrichir".
   - Ajout d'un panneau visuel + compteurs : classés / à enrichir.
   - Ajout d'une liste exportable des films absents pour préparer le futur Catalogue global.
*/
(function () {
  'use strict';

  const NEARBY_CATALOGUE_API = 'https://cinepro-api-yal8.onrender.com';
  const tmdbRatingCache = new Map();

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

    if (!a || !b) return 0;
    if (a === b) return 100;
    if (ca === cb) return 98;

    if (a.includes(b) || b.includes(a)) {
      const shortLen = Math.min(a.length, b.length);
      const longLen = Math.max(a.length, b.length);
      return Math.round(82 + (shortLen / longLen) * 12);
    }

    const wordsA = new Set(a.split(' ').filter(w => w.length > 1));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 1));
    const intersection = [...wordsA].filter(w => wordsB.has(w));
    if (!intersection.length) return 0;
    const ratio = intersection.length / Math.max(wordsA.size, wordsB.size);
    return Math.round(ratio * 80);
  }

  function findLocalFilmByTitle(title) {
    const index = buildLocalFilmIndex();
    let best = null;

    for (const item of index) {
      const score = scoreTitleMatch(title, item.title);
      if (!best || score > best.score) best = { ...item, score };
    }

    if (best && best.score >= 82) {
      return { film: best.film, matchedTitle: best.title, score: best.score };
    }
    return null;
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
    const cacheKey = normalizeNearbyTitle(title);
    if (!cacheKey) return null;
    if (tmdbRatingCache.has(cacheKey)) return tmdbRatingCache.get(cacheKey);

    const hasTmdb = Boolean(window.CONFIG?.TMDB_API_KEY && window.CONFIG?.TMDB_BASE_URL);
    if (!hasTmdb) {
      tmdbRatingCache.set(cacheKey, null);
      return null;
    }

    try {
      const language = CONFIG.LANGUAGE || 'fr-FR';
      const region = CONFIG.REGION || 'FR';
      const url = `${CONFIG.TMDB_BASE_URL}/search/movie?api_key=${CONFIG.TMDB_API_KEY}&language=${language}&region=${region}&query=${encodeURIComponent(title)}`;
      const response = await fetch(url);
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      let best = null;

      for (const result of results.slice(0, 8)) {
        const candidateTitle = result?.title || result?.name || result?.original_title || '';
        const score = Math.max(
          scoreTitleMatch(title, candidateTitle),
          scoreTitleMatch(title, result?.original_title || '')
        );
        if (!best || score > best.score) best = { result, score, candidateTitle };
      }

      if (!best || best.score < 70) {
        tmdbRatingCache.set(cacheKey, null);
        return null;
      }

      const vote = Number(best.result?.vote_average);
      if (!Number.isFinite(vote) || vote <= 0) {
        tmdbRatingCache.set(cacheKey, null);
        return null;
      }

      const rating = {
        source: 'TMDB',
        value: Math.round(vote * 10) / 10,
        matchedTitle: best.result?.title || best.result?.original_title || best.candidateTitle,
        tmdbId: best.result?.id,
        score: best.score,
        posterPath: best.result?.poster_path || ''
      };
      tmdbRatingCache.set(cacheKey, rating);
      return rating;
    } catch (error) {
      console.warn(`[Catalogue proche][TMDB] Recherche impossible pour "${title}" :`, error?.message || error);
      tmdbRatingCache.set(cacheKey, null);
      return null;
    }
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

  function extractShowtimes(item) {
    if (!item || typeof item !== 'object') return [];
    const possibleArrays = [item.horaires, item.times, item.showtimes, item.seances, item.sessions, item.scr, item.version?.times];
    for (const arr of possibleArrays) if (Array.isArray(arr)) return arr;
    if (typeof item.time === 'string') return [item.time];
    if (typeof item.horaire === 'string') return [item.horaire];
    return [];
  }

  function normalizeShowtimeItem(rawItem) {
    const movieObject = extractMovieObject(rawItem);
    const title = extractMovieTitle(movieObject) || extractMovieTitle(rawItem);
    if (!title || !looksLikeRealMovieTitle(title)) return null;
    return {
      title,
      normalizedKey: normalizeNearbyTitle(title),
      rawMovie: movieObject || rawItem,
      rawItem,
      poster: extractPoster(movieObject, rawItem),
      horaires: extractShowtimes(rawItem)
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
    // ZIP 2.9.6 : on ne suppose plus une structure précise.
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
      .nearby-movie-card{border:1px solid rgba(0,0,0,.08);border-radius:22px;padding:16px;background:#fff;display:flex;flex-direction:column;gap:10px;min-height:145px;}
      .nearby-movie-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
      .nearby-movie-title{font-weight:800;font-size:16px;line-height:1.2;letter-spacing:-.02em;}
      .nearby-badge{border-radius:999px;padding:6px 9px;font-size:12px;font-weight:800;white-space:nowrap;}
      .nearby-badge-rated{background:#e9f8ef;color:#147a3c;}
      .nearby-badge-new{background:#fff3d8;color:#8a5a00;}
      .nearby-movie-meta{color:#666;font-size:13px;line-height:1.45;}
      .nearby-movie-cinemas{color:#333;font-size:13px;line-height:1.45;}
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
        : '<span class="nearby-badge nearby-badge-new">À enrichir</span>';
      const cinemas = movie.cinemas.map(c => c.nom).join(', ');
      const matched = movie.matchedTitle ? `Catalogue : ${escapeHtml(movie.matchedTitle)}` : 'Absent du catalogue';
      return `
        <article class="nearby-movie-card">
          <div class="nearby-movie-top">
            <div class="nearby-movie-title">${index + 1}. ${escapeHtml(movie.title)}</div>
            ${badge}
          </div>
          <div class="nearby-movie-meta">${matched}</div>
          <div class="nearby-movie-cinemas">${escapeHtml(cinemas || 'Cinéma non précisé')}</div>
        </article>
      `;
    }).join('');

    mount.innerHTML = `
      <div class="nearby-catalogue-box">
        <div class="nearby-catalogue-head">
          <div>
            <h2>Films proches trouvés</h2>
            <p>ZIP 2.9.6 : séances réelles + nettoyage des faux titres + films absents visibles pour enrichissement Catalogue.</p>
          </div>
          <div class="nearby-catalogue-stats">
            <div class="nearby-catalogue-stat"><strong>${stats.total}</strong> films</div>
            <div class="nearby-catalogue-stat"><strong>${stats.rated}</strong> classés</div>
            <div class="nearby-catalogue-stat"><strong>${stats.missing}</strong> à enrichir</div>
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
      .filter(movie => movie.enrichmentStatus === 'missing')
      .map((movie, index) => ({
        id: `todo-${index + 1}`,
        titre: movie.title,
        original: '',
        genre: 'À compléter',
        duree: '',
        real: '',
        acteurs: '',
        synopsis: 'À enrichir',
        color: 'p1',
        badge: 'À enrichir',
        lb: null,
        imdb: null,
        sc: null,
        annee: null,
        imdbID: '',
        tmdbId: movie.tmdbId || '',
        cinemas: movie.cinemas.map(c => c.nom)
      }));
  }

  async function getNearbyRankedMovies(options = {}) {
    if (!window.PLACES) throw new Error('PLACES n’est pas chargé. Vérifie js/places.js.');

    const radius = options.radius || window.CONFIG?.SEARCH_RADIUS || 15000;
    let location = options.location || null;
    if (!location && options.address) {
      const geocoded = await window.PLACES.geocodeAddress(options.address);
      location = geocoded.location;
    }
    if (!location) location = await window.PLACES.geolocate();

    console.log('[Catalogue proche] ZIP 2.9.6 actif — /seances-auto + nettoyage titres techniques.');
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
          const key = item.normalizedKey || normalizeNearbyTitle(title);
          if (!key) continue;

          const localMatch = findLocalFilmByTitle(title);
          const rating = await resolveMovieRating(title, localMatch, item.rawMovie);
          const enrichmentStatus = localMatch ? 'catalogue' : 'missing';

          matchDebug.push({
            seances: title,
            catalogue: localMatch?.film?.titre || localMatch?.matchedTitle || 'ABSENT',
            statut: enrichmentStatus === 'catalogue' ? 'Classé' : 'À enrichir',
            scoreLocal: localMatch?.score || 0,
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

    const stats = {
      total: ranked.length,
      rated: ranked.filter(movie => movie.ratingValue !== null && movie.ratingValue !== undefined).length,
      local: ranked.filter(movie => movie.ratingKind === 'local').length,
      tmdb: ranked.filter(movie => movie.ratingKind === 'tmdb').length,
      missing: ranked.filter(movie => movie.enrichmentStatus === 'missing').length
    };

    const missingDraft = buildMissingCatalogueDraft(ranked);

    console.log(`[Catalogue proche] Résultat ZIP 2.9.6 : ${stats.total} film(s), ${stats.rated} classé(s), ${stats.missing} à enrichir.`);
    console.group('[Catalogue proche] Debug correspondances titres');
    console.table(matchDebug);
    console.groupEnd();

    if (missingDraft.length) {
      console.warn('[Catalogue proche] Films absents de js/data.js — brouillon prêt pour futur enrichissement :', missingDraft);
    }

    console.table(ranked.map((movie, index) => ({
      rang: index + 1,
      film: movie.title,
      statut: movie.enrichmentStatus === 'missing' ? 'À enrichir' : 'Catalogue',
      catalogue: movie.matchedTitle || 'ABSENT',
      scoreMatch: movie.matchScore || '—',
      note: movie.ratingValue ?? '—',
      source: movie.ratingSource ?? '—',
      cinemas: movie.cinemas.map(c => c.nom).join(', ')
    })));

    window.NEARBY_RANKED_MOVIES_LAST_RESULT = ranked;
    window.NEARBY_CATALOGUE_MISSING_DRAFT = missingDraft;
    window.NEARBY_CATALOGUE_STATS = stats;

    renderNearbyRankedMovies(ranked, stats);
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
