import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { extractCvText } from './cv.js';
import { aiEnabled, aiProviderStatus, analyzeCvWithAI } from './ai.js';
import { resolvePortalSelection } from './portals.js';
import { searchPortals, saveResults } from './search-engine.js';
import { prepareApplications } from './application-engine.js';

const app = express();
const port = Number(process.env.WEB_PORT || 3210);
const uploadsDir = path.resolve('data/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|docx|txt|md)$/i.test(file.originalname);
    cb(ok ? null : new Error('Solo se permiten PDF, DOCX, TXT o MD.'), ok);
  }
});

const jobs = new Map();
let currentProfile = null;
let currentCvPath = null;
let currentCvText = '';
let latestResults = [];

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve('public')));

function jobId() { return crypto.randomBytes(8).toString('hex'); }
function publicProfile(profile) {
  if (!profile) return null;
  return {
    personal: { name: profile.personal?.name || '', city: profile.personal?.city || '', country: profile.personal?.country || '' },
    professional: profile.professional || {},
    cvName: currentCvPath ? path.basename(currentCvPath) : ''
  };
}

app.get('/api/status', (_req, res) => {
  const ai = aiProviderStatus();
  res.json({
    aiEnabled: aiEnabled(),
    provider: ai.provider,
    ai,
    minMatch: Number(process.env.MIN_MATCH || 85),
    portals: (process.env.PORTALS || 'linkedin,indeed,computrabajo,occ').split(','),
    profile: publicProfile(currentProfile),
    resultCount: latestResults.length
  });
});

app.post('/api/ai/config', (req, res) => {
  const allowed = new Set(['auto', 'deepseek', 'gemini', 'openai', 'none']);
  const provider = String(req.body.provider || '').trim().toLowerCase();
  if (!allowed.has(provider)) return res.status(400).json({ error: 'Proveedor IA inválido.' });
  process.env.AI_PROVIDER = provider;
  if (typeof req.body.fallback === 'boolean') process.env.AI_FALLBACK = String(req.body.fallback);
  const ai = aiProviderStatus();
  if (provider !== 'none' && !aiEnabled()) {
    return res.status(400).json({ error: 'Ese proveedor no tiene API key configurada y no hay fallback disponible.' });
  }
  res.json({ aiEnabled: aiEnabled(), provider: ai.provider, ai });
});

