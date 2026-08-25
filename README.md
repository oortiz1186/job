# Job Application Assistant

Asistente local y semi-automático para preparar postulaciones en LinkedIn e Indeed sin compartir credenciales.

## Objetivo

1. Mantener la sesión del navegador en el equipo del usuario.
2. Analizar la descripción de una vacante.
3. Calcular compatibilidad contra un perfil profesional local.
4. Preparar respuestas y seleccionar el CV adecuado.
5. Completar campos repetitivos con Playwright.
6. Detenerse antes del envío final para revisión humana.

## Seguridad

- No almacena contraseñas de LinkedIn o Indeed.
- No intenta evadir CAPTCHA, MFA ni mecanismos anti-bot.
- No pulsa el botón final de envío de solicitud.
- No inventa experiencia; las respuestas se basan en el perfil configurado.

## Requisitos

- Node.js 20+
- npm
- Google Chrome instalado

## Instalación

```bash
npm install
npx playwright install chromium
cp .env.example .env
cp data/profile.example.json data/profile.json
```

Edita `data/profile.json` con tus datos reales y conserva ese archivo fuera de Git. `data/profile.json` está ignorado por `.gitignore`.

## Uso

```bash
npm run start
```

También puedes ejecutar una URL concreta:

```bash
npm run apply -- "https://www.linkedin.com/jobs/view/..."
```

El asistente abrirá Chromium con un perfil persistente local en `.browser-profile/`. La primera vez inicia sesión manualmente en LinkedIn o Indeed. Después esa sesión se reutiliza localmente.

## Estado actual

MVP orientado a:

- LinkedIn Easy Apply: relleno básico de campos comunes y pausa antes de enviar.
- Indeed: relleno básico de formularios comunes y pausa antes de enviar.
- Scoring local por palabras clave y experiencia.
- Banco de respuestas reutilizables.

Los portales cambian con frecuencia; los selectores pueden necesitar mantenimiento.
