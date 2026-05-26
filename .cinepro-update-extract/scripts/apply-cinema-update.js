#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const desktop = path.join(os.homedir(), 'Desktop');
const cwd = process.cwd();

function exists(p) { try { return fs.existsSync(p); } catch { return false; } }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.next'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function findProjectRoot() {
  const candidates = [cwd, desktop, ...fs.readdirSync(desktop, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(desktop, d.name))];
  const scored = [];
  for (const d of candidates) {
    const files = walk(d).slice(0, 4000);
    const hasData = files.some(f => /(^|[/\\])js[/\\]data\.js$/i.test(f));
    const hasApi = files.some(f => /\.(js|mjs|cjs)$/i.test(f) && read(f).includes('imdb-synopsis'));
    const hasPkg = exists(path.join(d, 'package.json'));
    let score = 0;
    if (/cinema/i.test(path.basename(d))) score += 3;
    if (hasApi) score += 6;
    if (hasData) score += 3;
    if (hasPkg) score += 2;
    if (score > 0) scored.push({ d, score });
  }
  scored.sort((a, b) => b.score - a.score || a.d.length - b.d.length);
  return scored[0]?.d || cwd;
}

const root = findProjectRoot();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, `.backup-cinema-imdb-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
console.log(`Projet détecté : ${root}`);
console.log(`Sauvegarde : ${backupDir}`);

const allFiles = walk(root);
const jsFiles = allFiles.filter(f => /\.(js|mjs|cjs)$/i.test(f));
const apiFiles = jsFiles.filter(f => read(f).includes('imdb-synopsis'));

if (apiFiles.length === 0) {
  console.error('Aucun fichier backend contenant imdb-synopsis trouvé. Le projet détecté ne semble pas être le bon.');
  process.exit(1);
}

const routeCode = String.raw`

// === CINEMA UPDATE: Reliable IMDb/OMDb synopsis route ===
// This route is intentionally registered before the old scraper route.
// It uses OMDb when OMDB_API_KEY is set, caches by imdbId, and never silently returns a TMDB synopsis.
app.get('/api/imdb-synopsis', async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const imdbId = String(req.query.imdbId || req.query.id || '').trim();
  const title = String(req.query.title || '').trim();
  const year = String(req.query.year || '').trim();
  const omdbKey = process.env.OMDB_API_KEY || process.env.OMDB_KEY || '';

  const cacheDir = path.join(process.cwd(), 'data');
  const cacheFile = path.join(cacheDir, 'imdb-synopsis-cache.json');

  function readCache() {
    try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { return {}; }
  }
  function writeCache(cache) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  }
  function unavailable(message, extra = {}) {
    return res.status(200).json({
      ok: false,
      source: 'IMDb/OMDb',
      synopsis: message,
      message,
      ...extra,
    });
  }

  if (!imdbId && !title) {
    return unavailable('Synopsis IMDb indisponible : imdbId manquant.', { reason: 'missing_imdb_id' });
  }

  const cacheKey = imdbId || `${title.toLowerCase()}-${year}`;
  const cache = readCache();
  if (cache[cacheKey]?.synopsis) {
    return res.status(200).json({ ok: true, source: 'OMDb cache', synopsis: cache[cacheKey].synopsis, cached: true });
  }

  if (!omdbKey) {
    return unavailable('Synopsis IMDb indisponible : ajoute OMDB_API_KEY dans le fichier .env du backend.', { reason: 'missing_omdb_api_key' });
  }

  try {
    const params = new URLSearchParams({ apikey: omdbKey, plot: 'full', r: 'json' });
    if (imdbId) params.set('i', imdbId); else params.set('t', title);
    if (year) params.set('y', year);

    const response = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
    const data = await response.json();
    const plot = data?.Plot && data.Plot !== 'N/A' ? String(data.Plot).trim() : '';

    if (!plot) {
      return unavailable('Synopsis IMDb indisponible : OMDb n’a pas retourné de plot pour ce film.', {
        reason: 'empty_omdb_plot',
        omdbError: data?.Error || null,
      });
    }

    cache[cacheKey] = {
      imdbId: data.imdbID || imdbId || null,
      title: data.Title || title || null,
      year: data.Year || year || null,
      synopsis: plot,
      source: 'OMDb',
      updatedAt: new Date().toISOString(),
    };
    writeCache(cache);

    return res.status(200).json({ ok: true, source: 'OMDb', synopsis: plot, cached: false });
  } catch (error) {
    return unavailable('Synopsis IMDb indisponible : erreur pendant l’appel OMDb.', {
      reason: 'omdb_request_failed',
      error: error.message,
    });
  }
});
// === END CINEMA UPDATE ===
`;

let patchedBackend = false;
for (const file of apiFiles) {
  let src = read(file);
  if (src.includes('CINEMA UPDATE: Reliable IMDb/OMDb synopsis route')) continue;
  const hasExpressApp = /\bapp\s*\.\s*(get|post|use)\s*\(/.test(src);
  if (!hasExpressApp) continue;

  fs.copyFileSync(file, path.join(backupDir, path.basename(file)));

  const routeRegex = /\bapp\s*\.\s*get\s*\(\s*['"]\/api\/imdb-synopsis['"]/;
  if (routeRegex.test(src)) {
    src = src.replace(routeRegex, routeCode + '\napp.get(\'/api/imdb-synopsis\'');
  } else {
    const listenRegex = /\bapp\s*\.\s*listen\s*\(/;
    if (listenRegex.test(src)) src = src.replace(listenRegex, routeCode + '\napp.listen(');
    else src += routeCode;
  }
  write(file, src);
  console.log(`Backend patché : ${path.relative(root, file)}`);
  patchedBackend = true;
  break;
}

if (!patchedBackend) {
  console.error('Impossible de patcher le backend automatiquement : aucun fichier Express app.get trouvé.');
  process.exit(1);
}

// Add .env.example without overwriting real .env
const envExample = path.join(root, '.env.example');
let envText = exists(envExample) ? read(envExample) : '';
if (!/OMDB_API_KEY\s*=/.test(envText)) {
  envText += `${envText.endsWith('\n') || envText.length === 0 ? '' : '\n'}OMDB_API_KEY=colle_ta_cle_omdb_ici\n`;
  write(envExample, envText);
  console.log('Ajouté : .env.example avec OMDB_API_KEY');
}

// Ensure cache file exists
const cachePath = path.join(root, 'data', 'imdb-synopsis-cache.json');
if (!exists(cachePath)) {
  write(cachePath, '{}\n');
  console.log('Ajouté : data/imdb-synopsis-cache.json');
}

// Add cache to .gitignore? Keep cache local by default.
const gitignore = path.join(root, '.gitignore');
let gi = exists(gitignore) ? read(gitignore) : '';
if (!gi.includes('data/imdb-synopsis-cache.json')) {
  gi += `${gi.endsWith('\n') || gi.length === 0 ? '' : '\n'}data/imdb-synopsis-cache.json\n`;
  write(gitignore, gi);
  console.log('Mis à jour : .gitignore');
}

console.log('\n✅ Mise à jour terminée.');
console.log('Prochaine étape : ajoute OMDB_API_KEY dans ton .env backend puis redémarre le serveur.');
console.log('Sans clé OMDb, les popups afficheront un message clair au lieu de garder silencieusement TMDB.');
