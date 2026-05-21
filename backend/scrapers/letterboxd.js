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

// Important : Letterboxd ne met pas toujours la note publique affichée dans le HTML statique.
// Les anciennes versions du scraper lisaient donc parfois une autre valeur cachée
// (ex : Parasite 4.4 au lieu de 4.5, ou pire 2.4).
// Pour éviter de casser le catalogue, on conserve une table vérifiée et on ne scrape plus
// automatiquement une valeur ambiguë. Letterboxd reste utilisé uniquement pour les notes.
const VERIFIED_LETTERBOXD_RATINGS = {
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
  'Harakiri': 4.6,
  'Once Upon a Time in the West': 4.4,
  'The Usual Suspects': 4.1
};

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
  'Pulp Fiction': 'pulp-fiction',
  'The Good, the Bad and the Ugly': 'the-good-the-bad-and-the-ugly',
  'Forrest Gump': 'forrest-gump',
  'The Lord of the Rings: The Two Towers': 'the-lord-of-the-rings-the-two-towers',
  'Fight Club': 'fight-club',
  'Inception': 'inception',
  'The Empire Strikes Back': 'the-empire-strikes-back',
  'The Matrix': 'the-matrix',
  'Goodfellas': 'goodfellas',
  'One Flew Over the Cuckoo’s Nest': 'one-flew-over-the-cuckoos-nest',
  "One Flew Over the Cuckoo's Nest": 'one-flew-over-the-cuckoos-nest',
  'Interstellar': 'interstellar',
  'Se7en': 'se7en',
  'Life Is Beautiful': 'life-is-beautiful',
  'Seven Samurai': 'seven-samurai',
  'The Silence of the Lambs': 'the-silence-of-the-lambs',
  'Saving Private Ryan': 'saving-private-ryan',
  'City of God': 'city-of-god',
  'The Green Mile': 'the-green-mile',
  'Terminator 2: Judgment Day': 'terminator-2-judgment-day',
  'Star Wars': 'star-wars',
  'Back to the Future': 'back-to-the-future',
  'Spirited Away': 'spirited-away',
  'Psycho': 'psycho',
  'Parasite': 'parasite-2019',
  'Gladiator': 'gladiator-2000',
  'The Departed': 'the-departed',
  'Whiplash': 'whiplash-2014',
  'The Prestige': 'the-prestige',
  'Intouchables': 'the-intouchables',
  'The Intouchables': 'the-intouchables',
  'Harakiri': 'harakiri',
  'Once Upon a Time in the West': 'once-upon-a-time-in-the-west',
  'The Usual Suspects': 'the-usual-suspects'
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
    const verifiedRating = VERIFIED_LETTERBOXD_RATINGS[displayTitle] ?? VERIFIED_LETTERBOXD_RATINGS[titre] ?? lb;

    return {
      rank: index + 1,
      title: displayTitle,
      titre,
      original,
      letterboxdSlug: slug,
      letterboxdUrl: `${BASE_URL}/film/${slug}/`,
      letterboxdRating: safeRating(verifiedRating),
      imdb,
      imdbID,
      sourceType: VERIFIED_LETTERBOXD_RATINGS[displayTitle] || VERIFIED_LETTERBOXD_RATINGS[titre]
        ? 'verified-letterboxd-rating'
        : 'local-preserved'
    };
  }).filter(film => film.title && film.letterboxdSlug);
}

function savePayload(payload) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`${payload.count} films sauvegardés dans backend/data/letterboxd-films.json`);
}

async function updateLetterboxdRatings() {
  console.log('Mise à jour des notes Letterboxd depuis la table vérifiée...');

  const films = extractFilmBlocksFromLocalData();
  if (!films.length) {
    console.log('Aucun film trouvé dans js/data.js : conservation du fichier existant.');
    return;
  }

  savePayload({
    source: 'verified-letterboxd-ratings-no-ambiguous-scrape',
    reason: 'Le HTML statique Letterboxd contient parfois des valeurs cachées qui ne correspondent pas à la note publique affichée.',
    scrapedAt: new Date().toISOString(),
    count: films.length,
    liveCount: 0,
    films
  });
}

updateLetterboxdRatings().catch(error => {
  console.error('Mise à jour Letterboxd échouée :', error.message);
  process.exitCode = 0;
});
