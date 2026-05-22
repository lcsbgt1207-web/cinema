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
  return /javascript est désactivé|javascript est desactive|enable javascript|you need to enable javascript|nous devons vérifier que vous n.?êtes pas un robot|vous n.?êtes pas un robot|not a robot|robot|captcha|verify you are human|access denied|request blocked|réessayez plus tard|try again later/i.test(value);
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

function decodeBackslashEscapes(value = '') {
  return String(value)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n|\n/g, ' ')
    .replace(/\\t|\t/g, ' ')
    .replace(/\\r|\r/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\//g, '/')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlVariantsForExtraction(html = '') {
  const raw = String(html || '');
  const loose = decodeBackslashEscapes(raw);
  const noTagsJson = loose
    .replace(/\\u003C/gi, '<')
    .replace(/\\u003E/gi, '>')
    .replace(/\\u002F/gi, '/')
    .replace(/\u003C/gi, '<')
    .replace(/\u003E/gi, '>')
    .replace(/\u002F/gi, '/');
  return [...new Set([raw, loose, noTagsJson])].filter(Boolean);
}

function isProbablyUiOrMetadata(text = '') {
  const value = cleanSynopsis(text);
  const lower = value.toLowerCase();
  if (!value) return true;
  if (/^(menu|tout|se connecter|créer un compte|liste de favoris|ajouter à la liste|marquer comme regardé)$/i.test(value)) return true;
  if (/^(réalisation|scénaristes|stars|distribution|photos|vidéos|récompenses|imdbpro|in theaters|streaming)$/i.test(value)) return true;
  if (/^(prochainement|sortie le|voir les séances|définissez vos services|nouveau client)/i.test(lower)) return true;
  if (/\b(avis des critiques|informations de production|showtimes|watch options|user reviews|critic reviews)\b/i.test(lower)) return true;
  if (/^\d+(\.\d+)?\s*(\/10|avis|h|min|victoires|nominations)/i.test(lower)) return true;
  return false;
}

function collectVisibleTextCandidates($, candidates = []) {
  const selectors = [
    'main span',
    'main div',
    'section span',
    'section div',
    '[role="presentation"] span',
    '.ipc-html-content-inner-div',
    '.ipc-overflowText',
    '.ipc-overflowText--children',
    '[data-testid*="plot"]',
    '[data-testid*="storyline"]',
    '[data-testid*="hero"]'
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = cleanSynopsis($(el).clone().children('script,style,svg,button,a').remove().end().text());
      if (!isProbablyUiOrMetadata(text) && isGoodSynopsis(text)) {
        candidates.push(text);
      }
    });
  }

  // Dernier filet de sécurité : certains rendus IMDb Next.js mettent le pitch dans un élément
  // sans data-testid stable. On parcourt alors les textes visibles courts/propres.
  $('body *').each((_, el) => {
    const childElements = $(el).children().length;
    if (childElements > 2) return;
    const text = cleanSynopsis($(el).clone().children('script,style,svg,button,a').remove().end().text());
    if (!isProbablyUiOrMetadata(text) && isGoodSynopsis(text)) {
      candidates.push(text);
    }
  });

  return candidates;
}

function collectRawSynopsisCandidates(html = '', candidates = []) {
  const rawPatterns = [
    /"plot"\s*:\s*\{[\s\S]{0,4000}?"plotText"\s*:\s*\{[\s\S]{0,1200}?"plainText"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g,
    /"plotText"\s*:\s*\{[\s\S]{0,1200}?"plainText"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g,
    /"plainText"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g,
    /"description"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g,
    /"storyline"\s*:\s*"((?:\\.|[^"\\]){35,1200})"/g
  ];

  for (const variant of htmlVariantsForExtraction(html)) {
    for (const pattern of rawPatterns) {
      let match;
      while ((match = pattern.exec(variant)) !== null) {
        const text = decodeBackslashEscapes(decodeJsonString(match[1]));
        if (!isProbablyUiOrMetadata(text) && isGoodSynopsis(text)) candidates.push(text);
      }
    }
  }

  return candidates;
}

