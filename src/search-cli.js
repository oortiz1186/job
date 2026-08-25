import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { extractCvText } from './cv.js';
import { aiEnabled, analyzeCvWithAI } from './ai.js';
import { resolvePortalSelection } from './portals.js';
import { searchPortals, saveResults } from './search-engine.js';

const args = process.argv.slice(2);
const arg = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = name => args.includes(name);

const cvPath = arg('--cv') || process.env.CV_PATH;
const portals = resolvePortalSelection(arg('--portals'));
const minMatch = Number(arg('--min-match') || process.env.MIN_MATCH || 85);
const maxPerPortal = Number(arg('--max') || process.env.SEARCH_MAX_PER_PORTAL || 20);
const fastMode = has('--fast') || String(process.env.SEARCH_FAST || '').toLowerCase() === 'true';
const prefilterScore = Number(arg('--prefilter') || process.env.SEARCH_PREFILTER_SCORE || (fastMode ? 65 : 60));
const concurrency = Number(arg('--concurrency') || process.env.SEARCH_CONCURRENCY || (fastMode ? 4 : 3));
const cacheTtlHours = Number(process.env.SEARCH_CACHE_TTL_HOURS || 168);
const cvText = await extractCvText(cvPath);

let aiProfile;
const profilePath = path.resolve('data/profile.json');
if (fs.existsSync(profilePath)) {
  aiProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8')).professional || {};
} else if (aiEnabled()) {
  aiProfile = (await analyzeCvWithAI(cvText)).professional || {};
} else {
  aiProfile = {
    headline: '',
    skills: [],
    roles: [],
    industries: [],
    searchQueries: []
  };
}

let queries = aiProfile.searchQueries || [];
const manualQuery = arg('--query');
if (manualQuery) queries = [manualQuery];
if (!queries.length) {
  console.error('No hay búsquedas generadas. Configura IA o usa --query "puesto".');
  process.exit(1);
}

console.log(`CV: ${path.resolve(cvPath)}`);
console.log(`Portales: ${portals.map(p => p.label).join(', ')}`);
console.log(`Búsquedas: ${queries.join(' | ')}`);
console.log(`Umbral recomendado: ${minMatch}%`);
console.log(`Prefiltro local para IA: ${prefilterScore}%`);
console.log(`Concurrencia: ${concurrency}`);
console.log(`Modo rápido: ${fastMode ? 'sí' : 'no'}`);

const context = await chromium.launchPersistentContext(
  path.resolve(process.env.BROWSER_PROFILE || '.browser-profile'),
  {
    headless: String(process.env.HEADLESS).toLowerCase() === 'true',
    channel: 'chrome'
  }
);

try {
  const results = await searchPortals({
    context,
    portals,
    queries,
    cvText,
    aiProfile,
    minMatch,
    maxPerPortal,
    prefilterScore,
    concurrency,
    fastMode,
    cacheTtlHours
  });

  const output = saveResults(results);
  const compatible = results.filter(r => r.score >= minMatch && r.recommendation !== 'NO_APLICAR');
  console.log(`\nVacantes analizadas: ${results.length}`);
  console.log(`Compatibles >= ${minMatch}%: ${compatible.length}`);
  console.log(`Resultados guardados en: ${output}`);
  console.table(compatible.slice(0, 20).map(x => ({
    portal: x.portal,
    score: x.score,
    local: x.localScore,
    fuente: x.evaluationSource,
    puesto: x.title,
    url: x.url
  })));
} finally {
  await context.close().catch(() => {});
}
