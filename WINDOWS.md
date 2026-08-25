# Instalación y prueba en Windows

## 1. Actualizar el proyecto

```powershell
git checkout feature/job-application-assistant-mvp
git pull origin feature/job-application-assistant-mvp
npm install
npx playwright install chromium
```

## 2. Configurar `.env`

Si aún no existe:

```powershell
Copy-Item .env.example .env
notepad .env
```

Ejemplo con Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=TU_API_KEY
GEMINI_MODEL=gemini-2.5-flash
HEADLESS=false
MIN_MATCH=85
WEB_PORT=3210
PORTALS=linkedin,indeed,computrabajo,occ
SEARCH_PREFILTER_SCORE=60
SEARCH_CONCURRENCY=3
```

## 3. Iniciar portal

```powershell
npm run web
```

Después abre:

```text
http://localhost:3210
```

## 4. Uso

1. Sube un CV.
2. Pulsa **Analizar CV con IA**.
3. Selecciona los portales.
4. Ajusta el porcentaje mínimo.
5. Pulsa **Buscar vacantes**.
6. Revisa los resultados.
7. Usa **Preparar postulación**, **Preparar seleccionadas** o **Preparar todas compatibles**.
8. Chrome abrirá las solicitudes y tratará de completar campos/adjuntar el CV.
9. Revisa cada formulario y realiza manualmente el envío final.

La primera vez puede ser necesario iniciar sesión manualmente en cada portal dentro de los perfiles de Chrome que crea el sistema.
