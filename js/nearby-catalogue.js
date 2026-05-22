/* CinéProche — Catalogue proche — ZIP 2.9
   Objectif unique : rendre les films des séances exploitables.
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

  function extractMovieTitle(item) {
    if (!item || typeof item !== 'object') return '';
    return firstString(
      item.title, item.titre, item.name, item.nom, item.label,
      item.originalTitle, item.original_title, item.movieTitle, item.filmTitle,
      item.fullTitle, item.displayTitle,
      getDeep(item, 'movie.title'), getDeep(item, 'movie.name'), getDeep(item, 'movie.titre'),
      getDeep(item, 'film.title'), getDeep(item, 'film.name'), getDeep(item, 'film.titre'),
      getDeep(item, 'show.title'), getDeep(item, 'show.name'),
      getDeep(item, 'entity.title'), getDeep(item, 'entity.name'),
      getDeep(item, 'data.title'), getDeep(item, 'data.name')
    );
  }

  function extractMovieObject(item) {
    if (!item || typeof item !== 'object') return null;
    const candidates = [
      item.movie, item.film, item.filmShow, item.show, item.entity, item.work,
      item.movieShow, item.data?.movie, item.data?.film, item.production, item
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
    if (!title) return null;
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

  async function getCinemaAllocineId(cinema) {
    const params = new URLSearchParams({
      name: cinema?.nom || '',
      lat: cinema?.location?.lat || '',
      lng: cinema?.location?.lng || ''
    });
    const data = await fetchJsonWithDebug(`${NEARBY_CATALOGUE_API}/search-cinema?${params}`, `search-cinema pour ${cinema?.nom}`);
    const id = data?.id || data?.cinema_id || data?.cinemaId || data?.allocineId || data?.theater?.id || null;
    if (id) console.log(`[Catalogue proche][DEBUG] ID extrait pour ${cinema?.nom} :`, id);
    else console.warn(`[Catalogue proche][DEBUG] Aucun ID cinéma trouvé pour ${cinema?.nom}.`);
    return id;
  }

  function extractSeancesArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.seances)) return data.seances;
    if (Array.isArray(data?.sessions)) return data.sessions;
    if (Array.isArray(data?.showtimes)) return data.showtimes;
    if (Array.isArray(data?.movies)) return data.movies;
    if (Array.isArray(data?.films)) return data.films;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  async function getCinemaShowtimes(cinema) {
    const allocineId = await getCinemaAllocineId(cinema);
    if (!allocineId) return [];
    const today = new Date().toISOString().split('T')[0];
    const data = await fetchJsonWithDebug(`${NEARBY_CATALOGUE_API}/seances?id=${encodeURIComponent(allocineId)}&date=${today}`, `seances pour ${cinema?.nom}`);
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
            <p>ZIP 2.9 : les films absents sont maintenant visibles et prêts à être enrichis dans le Catalogue.</p>
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

    console.log('[Catalogue proche] ZIP 2.9 actif.');
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

    console.log(`[Catalogue proche] Résultat ZIP 2.9 : ${stats.total} film(s), ${stats.rated} classé(s), ${stats.missing} à enrichir.`);
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
