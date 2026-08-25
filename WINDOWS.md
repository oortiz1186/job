# Instalación en Windows

## 1. Clonar

```powershell
git clone https://github.com/oortiz1186/job.git
cd job
git checkout feature/job-application-assistant-mvp
```

## 2. Instalar dependencias

```powershell
npm install
npx playwright install chromium
```

## 3. Crear configuración local

```powershell
Copy-Item .env.example .env
Copy-Item data\profile.example.json data\profile.json
```

Edita `data\profile.json` y completa correo, teléfono, enlaces, respuestas y rutas reales de tus CVs.

## 4. Primera ejecución

```powershell
npm run apply -- "URL_DE_LA_VACANTE"
```

Se abrirá Chrome con un perfil independiente almacenado en `.browser-profile`. La primera vez inicia sesión manualmente. No pongas usuario ni contraseña dentro del proyecto.

## 5. Funcionamiento

- Lee el texto visible de la vacante.
- Calcula compatibilidad.
- Si el resultado está por debajo de `MIN_MATCH`, no rellena automáticamente.
- Si supera el umbral, elige el CV configurado según el tipo de puesto.
- Rellena datos personales y preguntas conocidas.
- Puede avanzar pasos intermedios.
- Se detiene cuando detecta el botón final de envío.

## Importante

LinkedIn e Indeed modifican su HTML con frecuencia. Si deja de detectar un botón o campo, actualiza los selectores en `src/platforms/` y `src/form-utils.js`.

No automatices CAPTCHA, MFA ni controles anti-bot. Si aparece uno, resuélvelo manualmente.
