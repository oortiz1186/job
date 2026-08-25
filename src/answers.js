function norm(text = '') {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function answerForQuestion(question, profile) {
  const q = norm(question);
  const a = profile.answers ?? {};
  const p = profile.professional ?? {};

  if (/sponsor|sponsorship|patrocinio/.test(q)) return a.requiresSponsorship;
  if (/authorized|autorizado.*trabajar|permiso.*trabajar/.test(q)) return a.authorizedToWork;
  if (/relocate|reubic/.test(q)) return a.willingToRelocate;
  if (/remote|remoto/.test(q)) return a.remoteWork;
  if (/notice|preaviso|disponibilidad/.test(q)) return a.noticePeriod;
  if (/salary|salario|sueldo|compensation|pretension/.test(q)) return p.salaryExpectationMonthlyMXN;
  if (/english|ingles/.test(q)) return p.englishLevel;
  if (/education|educacion|estudios|degree/.test(q)) return a.highestEducation;
  if (/\.net|dotnet/.test(q)) return a.yearsDotNet;
  if (/c#|c sharp/.test(q)) return a.yearsCSharp;
  if (/angular/.test(q)) return a.yearsAngular;
  if (/typescript/.test(q)) return a.yearsTypeScript;
  if (/sql server/.test(q)) return a.yearsSqlServer;
  return undefined;
}

export async function fillKnownQuestions(page, profile) {
  const fields = page.locator('input, textarea, select');
  const count = await fields.count();

  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    try {
      const meta = await field.evaluate(el => {
        const id = el.id;
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.innerText : '';
        return [label, el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.name].filter(Boolean).join(' ');
      });
      const answer = answerForQuestion(meta, profile);
      if (answer === undefined || answer === null || answer === '') continue;

      const tag = await field.evaluate(el => el.tagName.toLowerCase());
      const type = await field.getAttribute('type');
      if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'hidden') continue;
      if (tag === 'select') {
        await field.selectOption({ label: String(answer) }).catch(() => field.selectOption(String(answer)));
      } else {
        const current = await field.inputValue().catch(() => '');
        if (!current) await field.fill(String(answer));
      }
    } catch {
      // Campo no compatible o cambió el DOM; se deja para revisión humana.
    }
  }
}
