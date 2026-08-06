/**
 * Post-build audit: does every image the site actually SERVES exist on disk?
 *
 * The mirror scripts check the harvested DATA. This checks the built OUTPUT,
 * which is what a visitor receives — including srcset candidates, which are the
 * easiest thing to get wrong: a srcset promises the browser a set of URLs, and a
 * single missing candidate is a broken image at one viewport width only, on one
 * page, which no amount of clicking around reliably finds.
 *
 * Usage: node scripts/verify-build.mjs      (run after `npm run build`)
 */

import { readFile, readdir, access, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');
const OUT = resolve(ROOT, '.next/server/app');

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

async function htmlFiles(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await htmlFiles(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const pages = await htmlFiles(OUT);
if (!pages.length) {
  console.error('No built HTML found. Run `npm run build` first.');
  process.exit(1);
}

const referenced = new Map(); // /wp-content path -> Set(pages)
const note = (path, page) => {
  if (!referenced.has(path)) referenced.set(path, new Set());
  referenced.get(path).add(page.replace(OUT, '').replace(/\\/g, '/'));
};

let imgTags = 0;
let srcsetTags = 0;

for (const page of pages) {
  const html = await readFile(page, 'utf8');

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    imgTags += 1;
    const tag = m[0];

    const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
    if (src?.startsWith('/wp-content/')) note(decodeURI(src), page);

    const set = tag.match(/\ssrcset="([^"]+)"/i)?.[1];
    if (set) {
      srcsetTags += 1;
      for (const part of set.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url?.startsWith('/wp-content/')) note(decodeURI(url), page);
      }
    }
  }

  // Inline background images and <source> elements, if any ever appear.
  for (const m of html.matchAll(/url\((['"]?)(\/wp-content\/[^'")]+)\1\)/gi)) {
    note(decodeURI(m[2]), page);
  }
}

const broken = [];
let bytes = 0;
for (const [path, onPages] of referenced) {
  const file = resolve(PUBLIC, `.${path}`);
  if (!(await exists(file))) broken.push([path, [...onPages]]);
  else bytes += (await stat(file)).size;
}

console.log(`Built pages        : ${pages.length}`);
console.log(`<img> tags         : ${imgTags} (${srcsetTags} with a srcset)`);
console.log(`distinct image URLs: ${referenced.size}`);
console.log(`served image weight: ${(bytes / 1024 / 1024).toFixed(1)} MB on disk`);

if (broken.length) {
  console.log(`\nBROKEN — ${broken.length} referenced file(s) are not in public/:`);
  for (const [path, onPages] of broken.slice(0, 25)) {
    console.log(`  ${path}`);
    console.log(`     on ${onPages.slice(0, 3).join(', ')}${onPages.length > 3 ? ` (+${onPages.length - 3})` : ''}`);
  }
  process.exit(1);
}

console.log('\nEvery image the built site serves is present in public/.');