function extractPlainTextSynopsis(text = '', preferFrench = false) {
  const candidates = [];
  const cleanText = decodeBackslashEscapes(stripHtml(text))
    .replace(/\s+/g, ' ')
    .trim();

  // Cas IMDb FR fréquent : pitch entre les genres et "Réalisation".
  const blocks = [
    /(?:Français|French|Drame|Drama|Action|Comédie|Comedy|Horreur|Horror|Thriller|Aventure|Adventure|Historique|History|Science-fiction|Sci-Fi)(?:\s+[A-ZÀ-Ÿ][^.!?…]{10,}){0,4}\s+([^|]{50,700}?[.!?…])\s+(?:Réalisation|Director|Directors|Scénaristes|Writers|Stars)/gi,
    /\b((?:Jura suisse|Alors que|Dans|Après|Lorsque|Tandis|Une|Un|Le|La|Les|Des|Emma|Maverick|Chronicles|The|When|After)[^\n]{50,700}?[.!?…])\s+(?:Réalisation|Director|Scénaristes|Writers|Stars)/gi
  ];

  for (const pattern of blocks) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const candidate = cleanSynopsis(match[1]);
      if (!isProbablyUiOrMetadata(candidate) && isGoodSynopsis(candidate)) candidates.push(candidate);
    }
  }

  return pickShortOfficial(candidates, preferFrench);
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

  // DOM visible de la fiche titre : plusieurs variantes IMDb existent selon film/langue/rendu.
  [
    '[data-testid="plot-xl"]',
    '[data-testid="plot-l"]',
    '[data-testid="plot"]',
    '[data-testid="title-plot-xl"]',
    '[data-testid="title-plot-l"]',
    '[data-testid="hero-plot"]',
    '[data-testid="hero-overview"] [data-testid*="plot"]',
    '[data-testid="hero-overview"] span',
    'section[data-testid="Storyline"] [data-testid*="plot"]',
    'section[data-testid="Storyline"] .ipc-html-content-inner-div',
    '.ipc-html-content-inner-div',
    '.ipc-overflowText .ipc-html-content-inner-div'
  ].forEach(selector => {
    $(selector).each((_, el) => {
      const text = cleanSynopsis($(el).text());
      if (!isProbablyUiOrMetadata(text) && isGoodSynopsis(text)) candidates.push(text);
    });
  });

  // JSON-LD : souvent utilisé par Google et correspond au court résumé officiel.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const values = Array.isArray(json) ? json : [json];
      values.forEach(item => {
        if (item?.description && !isProbablyUiOrMetadata(item.description) && isGoodSynopsis(item.description)) candidates.push(item.description);
      });
    } catch {}
  });

  // Next/GraphQL classique.
  $('#__NEXT_DATA__, script#__NEXT_DATA__').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      collectSynopsisCandidatesFromJson(json, candidates);
    } catch {}
  });

  // Next.js App Router / scripts self.__next_f.push : IMDb met parfois les données ici,
  // avec les guillemets échappés. On scanne donc le HTML brut ET déséchappé.
  collectRawSynopsisCandidates(html, candidates);

  // Texte visible générique : utile pour les pages IMDb FR où le pitch est bien affiché
  // mais pas sous un data-testid stable.
  collectVisibleTextCandidates($, candidates);

  const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (meta && !/^.+?:\s*directed by/i.test(meta) && !isProbablyUiOrMetadata(meta) && isGoodSynopsis(meta)) candidates.push(meta);

  // Fallback texte brut : récupère les cas où le pitch existe dans le HTML rendu, mais
  // mélangé dans un gros flux texte.
  const fromPlain = extractPlainTextSynopsis($.text(), preferFrench) || extractPlainTextSynopsis(html, preferFrench);
  if (fromPlain) candidates.push(fromPlain);

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

function readSynopsisCache() {
  return readJson(synopsisCachePath(), {});
}

function normalizeCacheEntry(raw, imdbId = '') {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const synopsis = cleanSynopsis(raw);
    return synopsis && !isBadSynopsisText(synopsis) ? { imdbId, synopsis, source: 'imdb-cache-manual' } : null;
  }
  if (typeof raw === 'object') {
    const synopsis = cleanSynopsis(raw.synopsis || raw.plot || raw.overview || '');
    if (!synopsis || isBadSynopsisText(synopsis)) return null;
    return {
      imdbId: raw.imdbId || imdbId,
      synopsis,
      source: raw.source || 'imdb-cache-manual',
      updatedAt: raw.updatedAt || null
    };
  }
  return null;
}

function isTrustedImdbCacheEntry(entry) {
  if (!entry?.synopsis || isBadSynopsisText(entry.synopsis)) return false;
  // Le cache prioritaire ne doit pas bloquer IMDb avec d'anciens fallback TMDB/OMDb.
  // On garde seulement les entrées IMDb officielles ou ajoutées manuellement.
  const source = String(entry.source || '').toLowerCase();
  return source.includes('imdb') && !source.includes('tmdb') && !source.includes('omdb');
}

