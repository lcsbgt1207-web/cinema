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

app.get('/', (req, res) => {
  res.json({
    message: 'Backend CinéProche actif',
    routes: ['/api/films-letterboxd']
  });
});

app.get('/api/films-letterboxd', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'letterboxd-films.json');

  if (!fs.existsSync(filePath)) {
    return res.json({
      source: 'empty',
      scrapedAt: new Date().toISOString(),
      count: 0,
      films: []
    });
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  res.json(data);
});

app.listen(PORT, () => {
  console.log('======================================');
  console.log(`Backend CinéProche lancé sur http://localhost:${PORT}`);
  console.log(`API Letterboxd : http://localhost:${PORT}/api/films-letterboxd`);
  console.log('Garde cette fenêtre Git Bash ouverte pour laisser API active.');
  console.log('======================================');
});
