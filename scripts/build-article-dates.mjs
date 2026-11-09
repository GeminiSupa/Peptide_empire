#!/usr/bin/env node
/**
 * Writes data/site/article-dates.json: the publish and last-modified dates
 * WordPress recorded for every post and page (data/wp/posts.json and
 * pages.json), keyed by English path. Read by the article structured data
 * (lib/site/structured-data.mjs via post-page.js) so the site does not load
 * the full WordPress export at runtime.
 *
 *   node scripts/build-article-dates.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const iso = (gmt) => (gmt ? `${String(gmt).replace(/Z?$/, '')}Z` : undefined);

const dates = {};
for (const file of ['data/wp/posts.json', 'data/wp/pages.json']) {
  for (const entry of read(file)) {
    if (entry.status && entry.status !== 'publish') continue;
    const key = new URL(entry.link).pathname;
    dates[key] = { published: iso(entry.date_gmt), modified: iso(entry.modified_gmt) };
  }
}
const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(ROOT, 'data/site/article-dates.json'), `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Wrote ${Object.keys(sorted).length} dates to data/site/article-dates.json`);
