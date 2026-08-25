import 'dotenv/config';
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { loadProfile } from './profile.js';
import { extractCvText } from './cv.js';
import { scoreJob, chooseResume } from './scoring.js';
import { aiEnabled, evaluateVacancyWithAI } from './ai.js';
import { portalForUrl } from './portals.js';
import { handleLinkedIn } from './platforms/linkedin.js';
import { handleIndeed } from './platforms/indeed.js';
import { handleGenericPortal } from './platforms/generic.js';

const args = process.argv.slice(2);
const arg = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const url = arg('--url') || args.find(x => /^https?:\/\//i.test(x));
if (!url) {
  console.error('Uso: npm run apply -- "https://..." [--cv "ruta/cv.pdf"]');
  process.exit(1);
}

const profile = loadProfile();
const resumePath = path.resolve(arg('--cv') || chooseResume('', profile) || process.env.CV_PATH || '');
if (!resumePath || !fs.existsSync(resumePath)) {
  console.error('No se encontró el CV. Usa --cv o configura CV_PATH.');
  process.exit(1);
}

const cvText = await extractCvText(resumePath);
const context = await chromium.launchPersistentContext(
  path.resolve(process.env.BROWSER_PROFILE || '.browser-profile'),
  { headless: String(process.env.HEADLESS).toLowerCase() === 'true', channel: 'chrome' }
);

const pages = context.pages();
const page = pages[0] ?? await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1200);

const description = await page.locator('body').innerText().catch(() => '');
const local = scoreJob(description, profile);
let result = {
  score: local.score,
  recommendation: local.recommendation,
  missing: local.missingHighValue || [],
  reasons: ['Scoring local por coincidencia entre CV y descripción.']
};

if (aiEnabled()) {
  try {
    result = await evaluateVacancyWithAI(cvText, description, local.score);
  } catch (error) {
    console.warn(`No se pudo usar IA; se continúa con scoring local: ${error.message}`);
  }
}

const minMatch = Number(process.env.MIN_MATCH || 85);
console.log(`Compatibilidad estimada: ${result.score}% - ${result.recommendation}`);
if (result.reasons?.length) console.log('Motivos:', result.reasons.join(' | '));
if (result.missing?.length) console.log('Faltantes relevantes:', result.missing.join(', '));

if (Number(result.score) < minMatch || result.recommendation === 'NO_APLICAR') {
  console.log(`No se prepara la postulación porque está debajo del umbral (${minMatch}%) o la IA recomienda no aplicar.`);
  console.log('El navegador queda abierto para revisión manual. Presiona Ctrl+C para terminar.');
  await new Promise(() => {});
}

console.log(`CV a adjuntar: ${resumePath}`);
const portal = portalForUrl(url);
if (!portal) {
  console.log('Portal no soportado. Se realizó scoring pero no se llenaron campos.');
} else if (portal.id === 'linkedin') {
  await handleLinkedIn(page, profile, resumePath);
} else if (portal.id === 'indeed') {
  await handleIndeed(page, profile, resumePath);
} else {
  await handleGenericPortal(page, profile, resumePath, portal.label);
}

console.log('El navegador permanece abierto para tu revisión. El envío final es manual. Presiona Ctrl+C para cerrar.');
await new Promise(() => {});
