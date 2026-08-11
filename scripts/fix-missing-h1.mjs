/**
 * Give every block-built page the <h1> the live site renders.
 *
 * WordPress stores a page's title separately from its body, and the theme
 * prints it as the <h1>. The harvest only walked the body, so 8 block pages —
 * the COA database, the blog index, the shipping and returns policies, in both
 * languages — shipped with no <h1> at all. Verified against the live site:
 * /lab-tests-coa-results/ does render `<h1>Peptide Product Lab Tests & COA
 * Results</h1>`.
 *
 * Prepends a level-1 heading built from the page's own harvested title, only
 * where the page has no level-1 heading already. Idempotent.
 *
 * Guides are not touched here: they are single self-contained HTML articles and
 * are handled in components/guide-article.js.
 *
 * Usage: node scripts/fix-missing-h1.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = resolve(ROOT, 'data/pages');

/** Block-built groups only. Article-built guides render their own markup. */
const FILES = ['core.json', 'legal.json', 'category.json', 'city.json', 'productLander.json'];

/** Strip the site suffix WordPress appends to <title>. */
const cleanTitle = (s) =>
  String(s || '')
    .split('|')[0]
    .split('–')[0]
    .trim();

let changed = 0;
const report = [];

for (const file of FILES) {
  const path = resolve(PAGES, file);
  let data;
  try {
    data = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    continue;
  }

  let fileTouched = false;
  for (const page of data.pages ?? []) {
    const hasH1 = (page.sections ?? []).some(
      (s) => s.type === 'heading' && Number(s.content?.level) === 1
    );
    if (hasH1) continue;

    const en = cleanTitle(page.head?.title_en);
    const es = cleanTitle(page.head?.title_es) || en;
    if (!en) continue;

    page.sections.unshift({
      type: 'heading',
      content: { level: 1, text_en: en, text_es: es },
    });
    fileTouched = true;
    changed += 1;
    report.push(`  ${file}  ${page.slug} → "${en}"`);
  }

  if (fileTouched) await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log(`fix-missing-h1: added ${changed} page title heading(s)`);
for (const r of report) console.log(r);
if (!changed) console.log('  nothing to fix — every block page already has an <h1>');
