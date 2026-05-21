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

// Notes locales conservées si Letterboxd bloque, change son HTML, ou renvoie une mauvaise valeur.
// Règle : Letterboxd ne doit jamais casser le catalogue. On part toujours de js/data.js,
// puis on accepte une note live uniquement si elle est cohérente avec la note locale.
const MAX_LIVE_LOCAL_DELTA = 0.35;

function safeRating(value) {
  const rating = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(rating) && rating >= 0.5 && rating <= 5 ? Math.round(rating * 10) / 10 : null;
}

function safeScore10(value) {
  const score = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(score) && score >= 0.5 && score <= 10 ? Math.round(score * 10) / 10 : null;
}

function htmlDecode(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function chooseBestRating(liveRating, localRating) {
  const live = safeRating(liveRating);
  const local = safeRating(localRating);

  if (live === null) return { rating: local, sourceType: 'local-preserved-no-live-rating' };
  if (local === null) return { rating: live, sourceType: 'letterboxd-film-page' };

  // Protection contre le bug actuel : certaines pages Letterboxd contiennent plusieurs
  // nombres dans le HTML. Si le parsing récupère 2.4 ou 3.2 alors que la note locale
  // fiable est autour de 4.3, on rejette la valeur live au lieu de casser le site.
  if (Math.abs(live - local) > MAX_LIVE_LOCAL_DELTA) {
    return { rating: local, sourceType: 'local-preserved-live-rejected' };
  }

  return { rating: live, sourceType: 'letterboxd-film-page' };
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
    const imdb = safeScore10(block.match(/imdb:\s*([0-9.]+)/)?.[1]);
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
      letterboxdRating: lb,
      imdb,
      imdbID,
      sourceType: 'local-preserved'
    };
  }).filter(film => film.title && film.letterboxdSlug);
}

function extractRating(html) {
  const source = String(html || '');
  const candidates = [];

  const add = (value, label) => {
    const rating = safeRating(value);
    if (rating !== null) candidates.push({ rating, label });
  };

  // 1) Le plus fiable quand présent : métadonnées qui affichent "4.3 out of 5".
  const metaPatterns = [
    /<meta[^>]+name=["']twitter:data2["'][^>]+content=["']([0-5](?:[\.,]\d+)?)\s*(?:out of|\/)?\s*5?["'][^>]*>/i,
    /<meta[^>]+content=["']([0-5](?:[\.,]\d+)?)\s*(?:out of|\/)?\s*5?["'][^>]+name=["']twitter:data2["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']*?([0-5](?:[\.,]\d+)?)\s*(?:out of|\/)?\s*5/i
  ];
  for (const pattern of metaPatterns) {
    const match = source.match(pattern);
    if (match) add(match[1], 'meta');
  }

  // 2) JSON-LD AggregateRating, mais uniquement si le bloc contient aussi un count.
  // Ça évite de prendre la note d'une critique ou d'un autre élément de la page.
  const aggregateBlocks = source.match(/aggregateRating[\s\S]{0,1200}?(?:ratingCount|reviewCount|ratingValue)[\s\S]{0,1200}?\}/gi) || [];
  for (const block of aggregateBlocks) {
    const decoded = htmlDecode(block);
    if (!/(ratingCount|reviewCount)/i.test(decoded)) continue;
    const match = decoded.match(/ratingValue["'\s:]+([0-5](?:[\.,]\d+)?)/i);
    if (match) add(match[1], 'aggregateRating');
  }

  // 3) Dernier recours : data-average-rating, si Letterboxd le garde dans le HTML.
  const dataAverage = source.match(/data-average-rating=["']([0-5](?:[\.,]\d+)?)["']/i);
  if (dataAverage) add(dataAverage[1], 'data-average-rating');

  if (!candidates.length) return null;

  // On privilégie les valeurs fortes proches de l'affichage public Letterboxd.
  // Les mauvaises captures vues dans le projet étaient souvent 2.4 ou 3.2.
  candidates.sort((a, b) => b.rating - a.rating);
  return candidates[0].rating;
}

async function fetchFilmRating(film) {
  try {
    const response = await axios.get(film.letterboxdUrl, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
      validateStatus: status => status >= 200 && status < 400
    });
    return extractRating(response.data);
  } catch (error) {
    console.log(`Letterboxd indisponible pour ${film.title} : ${error.message}`);
    return null;
  }
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
  let rejectedCount = 0;
  for (const film of films) {
    const localRating = film.letterboxdRating;
    const liveRating = await fetchFilmRating(film);
    const choice = chooseBestRating(liveRating, localRating);
    film.letterboxdRating = choice.rating;
    film.sourceType = choice.sourceType;
    if (choice.sourceType === 'letterboxd-film-page') liveCount++;
    if (choice.sourceType === 'local-preserved-live-rejected') rejectedCount++;
    await sleep(350);
  }

  savePayload({
    source: liveCount > 0 ? 'letterboxd-film-pages-with-local-preserve' : 'local-preserved-no-live-rating',
    scrapedAt: new Date().toISOString(),
    count: films.length,
    liveCount,
    rejectedCount,
    films
  });
}

scrapeLetterboxd().catch(error => {
  console.error('Scraping Letterboxd échoué :', error.message);
  process.exitCode = 0;
});
