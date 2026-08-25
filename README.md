# Job Application Assistant

Asistente local y semi-automático para buscar, evaluar y preparar postulaciones usando el CV real de cada usuario.

## Qué hace

1. El usuario adjunta un CV local en PDF, DOCX, TXT o MD.
2. La IA analiza el CV y genera un perfil profesional estructurado sin inventar datos.
3. El usuario elige en qué portales buscar: LinkedIn, Indeed, Computrabajo y OCC.
4. La IA genera búsquedas de puestos a partir del propio CV.
5. El sistema recorre los portales seleccionados y obtiene vacantes visibles en navegador.
6. Un prefiltro local descarta vacantes claramente incompatibles antes de gastar llamadas de IA.
7. Las vacantes candidatas se analizan con concurrencia limitada y caché persistente.
8. Cada vacante recibe un porcentaje de compatibilidad y una explicación.
9. Solo las vacantes que superan `MIN_MATCH` quedan recomendadas para aplicar.
10. Al abrir una solicitud, el sistema completa campos repetitivos y adjunta el CV.
11. Siempre se detiene antes del envío final para revisión humana.

## Seguridad y privacidad

- No almacena contraseñas de portales.
- La sesión se conserva únicamente en `.browser-profile/` dentro del equipo local.
- Los CV, el perfil generado, los resultados y el caché están ignorados por Git.
- No intenta evadir CAPTCHA, MFA ni mecanismos anti-bot.
- No pulsa automáticamente el botón final de envío.
- La IA recibe el texto del CV únicamente cuando el usuario configura un proveedor de IA externo.

## Requisitos

- Node.js 20+
- npm
- Google Chrome
- Opcional: API key de OpenAI o Google Gemini

## Instalación

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

En Windows PowerShell:

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env
```

## Configurar IA

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

También puede usarse `AI_PROVIDER=none`; en ese modo el scoring es local y las búsquedas deben indicarse manualmente con `--query`.

## Adjuntar un CV y crear perfil

```bash
npm run profile -- --cv "C:/ruta/CV.pdf"
```

Se crea `data/profile.json`. Revísalo antes de usarlo. Los datos no detectados quedan vacíos.

También puedes configurar:

```env
CV_PATH=C:/ruta/CV.pdf
```

## Seleccionar portales

En `.env`:

```env
PORTALS=linkedin,indeed,computrabajo,occ
```

O en cada búsqueda:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed
```

## Buscar vacantes

Modo normal:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed,computrabajo,occ
```

Modo rápido recomendado para búsquedas amplias:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed --fast
```

La consola muestra progreso, porcentaje terminado, ETA aproximado, llamadas a IA, hits de caché y descartes por prefiltro.

Ejemplo:

```text
[18/47] 38% | ETA 1m 12s | IA 7 | caché 5 | prefiltro 6
```

Los resultados se guardan en:

```text
data/search-results.json
```

El caché local de evaluaciones se guarda en:

```text
data/search-cache.json
```

Si una vacante no cambió y sigue dentro del TTL, no vuelve a consumir IA.

## Optimización de rendimiento

Variables disponibles en `.env`:

```env
SEARCH_PREFILTER_SCORE=60
SEARCH_CONCURRENCY=3
SEARCH_FAST=false
SEARCH_CACHE_TTL_HOURS=168
SEARCH_MAX_PER_PORTAL=20
```

- `SEARCH_PREFILTER_SCORE`: solo usa IA en vacantes cuyo score local alcance este valor. En `--fast`, el valor predeterminado efectivo es 65 si no se configuró otro.
- `SEARCH_CONCURRENCY`: número de vacantes procesadas simultáneamente. Recomendado: 3 o 4.
- `SEARCH_FAST`: reduce pausas del navegador.
- `SEARCH_CACHE_TTL_HOURS`: tiempo durante el cual una evaluación IA puede reutilizarse. 168 horas = 7 días.
- `SEARCH_MAX_PER_PORTAL`: máximo de enlaces recolectados por búsqueda y portal.

También puedes ajustar por comando:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed --fast --prefilter 65 --concurrency 4 --max 15
```

No se recomienda una concurrencia muy alta porque los portales pueden responder peor, activar controles anti-bot o consumir demasiadas llamadas de IA simultáneas.

## Umbral de compatibilidad

```env
MIN_MATCH=85
```

También:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --min-match 90
```

## Búsqueda concreta

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed --query "Senior Full Stack Developer"
```

## Preparar una solicitud

```bash
npm run apply -- "URL_DE_LA_VACANTE" --cv "C:/ruta/CV.pdf"
```

El sistema abre la vacante, analiza compatibilidad, completa campos comunes, adjunta el CV indicado, avanza por pasos intermedios compatibles y se detiene antes del envío final.

## Portales soportados

### LinkedIn
Soporte inicial para Easy Apply / Solicitud sencilla.

### Indeed
Soporte inicial para formularios de aplicación visibles desde Indeed.

### Computrabajo
Búsqueda y manejador genérico de formularios. Algunos procesos pueden redirigir a sitios externos.

### OCC
Búsqueda y manejador genérico de formularios. Algunos procesos pueden redirigir al sitio del empleador.

## Limitaciones

Los portales cambian HTML, selectores y flujos con frecuencia. CAPTCHA, MFA, redirecciones externas y preguntas no estándar requieren intervención humana. La primera versión está pensada como asistente, no como bot de envío masivo.

## Flujo recomendado

```text
CV
 ↓
IA analiza perfil
 ↓
Genera puestos objetivo
 ↓
Usuario selecciona portales
 ↓
Búsqueda multiportal
 ↓
Prefiltro local rápido
 ↓
Vacantes candidatas
 ↓
IA + caché + concurrencia limitada
 ↓
Compatibilidad >= umbral
 ↓
Preparar solicitud
 ↓
Adjuntar CV + llenar campos
 ↓
Revisión humana
 ↓
Enviar
```
