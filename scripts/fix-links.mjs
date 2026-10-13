/**
 * Repair link defects the harvest introduced, across every harvested file.
 *
 * Each rule below is a bug confirmed against the live site, not a guess:
 *
 *  1. External links lost their origin. The press link and the Google Maps
 *     link were stored as `/introducing-peptides-.../` and `/AgpzEd8NNRKYNbJj9`
 *     — root-relative paths on OUR domain — so they 404'd instead of leaving
 *     the site. (The older home.json still holds the correct absolute URL,
 *     which is how the regression was spotted.)
 *
 *  2. Links to URLs that 301 on the live site are rewritten to the target the
 *     live site actually serves, so the clone has no redirect hops:
 *       /dsip/            -> /dsip-costa-rica/
 *       /costa-rica-map/  -> the .webp it resolves to (an image attachment)
 *       /tirzepatida-costa-rica/ -> /tirzepatide-costa-rica/
 *
 *  3. Trailing whitespace inside href attributes, which made otherwise valid
 *     internal links unresolvable.
 *
 * Re-runnable and idempotent: every rule is a literal replacement that no
 * longer matches once applied.
 *
 * Usage: node scripts/fix-links.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = resolve(ROOT, 'data/pages');

/** [description, find, replace] — applied to the raw JSON text of each file. */
const RULES = [
  [
    'press article link regains its origin',
    '"/introducing-peptides-costa-rica-bringing-trusted-peptide-products-to-costa-rica/"',
    '"https://thecostaricanews.com/introducing-peptides-costa-rica-bringing-trusted-peptide-products-to-costa-rica/"',
  ],
  [
    'second press link regains its origin',
    '"/2026/07/26/why-two-fitness-veterans-chose-costa-rica-to-launch-a-new-peptide-company-peptides-costa-rica',
    '"https://thecostaricanews.com/2026/07/26/why-two-fitness-veterans-chose-costa-rica-to-launch-a-new-peptide-company-peptides-costa-rica',
  ],
  [
    'Google Maps short link regains its origin',
    '"/AgpzEd8NNRKYNbJj9"',
    '"https://maps.app.goo.gl/AgpzEd8NNRKYNbJj9"',
  ],
  ['dsip 301 resolved', 'href=\\"/dsip/\\"', 'href=\\"/dsip-costa-rica/\\"'],
  // The Spanish body has the same link with a typo in the slug ("dsp"), and
  // TranslatePress prefixed it with /es/. Same destination, Spanish route.
  ['dsip (es, misspelt "dsp") resolved', 'href=\\"/es/dsp/\\"', 'href=\\"/es/dsip-costa-rica/\\"'],
  ['dsip (es) resolved', 'href=\\"/es/dsip/\\"', 'href=\\"/es/dsip-costa-rica/\\"'],
  [
    'costa-rica-map 301 resolved to the asset it serves',
    'href=\\"/costa-rica-map/\\"',
    'href=\\"/wp-content/uploads/2026/07/Costa-Rica-Map.webp\\"',
  ],
  // An image file has no Spanish variant — /es/ was prefixed to an asset path.
  [
    'costa-rica-map (es) points at the same asset',
    'href=\\"/es/costa-rica-map/\\"',
    'href=\\"/wp-content/uploads/2026/07/Costa-Rica-Map.webp\\"',
  ],
  [
    // REVERSED 2026-08-20. The live site used to serve the Spanish spelling in
    // English and redirect the other way; it now does the opposite —
    // /tirzepatida-costa-rica/ 301s to /tirzepatide-costa-rica/, which is a 200.
    // The old rule pointed 40 city-page links at a slug that no longer exists
    // on either site, and data/wp/pages.json only holds the -e- spelling, so
    // the page was not being generated under the name being linked.
    'tirzepatide lander uses the slug the live site serves',
    '/tirzepatida-costa-rica/',
    '/tirzepatide-costa-rica/',
  ],
  [
    // ...but ONLY in English. These are literal replacements, so the rule above
    // also rewrites the Spanish route, whose slug legitimately keeps the
    // Spanish spelling (/es/tirzepatida-costa-rica/). This puts those four
    // links back; it must stay directly after the rule it corrects.
    'tirzepatida keeps its Spanish spelling on the /es/ route',
    '/es/tirzepatide-costa-rica/',
    '/es/tirzepatida-costa-rica/',
  ],
  [
    'complete peptide guide uses its live root-level URL',
    '/blog/complete-guide-to-peptides/',
    '/complete-guide-to-peptides/',
  ],
  [
    'Spanish complete peptide guide uses its live root-level URL',
    '/es/blog/complete-guide-to-peptides/',
    '/es/guia-completa-de-peptidos-2/',
  ],
  [
    'Spanish complete peptide guide drops the stale untranslated slug',
    '/es/complete-guide-to-peptides/',
    '/es/guia-completa-de-peptidos-2/',
  ],
];

/** Collapse whitespace inside any href="..." in an embedded HTML string. */
const trimHrefs = (text) =>
  text.replace(/href=\\"([^"\\]*?)\\"/g, (m, url) => `href=\\"${url.trim()}\\"`);

/**
 * Every harvested file that can hold a link — page bodies AND the site chrome.
 *
 * data/global.json belongs here because the header and footer navigation is
 * harvested too, and it carries the same defects. The nav's Tirzepatide entry
 * pointed at a URL the live site only 301-redirects, which made it a dead link
 * on all 227 pages of the clone rather than on one.
 */
const files = [
  ...(await readdir(PAGES)).filter((f) => f.endsWith('.json')).map((f) => resolve(PAGES, f)),
  resolve(ROOT, 'data/global.json'),
];
let touched = 0;
const report = [];

for (const path of files) {
  const file = path.slice(ROOT.length + 1).split(sep).join('/');
  const before = await readFile(path, 'utf8');
  let after = before;
  const applied = [];

  for (const [label, find, replace] of RULES) {
    if (!after.includes(find)) continue;
    const count = after.split(find).length - 1;
    after = after.split(find).join(replace);
    applied.push(`${label} (${count})`);
  }

  const trimmed = trimHrefs(after);
  if (trimmed !== after) {
    applied.push('trimmed whitespace in href');
    after = trimmed;
  }

  if (after !== before) {
    // Confirm we did not corrupt the file before writing it back.
    JSON.parse(after);
    await writeFile(path, after, 'utf8');
    touched += 1;
    report.push(`  ${file}\n      ${applied.join('\n      ')}`);
  }
}

console.log(`fix-links: ${touched} file(s) changed`);
for (const r of report) console.log(r);
if (!touched) console.log('  nothing to fix — all rules already applied');
