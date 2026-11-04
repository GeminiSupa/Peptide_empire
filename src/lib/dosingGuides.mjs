import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const GUIDE_DIRECTORY = path.join(process.cwd(), 'private', 'dosing-guides');

export function cleanDosingGuideTitle(filename) {
  return filename.replace(/\.pdf$/i, '').replace(/_/g, ' ').replace(/\bcopy of\s+/i, '').replace(/\s*\((?:1|2|3)\)(?=\s|$)/g, '').replace(/_{2,}/g, '').replace(/\s+/g, ' ').trim();
}

export async function listDosingGuides() {
  const filenames = (await readdir(GUIDE_DIRECTORY)).filter((filename) => filename.toLowerCase().endsWith('.pdf'));
  return filenames.sort((left, right) => cleanDosingGuideTitle(left).localeCompare(cleanDosingGuideTitle(right))).map((filename) => ({ filename, title: cleanDosingGuideTitle(filename) }));
}

export async function readDosingGuide(filename) {
  if (!filename || path.basename(filename) !== filename || !filename.toLowerCase().endsWith('.pdf')) return null;
  const guides = await listDosingGuides();
  if (!guides.some((guide) => guide.filename === filename)) return null;
  return readFile(path.join(GUIDE_DIRECTORY, filename));
}
