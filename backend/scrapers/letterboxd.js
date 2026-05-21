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

const FALLBACK_FILMS = [
  'The Shawshank Redemption','The Godfather','The Dark Knight','The Godfather Part II','12 Angry Men','The Lord of the Rings: The Return of the King','Schindler’s List','Pulp Fiction','Parasite','Interstellar','Whiplash','Fight Club','Inception','Goodfellas','Spirited Away','Seven Samurai','City of God','The Matrix','Seven','The Silence of the Lambs','Se7en','Back to the Future','The Green Mile','Saving Private Ryan','The Prestige','Gladiator','The Departed','Django Unchained','Alien','Blade Runner 2049'
];

function slugify(title) {
  return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
      letterboxdUrl: null,
      sourceType: 'fallback'
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
      const slug = poster.attr('data-film-slug') || slugify(title || '');
      if (title && !films.some(f => f.letterboxdSlug === slug)) {
        films.push({ rank: films.length + 1, title, letterboxdSlug: slug, letterboxdUrl: `https://letterboxd.com/film/${slug}/`, sourceType: 'letterboxd-html' });
      }
    });

    if (films.length === 0) {
      savePayload(fallbackPayload('Letterboxd ne renvoie pas de films exploitables.'));
      return;
    }

    savePayload({ source: SOURCE_URL, scrapedAt: new Date().toISOString(), count: films.length, films });
  } catch (error) {
    console.log(`Tentative échouée : ${error.message}`);
    savePayload(fallbackPayload(error.message));
  }
}

scrapeLetterboxd();
