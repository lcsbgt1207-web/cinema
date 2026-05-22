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

async function findImdbIdBySuggestion(title, year = '') {
  if (!title) return '';
  const cleaned = normalizeSearchTitle(title).replace(/ /g, '_');
  if (!cleaned) return '';

  try {
    const first = cleaned[0];
    const url = `https://v3.sg.media-imdb.com/suggestion/${first}/${encodeURIComponent(cleaned)}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
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

function isGoodSynopsis(text = '') {
  const clean = cleanSynopsis(text);
  if (clean.length < 45 || clean.length > 1200) return false;
  if (!/[.!?…]/.test(clean)) return false;
  if (/^(cast|crew|details|release|ratings|photos|videos|official sites)$/i.test(clean)) return false;
  return true;
}

function collectSynopsisCandidatesFromJson(value, candidates = [], parentKey = '') {
  if (!value) return candidates;

  if (typeof value === 'string') {
    const key = String(parentKey || '').toLowerCase();
    if (/description|plot|synopsis|summary|storyline|plain/.test(key) && isGoodSynopsis(value)) {
      candidates.push(value);
    }
    return candidates;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectSynopsisCandidatesFromJson(item, candidates, parentKey));
    return candidates;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectSynopsisCandidatesFromJson(child, candidates, key);
    }
  }

  return candidates;
}

function pickBestSynopsis(candidates = []) {
  const cleaned = [...new Set(candidates.map(cleanSynopsis).filter(isGoodSynopsis))];
  if (!cleaned.length) return '';

  // On privilégie un synopsis IMDb complet, mais pas un très long résumé technique.
  return cleaned
    .sort((a, b) => {
      const aScore = (a.length > 90 ? 100 : 0) + (a.length < 500 ? 20 : 0) + a.length / 100;
      const bScore = (b.length > 90 ? 100 : 0) + (b.length < 500 ? 20 : 0) + b.length / 100;
      return bScore - aScore;
    })[0];
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) return '';
  return response.text();
}

function extractImdbSynopsis(html = '') {
  const candidates = [];
  const $ = cheerio.load(html);

  // 1) Pages /plotsummary : le résumé IMDb est souvent dans ces blocs.
  [
    '[data-testid="sub-section-summaries"] .ipc-html-content-inner-div',
    '[data-testid="sub-section-summaries"] li',
    'li[data-testid="list-item"] .ipc-html-content-inner-div',
    '.ipc-metadata-list__item .ipc-html-content-inner-div',
    '[data-testid="plot-xl"]',
    '[data-testid="plot-l"]',
    '[data-testid="plot"]',
    'section[data-testid="Storyline"] .ipc-html-content-inner-div'
  ].forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text();
      if (isGoodSynopsis(text)) candidates.push(text);
    });
  });

  // 2) JSON-LD et __NEXT_DATA__ : plus stable quand IMDb change le HTML.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      collectSynopsisCandidatesFromJson(json, candidates);
    } catch {}
  });

  $('#__NEXT_DATA__, script#__NEXT_DATA__').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      collectSynopsisCandidatesFromJson(json, candidates);
    } catch {}
  });

  // 3) Données Next.js/GraphQL compressées dans le HTML.
  // IMDb change souvent son DOM, mais ces champs restent généralement présents.
  const rawPatterns = [
    /\"plotText\"\s*:\s*\{\s*\"plainText\"\s*:\s*\"((?:\\.|[^\"\\]){40,1400})\"/g,
    /\"plot\"\s*:\s*\{[^{}]*\"plotText\"[^{}]*\"plainText\"\s*:\s*\"((?:\\.|[^\"\\]){40,1400})\"/g,
    /\"description\"\s*:\s*\"((?:\\.|[^\"\\]){40,1400})\"/g,
    /\"plainText\"\s*:\s*\"((?:\\.|[^\"\\]){40,1400})\"/g
  ];

  for (const pattern of rawPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = decodeJsonString(match[1]);
      if (isGoodSynopsis(text)) candidates.push(text);
    }
  }

  // 4) Dernier recours : meta description IMDb.
  const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (isGoodSynopsis(meta)) candidates.push(meta);

  return pickBestSynopsis(candidates);
}

function extractImdbMainSynopsis(html = '') {
  const candidates = [];
  const $ = cheerio.load(html);

  // Page principale IMDb : ce bloc correspond au synopsis court visible sous la bande-annonce.
  [
    '[data-testid="plot-xl"]',
    '[data-testid="plot-l"]',
    '[data-testid="plot"]',
    'span[data-testid="plot-xl"]',
    'span[data-testid="plot-l"]'
  ].forEach(selector => {
    $(selector).each((_, el) => {
      const text = $(el).text();
      if (isGoodSynopsis(text)) candidates.push(text);
    });
  });

  // JSON-LD de la page principale : souvent le vrai court synopsis IMDb.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const description = Array.isArray(json)
        ? json.map(item => item?.description).find(Boolean)
        : json?.description;
      if (isGoodSynopsis(description)) candidates.push(description);
    } catch {}
  });

  // Dernier recours sur la page principale.
  const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (isGoodSynopsis(meta) && !/^.+?:\s*directed by/i.test(meta)) candidates.push(meta);

  return pickShortestGoodSynopsis(candidates);
}

function pickShortestGoodSynopsis(candidates = []) {
  const cleaned = [...new Set(candidates.map(cleanSynopsis).filter(isGoodSynopsis))];
  if (!cleaned.length) return '';

  // Pour coller à IMDb : on veut le synopsis court officiel, pas les longs résumés utilisateurs.
  return cleaned
    .filter(text => text.length <= 650)
    .sort((a, b) => {
      const aScore = (a.length >= 80 ? 100 : 0) - Math.abs(a.length - 220) / 10;
      const bScore = (b.length >= 80 ? 100 : 0) - Math.abs(b.length - 220) / 10;
      return bScore - aScore;
    })[0] || cleaned.sort((a, b) => a.length - b.length)[0];
}

async function fetchOmdbPlot(imdbId) {
  const apiKey = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY || '';
  if (!apiKey || !/^tt\d+$/.test(imdbId)) return '';

  try {
    const params = new URLSearchParams({ apikey: apiKey, i: imdbId, plot: 'full', r: 'json' });
    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
    if (!response.ok) return '';
    const data = await response.json();
    const plot = String(data?.Plot || '').trim();
    return plot && plot !== 'N/A' ? cleanSynopsis(plot) : '';
  } catch {
    return '';
  }
}

async function fetchOmdbByTitle(title, year = '') {
  const apiKey = process.env.OMDB_API_KEY || process.env.VITE_OMDB_API_KEY || '';
  if (!apiKey || !title) return null;

  try {
    const params = new URLSearchParams({ apikey: apiKey, t: title, plot: 'full', r: 'json' });
    if (/^\d{4}$/.test(String(year))) params.set('y', String(year));

    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.Response !== 'True') return null;

    const imdbId = String(data?.imdbID || '').trim();
    const plot = String(data?.Plot || '').trim();

    return {
      imdbId: /^tt\d+$/.test(imdbId) ? imdbId : '',
      synopsis: plot && plot !== 'N/A' ? cleanSynopsis(plot) : ''
    };
  } catch {
    return null;
  }
}


function looksFrench(text = '') {
  const value = String(text).toLowerCase();
  const frenchHits = (value.match(/\b(le|la|les|des|une|dans|avec|pour|qui|que|est|sont|son|sa|ses|leur|leurs|été|après|avant|mais|plus|tout|toute)\b/g) || []).length;
  const englishHits = (value.match(/\b(the|and|with|from|after|before|his|her|their|into|while|when|who|that|this|story|life)\b/g) || []).length;
  return frenchHits >= 3 && frenchHits >= englishHits;
}

function getTranslationCachePath() {
  return path.join(__dirname, 'data', 'imdb-synopsis-fr-cache.json');
}

function readTranslationCache() {
  const filePath = getTranslationCachePath();
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {};
  } catch {
    return {};
  }
}

function writeTranslationCache(cache) {
  const filePath = getTranslationCachePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {}
}

async function translateSynopsisToFrench(text = '', cacheKey = '') {
  const synopsis = cleanSynopsis(text);
  if (!synopsis || looksFrench(synopsis)) return synopsis;

  const key = cacheKey || synopsis;
  const cache = readTranslationCache();
  if (cache[key]) return cache[key];

  try {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'en',
      tl: 'fr',
      dt: 't',
      q: synopsis
    });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/plain,*/*'
      }
    });
    if (!response.ok) return synopsis;
    const data = await response.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map(part => part?.[0] || '').join('').trim()
      : '';

    const cleanTranslated = cleanSynopsis(translated);
    if (cleanTranslated && cleanTranslated.length >= 30) {
      cache[key] = cleanTranslated;
      writeTranslationCache(cache);
      return cleanTranslated;
    }
  } catch {}

  return synopsis;
}

async function sendSynopsisJson(res, { source, imdbId = '', synopsis = '', title = '', year = '' }) {
  const cacheKey = imdbId || `${normalizeSearchTitle(title)}-${year}` || synopsis;
  const synopsisFr = await translateSynopsisToFrench(synopsis, cacheKey);
  return res.json({
    source: synopsisFr && synopsisFr !== synopsis ? `${source}-fr` : source,
    imdbId,
    synopsis: synopsisFr
  });
}

app.get('/', (req, res) => {
  res.json({ message: 'Backend CinéProche actif', routes: ['/api/films-letterboxd', '/api/imdb-synopsis'] });
});


app.get('/api/imdb-synopsis', async (req, res) => {
  let imdbId = String(req.query.imdbId || '').trim();
  const title = String(req.query.title || '').trim();
  const originalTitle = String(req.query.originalTitle || '').trim();
  const year = String(req.query.year || '').trim();
  const tmdbId = String(req.query.tmdbId || '').trim();

  if (imdbId && !/^tt\d+$/.test(imdbId)) imdbId = '';

  // Source autorisée pour trouver l'identifiant : TMDB external_ids ou suggestion IMDb.
  // Source NON autorisée pour le synopsis : OMDb / TMDB / traduction automatique.
  if (!imdbId && tmdbId) imdbId = await fetchTmdbExternalId(tmdbId);
  const lookupTitle = originalTitle || title;
  if (!imdbId && lookupTitle) imdbId = await findImdbIdBySuggestion(lookupTitle, year);

  if (!imdbId) {
    return res.json({
      source: 'unavailable-no-imdb-id',
      imdbId: '',
      synopsis: ''
    });
  }

  // IMPORTANT : on veut le synopsis IMDb français officiel visible sur la fiche IMDb FR.
  // On ne prend PAS OMDb, on ne traduit PAS l'anglais, et on ne prend PAS /plotsummary
  // car /plotsummary donne souvent de longs résumés utilisateurs.
  const url = `https://www.imdb.com/fr/title/${imdbId}/`;

  try {
    const html = await fetchHtml(url);
    const synopsis = extractImdbMainSynopsis(html);

    if (synopsis && looksFrench(synopsis)) {
      return res.json({
        source: 'imdb-fr-main-plot',
        imdbId,
        synopsis
      });
    }

    return res.json({
      source: synopsis ? 'imdb-fr-plot-not-french' : 'imdb-fr-plot-missing',
      imdbId,
      synopsis: ''
    });
  } catch (error) {
    return res.json({
      source: 'imdb-fr-fetch-error',
      imdbId,
      synopsis: ''
    });
  }
});

app.get('/api/films-letterboxd', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'letterboxd-films.json');
  if (!fs.existsSync(filePath)) {
    return res.json({ source: 'empty', count: 0, films: [] });
  }
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
