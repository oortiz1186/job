import fs from 'node:fs';
import { fillByLabels, standardEntries, clickIfPresent } from '../form-utils.js';
import { fillKnownQuestions } from '../answers.js';

export async function handleIndeed(page, profile, resumePath) {
  await fillByLabels(page, standardEntries(profile));

  const apply = page.getByRole('button', { name: /apply now|aplicar ahora|solicitar/i }).first();
  if (await apply.count()) {
    await apply.click().catch(() => {});
    await page.waitForTimeout(1200);
  }

  await fillByLabels(page, standardEntries(profile));
  await fillKnownQuestions(page, profile);

  if (resumePath && fs.existsSync(resumePath)) {
    const upload = page.locator('input[type=file]').first();
    if (await upload.count()) await upload.setInputFiles(resumePath).catch(() => {});
  }

  for (let i = 0; i < 5; i++) {
    const finalButton = await page.getByRole('button', { name: /submit|enviar|send application|enviar solicitud/i }).count();
    if (finalButton) break;
    const moved = await clickIfPresent(page, ['continue', 'continuar', 'next', 'siguiente', 'review', 'revisar']);
    if (!moved) break;
    await page.waitForTimeout(900);
    await fillByLabels(page, standardEntries(profile));
    await fillKnownQuestions(page, profile);
  }

  console.log('Indeed preparado. Revisa todos los datos y realiza manualmente el envío final.');
}
