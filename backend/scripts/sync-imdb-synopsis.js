import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(BACKEND_DIR, '..');
const DATA_DIR = path.join(BACKEND_DIR, 'data');
const CACHE_PATH = path.join(DATA_DIR, 'synopsis-cache.json');
const TRANSLATION_CACHE_PATH = path.join(DATA_DIR, 'translation-cache.json');

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '16d984ea5d9a771088779b56497e0890';
const OMDB_API_KEY = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) || fallback;
  } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
function stripHtml(value = '') { return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')); }
function cleanSynopsis(value = '') {
  return stripHtml(value)
    .replace(/\s*See full summary\s*»?\s*$/i, '')
    .replace(/\s*Voir le résumé complet\s*»?\s*$/i, '')
    .replace(/\s*Add a plot.*$/i, '')
    .replace(/\s*Ajouter un résumé.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function isBadSynopsisText(text = '') {
  const value = cleanSynopsis(text).toLowerCase();
  if (!value) return true;
  return /javascript est désactivé|javascript est desactive|enable javascript|you need to enable javascript|nous devons vérifier|vous n.?êtes pas un robot|not a robot|robot|captcha|verify you are human|access denied|request blocked|réessayez plus tard|try again later|^n\/a$/i.test(value);
}
function isGoodSynopsis(text = '') {
  const clean = cleanSynopsis(text);
  if (isBadSynopsisText(clean)) return false;
  if (clean.length < 35 || clean.length > 900) return false;
  if (!/[.!?…]/.test(clean)) return false;
  if (/directed by|with [A-Z][a-z]+|watch options|add a plot/i.test(clean)) return false;
  return true;
}
function looksFrench(text = '') {
  const value = String(text).toLowerCase();
  const frenchHits = (value.match(/\b(le|la|les|des|une|un|dans|avec|pour|qui|que|est|sont|son|sa|ses|leur|leurs|été|après|avant|mais|plus|tout|toute|alors|lorsque|tandis|afin|ce|cette|ces|aux|du)\b/g) || []).length;
  const englishHits = (value.match(/\b(the|and|with|from|after|before|his|her|their|into|while|when|who|that|this|story|life|must|find)\b/g) || []).length;
  return frenchHits >= 3 && frenchHits >= englishHits;
}
async function translateToFrench(text = '', translationCache = {}) {
  const clean = cleanSynopsis(text);
  if (!clean || looksFrench(clean)) return clean;
  const key = `sync-fr-${clean}`;
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
    if (finalText && finalText.length >= 30) {
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
  } catch { return ''; }
}
async function fetchTmdbFrenchOverview(tmdbId = '') {
  if (!TMDB_API_KEY || !tmdbId) return '';
  try {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=fr-FR`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' }
    });
    if (!response.ok) return '';
    const data = await response.json();
    const overview = cleanSynopsis(data?.overview || '');
    return isGoodSynopsis(overview) ? overview : '';
  } catch { return ''; }
}
function readCatalogueFilms() {
  const file = path.join(PROJECT_DIR, 'js', 'data.js');
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf-8');
  const films = [];
  const blocks = content.match(/\{[\s\S]*?imdbID:\s*["']tt\d+["'][\s\S]*?\}/g) || [];
  for (const block of blocks) {
    const imdbId = block.match(/imdbID:\s*["'](tt\d+)["']/)?.[1] || '';
    const title = block.match(/titre:\s*["']([^"']+)["']/)?.[1] || '';
    const originalTitle = block.match(/original:\s*["']([^"']+)["']/)?.[1] || '';
    const year = block.match(/annee:\s*(\d{4})/)?.[1] || '';
    if (imdbId) films.push({ imdbId, tmdbId: '', title, originalTitle, year, sourceList: 'catalogue-local' });
  }
  return films;
}
async function getTmdbList(pathname, page = 1) {
  try {
    const url = `${TMDB_BASE_URL}${pathname}?api_key=${TMDB_API_KEY}&language=fr-FR&region=FR&page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' } });
    if (!res.ok) return [];
    return (await res.json()).results || [];
  } catch { return []; }
}
async function enrichTmdbMovie(item, sourceList) {
  try {
    const url = `${TMDB_BASE_URL}/movie/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=external_ids`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/plain,*/*' } });
    if (!res.ok) return null;
    const data = await res.json();
    const imdbId = String(data?.external_ids?.imdb_id || data?.imdb_id || '').trim();
    if (!/^tt\d+$/.test(imdbId)) return null;
    return {
      imdbId,
      tmdbId: String(data.id || item.id || ''),
      title: data.title || item.title || '',
      originalTitle: data.original_title || '',
      year: data.release_date ? String(data.release_date).slice(0, 4) : '',
      tmdbOverview: cleanSynopsis(data.overview || item.overview || ''),
      sourceList
    };
  } catch { return null; }
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
    for (let page = 1; page <= 3; page++) {
      const list = await getTmdbList(pathname, page);
      for (const item of list) {
        const film = await enrichTmdbMovie(item, sourceList);
        if (film) all.push(film);
        await wait(80);
      }
    }
  }
  const byId = new Map();
  for (const film of all) byId.set(film.imdbId, { ...(byId.get(film.imdbId) || {}), ...film });
  return [...byId.values()];
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cache = readJson(CACHE_PATH, {});
  const translationCache = readJson(TRANSLATION_CACHE_PATH, {});
  for (const [id, entry] of Object.entries(cache)) {
    if (!entry?.synopsis || isBadSynopsisText(entry.synopsis)) delete cache[id];
  }
  if (!OMDB_API_KEY) {
    console.log('OMDB_API_KEY manquante : ajoute-la dans backend/.env puis relance npm run sync-imdb.');
  }
  const films = await collectFilms();
  console.log(`Synchronisation cache synopsis : ${films.length} films à vérifier.`);
  console.log('Priorité : cache local construit via OMDb par imdbId → traduction FR. TMDB reste uniquement le secours au clic.');
  let added = 0, skipped = 0, missing = 0, tmdbKnown = 0;
  for (const film of films) {
    const existing = cleanSynopsis(cache[film.imdbId]?.synopsis || '');
    if (existing && !isBadSynopsisText(existing) && /^(imdb|omdb)/i.test(String(cache[film.imdbId]?.source || ''))) { skipped++; continue; }
    process.stdout.write(`Cache IMDb ${film.imdbId} — ${film.title || film.originalTitle || ''}... `);
    const omdbPlot = await fetchOmdbShortPlot(film.imdbId);
    if (omdbPlot) {
      const synopsisFr = await translateToFrench(omdbPlot, translationCache);
      if (synopsisFr && isGoodSynopsis(synopsisFr)) {
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
        writeJson(CACHE_PATH, cache);
        writeJson(TRANSLATION_CACHE_PATH, translationCache);
        added++;
        console.log('OK OMDb');
      } else { missing++; console.log('OMDb inutilisable'); }
    } else {
      const tmdb = film.tmdbOverview || await fetchTmdbFrenchOverview(film.tmdbId || '');
      if (tmdb) tmdbKnown++;
      missing++;
      console.log(tmdb ? 'pas OMDb, TMDB sera utilisé au clic' : 'absent');
    }
    await wait(250);
  }
  writeJson(CACHE_PATH, cache);
  writeJson(TRANSLATION_CACHE_PATH, translationCache);
  console.log(`Cache terminé : ${Object.keys(cache).length} entrées IMDb/OMDb, ${added} ajoutées, ${skipped} déjà présentes, ${missing} sans OMDb, ${tmdbKnown} avec TMDB connu.`);
}
main().catch(error => { console.error('sync-imdb échoué :', error?.message || error); process.exitCode = 0; });
