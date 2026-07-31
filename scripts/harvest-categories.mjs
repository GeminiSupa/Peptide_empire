/**
 * Harvest the 15 WooCommerce category archives into data/pages/wooCategory.json.
 *
 * These are LISTING pages, not content pages. The products they list come from
 * data/wp/store-products.json at render time, so nothing about the listing is
 * frozen into this file — add a product to a category in WordPress, re-run the
 * store harvest, and the archive updates without touching this one.
 *
 * What is harvested here is only what a listing cannot derive: the category's
 * own name and description, in both languages, plus the page title and meta
 * description as the live site serves them.
 *
 * Spanish comes from the rendered /es/ archive. Category names are short, so
 * they are read from the page's own <title> and heading rather than paired
 * node-by-node — there is no long-form copy here to misalign.
 *
 * Usage: node scripts/harvest-categories.mjs
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/pages/wooCategory.json');

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

async function load(path, attempt = 1) {
  try {
    const res = await fetch(ORIGIN + path, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return cheerio.load(await res.text());
  } catch (err) {
    if (attempt >= 4) throw new Error(`${path} -> ${err.message} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return load(path, attempt + 1);
  }
}

/** Title, meta description and the archive's own heading and intro. */
function describe($) {
  const heading = clean($('#content h1').first().text()) || clean($('h1').first().text());
  const intro = clean($('.term-description, .woocommerce-product-category-description').first().text());
  return {
    title: clean($('title').first().text()),
    description: clean($('meta[name="description"]').attr('content')),
    heading,
    intro,
  };
}

async function pool(items, size, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }),
  );
}

async function main() {
  const routeData = JSON.parse(await readFile(resolve(ROOT, 'data/routes.json'), 'utf8'));
  const store = JSON.parse(await readFile(resolve(ROOT, 'data/wp/store-products.json'), 'utf8'));

  const routes = routeData.routes.filter((r) => r.group === 'wooCategory');

  // Name and product count per category, from the products already harvested.
  const meta = new Map();
  for (const product of store.products) {
    for (const c of product.categories ?? []) {
      if (!meta.has(c.slug)) meta.set(c.slug, { name: c.name, count: 0 });
      meta.get(c.slug).count += 1;
    }
  }

  const pages = [];
  const failed = [];

  await pool(routes, 5, async (route) => {
    const slug = route.en.replace(/^\/product-category\//, '').replace(/\/$/, '');
    try {
      const [$en, $es] = await Promise.all([load(route.en), load(route.es)]);
      const en = describe($en);
      const es = describe($es);
      const info = meta.get(slug);

      pages.push({
        slug,
        en: route.en,
        es: route.es,
        productCount: info?.count ?? 0,
        head: {
          title_en: en.title,
          title_es: es.title,
          description_en: en.description,
          description_es: es.description,
        },
        heading_en: en.heading || info?.name || slug,
        heading_es: es.heading || en.heading || slug,
        intro_en: en.intro,
        intro_es: es.intro,
      });
    } catch (err) {
      failed.push({ ...route, reason: err.message });
    }
  });

  pages.sort((a, b) => a.slug.localeCompare(b.slug));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group: 'wooCategory', count: pages.length, pages, failed },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const empty = pages.filter((p) => !p.productCount);
  console.log(`Wrote ${pages.length}/${routes.length} category archives → data/pages/wooCategory.json`);
  console.log(`  ${pages.reduce((n, p) => n + p.productCount, 0)} product placements across them`);
  if (empty.length) console.log(`  ${empty.length} list no products: ${empty.map((p) => p.slug).join(', ')}`);
  if (failed.length) {
    console.log(`\n${failed.length} failed:`);
    for (const f of failed) console.log(`  ${f.en} — ${f.reason}`);
  }
}

main().catch((err) => {
  console.error(`\nharvest-categories failed: ${err.message}`);
  process.exit(1);
});
