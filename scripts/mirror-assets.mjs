/**
 * Mirror every asset the harvested content references into public/.
 *
 * WHY NOW AND NOT AT CUTOVER
 *
 * Until this runs, the clone renders correctly only because it hotlinks the
 * live WordPress server. Those are exactly the files that disappear the moment
 * WooCommerce is switched off — so "download them at cutover" means downloading
 * them from a host that may already be gone.
 *
 * WHAT IT COVERS, that scripts/download-images.mjs does not
 *
 * download-images.mjs scans rendered PAGES for image references. This walks the
 * harvested DATA instead, so it also catches:
 *   - product images and related-product thumbnails (data/pages/wooProduct)
 *   - store gallery images (data/wp/store-products)
 *   - the 78 certificate-of-analysis PDFs on the lab-tests page
 *
 * Files already present are skipped, so re-running is cheap and safe.
 *
 * Usage:
 *   node scripts/mirror-assets.mjs
 *   node scripts/mirror-assets.mjs --dry
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');
const DRY = process.argv.includes('--dry');

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

/** Every /wp-content/... reference anywhere in the harvested data. */
async function collect() {
  const refs = new Set();
  const add = (v) => {
    if (typeof v === 'string' && v.startsWith('/wp-content/')) refs.add(v);
  };

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'object') return Object.values(node).forEach(walk);
    add(node);
  };

  const dirs = ['data/pages', 'data/wp'];
  for (const dir of dirs) {
    const full = resolve(ROOT, dir);
    for (const name of await readdir(full)) {
      if (!name.endsWith('.json')) continue;
      walk(JSON.parse(await readFile(resolve(full, name), 'utf8')));
    }
  }
  return [...refs].sort();
}

async function pool(items, size, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }),
  );
}

async function download(path, attempt = 1) {
  try {
    const res = await fetch(ORIGIN + path, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-mirror' },
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return download(path, attempt + 1);
  }
}

async function main() {
  const refs = await collect();
  const images = refs.filter((r) => !r.toLowerCase().endsWith('.pdf'));
  const pdfs = refs.filter((r) => r.toLowerCase().endsWith('.pdf'));
  console.log(`${refs.length} referenced assets — ${images.length} images, ${pdfs.length} PDFs\n`);

  const missing = [];
  for (const ref of refs) {
    if (!(await exists(resolve(PUBLIC, `.${ref}`)))) missing.push(ref);
  }
  console.log(`${refs.length - missing.length} already local · ${missing.length} to fetch`);
  if (DRY || !missing.length) {
    for (const m of missing.slice(0, 15)) console.log(`  would fetch ${m}`);
    if (missing.length > 15) console.log(`  …and ${missing.length - 15} more`);
    return;
  }

  let ok = 0;
  let bytes = 0;
  const failed = [];
  let done = 0;

  await pool(missing, 6, async (ref) => {
    try {
      const buf = await download(ref);
      const dest = resolve(PUBLIC, `.${ref}`);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      ok += 1;
      bytes += buf.length;
    } catch (err) {
      failed.push(`${ref} — ${err.message}`);
    } finally {
      done += 1;
      if (done % 50 === 0) console.log(`  …${done}/${missing.length}`);
    }
  });

  console.log(`\nMirrored ${ok} files · ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (failed.length) {
    console.log(`\n${failed.length} could not be fetched — these are gone from the live server:`);
    for (const f of failed.slice(0, 25)) console.log(`  ${f}`);
    if (failed.length > 25) console.log(`  …and ${failed.length - 25} more`);
  } else {
    console.log('\nEvery referenced asset is now local. The clone no longer hotlinks WordPress.');
  }
}

main().catch((err) => {
  console.error(`\nmirror-assets failed: ${err.message}`);
  process.exit(1);
});
