import 'dotenv/config';
import { chromium } from 'playwright';
import path from 'node:path';
import { loadProfile } from './profile.js';
import { scoreJob, chooseResume } from './scoring.js';
import { handleLinkedIn } from './platforms/linkedin.js';
import { handleIndeed } from './platforms/indeed.js';

const urlArgIndex = process.argv.indexOf('--url');
const url = urlArgIndex >= 0 ? process.argv[urlArgIndex + 1] : process.argv[2];

if (!url) {
  console.error('Uso: npm run apply -- "https://..."');
  process.exit(1);
}

const profile = loadProfile();
const context = await chromium.launchPersistentContext(
  path.resolve(process.env.BROWSER_PROFILE || '.browser-profile'),
  { headless: String(process.env.HEADLESS).toLowerCase() === 'true', channel: 'chrome' }
);

const pages = context.pages();
const page = pages[0] ?? await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1200);

const description = await page.locator('body').innerText().catch(() => '');
const result = scoreJob(description, profile);
const minMatch = Number(process.env.MIN_MATCH || 85);

console.log(`Compatibilidad estimada: ${result.score}% - ${result.recommendation}`);
if (result.missingHighValue.length) console.log('Tecnologías relevantes no encontradas en tu perfil:', result.missingHighValue.join(', '));

if (result.score < minMatch) {
  console.log(`No se automatiza porque está debajo del umbral configurado (${minMatch}%).`);
  console.log('El navegador queda abierto para revisión manual. Presiona Ctrl+C para terminar.');
  await new Promise(() => {});
}

const resumePath = chooseResume(description, profile);
console.log(`CV seleccionado: ${resumePath || 'ninguno'}`);

const host = new URL(url).hostname.toLowerCase();
if (host.includes('linkedin.com')) {
  await handleLinkedIn(page, profile, resumePath);
} else if (host.includes('indeed.')) {
  await handleIndeed(page, profile, resumePath);
} else {
  console.log('Portal no soportado todavía. Se realizó scoring pero no se llenaron campos.');
}

console.log('El navegador permanece abierto para tu revisión. Presiona Ctrl+C para cerrar.');
await new Promise(() => {});
