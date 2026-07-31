/**
 * Download the live site's images into public/ so the rebuild stops hotlinking
 * production.
 *
 * Path scheme: files keep their live path exactly, so an image referenced in
 * content as `/wp-content/uploads/2026/01/hero.webp` is served either from the
 * live site or from `public/wp-content/uploads/2026/01/hero.webp` depending on
 * NEXT_PUBLIC_IMAGE_BASE — with no content file edited. See lib/images.js.
 *
 * WordPress generates many resized copies of each upload
 * (`hero-300x200.webp`). Those are derivatives, not assets: we resolve each
 * reference back to its ORIGINAL and download that once, letting next/image do
 * the resizing. On the pages sampled that collapsed 505 references into 69
 * real files.
 *
 * Usage:
 *   node scripts/download-images.mjs                 # core pages
 *   node scripts/download-images.mjs core category   # named groups
 *   node scripts/download-images.mjs --all           # every page (slow)
 */

import { writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import routeData from '../data/routes.json' with { type: 'json' };

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

const UPLOAD_RE =
  /https:\/\/peptidescostarica\.net(\/wp-content\/uploads\/[^"'\s)\\]+?\.(?:jpg|jpeg|png|webp|gif|svg|avif))/gi;

/** `hero-300x200.webp` → `hero.webp`. WP size variants are derivatives. */
const toOriginal = (path) => path.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '');

/**
 * Images the live site references at a path that 404s, where the real file is
 * still in the Media Library under a DOUBLE extension — uploaded as
 * `IGF-1mg.jpg.jpeg`, referenced as `IGF-1mg.jpg`.
 *
 * These are broken for real visitors on the live site right now. Found by
 * searching /wp-json/wp/v2/media (2026-07-31); each was byte-verified, so this
 * is recovery, not guesswork. The file is still written to the REFERENCED path,
 * matching how resized fallbacks are handled — content keeps one stable name.
 *
 * Note two of them are not really JPEGs: the `.jpg.webp` pair are RIFF/WebP.
 * They are saved under the referenced `.jpg` name regardless; browsers sniff
 * content type, and renaming would mean editing every reference.
 */
const RECOVERED = {
  '/wp-content/uploads/2026/04/IGF-1mg.jpg': ['/wp-content/uploads/2026/04/IGF-1mg.jpg.jpeg'],
  '/wp-content/uploads/2026/06/Retatrutide-25mg-1.jpg': [
    '/wp-content/uploads/2026/06/Retatrutide-25mg-1.jpg.jpeg',
  ],
  '/wp-content/uploads/2026/06/Tirzepatide-40mg.jpg': [
    '/wp-content/uploads/2026/06/Tirzepatide-40mg.jpg.webp',
  ],
  '/wp-content/uploads/2026/07/DSIP-10-mg.jpg': [
    '/wp-content/uploads/2026/07/DSIP-10-mg.jpg.jpeg',
  ],
  '/wp-content/uploads/2026/07/Tesa.jpg': ['/wp-content/uploads/2026/07/Tesa.jpg.jpeg'],
  '/wp-content/uploads/2026/07/tez.jpg': ['/wp-content/uploads/2026/07/tez.jpg.jpeg'],

  // Same file, re-saved in another format or month. The stem is unchanged (and
  // for the first, a UUID), so these are the same image beyond doubt.
  '/wp-content/uploads/2026/02/b7542b1d-3c42-49b5-916c-a9b713f3e743.png': [
    '/wp-content/uploads/2026/07/b7542b1d-3c42-49b5-916c-a9b713f3e743.webp',
  ],
  '/wp-content/uploads/2026/04/Untitled-design-5-1.png': [
    '/wp-content/uploads/2026/07/Untitled-design-5-1.webp',
  ],
  '/wp-content/uploads/2026/07/finding-focus-city-of-flowers-heredia-spanish.webp': [
    '/wp-content/uploads/2026/07/finding-focus-city-of-flowers-heredia-spanish.webp.webp',
  ],

  // NOT mapped, deliberately. The Media Library holds a near-miss for each of
  // these, but WordPress's -1/-2 suffix marks a SEPARATE upload, not a variant
  // of the same picture — peptides-11-1 is not peptides-11-2. Guessing here
  // would put a plausible-looking wrong image on a live page, which is worse
  // than a visible gap. Needs the client to confirm:
  //   /2026/03/peptides-11-2.webp              ~ peptides-11-1.png
  //   /2026/04/3-13-1.png                      ~ 3-13-1-2.webp
  //   /2026/03/Banner-Imagesz-1-e1774523007418.png
  //                                            ~ …-removebg-preview-….png
};

const args = process.argv.slice(2);
const groups = args.filter((a) => !a.startsWith('--'));
const wantAll = args.includes('--all');

const pages = wantAll
  ? routeData.routes
  : routeData.routes.filter((r) => (groups.length ? groups : ['core']).includes(r.group));

if (pages.length === 0) {
  console.error(
    `No pages matched. Known groups: ${[...new Set(routeData.routes.map((r) => r.group))].join(', ')}`
  );
  process.exit(1);
}

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

/** Small worker pool — the live site serialises heavy requests. */
async function pool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  console.log(`Scanning ${pages.length} page(s) for images…`);

  // original path → the resized variants actually referenced on the site.
  // Some uploads only exist as variants (the original was cleaned up), so the
  // variants are the fallback when the original 404s.
  const referenced = new Map();
  let scanned = 0;

  await pool(pages, 4, async (route) => {
    for (const path of [route.en, route.es].filter(Boolean)) {
      try {
        const res = await fetch(ORIGIN + path, {
          headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
        });
        if (!res.ok) continue;
        const html = await res.text();
        for (const m of html.matchAll(UPLOAD_RE)) {
          const actual = m[1];
          const original = toOriginal(actual);
          if (!referenced.has(original)) referenced.set(original, new Set());
          if (actual !== original) referenced.get(original).add(actual);
        }
      } catch {
        /* a single unreachable page shouldn't abort the run */
      }
    }
    scanned += 1;
    if (scanned % 10 === 0) console.log(`  …${scanned}/${pages.length} pages`);
  });

  const list = [...referenced.keys()].sort();
  console.log(`\nFound ${list.length} unique original images.`);

  /** Widest variant first — closest thing to the original we can still get. */
  const variantsByWidth = (original) =>
    [...(referenced.get(original) ?? [])].sort((a, b) => {
      const w = (s) => Number(s.match(/-(\d+)x\d+(?=\.[a-z0-9]+$)/i)?.[1] ?? 0);
      return w(b) - w(a);
    });

  let downloaded = 0;
  let skipped = 0;
  let bytes = 0;
  const failed = [];
  const fellBack = [];

  await pool(list, 6, async (path) => {
    const dest = resolve(PUBLIC, `.${path}`);
    if (await exists(dest)) {
      skipped += 1;
      return;
    }
    // Try the original, then progressively smaller variants. Whatever lands is
    // written to the ORIGINAL path, so content files reference one stable name
    // regardless of which copy survived on the server.
    const candidates = [path, ...(RECOVERED[path] ?? []), ...variantsByWidth(path)];
    for (const candidate of candidates) {
      try {
        const res = await fetch(ORIGIN + candidate, {
          headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        downloaded += 1;
        bytes += buf.length;
        if (candidate !== path) fellBack.push(`${path} ← ${candidate.split('/').pop()}`);
        return;
      } catch {
        /* try the next candidate */
      }
    }
    failed.push(path);
  });

  console.log(
    `\nDownloaded ${downloaded} · already had ${skipped} · ${(bytes / 1024 / 1024).toFixed(1)} MB`
  );
  if (fellBack.length) {
    console.log(`\n${fellBack.length} saved from a resized copy (original gone from the server):`);
    for (const f of fellBack) console.log(`  ${f}`);
  }
  if (failed.length) {
    console.log(`\n${failed.length} could not be fetched in any size:`);
    for (const f of failed) console.log(`  ${f}`);
  }
  console.log(`\nServe locally by setting NEXT_PUBLIC_IMAGE_BASE= (empty) in .env.local`);
}

main().catch((err) => {
  console.error(`\nDownload failed: ${err.message}`);
  process.exitCode = 1;
});
