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

function parseProviderError(provider, status, rawText) {
  let message = String(rawText || '').trim();
  try {
    const parsed = JSON.parse(message);
    message = parsed?.error?.message || parsed?.message || message;
  } catch {}

  if (provider === 'Gemini') {
    if (status === 400) return `Gemini rechazó la solicitud (400). Revisa GEMINI_MODEL y el formato de la petición. Detalle: ${message}`;
    if (status === 401 || status === 403) return `Gemini rechazó la API key o no tiene permisos (${status}). Revisa GEMINI_API_KEY en .env. Detalle: ${message}`;
    if (status === 404) return `El modelo configurado en GEMINI_MODEL no está disponible (404). Modelo actual: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}. Detalle: ${message}`;
    if (status === 429) return `Gemini alcanzó un límite de cuota o velocidad (429). Espera un momento o revisa la cuota de la API. Detalle: ${message}`;
    if (status >= 500) return `Gemini tiene un error temporal (${status}). Intenta nuevamente. Detalle: ${message}`;
  }

  return `${provider} HTTP ${status}: ${message || 'sin detalle devuelto por el proveedor'}`;
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
  if (!response.ok) throw new Error(parseProviderError('OpenAI', response.status, await response.text()));
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || '').join('\n') || '';
  if (!text.trim()) throw new Error('OpenAI respondió sin contenido utilizable.');
  return text;
}

async function callGemini(prompt) {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('Falta GEMINI_API_KEY en .env.');
  const model = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  if (!model) throw new Error('GEMINI_MODEL está vacío en .env.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json'
    }
  });

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
    } catch (error) {
      lastError = new Error(`No se pudo conectar con Gemini: ${error.message}`);
      if (attempt < 3) {
        await sleep(attempt * 1000);
        continue;
      }
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
    lastError = new Error(parseProviderError('Gemini', response.status, raw));
    const retryable = response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504;
    if (!retryable || attempt === 3) throw lastError;
    await sleep(attempt * 1500);
  }

  throw lastError || new Error('Error desconocido al consultar Gemini.');
}

export function aiEnabled() {
  return ['openai', 'gemini'].includes(String(process.env.AI_PROVIDER || 'none').trim().toLowerCase());
}

export async function askAI(prompt) {
  const provider = String(process.env.AI_PROVIDER || 'none').trim().toLowerCase();
  if (provider === 'openai') return callOpenAI(prompt);
  if (provider === 'gemini') return callGemini(prompt);
  throw new Error('AI_PROVIDER debe ser openai o gemini.');
}

export async function analyzeCvWithAI(cvText) {
  const prompt = `Analiza este CV para búsqueda de empleo. No inventes ni completes datos ausentes. Devuelve SOLO JSON válido con esta forma:\n{
  "personal": {
    "name": "",
    "email": "",
    "phone": "",
    "city": "",
    "country": "",
    "linkedin": "",
    "github": ""
  },
  "professional": {
    "headline": "",
    "seniority": "",
    "yearsExperience": 0,
    "skills": [],
    "roles": [],
    "industries": [],
    "languages": [],
    "searchQueries": [],
    "strengths": [],
    "constraints": []
  }
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
