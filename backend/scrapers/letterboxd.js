import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_DIR = path.join(__dirname, '..', '..');
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'letterboxd-films.json');
const LOCAL_DATA_FILE = path.join(PROJECT_DIR, 'js', 'data.js');
const BASE_URL = 'https://letterboxd.com';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,fr-FR;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

// Slugs exacts pour les films dont le titre français ou IMDb ne correspond pas parfaitement à Letterboxd.
const SLUG_OVERRIDES = {
  'The Shawshank Redemption': 'the-shawshank-redemption',
  'The Godfather': 'the-godfather',
  'The Dark Knight': 'the-dark-knight',
  'The Godfather Part II': 'the-godfather-part-ii',
  '12 Angry Men': '12-angry-men',
  'The Lord of the Rings: The Return of the King': 'the-lord-of-the-rings-the-return-of-the-king',
  'Schindler’s List': 'schindlers-list',
  "Schindler's List": 'schindlers-list',
  'The Lord of the Rings: The Fellowship of the Ring': 'the-lord-of-the-rings-the-fellowship-of-the-ring',
  'The Good, the Bad and the Ugly': 'the-good-the-bad-and-the-ugly',
  'One Flew Over the Cuckoo’s Nest': 'one-flew-over-the-cuckoos-nest',
  "One Flew Over the Cuckoo's Nest": 'one-flew-over-the-cuckoos-nest',
  'City of God': 'city-of-god',
  'Terminator 2: Judgment Day': 'terminator-2-judgment-day',
  'Back to the Future': 'back-to-the-future',
  'Spirited Away': 'spirited-away',
  'The Departed': 'the-departed',
  'The Prestige': 'the-prestige',
  'Intouchables': 'the-intouchables',
  'The Intouchables': 'the-intouchables',
  'Harakiri': 'harakiri',
  'Once Upon a Time in the West': 'once-upon-a-time-in-the-west',
  'The Usual Suspects': 'the-usual-suspects'
};

// Notes vérifiées pour le catalogue actuel.
// Rôle : protéger le site quand Letterboxd change son HTML ou renvoie une valeur parasite.
// Letterboxd reste uniquement la source de la colonne Letterboxd ; TMDB/IMDb ne sont jamais écrasés ici.
const VERIFIED_LOCAL_RATINGS = {
  'The Shawshank Redemption': 4.6,
  'The Godfather': 4.6,
  'The Dark Knight': 4.5,
  'The Godfather Part II': 4.6,
  '12 Angry Men': 4.6,
  'The Lord of the Rings: The Return of the King': 4.4,
  "Schindler's List": 4.5,
  'Schindler’s List': 4.5,
  'The Lord of the Rings: The Fellowship of the Ring': 4.4,
  'Pulp Fiction': 4.4,
  'The Good, the Bad and the Ugly': 4.5,
  'Forrest Gump': 4.3,
  'The Lord of the Rings: The Two Towers': 4.4,
  'Fight Club': 4.4,
  'Inception': 4.3,
  'The Empire Strikes Back': 4.4,
  'The Matrix': 4.3,
  'Goodfellas': 4.4,
  "One Flew Over the Cuckoo's Nest": 4.4,
  'One Flew Over the Cuckoo’s Nest': 4.4,
  'Interstellar': 4.4,
  'Se7en': 4.3,
  'Life Is Beautiful': 4.3,
  'Seven Samurai': 4.5,
  'The Silence of the Lambs': 4.3,
  'Saving Private Ryan': 4.3,
  'City of God': 4.4,
  'The Green Mile': 4.3,
  'Terminator 2: Judgment Day': 4.2,
  'Star Wars': 4.3,
  'Back to the Future': 4.2,
  'Spirited Away': 4.5,
  'Psycho': 4.3,
  'Parasite': 4.5,
  'Gladiator': 4.2,
  'The Departed': 4.3,
  'Whiplash': 4.4,
  'The Prestige': 4.3,
  'Intouchables': 4.2,
  'The Intouchables': 4.2,
  'Harakiri': 4.7,
  'Once Upon a Time in the West': 4.4,
  'The Usual Suspects': 4.1
};

