import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(BACKEND_DIR, '..');
const DATA_DIR = path.join(BACKEND_DIR, 'data');

dotenv.config({ path: path.join(BACKEND_DIR, '.env') });
dotenv.config({ path: path.join(PROJECT_DIR, '.env') });

const CACHE_PATH = path.join(DATA_DIR, 'imdb-synopsis-cache.json');
const OLD_CACHE_PATH = path.join(DATA_DIR, 'synopsis-cache.json');
const FR_CACHE_PATH = path.join(DATA_DIR, 'imdb-synopsis-fr-cache.json');
const TRANSLATION_CACHE_PATH = path.join(DATA_DIR, 'translation-cache.json');
const LETTERBOXD_PATH = path.join(DATA_DIR, 'letterboxd-films.json');

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '16d984ea5d9a771088779b56497e0890';
const OMDB_API_KEY = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function cleanSynopsis(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s*See full summary\s*»?\s*$/i, '')
    .replace(/\s*Voir le résumé complet\s*»?\s*$/i, '')
    .replace(/\s*Add a plot.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadSynopsisText(text = '') {
  const value = cleanSynopsis(text).toLowerCase();
  if (!value) return true;
  return /javascript est désactivé|javascript est desactive|enable javascript|robot|captcha|verify you are human|access denied|request blocked|réessayez plus tard|try again later|^n\/?a$/i.test(value);
}

function isGoodSynopsis(text = '') {
  const clean = cleanSynopsis(text);
  if (isBadSynopsisText(clean)) return false;
  if (clean.length < 20 || clean.length > 1200) return false;
  return true;
}

function looksFrench(text = '') {
  const value = String(text).toLowerCase();
  const frenchHits = (value.match(/\b(le|la|les|des|une|un|dans|avec|pour|qui|que|est|sont|son|sa|ses|leur|leurs|été|après|avant|mais|plus|tout|toute|alors|lorsque|tandis|afin|ce|cette|ces|aux|du|de|au)\b/g) || []).length;
  const englishHits = (value.match(/\b(the|and|with|from|after|before|his|her|their|into|while|when|who|that|this|story|life|must|find)\b/g) || []).length;
  return frenchHits >= 3 && frenchHits >= englishHits;
}

function normalizeTitle(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mergeLegacyCaches(cache) {
  for (const file of [OLD_CACHE_PATH, FR_CACHE_PATH]) {
    const legacy = readJson(file, {});
    for (const [key, value] of Object.entries(legacy)) {
      const imdbMatch = String(key).match(/tt\d+/);
      const imdbId = value?.imdbId || imdbMatch?.[0] || '';
      const synopsis = cleanSynopsis(typeof value === 'string' ? value : (value?.synopsis || value?.plot || value?.overview || value?.description || ''));
      if (/^tt\d+$/.test(imdbId) && isGoodSynopsis(synopsis) && !cache[imdbId]) {
        cache[imdbId] = {
          imdbId,
          synopsis,
          source: value?.source || 'legacy-cache-migrated',
          updatedAt: new Date().toISOString()
        };
      }
    }
  }
}

async function translateToFrench(text = '', translationCache = {}, keyHint = '') {
  const clean = cleanSynopsis(text);
  if (!clean || looksFrench(clean)) return clean;
  const key = `sync-fr-${keyHint || clean}`;
  if (translationCache[key]) return translationCache[key];
  try {
    const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'fr', dt: 't', q: clean });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' }
    });
    if (!response.ok) return clean;
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : '';
    const finalText = cleanSynopsis(translated);
    if (finalText && finalText.length >= 20) {
      translationCache[key] = finalText;
      return finalText;
    }
  } catch {}
  return clean;
}

async function fetchOmdbShortPlot(imdbId) {
  if (!OMDB_API_KEY || !/^tt\d+$/.test(imdbId)) return '';
  try {
    const params = new URLSearchParams({ apikey: OMDB_API_KEY, i: imdbId, plot: 'short', r: 'json' });
    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' }
    });
    if (!response.ok) return '';
    const data = await response.json();
    const plot = cleanSynopsis(data?.Plot || '');
    return plot && plot !== 'N/A' && isGoodSynopsis(plot) ? plot : '';
  } catch {
    return '';
  }
}

async function fetchTmdbJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getTmdbList(pathname, page = 1) {
  if (!TMDB_API_KEY) return [];
  const params = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'fr-FR', region: 'FR', page: String(page) });
  const data = await fetchTmdbJson(`${TMDB_BASE_URL}${pathname}?${params.toString()}`);
  return data?.results || [];
}

