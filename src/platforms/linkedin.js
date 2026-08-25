import fs from 'node:fs';
import { fillByLabels, standardEntries, clickIfPresent } from '../form-utils.js';

export async function handleLinkedIn(page, profile, resumePath) {
  await fillByLabels(page, standardEntries(profile));

  const easyApply = page.getByRole('button', { name: /easy apply|solicitud sencilla|solicitar ahora/i }).first();
  if (await easyApply.count()) {
    await easyApply.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  await fillByLabels(page, standardEntries(profile));

  if (resumePath && fs.existsSync(resumePath)) {
    const upload = page.locator('input[type=file]').first();
    if (await upload.count()) await upload.setInputFiles(resumePath).catch(() => {});
  }

  // Avanza únicamente por pasos intermedios seguros; nunca pulsa enviar.
  for (let i = 0; i < 4; i++) {
    const sent = await page.getByRole('button', { name: /submit application|enviar solicitud|enviar/i }).count();
    if (sent) break;
    const moved = await clickIfPresent(page, ['next', 'siguiente', 'review', 'revisar']);
    if (!moved) break;
    await page.waitForTimeout(800);
    await fillByLabels(page, standardEntries(profile));
  }

  console.log('LinkedIn preparado. Revisa todos los datos y realiza manualmente el envío final.');
}
