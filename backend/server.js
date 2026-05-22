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

  // 3) Dernier recours : meta description IMDb.
  const meta = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
  if (isGoodSynopsis(meta)) candidates.push(meta);

  return pickBestSynopsis(candidates);
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

app.get('/', (req, res) => {
  res.json({ message: 'Backend CinéProche actif', routes: ['/api/films-letterboxd', '/api/imdb-synopsis'] });
});


app.get('/api/imdb-synopsis', async (req, res) => {
  let imdbId = String(req.query.imdbId || '').trim();
  const title = String(req.query.title || '').trim();
  const year = String(req.query.year || '').trim();

  if (imdbId && !/^tt\d+$/.test(imdbId)) imdbId = '';

  // Si TMDB ne fournit pas d'imdb_id, OMDb peut retrouver l'ID à partir du titre + année.
  // Cela évite de décaler les synopsis d'un film vers un autre.
  const omdbByTitle = !imdbId && title ? await fetchOmdbByTitle(title, year) : null;
  if (!imdbId && omdbByTitle?.imdbId) imdbId = omdbByTitle.imdbId;

  if (!imdbId) {
    return res.json({
      source: omdbByTitle?.synopsis ? 'omdb-title-plot' : 'unavailable',
      imdbId: '',
      synopsis: omdbByTitle?.synopsis || ''
    });
  }

  // Priorité : vraie page IMDb. OMDb n'est utilisé qu'en secours.
  const urls = [
    `https://www.imdb.com/fr/title/${imdbId}/plotsummary/`,
    `https://www.imdb.com/title/${imdbId}/plotsummary/`,
    `https://www.imdb.com/fr/title/${imdbId}/`,
    `https://www.imdb.com/title/${imdbId}/`
  ];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      if (!html) continue;

      const synopsis = extractImdbSynopsis(html);
      if (synopsis) {
        return res.json({ source: 'imdb', imdbId, synopsis });
      }
    } catch {}
  }

  const omdbPlot = await fetchOmdbPlot(imdbId);
  if (omdbPlot) {
    return res.json({ source: 'omdb-imdb-plot', imdbId, synopsis: omdbPlot });
  }

  if (omdbByTitle?.synopsis) {
    return res.json({ source: 'omdb-title-plot', imdbId, synopsis: omdbByTitle.synopsis });
  }

  res.json({ source: 'unavailable', imdbId, synopsis: '' });
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
