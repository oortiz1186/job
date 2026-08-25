import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { extractCvText } from './cv.js';
import { aiEnabled, analyzeCvWithAI } from './ai.js';

const args = process.argv.slice(2);
const cvIndex = args.indexOf('--cv');
const cvPath = cvIndex >= 0 ? args[cvIndex + 1] : process.env.CV_PATH;

if (!aiEnabled()) {
  console.error('Configura AI_PROVIDER=openai o AI_PROVIDER=gemini para generar el perfil automáticamente.');
  process.exit(1);
}

const cvText = await extractCvText(cvPath);
const analyzed = await analyzeCvWithAI(cvText);
const profile = {
  ...analyzed,
  cvPath: path.resolve(cvPath),
  generatedAt: new Date().toISOString(),
  answers: {}
};

const output = path.resolve('data/profile.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(profile, null, 2), 'utf8');

console.log(`Perfil generado: ${output}`);
console.log(`Nombre: ${profile.personal?.name || 'no detectado'}`);
console.log(`Headline: ${profile.professional?.headline || 'no detectado'}`);
console.log(`Skills: ${(profile.professional?.skills || []).slice(0, 15).join(', ')}`);
console.log('Revisa data/profile.json antes de utilizarlo para postulaciones.');
