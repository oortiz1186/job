import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { portalForUrl } from './portals.js';
import { handleLinkedIn } from './platforms/linkedin.js';
import { handleIndeed } from './platforms/indeed.js';
import { handleGenericPortal } from './platforms/generic.js';

let persistentContext;

async function getContext() {
  if (persistentContext) return persistentContext;
  persistentContext = await chromium.launchPersistentContext(
    path.resolve(process.env.BROWSER_PROFILE || '.browser-profile'),
    {
      headless: String(process.env.HEADLESS).toLowerCase() === 'true',
      channel: 'chrome'
    }
  );
  persistentContext.on('close', () => { persistentContext = undefined; });
  return persistentContext;
}

async function prepareOne(context, url, profile, cvPath) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(900);

  const portal = portalForUrl(page.url() || url);
  if (!portal) return { url, status: 'unsupported', message: 'Portal no soportado' };

  if (portal.id === 'linkedin') {
    await handleLinkedIn(page, profile, cvPath);
  } else if (portal.id === 'indeed') {
    await handleIndeed(page, profile, cvPath);
  } else {
    await handleGenericPortal(page, profile, cvPath, portal.label);
  }

  return {
    url: page.url(),
    portal: portal.id,
    status: 'prepared',
    message: 'Solicitud preparada para revisión manual'
  };
}

export async function prepareApplications({ urls, profile, cvPath, concurrency = 1 }) {
  if (!Array.isArray(urls) || !urls.length) throw new Error('No hay vacantes seleccionadas.');
  const resolvedCv = path.resolve(cvPath || profile?.cvPath || process.env.CV_PATH || '');
  if (!resolvedCv || !fs.existsSync(resolvedCv)) throw new Error('No se encontró el CV para adjuntar.');

  const context = await getContext();
  const queue = [...new Set(urls)].slice(0, 50);
  const results = [];
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(Number(concurrency) || 1, 3, queue.length)) }, async () => {
    while (true) {
      const current = cursor++;
      if (current >= queue.length) return;
      const url = queue[current];
      try {
        results[current] = await prepareOne(context, url, profile, resolvedCv);
      } catch (error) {
        results[current] = { url, status: 'error', message: error.message };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
