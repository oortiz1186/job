const STOP = new Set(['and','the','with','for','from','this','that','your','you','our','are','will','job','role','years','year','experience','work','team','de','la','el','los','las','con','para','por','que','una','uno']);

function normalize(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#.\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return [...new Set(normalize(text).split(' ').filter(t => t.length > 2 && !STOP.has(t)))];
}

const HIGH_VALUE = ['.net','c#','angular','typescript','react','next.js','node.js','nestjs','sql server','postgresql','rest api','docker','github actions','aws','scrum','agile'];

export function scoreJob(description, profile) {
  const desc = normalize(description);
  const profileText = normalize([
    ...(profile.professional?.skills ?? []),
    ...(profile.professional?.experienceKeywords ?? []),
    profile.professional?.headline ?? ''
  ].join(' '));

  const descTokens = tokens(desc);
  const matched = descTokens.filter(t => profileText.includes(t));
  const keywordBase = descTokens.length ? matched.length / descTokens.length : 0;

  const highValuePresent = HIGH_VALUE.filter(k => desc.includes(normalize(k)));
  const highValueMatched = highValuePresent.filter(k => profileText.includes(normalize(k)));
  const techScore = highValuePresent.length ? highValueMatched.length / highValuePresent.length : keywordBase;

  const score = Math.round(Math.min(100, (keywordBase * 45 + techScore * 55) * 100));

  return {
    score,
    matchedKeywords: matched.slice(0, 40),
    missingHighValue: highValuePresent.filter(k => !highValueMatched.includes(k)),
    recommendation: score >= 90 ? 'PRIORIDAD ALTA' : score >= 85 ? 'REVISAR Y APLICAR' : 'NO AUTOMATIZAR'
  };
}

export function chooseResume(description, profile) {
  const d = normalize(description);
  if (/technical lead|tech lead|lider tecnico|arquitect/.test(d)) return profile.resumeFiles?.lead ?? profile.resumeFiles?.default;
  if (/it manager|gerente de ti|coordinador de ti|infraestructura/.test(d)) return profile.resumeFiles?.itManager ?? profile.resumeFiles?.default;
  if (/\.net|c#|asp\.net/.test(d)) return profile.resumeFiles?.dotnet ?? profile.resumeFiles?.default;
  return profile.resumeFiles?.default;
}
