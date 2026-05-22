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

function parsePossiblyEscapedJson(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(decodeHtml(text)); } catch {}
  return null;
}

function walkJsonForSynopsis(node, results = []) {
  if (!node || results.length > 25) return results;

  if (typeof node === 'string') {
    const cleaned = cleanSynopsis(node);
    if (cleaned.length > 40) results.push(cleaned);
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) walkJsonForSynopsis(item, results);
    return results;
  }

  if (typeof node === 'object') {
    const preferredKeys = ['plotText', 'plot', 'description', 'summary', 'text', 'plainText'];
    for (const key of preferredKeys) {
      const value = node[key];
      if (!value) continue;

      if (typeof value === 'string') {
        const cleaned = cleanSynopsis(value);
        if (cleaned.length > 40) results.push(cleaned);
      } else if (typeof value === 'object') {
        if (typeof value.plainText === 'string') {
          const cleaned = cleanSynopsis(value.plainText);
          if (cleaned.length > 40) results.push(cleaned);
        }
        if (typeof value.text === 'string') {
          const cleaned = cleanSynopsis(value.text);
          if (cleaned.length > 40) results.push(cleaned);
        }
        walkJsonForSynopsis(value, results);
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (preferredKeys.includes(key)) continue;
      if (value && typeof value === 'object') walkJsonForSynopsis(value, results);
    }
  }

  return results;
}

function pickBestSynopsis(candidates = [], title = '') {
  const seen = new Set();
  const cleaned = candidates
    .map(cleanSynopsis)
    .filter(text => text.length > 45)
    .filter(text => {
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter(text => !/^with\s+/i.test(text))
    .filter(text => !/^(réalisé|directed)\s+by/i.test(text))
    .filter(text => !/(photos|videos|cast|crew|reviews|ratings)/i.test(text));

  if (!cleaned.length) return '';

  const titleLower = normalizeSpaces(title).toLowerCase();
  return cleaned
    .map(text => {
      let score = 0;
      const len = text.length;
      if (len >= 80 && len <= 700) score += 100;
      if (len > 700) score += 30;
      if (titleLower && text.toLowerCase().includes(titleLower)) score -= 15;
      if (/[.!?]$/.test(text)) score += 10;
      return { text, score };
    })
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)[0].text;
}

function normalizeSpaces(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractImdbSynopsis(html = '', title = '') {
  const candidates = [];

  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    const json = parsePossiblyEscapedJson(match[1]);
    if (json) walkJsonForSynopsis(json, candidates);
  }

  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData?.[1]) {
    const json = parsePossiblyEscapedJson(nextData[1]);
    if (json) walkJsonForSynopsis(json, candidates);
  }

  // Les pages IMDb récentes contiennent souvent la vraie intrigue dans des blocs JSON inline.
  const inlinePatterns = [
    /"plotText"\s*:\s*\{\s*"plainText"\s*:\s*"((?:\\"|[^"])*)"/gi,
    /"plotText"\s*:\s*\{\s*"text"\s*:\s*"((?:\\"|[^"])*)"/gi,
    /"description"\s*:\s*"((?:\\"|[^"])*)"/gi,
    /"plot"\s*:\s*\{[^{}]*"plainText"\s*:\s*"((?:\\"|[^"])*)"/gi
  ];

  for (const regex of inlinePatterns) {
    for (const match of html.matchAll(regex)) {
      try {
        candidates.push(JSON.parse(`"${match[1]}"`));
      } catch {
        candidates.push(match[1]);
      }
    }
  }

  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i);
  if (metaDescription?.[1]) candidates.push(metaDescription[1]);

  const plotSelectors = [
    /data-testid=["']plot-xl["'][^>]*>([\s\S]*?)<\/span>/i,
    /data-testid=["']plot["'][^>]*>([\s\S]*?)<\/span>/i,
    /<div[^>]+data-testid=["']sub-section-summaries["'][^>]*>[\s\S]*?<li[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const regex of plotSelectors) {
    const match = html.match(regex);
    if (match?.[1]) candidates.push(match[1].replace(/<[^>]+>/g, ' '));
  }

  return pickBestSynopsis(candidates, title);
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
