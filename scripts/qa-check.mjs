/**
 * Whole-site QA sweep against a running build.
 *
 * Crawls every route in data/routes.json and reports the defects a clone
 * actually suffers from: pages that error, blank pages, images that 404, links
 * that go nowhere, missing headings, and leftover placeholder text.
 *
 * Checking by crawl rather than by eye is the point — 632 pages cannot be
 * spot-checked, and the bug that matters is the one on page 400.
 *
 * Text is extracted with cheerio, NOT by stripping tags with a regex. HTML
 * escaping is correct output — React writes `don&#x27;t` for "don't" — so a
 * regex-stripped check reports every apostrophe on the site as corruption.
 * cheerio decodes entities, so what it returns is what the visitor reads.
 *
 * Usage:
 *   npm start                     # in another shell
 *   node scripts/qa-check.mjs
 *   node scripts/qa-check.mjs --group city --limit 20
 */

import { access } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import routeData from '../data/routes.json' with { type: 'json' };

const BASE = process.env.QA_BASE || 'http://localhost:3000';
const CONCURRENCY = Math.max(1, Number(process.env.QA_CONCURRENCY) || 12);
const FETCH_TIMEOUT_MS = Math.max(1_000, Number(process.env.QA_FETCH_TIMEOUT_MS) || 30_000);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const groupFilter = arg('group');
const limit = Number(arg('limit')) || Infinity;

const SKIP_GROUPS = new Set(['excludeCandidate']);

/**
 * Deliberately not generated. `pt-141-10mgtest` is a test product left live in
 * WooCommerce; the build stopped emitting a page for it on purpose.
 */
const INTENTIONALLY_ABSENT = new Set([
  '/product/pt-141-10mgtest/',
  '/es/producto-2/pt-141-10mgprueba/',
]);

let routes = routeData.routes.filter((r) => !SKIP_GROUPS.has(r.group));
if (groupFilter) routes = routes.filter((r) => r.group === groupFilter);

const targets = [];
for (const r of routes) {
  if (!INTENTIONALLY_ABSENT.has(r.en)) targets.push({ path: r.en, group: r.group, lang: 'en' });
  if (r.es && !INTENTIONALLY_ABSENT.has(r.es)) targets.push({ path: r.es, group: r.group, lang: 'es' });
}
const list = targets.slice(0, limit);

const knownPaths = new Set();
for (const r of routeData.routes) {
  knownPaths.add(r.en);
  if (r.es) knownPaths.add(r.es);
}

const issues = [];
const add = (path, kind, detail) => issues.push({ path, kind, detail });

const assetCache = new Map();
async function assetExists(src) {
  const key = decodeURIComponent(src.split('?')[0].split('#')[0]);
  if (assetCache.has(key)) return assetCache.get(key);
  let ok = false;
  try {
    await access(resolve(PUBLIC, `.${key}`));
    ok = true;
  } catch {
    ok = false;
  }
  assetCache.set(key, ok);
  return ok;
}

// Word-boundaried: "todo" is an ordinary Spanish word and "nan" appears inside
// plenty of real ones, so the loose forms flagged 360 healthy pages.
const PLACEHOLDER_RE =
  /(lorem ipsum|PLACEHOLDER CONTENT|CONTENIDO PENDIENTE|Site rebuild in progress|\bTODO:|\bFIXME\b|\bundefined\b|\[object Object\]|\bNaN\b)/;

