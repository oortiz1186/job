export async function fillByLabels(page, entries) {
  for (const entry of entries) {
    const { labels, value } = entry;
    if (value === undefined || value === null || value === '') continue;

    for (const label of labels) {
      const locator = page.getByLabel(new RegExp(label, 'i')).first();
      if (await locator.count()) {
        try {
          const tag = await locator.evaluate(el => el.tagName.toLowerCase());
          if (tag === 'select') await locator.selectOption({ label: String(value) }).catch(() => locator.selectOption(String(value)));
          else await locator.fill(String(value));
          break;
        } catch {
          // Continúa con otra coincidencia; los formularios cambian con frecuencia.
        }
      }
    }
  }
}

export async function clickIfPresent(page, patterns) {
  for (const pattern of patterns) {
    const btn = page.getByRole('button', { name: new RegExp(pattern, 'i') }).first();
    if (await btn.count()) {
      try {
        await btn.click();
        return true;
      } catch {}
    }
  }
  return false;
}

export function standardEntries(profile) {
  const p = profile.personal ?? {};
  return [
    { labels: ['first name', 'nombre'], value: p.firstName },
    { labels: ['last name', 'apellido'], value: p.lastName },
    { labels: ['email', 'correo'], value: p.email },
    { labels: ['phone', 'teléfono', 'telefono'], value: p.phone },
    { labels: ['city', 'ciudad'], value: p.city },
    { labels: ['state', 'estado'], value: p.state },
    { labels: ['country', 'país', 'pais'], value: p.country }
  ];
}