app.post('/api/cv/analyze', upload.single('cv'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Adjunta un CV.' });
    if (!aiEnabled()) return res.status(400).json({ error: 'Configura al menos una API key de DeepSeek, Gemini u OpenAI.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalPath = path.join(uploadsDir, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`);
    fs.renameSync(req.file.path, finalPath);
    const cvText = await extractCvText(finalPath);
    const analyzed = await analyzeCvWithAI(cvText);
    const profile = { ...analyzed, cvPath: finalPath, generatedAt: new Date().toISOString(), answers: {} };
    currentProfile = profile;
    currentCvPath = finalPath;
    currentCvText = cvText;
    latestResults = [];
    fs.mkdirSync(path.resolve('data'), { recursive: true });
    fs.writeFileSync(path.resolve('data/profile.json'), JSON.stringify(profile, null, 2), 'utf8');
    res.json({ profile: publicProfile(profile), ai: aiProviderStatus() });
  } catch (error) { next(error); }
});

app.post('/api/search', async (req, res) => {
  if (!currentProfile || !currentCvPath || !currentCvText) return res.status(400).json({ error: 'Primero analiza un CV.' });
  const id = jobId();
  const requestedPortals = Array.isArray(req.body.portals) ? req.body.portals.join(',') : req.body.portals;
  let portals;
  try { portals = resolvePortalSelection(requestedPortals); } catch (error) { return res.status(400).json({ error: error.message }); }
  const minMatch = Math.max(0, Math.min(100, Number(req.body.minMatch ?? process.env.MIN_MATCH ?? 85)));
  const fastMode = req.body.fastMode !== false;
  const prefilterScore = Math.max(0, Math.min(100, Number(req.body.prefilterScore ?? process.env.SEARCH_PREFILTER_SCORE ?? (fastMode ? 65 : 60))));
  const concurrency = Math.max(1, Math.min(5, Number(req.body.concurrency ?? process.env.SEARCH_CONCURRENCY ?? (fastMode ? 4 : 3))));
  const maxPerPortal = Math.max(1, Math.min(50, Number(req.body.maxPerPortal ?? process.env.SEARCH_MAX_PER_PORTAL ?? 20)));
  const queries = Array.isArray(currentProfile.professional?.searchQueries) ? currentProfile.professional.searchQueries : [];
  if (!queries.length) return res.status(400).json({ error: 'El perfil no contiene búsquedas sugeridas.' });
  const state = { id, status: 'queued', progress: { phase: 'queued', percent: 0, message: 'Preparando búsqueda...' }, results: [], error: null, minMatch };
  jobs.set(id, state);
  res.status(202).json({ jobId: id });

  (async () => {
    let context;
    try {
      state.status = 'running';
      context = await chromium.launchPersistentContext(path.resolve(process.env.SEARCH_BROWSER_PROFILE || '.browser-profile-search'), {
        headless: String(process.env.HEADLESS).toLowerCase() === 'true', channel: 'chrome'
      });
      const results = await searchPortals({
        context, portals, queries, cvText: currentCvText, aiProfile: currentProfile.professional || {}, minMatch, maxPerPortal,
        prefilterScore, concurrency, fastMode, cacheTtlHours: Number(process.env.SEARCH_CACHE_TTL_HOURS || 168),
        onProgress: progress => { state.progress = progress; }
      });
      latestResults = results;
      saveResults(results);
      state.results = results;
      state.status = 'done';
      state.progress = { ...state.progress, phase: 'done', percent: 100, message: 'Búsqueda terminada.' };
    } catch (error) {
      state.status = 'error'; state.error = error.message;
    } finally { await context?.close().catch(() => {}); }
  })();
});

app.get('/api/search/:id', (req, res) => {
  const state = jobs.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Búsqueda no encontrada.' });
  res.json(state);
});
app.get('/api/results', (_req, res) => res.json({ results: latestResults }));

app.post('/api/apply', async (req, res, next) => {
  try {
    if (!currentProfile || !currentCvPath) return res.status(400).json({ error: 'Primero analiza un CV.' });
    const urls = Array.isArray(req.body.urls) ? req.body.urls.filter(Boolean) : [];
    if (!urls.length) return res.status(400).json({ error: 'Selecciona al menos una vacante.' });
    const allowed = new Set(latestResults.map(x => x.url));
    const safeUrls = urls.filter(url => allowed.has(url));
    if (!safeUrls.length) return res.status(400).json({ error: 'Las vacantes seleccionadas no pertenecen a la búsqueda actual.' });
    const output = await prepareApplications({ urls: safeUrls, profile: currentProfile, cvPath: currentCvPath, concurrency: 1 });
    res.json({ prepared: output });
  } catch (error) { next(error); }
});

app.post('/api/apply-compatible', async (req, res, next) => {
  try {
    if (!currentProfile || !currentCvPath) return res.status(400).json({ error: 'Primero analiza un CV.' });
    const minMatch = Math.max(0, Math.min(100, Number(req.body.minMatch ?? process.env.MIN_MATCH ?? 85)));
    const urls = latestResults.filter(x => Number(x.score) >= minMatch && x.recommendation !== 'NO_APLICAR').map(x => x.url);
    if (!urls.length) return res.status(400).json({ error: 'No hay vacantes compatibles para preparar.' });
    const output = await prepareApplications({ urls, profile: currentProfile, cvPath: currentCvPath, concurrency: 1 });
    res.json({ prepared: output });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Error interno.' });
});

app.listen(port, () => {
  console.log(`Job Application Assistant: http://localhost:${port}`);
  console.log(`IA: ${JSON.stringify(aiProviderStatus())}`);
  console.log('El portal es local. Chrome se abrirá en este mismo equipo al preparar postulaciones.');
});
