import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '16d984ea5d9a771088779b56497e0890';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function dataPath(name) {
  return path.join(__dirname, 'data', name);
}

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

function normalizeSearchTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function decodeJsonString(value = '') {
  try {
    return JSON.parse('"' + String(value).replace(/"/g, '\\"') + '"');
  } catch {
    return String(value)
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/');
  }
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value = '') {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' '));
}

function cleanSynopsis(value = '') {
  return stripHtml(value)
    .replace(/\s*See full summary\s*»?\s*$/i, '')
    .replace(/\s*Voir le résumé complet\s*»?\s*$/i, '')
    .replace(/\s*Add a plot.*$/i, '')
    .replace(/\s*Ajouter un résumé.*$/i, '')
    .replace(/\s*IMDb\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadSynopsisText(text = '') {
  const value = cleanSynopsis(text).toLowerCase();
  if (!value) return true;
  return /javascript est désactivé|javascript est desactive|enable javascript|you need to enable javascript|nous devons vérifier que vous n.?êtes pas un robot|vous n.?êtes pas un robot|not a robot|robot|captcha|verify you are human|access denied|request blocked|réessayez plus tard|try again later|continue, we need to make sure/i.test(value);
}

function isGoodSynopsis(text = '') {
  const clean = cleanSynopsis(text);
  if (isBadSynopsisText(clean)) return false;
  if (clean.length < 35 || clean.length > 900) return false;
  if (!/[.!?…]/.test(clean)) return false;
  if (/^(cast|crew|details|release|ratings|photos|videos|official sites)$/i.test(clean)) return false;
  if (/directed by|with [A-Z][a-z]+|watch options|add a plot/i.test(clean)) return false;
  return true;
}

function looksFrench(text = '') {
  const value = String(text).toLowerCase();
  const frenchHits = (value.match(/\b(le|la|les|des|une|un|dans|avec|pour|qui|que|est|sont|son|sa|ses|leur|leurs|été|après|avant|mais|plus|tout|toute|alors|lorsque|tandis)\b/g) || []).length;
  const englishHits = (value.match(/\b(the|and|with|from|after|before|his|her|their|into|while|when|who|that|this|story|life|must|find)\b/g) || []).length;
  return frenchHits >= 3 && frenchHits >= englishHits;
}

function pickShortOfficial(candidates = [], preferFrench = false) {
  const cleaned = [...new Set(candidates.map(cleanSynopsis).filter(isGoodSynopsis))];
  const filtered = preferFrench ? cleaned.filter(looksFrench) : cleaned;
  const pool = filtered.length ? filtered : cleaned;
  if (!pool.length) return '';

  // IMDb affiche généralement un pitch court : 80–320 caractères.
  // On pénalise les textes OMDb longs et les résumés utilisateurs.
  return pool.sort((a, b) => {
    const score = (t) => {
      let s = 0;
      if (t.length >= 70 && t.length <= 360) s += 100;
      if (t.length <= 500) s += 25;
      if (looksFrench(t)) s += preferFrench ? 50 : 10;
      s -= Math.abs(t.length - 210) / 8;
      return s;
    };
    return score(b) - score(a);
  })[0];
}

function collectSynopsisCandidatesFromJson(value, candidates = [], parentKey = '') {
  if (!value) return candidates;

  if (typeof value === 'string') {
    const key = String(parentKey || '').toLowerCase();
    if (/description|plottext|plot|synopsis|summary|storyline|plaintext|plain/.test(key) && isGoodSynopsis(value)) {
      candidates.push(value);
    }
    return candidates;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectSynopsisCandidatesFromJson(item, candidates, parentKey));
    return candidates;
  }

  if (typeof value === 'object') {
    // Cas IMDb fréquent : { plotText: { plainText: "..." } }
    if (value?.plotText?.plainText && isGoodSynopsis(value.plotText.plainText)) candidates.push(value.plotText.plainText);
    if (value?.plot?.plotText?.plainText && isGoodSynopsis(value.plot.plotText.plainText)) candidates.push(value.plot.plotText.plainText);
    if (value?.description && isGoodSynopsis(value.description)) candidates.push(value.description);

    for (const [key, child] of Object.entries(value)) {
      collectSynopsisCandidatesFromJson(child, candidates, key);
    }
  }

  return candidates;
}

async function fetchHtml(url, lang = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7') {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': lang,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Cookie': lang.startsWith('fr') ? 'lc-main=fr_FR; ubid-main=135-0000000-0000000' : 'lc-main=en_US; ubid-main=135-0000000-0000000'
    }
  });
  if (!response.ok) return '';
  return response.text();
}

