import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

const protectedDirs = new Set(['.git', 'node_modules']);

function exists(target) {
  return fs.existsSync(target);
}

function removeFile(target) {
  try {
    if (exists(target) && fs.statSync(target).isFile()) {
      fs.rmSync(target, { force: true });
      console.log(`[cleanup] fichier supprimé: ${path.relative(projectRoot, target)}`);
    }
  } catch (error) {
    console.warn(`[cleanup] impossible de supprimer ${target}: ${error.message}`);
  }
}

function removeDir(target) {
  try {
    if (exists(target) && fs.statSync(target).isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[cleanup] dossier supprimé: ${path.relative(projectRoot, target)}`);
    }
  } catch (error) {
    console.warn(`[cleanup] impossible de supprimer ${target}: ${error.message}`);
  }
}

function walk(dir) {
  if (!exists(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (protectedDirs.has(entry.name)) continue;
      if (entry.name === 'node_modules') continue;
      walk(fullPath);
      continue;
    }

    const isBackup = /\.backup\./i.test(entry.name) || /\.bak$/i.test(entry.name);
    const isUpdateZip = /^cinema-update.*\.zip$/i.test(entry.name) || /^cinema-updates.*\.zip$/i.test(entry.name);

    if (isBackup || isUpdateZip) {
      removeFile(fullPath);
    }
  }
}

removeDir(path.join(projectRoot, 'cinema-main'));
removeDir(path.join(projectRoot, 'html'));
removeFile(path.join(projectRoot, 'cinema-update.zip'));
removeFile(path.join(projectRoot, 'cinema-updates.zip'));
removeFile(path.join(projectRoot, '[Cin#U00e9Proche]'));
walk(projectRoot);

console.log('[cleanup] nettoyage structure terminé');
