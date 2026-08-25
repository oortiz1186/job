import fs from 'node:fs';
import path from 'node:path';

export function loadProfile(profilePath = 'data/profile.json') {
  const resolved = path.resolve(profilePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`No existe ${profilePath}. Copia data/profile.example.json a data/profile.json y complétalo.`);
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

export function flattenProfile(profile) {
  return [
    ...(profile.professional?.skills ?? []),
    ...(profile.professional?.experienceKeywords ?? []),
    profile.professional?.headline ?? ''
  ].join(' ').toLowerCase();
}
