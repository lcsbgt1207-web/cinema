import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

function cleanSynopsis(value = '') {
  return decodeHtml(value)
    .replace(/\s*See full summary\s*»?\s*$/i, '')
    .replace(/\s*Voir le résumé complet\s*»?\s*$/i, '')
    .trim();
}

function extractImdbSynopsis(html = '') {
  const candidates = [];

  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const json = JSON.parse(decodeHtml(match[1]));
      if (json?.description) candidates.push(json.description);
    } catch {}
  }

  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  if (metaDescription?.[1]) candidates.push(metaDescription[1]);

  const plotSelectors = [
    /data-testid=["']plot-xl["'][^>]*>([\s\S]*?)<\/span>/i,
    /data-testid=["']plot["'][^>]*>([\s\S]*?)<\/span>/i,
    /<li[^>]+data-testid=["']list-item["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const regex of plotSelectors) {
    const match = html.match(regex);
    if (match?.[1]) candidates.push(match[1].replace(/<[^>]+>/g, ' '));
  }

  return candidates
    .map(cleanSynopsis)
    .filter(text => text.length > 40)
    .sort((a, b) => b.length - a.length)[0] || '';
}


app.get('/', (req, res) => {
  res.json({ message: 'Backend CinéProche actif', routes: ['/api/films-letterboxd', '/api/imdb-synopsis'] });
});


app.get('/api/imdb-synopsis', async (req, res) => {
  const imdbId = String(req.query.imdbId || '').trim();
  if (!/^tt\d+$/.test(imdbId)) {
    return res.status(400).json({ source: 'invalid', synopsis: '' });
  }

  const urls = [
    `https://www.imdb.com/fr/title/${imdbId}/plotsummary/`,
    `https://www.imdb.com/title/${imdbId}/plotsummary/`,
    `https://www.imdb.com/fr/title/${imdbId}/`,
    `https://www.imdb.com/title/${imdbId}/`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (!response.ok) continue;
      const html = await response.text();
      const synopsis = extractImdbSynopsis(html);
      if (synopsis) {
        return res.json({ source: 'imdb', imdbId, synopsis });
      }
    } catch {}
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