function extractMainPageSynopsis(html = '', preferFrench = false) {
  const candidates = [];
  const $ = cheerio.load(html);

  // DOM visible de la fiche titre : c'est le texte court sous les genres.
  [
    '[data-testid="plot-xl"]',
    '[data-testid="plot-l"]',
    '[data-testid="plot"]',
    'span[data-testid="plot-xl"]',
    'span[data-testid="plot-l"]',
    'section[data-testid="Storyline"] [data-testid="plot"]'
  ].forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text();
      if (isGoodSynopsis(text)) candidates.push(text);
    });
  });

  // JSON-LD : souvent utilisé par Google et correspond au court résumé officiel.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const values = Array.isArray(json) ? json : [json];
      values.forEach(item => {
        if (item?.description && isGoodSynopsis(item.description)) candidates.push(item.description);
      });
    } catch {}
  });

  // Next/GraphQL : robuste quand IMDb change les classes HTML.
  $('#__NEXT_DATA__, script#__NEXT_DATA__').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      collectSynopsisCandidatesFromJson(json, candidates);
    } catch {}
  });

  // Recherche brute dans le HTML pour les champs IMDb les plus stables.
  const rawPatterns = [
    /"plot"\s*:\s*\{[\s\S]{0,2500}?"plotText"\s*:\s*\{[\s\S]{0,800}?"plainText"\s*:\s*"((?:\\.|[^"\\]){35,900})"/g,
    /"plotText"\s*:\s*\{[\s\S]{0,800}?"plainText"\s*:\s*"((?:\\.|[^"\\]){35,900})"/g,
    /"description"\s*:\s*"((?:\\.|[^"\\]){35,900})"/g
  ];
  for (const pattern of rawPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = decodeJsonString(match[1]);
      if (isGoodSynopsis(text)) candidates.push(text);
    }
  }

  const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (isGoodSynopsis(meta) && !/^.+?:\s*directed by/i.test(meta)) candidates.push(meta);

  return pickShortOfficial(candidates, preferFrench);
}

async function fetchTmdbExternalId(tmdbId) {
  if (!tmdbId || !TMDB_API_KEY) return '';
  try {
    const url = `${TMDB_BASE_URL}/movie/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=external_ids`;
    const response = await fetch(url);
    if (!response.ok) return '';
    const data = await response.json();
    const imdbId = String(data?.external_ids?.imdb_id || data?.imdb_id || '').trim();
    return /^tt\d+$/.test(imdbId) ? imdbId : '';
  } catch {
    return '';
  }
}


