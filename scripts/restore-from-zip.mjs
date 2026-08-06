/**
 * Recover assets that are GONE from the live WordPress server, using the
 * originals supplied by the .net site's developer in Images.zip.
 *
 * WHY THIS EXISTS
 *
 * scripts/mirror-assets.mjs downloads what the live site still serves. Twelve
 * referenced files 404 there — they are referenced by category, city, product
 * lander and core pages, so without them those pages render broken images. The
 * live site has the same broken images; the zip is the only surviving source.
 *
 * MATCHING
 *
 * Exact filenames almost never match, because WordPress renames on collision
 * (`peptides-23.png` -> `peptides-23-1.png`) and serves a different container
 * than the source it was built from (`…743.png` for a `…743.webp` original). So
 * a name match is tried first, then a normalised stem.
 *
 * A recovered file keeps the ZIP's real extension rather than being written
 * under the referenced one — a WebP served as `.png` gets `Content-Type:
 * image/png` from Vercel and only renders because browsers sniff. The content
 * references in data/pages are rewritten to the extension actually written.
 *
 * RE-RUN AFTER HARVESTING. A harvest rewrites data/pages from the live site and
 * restores the dead references; this script is idempotent, so running it again
 * re-applies the rewrites.
 *
 * Usage:
 *   node scripts/restore-from-zip.mjs
 *   node scripts/restore-from-zip.mjs --dry
 */

import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { resolve, dirname, basename, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');
const ZIP = resolve(ROOT, 'Images.zip');
const DRY = process.argv.includes('--dry');

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * Normalised stem: extension and WordPress size suffix removed — and NOTHING
 * else.
 *
 * The re-upload counter is deliberately KEPT. Stripping it looked like it
 * recovered an extra file, but `peptides-11-1` and `peptides-11-2` are two
 * different uploads in different months, and the site references both; the zip
 * only has `-1`, which is already mirrored. Matching on the stripped stem would
 * have silently published one image in place of another. A missing image is a
 * visible gap; a wrong image is a lie, so only format differences are bridged.
 */
const stem = (f) =>
  basename(f)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-\d+x\d+$/, '')
    .toLowerCase();

/** Content files whose references may be rewritten. Never data/wp — that is the raw harvest. */
async function contentFiles() {
  const dir = resolve(ROOT, 'data/pages');
  const out = [];
  for (const name of await readdir(dir)) {
    if (name.endsWith('.json')) out.push(resolve(dir, name));
  }
  out.push(resolve(ROOT, 'data/global.json'));
  return out;
}

/**
 * Paths EMBEDDED IN a string count too — guides and blog posts store their
 * whole article as one HTML blob, so their images are inside `<img>` markup
 * rather than in fields of their own. See scripts/mirror-assets.mjs.
 */
const EMBEDDED = /(?:https?:\/\/[^"'\s)]*)?(\/wp-content\/uploads\/[^"'\s)\\]+)/g;

async function references() {
  const refs = new Set();
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === 'object') return Object.values(n).forEach(walk);
    if (typeof n !== 'string') return;
    for (const m of n.matchAll(EMBEDDED)) refs.add(m[1].replace(/&amp;/g, '&'));
  };
  for (const file of await contentFiles()) walk(JSON.parse(await readFile(file, 'utf8')));
  return [...refs];
}

function zipEntries() {
  return execFileSync(
    'python',
    ['-c', "import zipfile;print('\\n'.join(n for n in zipfile.ZipFile('Images.zip').namelist() if not n.endswith('/')))"],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1e8 },
  )
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function extract(entry, dest) {
  execFileSync(
    'python',
    [
      '-c',
      'import zipfile,sys,os,shutil\n' +
        'z=zipfile.ZipFile(sys.argv[1])\n' +
        'os.makedirs(os.path.dirname(sys.argv[3]),exist_ok=True)\n' +
        'with z.open(sys.argv[2]) as s, open(sys.argv[3],"wb") as d: shutil.copyfileobj(s,d)',
      ZIP,
      entry,
      dest,
    ],
    { cwd: ROOT },
  );
}

async function main() {
  if (!(await exists(ZIP))) throw new Error('Images.zip not found in the project root');

  const entries = zipEntries();
  const byName = new Map();
  const byStem = new Map();
  for (const e of entries) {
    const n = basename(e);
    if (!byName.has(n)) byName.set(n, e);
    const s = stem(e);
    if (!byStem.has(s)) byStem.set(s, e);
  }

  const refs = await references();
  const missing = [];
  for (const ref of refs) {
    if (!(await exists(resolve(PUBLIC, `.${ref}`)))) missing.push(ref);
  }

  console.log(`${refs.length} referenced assets · ${missing.length} missing · zip holds ${entries.length}\n`);

  const rewrites = new Map(); // old /wp-content path -> new /wp-content path
  const recovered = [];
  const unresolved = [];

  for (const ref of missing) {
    const entry = byName.get(basename(ref)) ?? byStem.get(stem(ref));
    if (!entry) {
      unresolved.push(ref);
      continue;
    }

    const ext = basename(entry).split('.').pop().toLowerCase();
    const newName = `${basename(ref).replace(/\.[a-z0-9]+$/i, '')}.${ext}`;
    const newRef = posix.join(posix.dirname(ref), newName);
    const dest = resolve(PUBLIC, `.${newRef}`);

    if (!DRY) {
      await mkdir(dirname(dest), { recursive: true });
      extract(entry, dest);
    }
    recovered.push([ref, newRef, entry]);
    if (newRef !== ref) rewrites.set(ref, newRef);
  }

  console.log('=== recovered from the zip ===');
  for (const [ref, newRef, entry] of recovered) {
    console.log(`  ${basename(ref)}`);
    console.log(`     from ${entry}`);
    if (newRef !== ref) console.log(`     ref  -> ${basename(newRef)}`);
  }
  if (!recovered.length) console.log('  (none)');

  if (rewrites.size && !DRY) {
    let touched = 0;
    for (const file of await contentFiles()) {
      let body = await readFile(file, 'utf8');
      const before = body;
      for (const [oldRef, newRef] of rewrites) body = body.split(oldRef).join(newRef);
      if (body !== before) {
        await writeFile(file, body, 'utf8');
        touched += 1;
      }
    }
    console.log(`\nRewrote ${rewrites.size} reference(s) across ${touched} content file(s).`);
  }

  console.log(`\n=== still missing: ${unresolved.length} ===`);
  for (const r of unresolved) console.log(`  ${basename(r)}`);
  if (unresolved.length) {
    console.log('\nThese 404 on the live server AND are absent from the zip.');
    console.log('lib/images.js drops any image it cannot serve, so they render as nothing');
    console.log('rather than as a broken image. Ask the developer for these specifically.');
  }
}

main().catch((err) => {
  console.error(`\nrestore-from-zip failed: ${err.message}`);
  process.exit(1);
});
