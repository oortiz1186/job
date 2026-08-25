import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { scoreJob } from './scoring.js';
import { aiEnabled, evaluateVacancyWithAI } from './ai.js';

function absoluteUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

async function collectLinks(page, portal, maxPerPortal) {
  const links = new Set();
  for (const selector of portal.linkSelectors) {
    const values = await page.locator(selector).evaluateAll(nodes => nodes.map(n => n.getAttribute('href')).filter(Boolean)).catch(() => []);
    for (const href of values) {
      const url = absoluteUrl(href, page.url());
      if (url) links.add(url.split('#')[0]);
      if (links.size >= maxPerPortal) break;
    }
    if (links.size >= maxPerPortal) break;
  }
  return [...links].slice(0, maxPerPortal);
}

function makeLocalProfile(aiProfile, cvText) {
  return {
    professional: {
      headline: aiProfile?.headline || '',
      skills: aiProfile?.skills || [],
      experienceKeywords: [
        ...(aiProfile?.roles || []),
        ...(aiProfile?.industries || []),
        cvText.slice(0, 12000)
      ]
    }
  };
}

function loadCache(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) return {};
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cachePath, cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function cacheKey(url, body) {
  const hash = crypto.createHash('sha1').update(body || '').digest('hex');
  return crypto.createHash('sha1').update(`${url}|${hash}`).digest('hex');
}

function formatEta(startedAt, done, total) {
  if (!done || !total || done >= total) return '0s';
  const elapsed = Date.now() - startedAt;
  const remainingMs = (elapsed / done) * (total - done);
  const seconds = Math.max(0, Math.round(remainingMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (true) {
      const current = cursor++;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  });
  await Promise.all(workers);
}

export async function searchPortals({
  context,
  portals,
  queries,
  cvText,
  aiProfile,
  minMatch = 85,
  maxPerPortal = 20,
  prefilterScore = 60,
  concurrency = 3,
  fastMode = false,
  cachePath = 'data/search-cache.json',
  cacheTtlHours = 168,
  onProgress = () => {}
}) {
  const profile = makeLocalProfile(aiProfile, cvText);
  const results = [];
  const seen = new Set();
  const candidates = [];
  const resolvedCachePath = path.resolve(cachePath);
  const cache = loadCache(resolvedCachePath);
  const cacheTtlMs = Math.max(1, cacheTtlHours) * 60 * 60 * 1000;

  console.log(`Modo: ${fastMode ? 'RÁPIDO' : 'NORMAL'} | Prefiltro IA: ${prefilterScore}% | Concurrencia: ${concurrency}`);
  onProgress({ phase: 'collecting', completed: 0, total: 0, percent: 0, message: 'Buscando vacantes en los portales seleccionados...' });

  for (const portal of portals) {
    const page = await context.newPage();
    try {
      for (const query of queries) {
        const searchUrl = portal.searchUrl(query);
        console.log(`\n[${portal.label}] Buscando: ${query}`);
        onProgress({ phase: 'collecting', completed: candidates.length, total: 0, percent: 0, message: `${portal.label}: ${query}` });
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(fastMode ? 800 : 1400);
        const links = await collectLinks(page, portal, maxPerPortal);

        for (const url of links) {
          if (seen.has(url)) continue;
          seen.add(url);
          candidates.push({ portal, query, url });
        }
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  console.log(`\nVacantes únicas encontradas: ${candidates.length}`);
  console.log('Analizando detalles...');
  onProgress({ phase: 'analyzing', completed: 0, total: candidates.length, percent: 0, message: `${candidates.length} vacantes encontradas. Analizando compatibilidad...` });

  const startedAt = Date.now();
  let completed = 0;
  let aiCalls = 0;
  let localRejected = 0;
  let cacheHits = 0;

  await runPool(candidates, concurrency, async candidate => {
    const detail = await context.newPage();
    try {
      await detail.goto(candidate.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await detail.waitForTimeout(fastMode ? 350 : 650);
      const body = await detail.locator('body').innerText().catch(() => '');
      if (body.length < 120) return;

      const finalUrl = detail.url();
      const title = ((await detail.locator('h1').first().innerText().catch(() => '')) || finalUrl).trim();
      const local = scoreJob(body, profile);
      const key = cacheKey(finalUrl, body);
      const cached = cache[key];
      const cacheValid = cached?.cachedAt && (Date.now() - new Date(cached.cachedAt).getTime()) < cacheTtlMs;

      let evaluation;
      let source = 'local';

      if (cacheValid) {
        evaluation = cached.evaluation;
        source = 'cache';
        cacheHits++;
      } else if (aiEnabled() && local.score >= prefilterScore) {
        try {
          aiCalls++;
          evaluation = await evaluateVacancyWithAI(cvText, body, local.score);
          source = 'ai';
          cache[key] = { cachedAt: new Date().toISOString(), evaluation };
        } catch (error) {
          console.warn(`IA no disponible para ${finalUrl}: ${error.message}`);
        }
      } else if (local.score < prefilterScore) {
        localRejected++;
      }

      if (!evaluation) {
        evaluation = {
          score: local.score,
          recommendation: local.score >= minMatch ? 'APLICAR' : local.score >= prefilterScore ? 'REVISAR' : 'NO_APLICAR',
          matched: local.matchedKeywords,
          missing: local.missingHighValue,
          reasons: [local.score < prefilterScore
            ? `Descartada por prefiltro local (${local.score}% < ${prefilterScore}%).`
            : 'Scoring local por coincidencia entre CV y descripción.'],
          atsKeywords: []
        };
      }

      results.push({
        portal: candidate.portal.id,
        query: candidate.query,
        title,
        url: finalUrl,
        localScore: local.score,
        score: Number(evaluation.score || 0),
        recommendation: evaluation.recommendation || 'REVISAR',
        matched: evaluation.matched || [],
        missing: evaluation.missing || [],
        reasons: evaluation.reasons || [],
        atsKeywords: evaluation.atsKeywords || [],
        evaluationSource: source
      });
    } finally {
      await detail.close().catch(() => {});
      completed++;
      const percent = candidates.length ? Math.round((completed / candidates.length) * 100) : 100;
      const eta = formatEta(startedAt, completed, candidates.length);
      const progress = { phase: 'analyzing', completed, total: candidates.length, percent, eta, aiCalls, cacheHits, localRejected, found: results.length, message: `Analizando ${completed}/${candidates.length} · ETA ${eta}` };
      onProgress(progress);
      console.log(`[${completed}/${candidates.length}] ${percent}% | ETA ${eta} | IA ${aiCalls} | caché ${cacheHits} | prefiltro ${localRejected}`);
    }
  });

  saveCache(resolvedCachePath, cache);
  console.log(`\nResumen análisis: IA=${aiCalls}, caché=${cacheHits}, descartadas localmente=${localRejected}`);
  onProgress({ phase: 'done', completed: candidates.length, total: candidates.length, percent: 100, eta: '0s', aiCalls, cacheHits, localRejected, found: results.length, message: 'Búsqueda terminada.' });

  return results.sort((a, b) => b.score - a.score);
}

export function saveResults(results, output = 'data/search-results.json') {
  const resolved = path.resolve(output);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(results, null, 2), 'utf8');
  return resolved;
}
