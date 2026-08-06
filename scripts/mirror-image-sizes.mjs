/**
 * Mirror the RESPONSIVE VARIANTS of every image the harvested content uses,
 * and write the manifest the renderer needs to emit a `srcset`.
 *
 * WHY THIS EXISTS
 *
 * scripts/mirror-assets.mjs downloads exactly the files the content references
 * — and the content references WordPress's `woocommerce_thumbnail`, which is
 * 300x300. A product card renders about 330 CSS px wide, and twice that on a
 * retina screen, so every product image on the site was a 300px JPEG upscaled
 * roughly 2.2x. That, not the layout, is why the clone looked blurry.
 *
 * The live site does not have this problem: WordPress emits a full `srcset`
 * (300w/600w/768w/1024w/1536w) for the same image. We only ever mirrored one
 * entry from that set.
 *
 * WHERE THE SIZE LIST COMES FROM
 *
 * data/wp/media.json — the WordPress media library, already harvested. Each
 * entry carries `media_details.sizes`, which is the authoritative list of
 * variants WordPress actually generated for that upload. Nothing here guesses
 * filenames from a naming convention; a guessed `-600x600` that WordPress never
 * generated would 404 and put a broken candidate in the srcset.
 *
 * WHAT IT WRITES
 *
 * data/image-sizes.json, listing ONLY variants that are on disk when the script
 * finishes. A srcset is a promise the browser will hold us to, so the manifest
 * is generated after the download rather than from the media library, and a
 * failed fetch drops that width instead of shipping a 404 candidate.
 *
 * Usage:
 *   node scripts/mirror-image-sizes.mjs
 *   node scripts/mirror-image-sizes.mjs --dry
 */