async function enrichTmdbMovie(item, sourceList) {
  if (!item?.id || !TMDB_API_KEY) return null;
  const params = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'fr-FR', append_to_response: 'external_ids' });
  const data = await fetchTmdbJson(`${TMDB_BASE_URL}/movie/${encodeURIComponent(item.id)}?${params.toString()}`);
  const imdbId = String(data?.external_ids?.imdb_id || data?.imdb_id || '').trim();
  if (!/^tt\d+$/.test(imdbId)) return null;
  return {
    imdbId,
    tmdbId: String(data.id || item.id || ''),
    title: data.title || item.title || '',
    originalTitle: data.original_title || item.original_title || '',
    year: data.release_date ? String(data.release_date).slice(0, 4) : '',
    sourceList
  };
}

function readCatalogueFilms() {
  const candidates = [];
  const files = [
    path.join(PROJECT_DIR, 'js', 'data.js'),
    path.join(PROJECT_DIR, 'js', 'films.js'),
    path.join(PROJECT_DIR, 'js', 'catalogue.js'),
    LETTERBOXD_PATH
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const json = file.endsWith('.json') ? readJson(file, null) : null;
    if (Array.isArray(json)) {
      for (const f of json) {
        const imdbId = String(f.imdbId || f.imdb_id || f.imdbID || '').trim();
        if (/^tt\d+$/.test(imdbId)) candidates.push({ imdbId, title: f.title || f.titre || '', year: f.year || f.annee || '', sourceList: path.basename(file) });
      }
    }
    const ids = [...content.matchAll(/tt\d{6,}/g)].map(m => m[0]);
    for (const imdbId of ids) candidates.push({ imdbId, title: '', year: '', sourceList: path.basename(file) });
  }
  return candidates;
}

async function collectFilms() {
  const all = [...readCatalogueFilms()];
  const tmdbSources = [
    ['/movie/now_playing', 'tmdb-now-playing'],
    ['/movie/upcoming', 'tmdb-upcoming'],
    ['/movie/popular', 'tmdb-popular'],
    ['/movie/top_rated', 'tmdb-top-rated']
  ];
  for (const [pathname, sourceList] of tmdbSources) {
    for (let page = 1; page <= 5; page++) {
      const list = await getTmdbList(pathname, page);
      for (const item of list) {
        const film = await enrichTmdbMovie(item, sourceList);
        if (film) all.push(film);
        await wait(60);
      }
    }
  }
  const byId = new Map();
  for (const film of all) {
    if (/^tt\d+$/.test(film.imdbId)) byId.set(film.imdbId, { ...(byId.get(film.imdbId) || {}), ...film });
  }
  return [...byId.values()];
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cache = readJson(CACHE_PATH, {});
  const translationCache = readJson(TRANSLATION_CACHE_PATH, {});
  mergeLegacyCaches(cache);

  if (!OMDB_API_KEY) {
    console.log('ERREUR : OMDB_API_KEY manquante dans backend/.env. Le cache ne peut pas se remplir via OMDb.');
    writeJson(CACHE_PATH, cache);
    return;
  }

  const films = await collectFilms();
  console.log(`Synchronisation cache synopsis OMDb : ${films.length} films détectés.`);
  console.log(`Cache cible : ${CACHE_PATH}`);

  let added = 0;
  let skipped = 0;
  let missing = 0;

  for (const film of films) {
    const existing = cleanSynopsis(cache[film.imdbId]?.synopsis || '');
    if (existing && !isBadSynopsisText(existing)) {
      skipped++;
      continue;
    }

    process.stdout.write(`OMDb ${film.imdbId} ${film.title ? '- ' + film.title : ''} ... `);
    const omdbPlot = await fetchOmdbShortPlot(film.imdbId);
    if (!omdbPlot) {
      missing++;
      console.log('absent');
      await wait(180);
      continue;
    }

    const synopsisFr = await translateToFrench(omdbPlot, translationCache, film.imdbId);
    if (isGoodSynopsis(synopsisFr)) {
      cache[film.imdbId] = {
        imdbId: film.imdbId,
        tmdbId: film.tmdbId || '',
        title: film.title || '',
        originalTitle: film.originalTitle || '',
        year: film.year || '',
        synopsis: synopsisFr,
        source: looksFrench(synopsisFr) ? 'omdb-short-translated-fr' : 'omdb-short',
        originalSource: 'OMDb by imdbId',
        updatedAt: new Date().toISOString()
      };
      added++;
      console.log('OK');
      writeJson(CACHE_PATH, cache);
      writeJson(TRANSLATION_CACHE_PATH, translationCache);
    } else {
      missing++;
      console.log('inutilisable');
    }
    await wait(180);
  }

  writeJson(CACHE_PATH, cache);
  writeJson(TRANSLATION_CACHE_PATH, translationCache);
  console.log(`Cache terminé : ${Object.keys(cache).length} entrées dans imdb-synopsis-cache.json, ${added} ajoutées, ${skipped} déjà présentes, ${missing} sans OMDb.`);
}

main().catch(error => {
  console.error('sync-imdb échoué :', error?.message || error);
  process.exitCode = 0;
});
