import fs from 'node:fs';
import path from 'node:path';
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

export async function searchPortals({ context, portals, queries, cvText, aiProfile, minMatch = 85, maxPerPortal = 20 }) {
  const profile = makeLocalProfile(aiProfile, cvText);
  const results = [];
  const seen = new Set();

  for (const portal of portals) {
    const page = await context.newPage();
    try {
      for (const query of queries) {
        const searchUrl = portal.searchUrl(query);
        console.log(`\n[${portal.label}] ${query}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(1800);

        const links = await collectLinks(page, portal, maxPerPortal);
        for (const url of links) {
          if (seen.has(url)) continue;
          seen.add(url);

          const detail = await context.newPage();
          try {
            await detail.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
            await detail.waitForTimeout(900);
            const body = await detail.locator('body').innerText().catch(() => '');
            if (body.length < 120) continue;

            const local = scoreJob(body, profile);
            let evaluation = {
              score: local.score,
              recommendation: local.score >= minMatch ? 'APLICAR' : 'NO_APLICAR',
              matched: local.matchedKeywords,
              missing: local.missingHighValue,
              reasons: ['Scoring local por coincidencia entre CV y descripción.'],
              atsKeywords: []
            };

            if (aiEnabled()) {
              try {
                evaluation = await evaluateVacancyWithAI(cvText, body, local.score);
              } catch (error) {
                console.warn(`IA no disponible para ${url}: ${error.message}`);
              }
            }

            const title = (await detail.locator('h1').first().innerText().catch(() => '')) || detail.url();
            const item = {
              portal: portal.id,
              query,
              title: title.trim(),
              url: detail.url(),
              score: Number(evaluation.score || 0),
              recommendation: evaluation.recommendation || 'REVISAR',
              matched: evaluation.matched || [],
              missing: evaluation.missing || [],
              reasons: evaluation.reasons || [],
              atsKeywords: evaluation.atsKeywords || []
            };
            results.push(item);
            console.log(`${item.score}% | ${item.recommendation} | ${item.title}`);
          } finally {
            await detail.close().catch(() => {});
          }
        }
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function saveResults(results, output = 'data/search-results.json') {
  const resolved = path.resolve(output);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(results, null, 2), 'utf8');
  return resolved;
}
