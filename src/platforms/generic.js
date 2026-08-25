import fs from 'node:fs';
import { fillByLabels, standardEntries, clickIfPresent } from '../form-utils.js';

export async function handleGenericPortal(page, profile, resumePath, label = 'Portal') {
  await fillByLabels(page, standardEntries(profile));

  if (resumePath && fs.existsSync(resumePath)) {
    const uploads = page.locator('input[type=file]');
    const count = await uploads.count();
    for (let i = 0; i < count; i++) {
      const input = uploads.nth(i);
      const accept = await input.getAttribute('accept').catch(() => '');
      if (!accept || /pdf|doc|resume|cv/i.test(accept)) {
        await input.setInputFiles(resumePath).catch(() => {});
        break;
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const finalButton = await page.getByRole('button', { name: /enviar solicitud|postularme|postular|submit|send application|aplicar/i }).count();
    if (finalButton) break;

    const moved = await clickIfPresent(page, ['continuar', 'continue', 'siguiente', 'next', 'revisar', 'review']);
    if (!moved) break;
    await page.waitForTimeout(800);
    await fillByLabels(page, standardEntries(profile));
  }

  console.log(`${label} preparado. Revisa todos los datos y realiza manualmente el envío final.`);
}
