/**
 * Snapshot launch-critical metadata and JSON-LD from the live WordPress site.
 *
 * The output is consumed by the custom site so titles, descriptions, social
 * cards and structured data survive the migration. English pages also provide
 * the authoritative es-CR hreflang, replacing the fragile positional pairing
 * that WordPress's HTML sitemap used in the early rebuild.
 *
 * Progress is checkpointed in .qa-cache so a slow or rate-limited WordPress
 * request can be resumed safely.
 *
 * Usage:
 *   node scripts/harvest-seo.mjs
 *   node scripts/harvest-seo.mjs --concurrency 3
 *   node scripts/harvest-seo.mjs --fresh
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import routeData from '../data/routes.json' with { type: 'json' };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://peptidescostarica.net';
const OUT = resolve(ROOT, 'data/seo.json');
const CHECKPOINT = resolve(ROOT, '.qa-cache/seo-progress.json');
const args = process.argv.slice(2);
const arg = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};
const CONCURRENCY = Math.max(1, Number(arg('concurrency')) || 3);
const LIMIT = Math.max(0, Number(arg('limit')) || 0);

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const toPath = (url) => {
  if (!url) return null;
  const parsed = new URL(url, ORIGIN);
  if (parsed.origin !== ORIGIN) return null;
  return parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
};

async function fetchHtml(path) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(ORIGIN + path, {
        headers: { 'user-agent': 'peptidescostarica-rebuild-seo-harvest' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 1_500);
    }
  }
  throw new Error(`${path}: ${lastError?.message || 'request failed'}`);
}

function pairs($, selector, keyAttr, valueAttr = 'content') {
  return Object.fromEntries(
    $(selector)
      .toArray()
      .map((element) => [$(element).attr(keyAttr), $(element).attr(valueAttr)])
      .filter(([key, value]) => key && value),
  );
}

function extract(html) {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => {
      try {
        return JSON.parse($(element).html());
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return {
    title: $('head > title').first().text().replace(/\s+/g, ' ').trim(),
    description: $('meta[name="description"]').attr('content') || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    hreflang: pairs($, 'link[rel="alternate"][hreflang]', 'hreflang', 'href'),
    openGraph: pairs($, 'meta[property^="og:"]', 'property'),
    twitter: pairs($, 'meta[name^="twitter:"]', 'name'),
    schemas,
  };
}

async function pool(items, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }),
  );
}

await mkdir(dirname(CHECKPOINT), { recursive: true });
let checkpoint = { pages: {}, failures: {} };
if (!args.includes('--fresh') && existsSync(CHECKPOINT)) {
  checkpoint = JSON.parse(await readFile(CHECKPOINT, 'utf8'));
}

const routes = routeData.routes.filter((route) => route.group !== 'excludeCandidate');
const english = (LIMIT ? routes.slice(0, LIMIT) : routes).map((route) => route.en);
let completed = Object.keys(checkpoint.pages).length;

async function saveCheckpoint() {
  await writeFile(CHECKPOINT, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
}

console.log(`Harvesting ${english.length} English pages with concurrency ${CONCURRENCY}…`);
await pool(english, async (path) => {
  if (checkpoint.pages[path]) return;
  try {
    checkpoint.pages[path] = extract(await fetchHtml(path));
    delete checkpoint.failures[path];
  } catch (error) {
    checkpoint.failures[path] = error.message;
  }
  completed += 1;
  if (completed % 20 === 0) {
    await saveCheckpoint();
    console.log(`  …${completed}/${english.length} English pages`);
  }
});
await saveCheckpoint();

const spanish = [...new Set(
  english
    .map((path) => toPath(checkpoint.pages[path]?.hreflang?.['es-CR']))
    .filter(Boolean),
)];
let spanishDone = spanish.filter((path) => checkpoint.pages[path]).length;
console.log(`Harvesting ${spanish.length} Spanish pages…`);
await pool(spanish, async (path) => {
  if (checkpoint.pages[path]) return;
  try {
    checkpoint.pages[path] = extract(await fetchHtml(path));
    delete checkpoint.failures[path];
  } catch (error) {
    checkpoint.failures[path] = error.message;
  }
  spanishDone += 1;
  if (spanishDone % 20 === 0) {
    await saveCheckpoint();
    console.log(`  …${spanishDone}/${spanish.length} Spanish pages`);
  }
});
await saveCheckpoint();

if (Object.keys(checkpoint.failures).length) {
  console.error('\nFailed URLs:');
  for (const [path, message] of Object.entries(checkpoint.failures)) console.error(`  ${path}: ${message}`);
  process.exit(1);
}

if (LIMIT) {
  console.log(`\nSample harvest complete: ${Object.keys(checkpoint.pages).length} record(s) checkpointed.`);
  process.exit(0);
}

const updatedRoutes = routeData.routes.map((route) => {
  if (route.group === 'excludeCandidate') return route;
  const es = toPath(checkpoint.pages[route.en]?.hreflang?.['es-CR']);
  return { ...route, es };
});
const duplicates = new Map();
for (const route of updatedRoutes) {
  if (!route.es) continue;
  if (!duplicates.has(route.es)) duplicates.set(route.es, []);
  duplicates.get(route.es).push(route.en);
}
const collisions = [...duplicates].filter(([, values]) => values.length > 1);
if (collisions.length) {
  console.log(`\nWarning: ${collisions.length} live es-CR hreflang collision(s):`);
  for (const [es, en] of collisions) console.log(`  ${es} <- ${en.join(', ')}`);
}

const counts = {};
for (const route of updatedRoutes) counts[route.group] = (counts[route.group] || 0) + 1;
const nextRoutes = {
  ...routeData,
  harvestedAt: new Date().toISOString(),
  counts: {
    ...counts,
    totalEn: updatedRoutes.length,
    totalEs: updatedRoutes.filter((route) => route.es).length,
  },
  missingEs: updatedRoutes.filter((route) => !route.es).map((route) => route.en),
  routes: updatedRoutes,
};

await writeFile(OUT, `${JSON.stringify({ harvestedAt: new Date().toISOString(), origin: ORIGIN, pages: checkpoint.pages }, null, 2)}\n`, 'utf8');
await writeFile(resolve(ROOT, 'data/routes.json'), `${JSON.stringify(nextRoutes, null, 2)}\n`, 'utf8');

console.log(`\nWrote ${Object.keys(checkpoint.pages).length} SEO records to ${OUT}`);
console.log(`Updated ${updatedRoutes.filter((route) => route.es).length} authoritative Spanish route pair(s).`);