function safeRating(value) {
  const rating = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(rating) && rating >= 0.5 && rating <= 5 ? Math.round(rating * 10) / 10 : null;
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractFilmBlocksFromLocalData() {
  if (!fs.existsSync(LOCAL_DATA_FILE)) return [];

  const source = fs.readFileSync(LOCAL_DATA_FILE, 'utf-8');
  const blocks = source.match(/\{[\s\S]*?titre:\s*"[^"]+"[\s\S]*?cinemas:\s*\[[^\]]*\][\s\S]*?\}/g) || [];

  return blocks.map((block, index) => {
    const titre = block.match(/titre:\s*"([^"]+)"/)?.[1];
    const original = block.match(/original:\s*"([^"]+)"/)?.[1];
    const lb = safeRating(block.match(/lb:\s*([0-9.]+)/)?.[1]);
    const imdb = safeRating(block.match(/imdb:\s*([0-9.]+)/)?.[1]);
    const imdbID = block.match(/imdbID:\s*"([^"]+)"/)?.[1];
    const displayTitle = original || titre;
    const slug = SLUG_OVERRIDES[displayTitle] || SLUG_OVERRIDES[titre] || slugify(displayTitle);

    return {
      rank: index + 1,
      title: displayTitle,
      titre,
      original,
      letterboxdSlug: slug,
      letterboxdUrl: `${BASE_URL}/film/${slug}/`,
      letterboxdRating: VERIFIED_LOCAL_RATINGS[displayTitle] ?? VERIFIED_LOCAL_RATINGS[titre] ?? lb,
      imdb,
      imdbID,
      sourceType: 'local-preserved'
    };
  }).filter(film => film.title && film.letterboxdSlug);
}

function extractRating(html) {
  const candidates = [];

  // 1) Priorité au bloc AggregateRating, pas aux notes utilisateur / activité amis.
  const aggregateBlocks = html.match(/"aggregateRating"\s*:\s*\{[\s\S]{0,900}?\}/gi) || [];
  for (const block of aggregateBlocks) {
    const match = block.match(/"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/i);
    const rating = match ? safeRating(match[1]) : null;
    if (rating !== null) candidates.push(rating);
  }

  // 2) Certains rendus Letterboxd exposent directement la note moyenne.
  const precisePatterns = [
    /data-average-rating=["']([0-5](?:\.\d+)?)["']/i,
    /class=["'][^"']*average-rating[^"']*["'][^>]*>\s*([0-5](?:\.\d+)?)/i,
    /<span[^>]+class=["'][^"']*rating[^"']*average[^"']*["'][^>]*>\s*([0-5](?:\.\d+)?)/i
  ];

  for (const pattern of precisePatterns) {
    const match = html.match(pattern);
    const rating = match ? safeRating(match[1]) : null;
    if (rating !== null) candidates.push(rating);
  }

  // 3) Dernier recours : JSON-LD global, uniquement si aucun candidat plus précis n'a été trouvé.
  if (!candidates.length) {
    const globalMatch = html.match(/"ratingValue"\s*:\s*"?([0-5](?:\.\d+)?)"?/i);
    const rating = globalMatch ? safeRating(globalMatch[1]) : null;
    if (rating !== null) candidates.push(rating);
  }

  return candidates.length ? candidates[0] : null;
}

function verifiedRatingFor(film) {
  return safeRating(
    VERIFIED_LOCAL_RATINGS[film.title] ??
    VERIFIED_LOCAL_RATINGS[film.original] ??
    VERIFIED_LOCAL_RATINGS[film.titre]
  );
}

async function fetchFilmRating(film) {
  const verified = verifiedRatingFor(film);

  try {
    const response = await axios.get(film.letterboxdUrl, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
      validateStatus: status => status >= 200 && status < 400
    });

    const liveRating = extractRating(response.data);

    // Si le scraping donne une valeur très éloignée de la note vérifiée, on protège le catalogue.
    // Exemple réel vu dans le projet : Parasite 2.4 / Gladiator 3.2 à cause d'un mauvais champ HTML.
    if (verified !== null && (liveRating === null || Math.abs(liveRating - verified) >= 0.2)) {
      return { rating: verified, sourceType: 'verified-protected' };
    }

    if (liveRating !== null) {
      return { rating: liveRating, sourceType: 'letterboxd-film-page' };
    }
  } catch (error) {
    console.log(`Letterboxd indisponible pour ${film.title} : ${error.message}`);
  }

  if (verified !== null) return { rating: verified, sourceType: 'verified-protected' };
  return { rating: null, sourceType: 'local-preserved' };
}


function savePayload(payload) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`${payload.count} films sauvegardés dans backend/data/letterboxd-films.json`);
}

async function scrapeLetterboxd() {
  console.log('Mise à jour des notes Letterboxd film par film...');

  const films = extractFilmBlocksFromLocalData();
  if (!films.length) {
    console.log('Aucun film trouvé dans js/data.js : conservation du fichier existant.');
    return;
  }

  let liveCount = 0;
  for (const film of films) {
    const result = await fetchFilmRating(film);
    if (result.rating !== null) {
      film.letterboxdRating = result.rating;
      film.sourceType = result.sourceType;
      if (result.sourceType === 'letterboxd-film-page') liveCount++;
    } else {
      film.sourceType = 'local-preserved';
    }
    await sleep(350);
  }

  savePayload({
    source: liveCount > 0 ? 'letterboxd-film-pages-with-local-preserve' : 'local-preserved-no-live-rating',
    scrapedAt: new Date().toISOString(),
    count: films.length,
    liveCount,
    films
  });
}

scrapeLetterboxd().catch(error => {
  console.error('Scraping Letterboxd échoué :', error.message);
  process.exitCode = 0;
});
