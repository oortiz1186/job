function safeJson(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('La IA no devolvió JSON válido.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Falta OPENAI_API_KEY.');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input: prompt, temperature: 0 })
  });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || '').join('\n') || '';
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } })
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
}

export function aiEnabled() {
  return ['openai', 'gemini'].includes(String(process.env.AI_PROVIDER || 'none').toLowerCase());
}

export async function askAI(prompt) {
  const provider = String(process.env.AI_PROVIDER || 'none').toLowerCase();
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