async function checkPage(target) {
  let res;
  try {
    res = await fetch(BASE + target.path, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    add(target.path, 'FETCH_FAILED', err.message);
    return;
  }

  if (res.status >= 300 && res.status < 400) {
    add(target.path, 'REDIRECT', `${res.status} → ${res.headers.get('location')}`);
    return;
  }
  if (res.status !== 200) {
    add(target.path, 'HTTP_ERROR', `status ${res.status}`);
    return;
  }

  const $ = cheerio.load(await res.text());
  $('script, style, noscript').remove();

  // --- structure -------------------------------------------------------
  const h1s = $('h1')
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, ' ').trim());
  if (h1s.length === 0) add(target.path, 'NO_H1', 'page has no <h1>');
  if (h1s.length > 1) add(target.path, 'MULTIPLE_H1', `${h1s.length} on the page`);
  if (h1s.some((h) => !h)) add(target.path, 'EMPTY_H1', 'an <h1> rendered empty');

  const bodyText = $('main').text().replace(/\s+/g, ' ').trim();
  if (bodyText.length === 0) add(target.path, 'BLANK_PAGE', '<main> renders nothing');
  else if (bodyText.length < 200) add(target.path, 'THIN_CONTENT', `${bodyText.length} chars`);

  const ph = bodyText.match(PLACEHOLDER_RE);
  if (ph) add(target.path, 'PLACEHOLDER', `"${ph[0]}"`);

  if (/Ã©|Ã¡|Ã­|Ã³|Ãº|Ã±|Â¿|Â¡/.test(bodyText)) {
    add(target.path, 'MOJIBAKE', 'double-encoded UTF-8 in visible text');
  }

  // --- images ----------------------------------------------------------
  for (const el of $('img').toArray()) {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) continue;
    if (!$(el).attr('alt') && $(el).attr('alt') !== '') {
      add(target.path, 'IMG_NO_ALT', src.slice(0, 80));
    }
    if (src.startsWith('/_next/image')) {
      const inner = decodeURIComponent(new URL(BASE + src).searchParams.get('url') || '');
      if (inner.startsWith('/') && !(await assetExists(inner))) add(target.path, 'IMG_MISSING', inner);
    } else if (src.startsWith('/')) {
      if (!(await assetExists(src))) add(target.path, 'IMG_MISSING', src);
    } else if (/^https?:/i.test(src) && !src.includes('localhost')) {
      add(target.path, 'IMG_REMOTE', src);
    }
  }

  // --- links -----------------------------------------------------------
  for (const el of $('a').toArray()) {
    const href = $(el).attr('href');
    if (!href || !href.startsWith('/')) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean || clean === '/' || clean.startsWith('/_next')) continue;

    // A link to a file (a COA PDF, an image) is an asset, not a route.
    if (extname(clean)) {
      if (!(await assetExists(clean))) add(target.path, 'ASSET_MISSING', clean);
      continue;
    }

    const withSlash = clean.endsWith('/') ? clean : `${clean}/`;
    if (!knownPaths.has(withSlash)) add(target.path, 'DEAD_LINK', href);
    else if (INTENTIONALLY_ABSENT.has(withSlash)) add(target.path, 'LINK_TO_404', href);
  }

  if (/vercel\.app/.test($.html())) add(target.path, 'VERCEL_URL', 'vercel.app in shipped HTML');
}

async function pool(items, size, worker) {
  const queue = [...items];
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) {
        await worker(queue.shift());
        done += 1;
        if (done % 100 === 0) process.stdout.write(`  …${done}/${items.length}\n`);
      }
    })
  );
}

console.log(`Checking ${list.length} pages against ${BASE}…`);
await pool(list, CONCURRENCY, checkPage);

const byKind = new Map();
for (const i of issues) {
  if (!byKind.has(i.kind)) byKind.set(i.kind, []);
  byKind.get(i.kind).push(i);
}

console.log(`\n${'='.repeat(64)}`);
console.log(`${list.length} pages checked · ${issues.length} issues · ${byKind.size} kinds`);
console.log('='.repeat(64));

for (const [kind, items] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${kind}  (${items.length})`);
  const uniq = new Map();
  for (const i of items) {
    if (!uniq.has(i.detail)) uniq.set(i.detail, []);
    uniq.get(i.detail).push(i.path);
  }
  for (const [detail, paths] of [...uniq.entries()].slice(0, 10)) {
    console.log(`  ${detail}  —  ${paths.length} page(s), e.g. ${paths.slice(0, 2).join(', ')}`);
  }
  if (uniq.size > 10) console.log(`  …and ${uniq.size - 10} more distinct`);
}

if (issues.length === 0) console.log('\nNo issues found.');
process.exitCode = issues.length ? 1 : 0;