async function fetchTmdbFrenchOverview(tmdbId = '', title = '', year = '') {
  if (!TMDB_API_KEY) return '';
  try {
    let movieId = String(tmdbId || '').trim();

    if (!movieId && title) {
      const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'fr-FR',
        region: 'FR',
        query: title
      });
      if (/^\d{4}$/.test(String(year))) params.set('year', String(year));
      const searchRes = await fetch(`${TMDB_BASE_URL}/search/movie?${params.toString()}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const wanted = normalizeSearchTitle(title);
        const wantedYear = /^\d{4}$/.test(String(year)) ? Number(year) : null;
        const best = (searchData?.results || [])
          .map(item => {
            const itemTitle = normalizeSearchTitle(item?.title || item?.original_title || '');
            const itemYear = item?.release_date ? Number(String(item.release_date).slice(0, 4)) : null;
            let score = 0;
            if (itemTitle === wanted) score += 100;
            if (itemTitle.includes(wanted) || wanted.includes(itemTitle)) score += 25;
            if (wantedYear && itemYear === wantedYear) score += 80;
            if (wantedYear && itemYear && Math.abs(itemYear - wantedYear) <= 1) score += 25;
            return { item, score };
          })
          .sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 60) movieId = String(best.item.id || '');
      }
    }

    if (!movieId) return '';
    const url = `${TMDB_BASE_URL}/movie/${encodeURIComponent(movieId)}?api_key=${TMDB_API_KEY}&language=fr-FR`;
    const response = await fetch(url);
    if (!response.ok) return '';
    const data = await response.json();
    const overview = cleanSynopsis(data?.overview || '');
    return isGoodSynopsis(overview) ? overview : '';
  } catch {
    return '';
  }
}

async function findImdbIdBySuggestion(title, year = '') {
  if (!title) return '';
  const cleaned = normalizeSearchTitle(title).replace(/ /g, '_');
  if (!cleaned) return '';
  try {
    const url = `https://v3.sg.media-imdb.com/suggestion/${cleaned[0]}/${encodeURIComponent(cleaned)}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json,text/plain,*/*'
      }
    });
    if (!response.ok) return '';
    const data = await response.json();
    const wanted = normalizeSearchTitle(title);
    const wantedYear = /^\d{4}$/.test(String(year)) ? Number(year) : null;
    const best = (data?.d || [])
      .filter(item => /^tt\d+$/.test(String(item?.id || '')) && (item?.qid === 'movie' || item?.qid === 'tvMovie' || !item?.qid))
      .map(item => {
        const itemTitle = normalizeSearchTitle(item?.l || '');
        const itemYear = Number(item?.y || 0) || null;
        let score = 0;
        if (itemTitle === wanted) score += 100;
        if (itemTitle.includes(wanted) || wanted.includes(itemTitle)) score += 25;
        if (wantedYear && itemYear === wantedYear) score += 80;
        if (wantedYear && itemYear && Math.abs(itemYear - wantedYear) <= 1) score += 25;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)[0];
    return best && best.score >= 60 ? String(best.item.id) : '';
  } catch {
    return '';
  }
}

async function fetchOmdbShortPlot(imdbId) {
  const apiKey = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY || '';
  if (!apiKey || !/^tt\d+$/.test(imdbId)) return '';
  try {
    const params = new URLSearchParams({ apikey: apiKey, i: imdbId, plot: 'short', r: 'json' });
    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
    if (!response.ok) return '';
    const data = await response.json();
    const plot = String(data?.Plot || '').trim();
    return plot && plot !== 'N/A' ? cleanSynopsis(plot) : '';
  } catch {
    return '';
  }
}

function translationCachePath() {
  return dataPath('translation-cache.json');
}

async function translateSynopsisToFrench(text = '', cacheKey = '') {
  const synopsis = cleanSynopsis(text);
  if (!synopsis || looksFrench(synopsis)) return synopsis;
  const cache = readJson(translationCachePath(), {});
  const key = cacheKey || synopsis;
  if (cache[key]) return cache[key];

  try {
    const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'fr', dt: 't', q: synopsis });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' }
    });
    if (!response.ok) return synopsis;
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : '';
    const cleanTranslated = cleanSynopsis(translated);
    if (cleanTranslated && cleanTranslated.length >= 30) {
      cache[key] = cleanTranslated;
      writeJson(translationCachePath(), cache);
      return cleanTranslated;
    }
  } catch {}
  return synopsis;
}

function synopsisCachePath() {
  return dataPath('imdb-synopsis-cache.json');
}

function synopsisFrCachePath() {
  return dataPath('imdb-synopsis-fr-cache.json');
}

function readSynopsisCache() {
  return readJson(synopsisCachePath(), {});
}

function readSynopsisFrCache() {
  return readJson(synopsisFrCachePath(), {});
}

