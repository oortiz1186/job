# Job Application Assistant

Asistente local y semi-automático para buscar, evaluar y preparar postulaciones usando el CV real de cada usuario.

## Qué hace

1. El usuario adjunta un CV local en PDF, DOCX, TXT o MD.
2. La IA analiza el CV y genera un perfil profesional estructurado sin inventar datos.
3. El usuario elige en qué portales buscar:
   - LinkedIn
   - Indeed
   - Computrabajo
   - OCC
4. La IA genera búsquedas de puestos a partir del propio CV.
5. El sistema recorre los portales seleccionados y obtiene vacantes visibles en navegador.
6. Cada vacante recibe un porcentaje de compatibilidad y una explicación.
7. Solo las vacantes que superan `MIN_MATCH` quedan recomendadas para aplicar.
8. Al abrir una solicitud, el sistema completa campos repetitivos y adjunta el CV.
9. Siempre se detiene antes del envío final para revisión humana.

## Seguridad y privacidad

- No almacena contraseñas de portales.
- La sesión se conserva únicamente en `.browser-profile/` dentro del equipo local.
- Los CV, el perfil generado y los resultados de búsqueda están ignorados por Git.
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

Coloca el CV en cualquier carpeta local y ejecuta:

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

Ejemplos:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,occ
npm run search -- --cv "C:/ruta/CV.pdf" --portals indeed,computrabajo
```

## Buscar vacantes con IA

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed,computrabajo,occ
```

La IA genera de 5 a 10 búsquedas adecuadas al perfil. Los resultados se guardan localmente en:

```text
data/search-results.json
```

Cada registro contiene portal, puesto, URL, porcentaje, recomendación, coincidencias, faltantes, razones y palabras clave ATS.

Para limitar a una búsqueda concreta:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --portals linkedin,indeed --query "Senior Full Stack Developer"
```

## Umbral de compatibilidad

```env
MIN_MATCH=85
```

Puedes cambiarlo por ejecución:

```bash
npm run search -- --cv "C:/ruta/CV.pdf" --min-match 90
```

## Preparar una solicitud

```bash
npm run apply -- "URL_DE_LA_VACANTE" --cv "C:/ruta/CV.pdf"
```

El sistema:

- abre la vacante;
- analiza compatibilidad;
- usa IA si está configurada;
- detiene el proceso si el match es demasiado bajo;
- completa campos comunes;
- adjunta el CV indicado;
- avanza por pasos intermedios compatibles;
- se detiene antes del envío final.

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
IA compara CV vs vacante
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
