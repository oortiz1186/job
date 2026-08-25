import fs from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractCvText(cvPath) {
  if (!cvPath) throw new Error('Debes indicar un CV con --cv o CV_PATH.');
  const resolved = path.resolve(cvPath);
  if (!fs.existsSync(resolved)) throw new Error(`No existe el CV: ${resolved}`);

  const ext = path.extname(resolved).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdf(fs.readFileSync(resolved));
    return cleanText(data.text);
  }
  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: resolved });
    return cleanText(value);
  }
  if (ext === '.txt' || ext === '.md') {
    return cleanText(fs.readFileSync(resolved, 'utf8'));
  }

  throw new Error('Formato no soportado. Usa PDF, DOCX, TXT o MD.');
}

export function cleanText(text = '') {
  return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
