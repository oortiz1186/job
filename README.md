# Job Application Assistant

Asistente local y semi-automático para analizar un CV, buscar vacantes compatibles y preparar postulaciones en LinkedIn, Indeed, Computrabajo y OCC.

## Portal web

```powershell
npm install
npx playwright install chromium
npm run web
```

Abre `http://localhost:3210`.

Desde el portal puedes subir un CV PDF/DOCX/TXT/MD, analizarlo con IA, elegir portales, configurar el porcentaje mínimo, buscar vacantes, revisar compatibilidad y preparar una, varias o todas las vacantes compatibles. El sistema completa campos compatibles y adjunta el CV, pero **no pulsa el botón final de envío**.

## Proveedores de IA

Se soportan DeepSeek, Gemini y OpenAI. El portal permite cambiar el proveedor en ejecución sin exponer las API keys al navegador.

Configuración recomendada con fallback:

```env
AI_PROVIDER=auto
AI_FALLBACK=true
AI_FALLBACK_ORDER=deepseek,gemini,openai

DEEPSEEK_API_KEY=tu_api_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

`AI_PROVIDER` acepta `auto`, `deepseek`, `gemini`, `openai` o `none`. En `auto`, se prueba el orden indicado por `AI_FALLBACK_ORDER`, omitiendo proveedores sin API key. Si un proveedor falla o alcanza cuota y `AI_FALLBACK=true`, el sistema intenta el siguiente disponible.

Puedes usar solo DeepSeek:

```env
AI_PROVIDER=deepseek
AI_FALLBACK=false
DEEPSEEK_API_KEY=tu_api_key
DEEPSEEK_MODEL=deepseek-chat
```

## Configuración general

```env
HEADLESS=false
MIN_MATCH=85
WEB_PORT=3210
PORTALS=linkedin,indeed,computrabajo,occ
SEARCH_PREFILTER_SCORE=60
SEARCH_CONCURRENCY=3
SEARCH_CACHE_TTL_HOURS=168
BROWSER_PROFILE=.browser-profile
SEARCH_BROWSER_PROFILE=.browser-profile-search
```

## Flujo

```text
CV
 ↓
IA extrae perfil, experiencia, skills y puestos objetivo
 ↓
Genera búsquedas
 ↓
Usuario elige portales
 ↓
Recolecta vacantes
 ↓
Prefiltro local rápido
 ↓
IA analiza candidatas relevantes
 ↓
Dashboard ordenado por compatibilidad
 ↓
Usuario elige una, varias o todas las compatibles
 ↓
Chrome abre y prepara las solicitudes
 ↓
Completa campos + adjunta CV
 ↓
Revisión humana
 ↓
Envío final manual
```

## Optimización y privacidad

La búsqueda usa prefiltro local antes de gastar IA, concurrencia limitada, caché de evaluaciones, progreso y ETA aproximado. No se guardan contraseñas en el proyecto. Las sesiones de los portales viven únicamente en perfiles locales de Chrome. Los CV, `profile.json`, resultados, caché y perfiles de navegador están ignorados por Git.

La primera vez que se abra un portal puede ser necesario iniciar sesión manualmente. No se intenta evadir CAPTCHA, MFA ni controles anti-bot.