function getSynopsisFromCache(cache, { imdbId = '', tmdbId = '', title = '', year = '' }) {
  const keys = [];
  if (/^tt\d+$/.test(imdbId)) keys.push(imdbId);
  if (tmdbId) keys.push(`tmdb:${tmdbId}`);
  const titleKey = normalizeSearchTitle(title);
  if (titleKey) keys.push(year ? `title:${titleKey}:${year}` : `title:${titleKey}`);

  for (const key of keys) {
    const entry = normalizeCacheEntry(cache[key], imdbId);
    if (isTrustedImdbCacheEntry(entry)) return { key, entry };
  }
  return { key: '', entry: null };
}

function removeBadOrFallbackCacheEntries(cache) {
  let changed = false;
  for (const [key, raw] of Object.entries(cache || {})) {
    const entry = normalizeCacheEntry(raw, key);
    const source = String(raw?.source || entry?.source || '').toLowerCase();
    if (!entry || source.includes('tmdb') || source.includes('omdb') || isBadSynopsisText(entry.synopsis)) {
      delete cache[key];
      changed = true;
    }
  }
  return changed;
}

function saveSynopsisCacheEntry(imdbId, entry) {
  if (!/^tt\d+$/.test(imdbId) || !entry?.synopsis) return;
  const source = String(entry.source || 'unknown');
  // Important : on ne sauvegarde PAS les fallback TMDB/OMDb dans le cache IMDb prioritaire.
  if (!source.toLowerCase().includes('imdb') || source.toLowerCase().includes('tmdb') || source.toLowerCase().includes('omdb')) return;
  const cache = readSynopsisCache();
  cache[imdbId] = {
    imdbId,
    synopsis: cleanSynopsis(entry.synopsis),
    source,
    updatedAt: new Date().toISOString()
  };
  writeJson(synopsisCachePath(), cache);
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
    if (fr && looksFrench(fr) && !isBadSynopsisText(fr)) {
      return { source: 'imdb-fr-official', synopsis: fr };
    }
  }

  return { source: 'imdb-fr-unavailable', synopsis: '' };
}

async function getBestSynopsis({ imdbId = '', tmdbId = '', title = '', year = '' }) {
  // Règle demandée : IMDb FR en priorité, sinon TMDB FR, sinon aucun synopsis.
  if (/^tt\d+$/.test(imdbId)) {
    const imdb = await getOfficialSynopsis(imdbId);
    if (imdb.synopsis && !isBadSynopsisText(imdb.synopsis)) return imdb;
  }

  const tmdb = await fetchTmdbFrenchOverview(tmdbId, title, year);
  if (tmdb && !isBadSynopsisText(tmdb)) {
    return { source: 'tmdb-fr-fallback', synopsis: tmdb };
  }

  return { source: 'unavailable', synopsis: '' };
}

app.get('/', (req, res) => {
  res.json({ message: 'Backend CinéProche actif', routes: ['/api/films-letterboxd', '/api/imdb-synopsis'] });
});

app.get('/api/imdb-synopsis', async (req, res) => {
  try {
    const resolvedId = await resolveImdbId({
      imdbId: String(req.query.imdbId || '').trim(),
      tmdbId: String(req.query.tmdbId || '').trim(),
      title: String(req.query.title || '').trim(),
      originalTitle: String(req.query.originalTitle || '').trim(),
      year: String(req.query.year || '').trim()
    });

    const tmdbId = String(req.query.tmdbId || '').trim();
    const title = String(req.query.title || '').trim();
    const year = String(req.query.year || '').trim();

    const refresh = String(req.query.refresh || '') === '1';
    const cache = readSynopsisCache();
    if (removeBadOrFallbackCacheEntries(cache)) writeJson(synopsisCachePath(), cache);

    const cached = getSynopsisFromCache(cache, { imdbId: resolvedId, tmdbId, title, year });
    if (!refresh && cached.entry) {
      return res.json({
        source: `${cached.entry.source || 'imdb-cache'}-cache`,
        cacheKey: cached.key,
        imdbId: resolvedId || cached.entry.imdbId || '',
        synopsis: cached.entry.synopsis
      });
    }

    const result = resolvedId
      ? await getBestSynopsis({ imdbId: resolvedId, tmdbId, title, year })
      : { source: 'tmdb-fr-fallback-no-imdb-id', synopsis: await fetchTmdbFrenchOverview(tmdbId, title, year) };

    if (result.synopsis && !isBadSynopsisText(result.synopsis)) saveSynopsisCacheEntry(resolvedId, result);

    return res.json({ source: result.source, imdbId: resolvedId || '', synopsis: result.synopsis || '' });
  } catch (error) {
    return res.json({ source: 'imdb-fetch-error', imdbId: '', synopsis: '' });
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
