import fs from 'node:fs';
import { loadProfile } from './profile.js';
import { scoreJob, chooseResume } from './scoring.js';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Uso: npm run score -- ruta/a/descripcion.txt');
  process.exit(1);
}
const profile = loadProfile();
const description = fs.readFileSync(file, 'utf8');
const result = scoreJob(description, profile);
console.log(JSON.stringify({ ...result, resume: chooseResume(description, profile) }, null, 2));
