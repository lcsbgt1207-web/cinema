import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'letterboxd-films.json');
const SOURCE_URL = 'https://letterboxd.com/films/popular/';
const BASE_URL = 'https://letterboxd.com';


const FALLBACK_RATINGS = {
  'The Shawshank Redemption': 4.6,
  'The Godfather': 4.6,
  'The Dark Knight': 4.5,
  'The Godfather Part II': 4.6,
  '12 Angry Men': 4.6,
  'The Lord of the Rings: The Return of the King': 4.4,
  'Schindler’s List': 4.5,
  'Schindler\'s List': 4.5,
  'Pulp Fiction': 4.4,
  'Parasite': 4.6,
  'Interstellar': 4.4,
  'Whiplash': 4.3,
  'Fight Club': 4.4,
  'Inception': 4.3,
  'Goodfellas': 4.4,
  'Spirited Away': 4.5,
  'Seven Samurai': 4.5,
  'City of God': 4.5,
  'The Matrix': 4.3,
  'Se7en': 4.3,
  'Seven': 4.3,
  'The Silence of the Lambs': 4.3,
  'Back to the Future': 4.2,
  'The Green Mile': 4.2,
  'Saving Private Ryan': 4.3,
  'The Prestige': 4.2,
  'Gladiator': 4.2,
  'The Departed': 4.2,
  'Django Unchained': 4.1,
  'Alien': 4.3,
  'Blade Runner 2049': 4.1,
  'Intouchables': 4.2,
  'The Intouchables': 4.2
};

function safeRating(value) {
  const rating = Number.parseFloat(value);
  return Number.isFinite(rating) && rating >= 0.5 ? Math.round(rating * 10) / 10 : null;
}

const FALLBACK_FILMS = [
  'The Shawshank Redemption','The Godfather','The Dark Knight','The Godfather Part II','12 Angry Men','The Lord of the Rings: The Return of the King','Schindler’s List','Pulp Fiction','Parasite','Interstellar','Whiplash','Fight Club','Inception','Goodfellas','Spirited Away','Seven Samurai','City of God','The Matrix','Seven','The Silence of the Lambs','Se7en','Back to the Future','The Green Mile','Saving Private Ryan','The Prestige','Gladiator','The Departed','Django Unchained','Alien','Blade Runner 2049'
];

function slugify(title) {
  return String(title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeSlug(slug) {
  return String(slug || '').replace(/^\/film\//, '').replace(/\/$/, '');
}

function extractRating(html) {
  const patterns = [
    /"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/i,
    /"averageRating"\s*:\s*"?([0-5](?:\.\d+)?)"?/i,
    /averageRating[^0-9]+([0-5](?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const rating = Number.parseFloat(match[1]);
      const clean = safeRating(rating);
      if (clean !== null) return clean;
    }
  }
  return null;
}

async function fetchFilmRating(film) {
  if (!film.letterboxdUrl) return null;

  try {
    const response = await axios.get(film.letterboxdUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,fr-FR;q=0.8'
      },
      timeout: 15000
    });
    return extractRating(response.data);
  } catch (error) {
    console.log(`Note ignorée pour ${film.title} : ${error.message}`);
    return null;
  }
}

function savePayload(payload) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`${payload.count} films sauvegardés dans backend/data/letterboxd-films.json`);
}

function fallbackPayload(reason) {
  return {
    source: 'fallback-local',
    reason,
    scrapedAt: new Date().toISOString(),
    count: FALLBACK_FILMS.length,
    films: FALLBACK_FILMS.map((title, index) => ({
      rank: index + 1,
      title,
      letterboxdSlug: slugify(title),
      letterboxdUrl: `https://letterboxd.com/film/${slugify(title)}/`,
      letterboxdRating: FALLBACK_RATINGS[title] ?? null,
      sourceType: 'fallback-local-safe'
    }))
  };
}

async function scrapeLetterboxd() {
  console.log('Scraping Letterboxd...');
  console.log('URL :', SOURCE_URL);

  try {
    const response = await axios.get(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const films = [];
    $('.film-poster').each((_, el) => {
      const poster = $(el);
      const title = poster.attr('data-film-name') || poster.find('img').attr('alt');
      const rawSlug = poster.attr('data-film-slug') || poster.attr('data-target-link') || slugify(title || '');
      const slug = normalizeSlug(rawSlug);
      if (title && slug && !films.some(f => f.letterboxdSlug === slug)) {
        films.push({
          rank: films.length + 1,
          title,
          letterboxdSlug: slug,
          letterboxdUrl: `${BASE_URL}/film/${slug}/`,
          letterboxdRating: FALLBACK_RATINGS[title] ?? null,
          sourceType: 'letterboxd-html'
        });
      }
    });

    if (films.length === 0) {
      savePayload(fallbackPayload('Letterboxd ne renvoie pas de films exploitables.'));
      return;
    }

    for (const film of films.slice(0, 30)) {
      film.letterboxdRating = await fetchFilmRating(film) ?? film.letterboxdRating ?? FALLBACK_RATINGS[film.title] ?? null;
    }

    savePayload({ source: SOURCE_URL, scrapedAt: new Date().toISOString(), count: films.length, films });
  } catch (error) {
    console.log(`Tentative échouée : ${error.message}`);
    savePayload(fallbackPayload(error.message));
  }
}

scrapeLetterboxd();
