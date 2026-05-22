import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(BACKEND_DIR, '..');
const DATA_DIR = path.join(BACKEND_DIR, 'data');
const CACHE_PATH = path.join(DATA_DIR, 'imdb-synopsis-cache.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || '16d984ea5d9a771088779b56497e0890';
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
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
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
  return /javascript est désactivé|javascript est desactive|enable javascript|you need to enable javascript|nous devons vérifier|vous n.?êtes pas un robot|not a robot|robot|captcha|verify you are human|access denied|request blocked|réessayez plus tard|try again later/i.test(value);
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
  const frenchHits = (value.match(/\b(le|la|les|des|une|un|dans|avec|pour|qui|que|est|sont|son|sa|ses|leur|leurs|été|après|avant|mais|plus|tout|toute|alors|lorsque|tandis)\b/g) || []).length;
  const englishHits = (value.match(/\b(the|and|with|from|after|before|his|her|their|into|while|when|who|that|this|story|life|must|find)\b/g) || []).length;
  return frenchHits >= 3 && frenchHits >= englishHits;
}
function decodeJsonString(value = '') {
  try { return JSON.parse('"' + String(value).replace(/"/g, '\\"') + '"'); }
  catch {
    return String(value).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\//g, '/');
  }
}
function pickBest(candidates = []) {
  const cleaned = [...new Set(candidates.map(cleanSynopsis).filter(isGoodSynopsis).filter(looksFrench))];
  if (!cleaned.length) return '';
  return cleaned.sort((a, b) => {
    const score = t => (t.length >= 70 && t.length <= 360 ? 100 : 0) + (t.length <= 500 ? 25 : 0) - Math.abs(t.length - 210) / 8;
    return score(b) - score(a);
  })[0];
}
function collectJson(value, candidates = [], parentKey = '') {
  if (!value) return;
  if (typeof value === 'string') {
    if (/description|plottext|plot|synopsis|summary|storyline|plaintext|plain/i.test(parentKey) && isGoodSynopsis(value)) candidates.push(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach(v => collectJson(v, candidates, parentKey));
  if (typeof value === 'object') {
    if (value?.plotText?.plainText) candidates.push(value.plotText.plainText);
    if (value?.plot?.plotText?.plainText) candidates.push(value.plot.plotText.plainText);
    if (value?.description) candidates.push(value.description);
    Object.entries(value).forEach(([k, v]) => collectJson(v, candidates, k));
  }
}
async function fetchHtml(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Cookie': 'lc-main=fr_FR; ubid-main=135-0000000-0000000'
      }
    });
    if (!response.ok) return '';
    return await response.text();
  } catch { return ''; }
}
function extractImdbFrSynopsis(html = '') {
  if (!html || isBadSynopsisText(html)) return '';
  const candidates = [];
  const $ = cheerio.load(html);
  [
    '[data-testid="plot-xl"]','[data-testid="plot-l"]','[data-testid="plot"]','[data-testid="title-plot-xl"]','[data-testid="title-plot-l"]',
    '[data-testid="hero-plot"]','[data-testid="hero-overview"] span','section[data-testid="Storyline"] [data-testid*="plot"]','.ipc-html-content-inner-div'
  ].forEach(sel => $(sel).each((_, el) => { const t = cleanSynopsis($(el).text()); if (isGoodSynopsis(t)) candidates.push(t); }));
  $('script[type="application/ld+json"]').each((_, el) => {
    try { const json = JSON.parse($(el).contents().text()); (Array.isArray(json) ? json : [json]).forEach(item => { if (item?.description) candidates.push(item.description); }); } catch {}
  });
  $('#__NEXT_DATA__, script#__NEXT_DATA__').each((_, el) => { try { collectJson(JSON.parse($(el).contents().text()), candidates); } catch {} });
  const patterns = [
    /"plot"\s*:\s*\{[\s\S]{0,4000}?"plotText"\s*:\s*\{[\s\S]{0,1200}?"plainText"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g,
    /"plotText"\s*:\s*\{[\s\S]{0,1200}?"plainText"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g,
    /"description"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g
  ];
  for (const pattern of patterns) {
    let match; while ((match = pattern.exec(html)) !== null) candidates.push(decodeJsonString(match[1]));
  }
  const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (meta) candidates.push(meta);
  return pickBest(candidates);
}
async function fetchImdbFr(imdbId) {
  const urls = [`https://www.imdb.com/fr/title/${imdbId}/`, `https://www.imdb.com/title/${imdbId}/?locale=fr_FR`];
  for (const url of urls) {
    const html = await fetchHtml(url);
    const synopsis = extractImdbFrSynopsis(html);
    if (synopsis) return synopsis;
  }
  return '';
}
function readCatalogueFilms() {
  const file = path.join(PROJECT_DIR, 'js', 'data.js');
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf-8');
  const films = [];
  const blocks = content.match(/\{[\s\S]*?imdbID:\s*"tt\d+"[\s\S]*?\}/g) || [];
  for (const block of blocks) {
    const imdb = block.match(/imdbID:\s*"(tt\d+)"/)?.[1] || '';
    const titre = block.match(/titre:\s*"([^"]+)"/)?.[1] || '';
    const original = block.match(/original:\s*"([^"]+)"/)?.[1] || '';
    const annee = block.match(/annee:\s*(\d{4})/)?.[1] || '';
    if (imdb) films.push({ imdbId: imdb, title: titre, originalTitle: original, year: annee, tmdbId: '' });
  }
  return films;
}
async function getTmdbList(pathname, page = 1) {
  const url = `${TMDB_BASE_URL}${pathname}?api_key=${TMDB_API_KEY}&language=fr-FR&region=FR&page=${page}`;
  try { const res = await fetch(url); if (!res.ok) return []; return (await res.json()).results || []; } catch { return []; }
}
async function enrichTmdbMovie(item) {
  try {
    const url = `${TMDB_BASE_URL}/movie/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=external_ids`;
    const res = await fetch(url); if (!res.ok) return null;
    const data = await res.json();
    const imdbId = String(data?.external_ids?.imdb_id || data?.imdb_id || '').trim();
    if (!/^tt\d+$/.test(imdbId)) return null;
    return { imdbId, tmdbId: String(data.id), title: data.title || item.title || '', originalTitle: data.original_title || '', year: data.release_date ? String(data.release_date).slice(0,4) : '' };
  } catch { return null; }
}
async function collectFilms() {
  const all = [...readCatalogueFilms()];
  // On précharge aussi les films dynamiques utilisés par Nouveautés/Résultats.
  for (const pathname of ['/movie/now_playing', '/movie/upcoming']) {
    for (let page = 1; page <= 3; page++) {
      const list = await getTmdbList(pathname, page);
      for (const item of list) {
        const film = await enrichTmdbMovie(item);
        if (film) all.push(film);
      }
    }
  }
  const byId = new Map();
  for (const film of all) byId.set(film.imdbId, film);
  return [...byId.values()];
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const cache = readJson(CACHE_PATH, {});
  for (const [id, entry] of Object.entries(cache)) {
    if (!entry?.synopsis || isBadSynopsisText(entry.synopsis) || !/^imdb/i.test(String(entry.source || ''))) delete cache[id];
  }
  const films = await collectFilms();
  console.log(`Synchronisation IMDb FR : ${films.length} films à vérifier.`);
  let added = 0, skipped = 0, missing = 0;
  for (const film of films) {
    const cached = cleanSynopsis(cache[film.imdbId]?.synopsis || '');
    if (cached && !isBadSynopsisText(cached) && /^imdb/i.test(String(cache[film.imdbId]?.source || ''))) { skipped++; continue; }
    process.stdout.write(`IMDb FR ${film.imdbId} — ${film.title || film.originalTitle || ''}... `);
    const synopsis = await fetchImdbFr(film.imdbId);
    if (synopsis) {
      cache[film.imdbId] = { imdbId: film.imdbId, tmdbId: film.tmdbId || '', title: film.title || '', originalTitle: film.originalTitle || '', year: film.year || '', synopsis, source: 'imdb-fr-preloaded', updatedAt: new Date().toISOString() };
      writeJson(CACHE_PATH, cache);
      added++;
      console.log('OK');
    } else {
      missing++;
      console.log('absent/bloqué');
    }
    await wait(450);
  }
  writeJson(CACHE_PATH, cache);
  console.log(`Cache IMDb terminé : ${Object.keys(cache).length} entrées, ${added} ajoutées, ${skipped} déjà présentes, ${missing} sans IMDb FR.`);
}

main().catch(error => { console.error('sync-imdb échoué :', error?.message || error); process.exitCode = 0; });
