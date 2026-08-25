# Instalación en Windows

```powershell
git clone https://github.com/oortiz1186/job.git
cd job
git checkout feature/job-application-assistant-mvp
npm install
npx playwright install chromium
Copy-Item .env.example .env
notepad .env
```

Para usar DeepSeek como proveedor principal:

```env
AI_PROVIDER=deepseek
AI_FALLBACK=true
AI_FALLBACK_ORDER=deepseek,gemini,openai
DEEPSEEK_API_KEY=TU_API_KEY
DEEPSEEK_MODEL=deepseek-chat
```

Si también configuras Gemini u OpenAI, el sistema puede cambiar automáticamente cuando DeepSeek falle o se agote una cuota.

Inicia el portal:

```powershell
npm run web
```

Abre:

```text
http://localhost:3210
```

En la interfaz puedes elegir Automático, DeepSeek, Gemini, OpenAI o scoring local. Las API keys permanecen en `.env` y no se muestran en el navegador.

La primera vez que el sistema prepare una postulación, inicia sesión manualmente en el portal correspondiente cuando Chrome lo solicite. El perfil del navegador se conserva localmente y no se versiona en Git.