function extractCachedSynopsis(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return cleanSynopsis(entry);
  if (typeof entry === 'object') {
    return cleanSynopsis(entry.synopsis || entry.plot || entry.overview || entry.description || '');
  }
  return '';
}

function findCachedSynopsis(cache, imdbId) {
  if (!/^tt\d+$/.test(String(imdbId || ''))) return null;

  const directKeys = [
    imdbId,
    `t-${imdbId}`,
    `${imdbId}-omdb-fallback-v2`,
    `t-${imdbId}-omdb-fallback-v2`,
    `omdb-short-${imdbId}`,
    `t-omdb-short-${imdbId}`
  ];

  for (const key of directKeys) {
    const synopsis = extractCachedSynopsis(cache?.[key]);
    if (synopsis && !isBadSynopsisText(synopsis) && isGoodSynopsis(synopsis)) {
      const entry = cache[key];
      return { key, synopsis, source: typeof entry === 'object' ? (entry.source || 'cache') : 'cache' };
    }
  }

  for (const [key, entry] of Object.entries(cache || {})) {
    if (!String(key).includes(imdbId)) continue;
    const synopsis = extractCachedSynopsis(entry);
    if (synopsis && !isBadSynopsisText(synopsis) && isGoodSynopsis(synopsis)) {
      return { key, synopsis, source: typeof entry === 'object' ? (entry.source || 'cache') : 'cache' };
    }
  }

  return null;
}

function readBestCachedSynopsis(imdbId) {
  // Priorité 1 : cache FR généré par npm run sync-imdb.
  const fr = findCachedSynopsis(readSynopsisFrCache(), imdbId);
  if (fr) return { ...fr, source: `imdb-fr-cache:${fr.source}` };

  // Priorité 2 : ancien cache IMDb historique.
  const legacy = findCachedSynopsis(readSynopsisCache(), imdbId);
  if (legacy) return { ...legacy, source: `imdb-cache:${legacy.source}` };

  return null;
}

function saveSynopsisCacheEntry(imdbId, entry) {
  if (!/^tt\d+$/.test(imdbId) || !entry?.synopsis) return;
  const cache = readSynopsisCache();
  cache[imdbId] = {
    imdbId,
    synopsis: cleanSynopsis(entry.synopsis),
    source: entry.source || 'unknown',
    updatedAt: new Date().toISOString()
  };
  writeJson(synopsisCachePath(), cache);
}

async function fetchTmdbFrenchOverviewByImdbId(imdbId = '') {
  if (!TMDB_API_KEY || !/^tt\d+$/.test(String(imdbId || ''))) return '';
  try {
    const findUrl = `${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&language=fr-FR&external_source=imdb_id`;
    const findResponse = await fetch(findUrl);
    if (!findResponse.ok) return '';
    const findData = await findResponse.json();
    const movie = (findData?.movie_results || [])[0];
    if (!movie?.id) return '';
    return await fetchTmdbFrenchOverview(String(movie.id), movie.title || movie.original_title || '', movie.release_date ? String(movie.release_date).slice(0, 4) : '');
  } catch {
    return '';
  }
}

async function resolveImdbId({ imdbId = '', tmdbId = '', title = '', originalTitle = '', year = '' }) {
  if (/^tt\d+$/.test(imdbId)) return imdbId;
  const fromTmdb = tmdbId ? await fetchTmdbExternalId(tmdbId) : '';
  if (fromTmdb) return fromTmdb;
  return await findImdbIdBySuggestion(originalTitle || title, year);
}

