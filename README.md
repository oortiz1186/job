# Job Application Assistant

Asistente local y semi-automático para analizar un CV, buscar vacantes compatibles y preparar postulaciones en LinkedIn, Indeed, Computrabajo y OCC.

## Portal web

La forma recomendada de usar el proyecto ahora es mediante la interfaz visual.

```powershell
npm install
npx playwright install chromium
npm run web
```

Abre:

```text
http://localhost:3210
```

Desde el portal puedes:

1. Subir un CV en PDF, DOCX, TXT o MD.
2. Analizarlo con OpenAI o Gemini.
3. Elegir LinkedIn, Indeed, Computrabajo y/o OCC.
4. Configurar el porcentaje mínimo de compatibilidad.
5. Buscar vacantes generadas a partir del perfil detectado en el CV.
6. Ver resultados ordenados por porcentaje de compatibilidad.
7. Revisar coincidencias, faltantes y explicación del análisis.
8. Abrir una vacante para revisarla manualmente.
9. Preparar una postulación individual.
10. Seleccionar varias y preparar las seleccionadas.
11. Preparar todas las vacantes compatibles con el umbral configurado.

El sistema completa campos compatibles y adjunta el CV, pero **no pulsa el botón final de envío**. La revisión y confirmación final permanecen bajo control del usuario.

## Configuración

Copia `.env.example` a `.env` y configura un proveedor de IA.

### Gemini

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### OpenAI

```env
AI_PROVIDER=openai
OPENAI_API_KEY=tu_api_key
OPENAI_MODEL=gpt-4.1-mini
```

Configuración recomendada:

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

## Optimización

La búsqueda usa prefiltro local antes de gastar IA, concurrencia limitada, caché de evaluaciones, progreso y ETA aproximado, además de modo rápido desde la interfaz.

## Privacidad

No se guardan contraseñas en el proyecto. Las sesiones de los portales viven únicamente en perfiles locales de Chrome. Los CV subidos, `profile.json`, resultados, caché y perfiles de navegador están ignorados por Git.

La primera vez que se abra un portal puede ser necesario iniciar sesión manualmente. No se intenta evadir CAPTCHA, MFA ni controles anti-bot.

## Terminal

La CLI sigue disponible.

Crear perfil:

```powershell
npm run profile -- --cv "C:\CV\curriculum.pdf"
```

Buscar:

```powershell
npm run search -- --cv "C:\CV\curriculum.pdf" --portals linkedin,indeed --fast
```

Preparar una URL:

```powershell
npm run apply -- "URL_DE_LA_VACANTE" --cv "C:\CV\curriculum.pdf"
```

## Nota sobre despliegue

El dashboard puede servirse como web, pero la preparación automática de solicitudes usa Playwright y un perfil de Chrome con las sesiones del usuario. En esta versión se recomienda ejecutar el portal en la misma PC del usuario. Para convertirlo en un SaaS público se requiere separar el dashboard del worker de navegador y administrar sesiones aisladas por usuario.
