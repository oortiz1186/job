export const PORTALS = {
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    host: /linkedin\.com/i,
    searchUrl: q => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&f_TPR=r604800`,
    linkSelectors: [
      'a[href*="/jobs/view/"]',
      'a.base-card__full-link'
    ]
  },
  indeed: {
    id: 'indeed',
    label: 'Indeed',
    host: /indeed\./i,
    searchUrl: q => `https://mx.indeed.com/jobs?q=${encodeURIComponent(q)}&fromage=7`,
    linkSelectors: [
      'a[href*="/viewjob"]',
      'a.jcs-JobTitle'
    ]
  },
  computrabajo: {
    id: 'computrabajo',
    label: 'Computrabajo',
    host: /computrabajo\./i,
    searchUrl: q => `https://mx.computrabajo.com/trabajo-de-${slug(q)}?pubdate=7`,
    linkSelectors: [
      'a[href*="/ofertas-de-trabajo/"]',
      'a.js-o-link'
    ]
  },
  occ: {
    id: 'occ',
    label: 'OCC',
    host: /occ\.com\.mx/i,
    searchUrl: q => `https://www.occ.com.mx/empleos/de-${slug(q)}/?tm=7`,
    linkSelectors: [
      'a[href*="/empleo/oferta/"]',
      'a[href*="/empleos/"]'
    ]
  }
};

function slug(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9+#.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolvePortalSelection(input) {
  const raw = input || process.env.PORTALS || Object.keys(PORTALS).join(',');
  const ids = String(raw).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const invalid = ids.filter(id => !PORTALS[id]);
  if (invalid.length) throw new Error(`Portales no válidos: ${invalid.join(', ')}`);
  return [...new Set(ids)].map(id => PORTALS[id]);
}

export function portalForUrl(url) {
  return Object.values(PORTALS).find(p => p.host.test(url));
}