async function getOfficialSynopsis(imdbId) {
  // 1) Page IMDb française officielle : objectif principal.
  const frUrls = [
    `https://www.imdb.com/fr/title/${imdbId}/`,
    `https://www.imdb.com/title/${imdbId}/?ref_=tt_stry_pl&locale=fr_FR`
  ];

  for (const url of frUrls) {
    const html = await fetchHtml(url, 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7');
    const fr = extractMainPageSynopsis(html, true);
    if (fr && looksFrench(fr)) {
      return { source: 'imdb-fr-official', synopsis: fr };
    }
  }

  // 2) Page IMDb anglaise officielle puis traduction française.
  const enHtml = await fetchHtml(`https://www.imdb.com/title/${imdbId}/`, 'en-US,en;q=0.9,fr-FR;q=0.7');
  const en = extractMainPageSynopsis(enHtml, false);
  if (en) {
    const translated = await translateSynopsisToFrench(en, `imdb-official-en-${imdbId}`);
    return { source: looksFrench(translated) ? 'imdb-en-official-translated-fr' : 'imdb-en-official', synopsis: translated };
  }

  // 3) Dernier secours : OMDb court traduit, uniquement si IMDb ne fournit rien.
  const omdb = await fetchOmdbShortPlot(imdbId);
  if (omdb) {
    const translated = await translateSynopsisToFrench(omdb, `omdb-short-${imdbId}`);
    return { source: looksFrench(translated) ? 'omdb-short-translated-fr' : 'omdb-short', synopsis: translated };
  }

  return { source: 'unavailable', synopsis: '' };
}

app.get('/', (req, res) => {
  res.json({ message: 'Backend CinéProche actif', routes: ['/api/films-letterboxd', '/api/imdb-synopsis', '/api/imdb-debug'] });
});



app.get('/api/imdb-debug', async (req, res) => {
  try {
    const input = {
      imdbId: String(req.query.imdbId || '').trim(),
      tmdbId: String(req.query.tmdbId || '').trim(),
      title: String(req.query.title || '').trim(),
      originalTitle: String(req.query.originalTitle || '').trim(),
      year: String(req.query.year || '').trim()
    };

    const resolvedId = await resolveImdbId(input);
    const cache = readSynopsisCache();
    const cacheEntry = resolvedId ? cache[resolvedId] : null;
    const cachedSynopsis = cleanSynopsis(cacheEntry?.synopsis || '');
    const cacheStatus = {
      file: 'backend/data/imdb-synopsis-cache.json',
      totalEntries: Object.keys(cache || {}).length,
      hasEntryForResolvedId: Boolean(cacheEntry),
      source: cacheEntry?.source || '',
      synopsisLength: cachedSynopsis.length,
      synopsisPreview: cachedSynopsis ? cachedSynopsis.slice(0, 220) : '',
      isBadSynopsis: cachedSynopsis ? isBadSynopsisText(cachedSynopsis) : false
    };

    const imdbFrAttempts = [];
    let bestImdbFr = '';
    if (resolvedId) {
      const urls = [
        `https://www.imdb.com/fr/title/${resolvedId}/`,
        `https://www.imdb.com/title/${resolvedId}/?ref_=tt_stry_pl&locale=fr_FR`
      ];

      for (const url of urls) {
        const html = await fetchHtml(url, 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7');
        const htmlSample = cleanSynopsis(html.slice(0, 900));
        const blocked = isBadSynopsisText(htmlSample) || /javascript est désactivé|javascript est desactive|enable javascript|robot|captcha|verify you are human/i.test(html);
        const extracted = extractMainPageSynopsis(html, true);
        if (!bestImdbFr && extracted && looksFrench(extracted) && !isBadSynopsisText(extracted)) bestImdbFr = extracted;
        imdbFrAttempts.push({
          url,
          htmlLength: html.length,
          looksBlocked: blocked,
          extractedLength: extracted.length,
          extractedLooksFrench: extracted ? looksFrench(extracted) : false,
          extractedIsBad: extracted ? isBadSynopsisText(extracted) : false,
          extractedPreview: extracted ? extracted.slice(0, 220) : ''
        });
      }
    }

    const tmdbSynopsis = await fetchTmdbFrenchOverview(input.tmdbId, input.title, input.year);
    let decision = 'unavailable';
    if (cachedSynopsis && !isBadSynopsisText(cachedSynopsis) && /^(imdb|omdb|legacy)/i.test(String(cacheEntry?.source || ''))) decision = 'would-use-imdb-cache';
    else if (bestImdbFr) decision = 'would-use-live-imdb-fr';
    else if (tmdbSynopsis) decision = 'would-use-tmdb-fr-fallback';

    res.json({
      source: 'imdb-debug-v1',
      input,
      resolvedId,
      cache: cacheStatus,
      imdbFrAttempts,
      tmdbFr: {
        available: Boolean(tmdbSynopsis),
        synopsisLength: tmdbSynopsis.length,
        synopsisPreview: tmdbSynopsis ? tmdbSynopsis.slice(0, 220) : ''
      },
      decision,
      nextStep: 'Si decision vaut would-use-tmdb-fr-fallback, le cache IMDb est vide ou IMDb FR est bloqué/non extrait. ZIP 2 servira à remplir ce cache.'
    });
  } catch (error) {
    res.json({ source: 'imdb-debug-error', message: error?.message || String(error) });
  }
});

app.get('/api/imdb-synopsis', async (req, res) => {
  try {
    const input = {
      imdbId: String(req.query.imdbId || '').trim(),
      tmdbId: String(req.query.tmdbId || '').trim(),
      title: String(req.query.title || '').trim(),
      originalTitle: String(req.query.originalTitle || '').trim(),
      year: String(req.query.year || '').trim()
    };

    const resolvedId = await resolveImdbId(input);

    // 1) Cache local FR/IMDb rempli par npm run sync-imdb.
    if (resolvedId) {
      const cached = readBestCachedSynopsis(resolvedId);
      if (cached?.synopsis) {
        return res.json({
          source: cached.source,
          cacheKey: cached.key,
          imdbId: resolvedId,
          synopsis: cached.synopsis
        });
      }
    }

    // 2) Tentative IMDb officielle en direct.
    // Important : ce n'est PAS OMDb. On tente d'abord imdb.com/fr/title/tt...
    // Si IMDb bloque la requête, on ne casse pas le site : on passe ensuite à TMDB.
    if (resolvedId) {
      const official = await getOfficialSynopsis(resolvedId);
      if (official?.synopsis && /^imdb/i.test(String(official.source || '')) && !isBadSynopsisText(official.synopsis)) {
        saveSynopsisCacheEntry(resolvedId, official);
        return res.json({
          source: official.source,
          cacheKey: resolvedId,
          imdbId: resolvedId,
          synopsis: official.synopsis
        });
      }
    }

    // 3) Secours TMDB FR, même si on n'a reçu que imdbId.
    let tmdbSynopsis = await fetchTmdbFrenchOverview(input.tmdbId, input.title, input.year);
    if (!tmdbSynopsis && resolvedId) {
      tmdbSynopsis = await fetchTmdbFrenchOverviewByImdbId(resolvedId);
    }
    if (tmdbSynopsis && !isBadSynopsisText(tmdbSynopsis)) {
      return res.json({ source: 'tmdb-fr-fallback', imdbId: resolvedId || '', synopsis: tmdbSynopsis });
    }

    return res.json({ source: 'unavailable', imdbId: resolvedId || '', synopsis: '' });
  } catch (error) {
    return res.json({ source: 'imdb-synopsis-error', message: error?.message || String(error), imdbId: '', synopsis: '' });
  }
});

app.get('/api/films-letterboxd', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'letterboxd-films.json');
  if (!fs.existsSync(filePath)) return res.json({ source: 'empty', count: 0, films: [] });
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
});

app.listen(PORT, () => {
  console.log('======================================');
  console.log(`Backend CinéProche lancé sur http://localhost:${PORT}`);
  console.log(`API Letterboxd : http://localhost:${PORT}/api/films-letterboxd`);
  console.log(`API Synopsis IMDb : http://localhost:${PORT}/api/imdb-synopsis?imdbId=tt0111161`);
  console.log('Garde cette fenêtre Git Bash ouverte pour laisser API active.');
  console.log('======================================');
});
