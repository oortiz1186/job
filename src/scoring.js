const STOP = new Set(['and','the','with','for','from','this','that','your','you','our','are','will','job','role','years','year','experience','work','team','de','la','el','los','las','con','para','por','que','una','uno','del','se','en','un','al']);

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#.\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return [...new Set(normalize(text).split(' ').filter(t => t.length > 2 && !STOP.has(t)))];
}

function professionalText(profile) {
  const p = profile.professional ?? {};
  return normalize([
    ...(p.skills ?? []),
    ...(p.experienceKeywords ?? []),
    ...(p.roles ?? []),
    ...(p.industries ?? []),
    ...(p.languages ?? []),
    ...(p.strengths ?? []),
    p.headline ?? '',
    p.seniority ?? ''
  ].join(' '));
}

export function scoreJob(description, profile) {
  const desc = normalize(description);
  const profileText = professionalText(profile);
  const descTokens = tokens(desc);
  const matched = descTokens.filter(t => profileText.includes(t));
  const keywordBase = descTokens.length ? matched.length / descTokens.length : 0;

  const skills = (profile.professional?.skills ?? []).map(normalize).filter(Boolean);
  const skillsMentioned = skills.filter(skill => desc.includes(skill));
  const skillCoverage = skills.length ? Math.min(1, skillsMentioned.length / Math.min(skills.length, 12)) : keywordBase;

  const roleTerms = [
    ...(profile.professional?.roles ?? []),
    profile.professional?.headline ?? ''
  ].map(normalize).filter(Boolean);
  const roleMatch = roleTerms.some(role => role && (desc.includes(role) || tokens(role).some(t => desc.includes(t)))) ? 1 : keywordBase;

  const score = Math.round(Math.min(100, (keywordBase * 35 + skillCoverage * 50 + roleMatch * 15) * 100));
  return {
    score,
    matchedKeywords: matched.slice(0, 40),
    matchedSkills: skillsMentioned.slice(0, 25),
    missingHighValue: [],
    recommendation: score >= 90 ? 'PRIORIDAD ALTA' : score >= 85 ? 'REVISAR Y APLICAR' : 'NO AUTOMATIZAR'
  };
}

export function chooseResume(_description, profile) {
  return profile.cvPath || profile.resumeFiles?.default || process.env.CV_PATH;
}
