import { readdir } from 'node:fs/promises';
import path from 'node:path';

import DosingGuideLibrary from './DosingGuideLibrary';

const GUIDE_DIRECTORY = path.join(process.cwd(), 'public', 'dosing-guides');

function cleanGuideTitle(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\bcopy of\s+/i, '')
    .replace(/\s*\((?:1|2|3)\)(?=\s|$)/g, '')
    .replace(/_{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function DosingGuidesPage() {
  const filenames = (await readdir(GUIDE_DIRECTORY))
    .filter((filename) => filename.toLowerCase().endsWith('.pdf'))
    .sort((left, right) => cleanGuideTitle(left).localeCompare(cleanGuideTitle(right)));

  const guides = filenames.map((filename) => ({
    filename,
    title: cleanGuideTitle(filename),
    href: `/dosing-guides/${encodeURIComponent(filename)}`,
  }));

  return <DosingGuideLibrary guides={guides} />;
}