import { writeFile, mkdir, access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');
const DRY = process.argv.includes('--dry');

/**
 * Widths above this are not worth mirroring. 1536 already covers a full-bleed
 * hero on a 2x display; the 2048 originals roughly double the mirror's size to
 * serve a case the layout never produces.
 */
const MAX_WIDTH = 1536;

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

/** Every /wp-content/... image reference anywhere in the harvested data. */
async function collectReferences() {
  const refs = new Set();

  /**
   * Matches paths EMBEDDED IN a string, not just strings that are a path.
   *
   * The guides and blog posts are stored as one HTML blob per article, with the
   * images as `<img src=… srcset=…>` inside it. A whole-value check only sees a
   * string beginning with `<figure`, so every image inside those articles — and
   * every srcset candidate — was invisible to the mirror. That shipped 34
   * broken image URLs across the blog, each one live only at the viewport width
   * that selects that candidate.
   */
  const EMBEDDED = /(?:https?:\/\/[^"'\s)]*)?(\/wp-content\/uploads\/[^"'\s)\\]+)/g;

  const add = (v) => {
    if (typeof v !== 'string') return;
    for (const m of v.matchAll(EMBEDDED)) {
      const path = m[1].replace(/&amp;/g, '&');
      if (/\.(pdf|svg)$/i.test(path)) continue;
      refs.add(path);
    }
  };

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'object') return Object.values(node).forEach(walk);
    add(node);
  };

  for (const dir of ['data/pages', 'data/wp']) {
    const full = resolve(ROOT, dir);
    for (const name of await readdir(full)) {
      if (!name.endsWith('.json')) continue;
      walk(JSON.parse(await readFile(resolve(full, name), 'utf8')));
    }
  }

  // Site chrome, not page content — the footer's review-band logos live here and
  // are referenced by every page.
  walk(JSON.parse(await readFile(resolve(ROOT, 'data/global.json'), 'utf8')));

  return refs;
}

/**
 * Index the media library by every path that can point at a given upload — the
 * original and each generated variant — so a reference to the 300x300 file
 * resolves to the same family as a reference to the original.
 */
async function buildIndex() {
  const media = JSON.parse(await readFile(resolve(ROOT, 'data/wp/media.json'), 'utf8'));
  const families = new Map(); // canonical path -> { width, height, variants: [] }
  const alias = new Map(); // any known path -> canonical path

  for (const item of media) {
    const url = item.source_url || '';
    if (!url.startsWith(ORIGIN)) continue;
    const canonical = url.slice(ORIGIN.length);
    if (!canonical.startsWith('/wp-content/') || /\.(pdf|svg)$/i.test(canonical)) continue;

    const details = item.media_details || {};
    const dir = posix.dirname(canonical);
    const variants = new Map(); // width -> [width, height, path]

    if (details.width && details.width <= MAX_WIDTH) {
      variants.set(details.width, [details.width, details.height, canonical]);
    }

    for (const size of Object.values(details.sizes || {})) {
      if (!size?.file || !size.width || size.width > MAX_WIDTH) continue;
      // The language-flag and site-icon sizes are chrome, not content.
      if (size.width < 100) continue;
      const path = posix.join(dir, size.file);
      variants.set(size.width, [size.width, size.height, path]);
      alias.set(path, canonical);
    }

    alias.set(canonical, canonical);
    families.set(canonical, {
      width: details.width || null,
      height: details.height || null,
      variants: [...variants.values()].sort((a, b) => a[0] - b[0]),
    });
  }

  return { families, alias };
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
  const refs = await collectReferences();
  const { families, alias } = await buildIndex();

  // The families actually reachable from content — not the whole media library.
  const used = new Map();
  const unknown = [];
  for (const ref of refs) {
    const canonical = alias.get(ref);
    if (!canonical) {
      unknown.push(ref);
      continue;
    }
    used.set(canonical, families.get(canonical));
  }

  const wanted = [...used.values()].flatMap((f) => f.variants.map(([, , path]) => path));
  console.log(
    `${refs.size} referenced images → ${used.size} uploads → ${wanted.length} variants (≤${MAX_WIDTH}px)`,
  );
  if (unknown.length) {
    console.log(`${unknown.length} references are not in the media library (kept as-is)`);
  }

  const missing = [];
  for (const path of new Set(wanted)) {
    if (!(await exists(resolve(PUBLIC, `.${path}`)))) missing.push(path);
  }
  console.log(`${wanted.length - missing.length} already local · ${missing.length} to fetch`);

  if (DRY) {
    for (const m of missing.slice(0, 15)) console.log(`  would fetch ${m}`);
    if (missing.length > 15) console.log(`  …and ${missing.length - 15} more`);
    return;
  }

  let ok = 0;
  let bytes = 0;
  let done = 0;
  const failed = new Set();

  await pool(missing, 6, async (path) => {
    try {
      const buf = await download(path);
      const dest = resolve(PUBLIC, `.${path}`);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      ok += 1;
      bytes += buf.length;
    } catch {
      failed.add(path);
    } finally {
      done += 1;
      if (done % 50 === 0) console.log(`  …${done}/${missing.length}`);
    }
  });

  console.log(`\nMirrored ${ok} variants · ${(bytes / 1024 / 1024).toFixed(1)} MB`);

  // Manifest: only what is on disk now. A width whose file failed to download is
  // dropped rather than promised to the browser.
  const manifest = {};
  for (const [canonical, family] of used) {
    const variants = [];
    for (const [width, height, path] of family.variants) {
      if (failed.has(path)) continue;
      if (!(await exists(resolve(PUBLIC, `.${path}`)))) continue;
      variants.push([width, height, path]);
    }
    if (variants.length < 2) continue; // a lone width needs no srcset
    manifest[canonical] = { width: family.width, height: family.height, variants };
  }

  // Every path that may appear in content resolves to its family.
  const index = {};
  for (const [path, canonical] of alias) {
    if (manifest[canonical]) index[path] = canonical;
  }

  // Referenced by content but not servable — gone from the live server and not
  // in Images.zip either. Recorded so lib/images.js can render nothing at all
  // instead of a broken-image icon on the ~10 pages that reference them.
  const absent = [];
  for (const ref of refs) {
    if (!(await exists(resolve(PUBLIC, `.${ref}`)))) absent.push(ref);
  }
  absent.sort();

  const out = { builtAt: new Date().toISOString(), families: manifest, index, missing: absent };
  await writeFile(
    resolve(ROOT, 'data/image-sizes.json'),
    `${JSON.stringify(out, null, 2)}\n`,
    'utf8',
  );
  if (absent.length) console.log(`${absent.length} referenced images cannot be served — recorded as missing`);

  console.log(
    `Manifest: ${Object.keys(manifest).length} uploads with a usable srcset, ` +
      `${Object.keys(index).length} resolvable paths → data/image-sizes.json`,
  );
  if (failed.size) {
    console.log(`\n${failed.size} variants are gone from the live server and were left out.`);
  }
}

main().catch((err) => {
  console.error(`\nmirror-image-sizes failed: ${err.message}`);
  process.exit(1);
});
