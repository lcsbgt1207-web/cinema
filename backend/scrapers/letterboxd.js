import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'letterboxd-films.json');

const URLS_TO_TRY = [
  'https://letterboxd.com/films/popular/',
  'https://letterboxd.com/films/ajax/popular/'
];

const FALLBACK_FILMS = [
  'The Shawshank Redemption','The Godfather','The Dark Knight','The Godfather Part II','12 Angry Men',
  'The Lord of the Rings: The Return of the King','Schindler\'s List','Pulp Fiction','Parasite','Interstellar',
  'Whiplash','Fight Club','Inception','Goodfellas','Spirited Away','Seven Samurai','City of God','Se7en','The Matrix','The Silence of the Lambs',
  'The Green Mile','Star Wars','Back to the Future','Gladiator','The Prestige','The Departed','Alien','Apocalypse Now','Cinema Paradiso','Oldboy'
];

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugify(title) {
  return cleanText(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueFilms(films) {
  const seen = new Set();
  return films.filter(film => {
    const key = film.letterboxdSlug || slugify(film.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((film, index) => ({ ...film, rank: index + 1 }));
}

function extractFilmsFromHtml(html) {
  const $ = cheerio.load(html);
  const raw = [];

  $('.film-poster, .poster-container, li.poster-container').each((index, element) => {
    const el = $(element);
    const poster = el.hasClass('film-poster') ? el : el.find('.film-poster').first();
    const link = poster.attr('data-target-link') || poster.find('a').attr('href') || el.find('a').attr('href') || '';

    let slug = poster.attr('data-film-slug') || '';
    if (!slug && link.includes('/film/')) {
      slug = link.split('/film/')[1].split('/')[0];
    }

    const title =
      poster.attr('data-film-name') ||
      poster.attr('data-original-title') ||
      poster.find('img').attr('alt') ||
      el.find('img').attr('alt') ||
      slug.replace(/-/g, ' ');

    if (title) {
      raw.push({
        rank: index + 1,
        title: cleanText(title),
        letterboxdSlug: slug || slugify(title),
        letterboxdUrl: slug ? `https://letterboxd.com/film/${slug}/` : null,
        sourceType: 'scraped'
      });
    }
  });

  return uniqueFilms(raw);
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      'Cache-Control': 'no-cache'
    },
    timeout: 15000,
    validateStatus: status => status >= 200 && status < 500
  });

  if (response.status >= 400) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.data;
}

async function run() {
  console.log('Scraping Letterboxd...');

  let films = [];
  let source = 'fallback-local';

  for (const url of URLS_TO_TRY) {
    try {
      console.log('URL :', url);
      const html = await fetchHtml(url);
      const extracted = extractFilmsFromHtml(html);

      if (extracted.length > 0) {
        films = extracted;
        source = url;
        break;
      }
    } catch (error) {
      console.log(`Tentative échouée : ${error.message}`);
    }
  }

  if (films.length === 0) {
    console.log('Letterboxd ne renvoie pas de films exploitables. Utilisation du fallback local.');
    films = FALLBACK_FILMS.map((title, index) => ({
      rank: index + 1,
      title,
      letterboxdSlug: slugify(title),
      letterboxdUrl: null,
      sourceType: 'fallback'
    }));
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const payload = {
    source,
    scrapedAt: new Date().toISOString(),
    count: films.length,
    films
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`${films.length} films sauvegardés dans backend/data/letterboxd-films.json`);
}

run().catch(error => {
  console.error('Erreur scraping Letterboxd :', error.message);
  process.exit(1);
});
