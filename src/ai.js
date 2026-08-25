function safeJson(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) {
    const preview = cleaned.slice(0, 240).replace(/\s+/g, ' ');
    throw new Error(`La IA no devolvió JSON válido${preview ? `: ${preview}` : '.'}`);
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    throw new Error(`La IA devolvió JSON mal formado: ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function providerLabel(provider) {
  return ({ deepseek: 'DeepSeek', gemini: 'Gemini', openai: 'OpenAI' })[provider] || provider;
}

function parseProviderError(provider, status, rawText) {
  const label = providerLabel(provider);
  let message = String(rawText || '').trim();
  try {
    const parsed = JSON.parse(message);
    message = parsed?.error?.message || parsed?.message || message;
  } catch {}

  if (status === 401 || status === 403) return `${label} rechazó la API key o no tiene permisos (${status}). Detalle: ${message}`;
  if (status === 404) return `${label} no encontró el endpoint o modelo configurado (404). Detalle: ${message}`;
  if (status === 429) return `${label} alcanzó un límite de cuota o velocidad (429). Detalle: ${message}`;
  if (status >= 500) return `${label} tiene un error temporal (${status}). Detalle: ${message}`;
  if (status === 400) return `${label} rechazó la solicitud (400). Revisa el modelo y formato. Detalle: ${message}`;
  return `${label} HTTP ${status}: ${message || 'sin detalle devuelto por el proveedor'}`;
}

async function callOpenAI(prompt) {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  if (!key) throw new Error('Falta OPENAI_API_KEY en .env.');
  const model = String(process.env.OPENAI_MODEL || 'gpt-4.1-mini').trim();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: prompt, temperature: 0 })
  });
  if (!response.ok) throw new Error(parseProviderError('openai', response.status, await response.text()));
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || '').join('\n') || '';
  if (!text.trim()) throw new Error('OpenAI respondió sin contenido utilizable.');
  return text;
}

async function callDeepSeek(prompt) {
  const key = String(process.env.DEEPSEEK_API_KEY || '').trim();
  if (!key) throw new Error('Falta DEEPSEEK_API_KEY en .env.');
  const model = String(process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim();
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
      stream: false
    })
  });
  if (!response.ok) throw new Error(parseProviderError('deepseek', response.status, await response.text()));
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!String(text).trim()) throw new Error('DeepSeek respondió sin contenido utilizable.');
  return text;
}

async function callGemini(prompt) {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('Falta GEMINI_API_KEY en .env.');
  const model = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim();
  if (!model) throw new Error('GEMINI_MODEL está vacío en .env.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  });

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    } catch (error) {
      lastError = new Error(`No se pudo conectar con Gemini: ${error.message}`);
      if (attempt < 3) { await sleep(attempt * 1000); continue; }
      throw lastError;
    }

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
      if (!text.trim()) {
        const finishReason = data.candidates?.[0]?.finishReason || 'desconocido';
        const blockReason = data.promptFeedback?.blockReason || '';
        throw new Error(`Gemini respondió sin contenido utilizable. finishReason=${finishReason}${blockReason ? `, blockReason=${blockReason}` : ''}.`);
      }
      return text;
    }

    const raw = await response.text();
    lastError = new Error(parseProviderError('gemini', response.status, raw));
    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === 3) throw lastError;
    await sleep(attempt * 1500);
  }
  throw lastError || new Error('Error desconocido al consultar Gemini.');
}

const PROVIDER_CALLS = { deepseek: callDeepSeek, gemini: callGemini, openai: callOpenAI };
const PROVIDER_KEYS = { deepseek: 'DEEPSEEK_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };

function configuredProviders() {
  return Object.keys(PROVIDER_CALLS).filter(provider => String(process.env[PROVIDER_KEYS[provider]] || '').trim());
}

function requestedProvider() {
  return String(process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
}

function fallbackOrder() {
  const configured = configuredProviders();
  const custom = String(process.env.AI_FALLBACK_ORDER || 'deepseek,gemini,openai')
    .split(',').map(x => x.trim().toLowerCase()).filter(x => PROVIDER_CALLS[x]);
  const preferred = requestedProvider();
  const fallback = envFlag('AI_FALLBACK', true);

  if (preferred === 'none') return [];
  if (preferred === 'auto') return [...new Set(custom)].filter(x => configured.includes(x));
  if (!PROVIDER_CALLS[preferred]) return [];
  if (!fallback) return configured.includes(preferred) ? [preferred] : [];
  return [...new Set([preferred, ...custom])].filter(x => configured.includes(x));
}

export function aiProviderStatus() {
  const provider = requestedProvider();
  const configured = configuredProviders();
  const order = fallbackOrder();
  return {
    provider,
    fallback: envFlag('AI_FALLBACK', true),
    order,
    providers: {
      deepseek: { configured: configured.includes('deepseek'), model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' },
      gemini: { configured: configured.includes('gemini'), model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite' },
      openai: { configured: configured.includes('openai'), model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' }
    }
  };
}

export function aiEnabled() {
  return fallbackOrder().length > 0;
}

export async function askAI(prompt) {
  const order = fallbackOrder();
  if (!order.length) {
    throw new Error('No hay proveedor IA utilizable. Configura DEEPSEEK_API_KEY, GEMINI_API_KEY u OPENAI_API_KEY y selecciona AI_PROVIDER.');
  }

  const errors = [];
  for (const provider of order) {
    try {
      const text = await PROVIDER_CALLS[provider](prompt);
      return text;
    } catch (error) {
      errors.push(`${providerLabel(provider)}: ${error.message}`);
      console.warn(`[IA] ${providerLabel(provider)} falló; ${order.indexOf(provider) < order.length - 1 ? 'probando fallback...' : 'sin más proveedores.'}`);
    }
  }
  throw new Error(`Todos los proveedores IA fallaron. ${errors.join(' | ')}`);
}

export async function analyzeCvWithAI(cvText) {
  const prompt = `Analiza este CV para búsqueda de empleo. No inventes ni completes datos ausentes. Devuelve SOLO JSON válido con esta forma:\n{
  "personal": {"name":"","email":"","phone":"","city":"","country":"","linkedin":"","github":""},
  "professional": {"headline":"","seniority":"","yearsExperience":0,"skills":[],"roles":[],"industries":[],"languages":[],"searchQueries":[],"strengths":[],"constraints":[]}
}\nGenera de 5 a 10 searchQueries realistas basadas únicamente en el CV. Si un dato personal no aparece, déjalo vacío.\nCV:\n${cvText.slice(0, 30000)}`;
  return safeJson(await askAI(prompt));
}

export async function evaluateVacancyWithAI(cvText, vacancyText, fallbackScore = 0) {
  const prompt = `Actúa como recruiter senior y ATS. Compara el CV y la vacante sin inventar experiencia. Devuelve SOLO JSON válido:\n{
  "score": 0,
  "recommendation": "APLICAR|REVISAR|NO_APLICAR",
  "matched": [],
  "missing": [],
  "reasons": [],
  "atsKeywords": []
}\nEl score debe ser 0-100 y penalizar requisitos obligatorios ausentes. Usa ${fallbackScore} solo como señal secundaria de coincidencia lexical.\nCV:\n${cvText.slice(0, 22000)}\n\nVACANTE:\n${vacancyText.slice(0, 18000)}`;
  return safeJson(await askAI(prompt));
}
