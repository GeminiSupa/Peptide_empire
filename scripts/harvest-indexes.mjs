/**
 * Build the three LISTING pages: /blog/, /peptide-guides/ and /shop/.
 *
 * These could not come through the block harvester. On the live site their
 * bodies are Elementor loop-grid and WooCommerce archive widgets — the content
 * is generated from the post and product tables at request time, so
 * content.rendered holds a template, not a page. Harvesting one would have
 * frozen today's list into a file that silently goes stale.
 *
 * So only the wrapper is harvested — the page title, meta description and
 * heading, which do need to match the live site for SEO. The list itself is a
 * `link_list` section naming its SOURCE, and the renderer resolves that source
 * from the site's own harvested data at build time. Publish a new guide and the
 * index picks it up with no page edit.
 *
 * Usage: node scripts/harvest-indexes.mjs
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ORIGIN = 'https://peptidescostarica.net';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/pages/index.json');

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

/** Which harvested collection each index lists. */
const INDEXES = [
  { path: '/blog/', source: 'blogPost' },
  { path: '/peptide-guides/', source: 'guide' },
  { path: '/shop/', source: 'wooProduct' },
];

async function load(path, attempt = 1) {
  try {
    const res = await fetch(ORIGIN + path, {
      headers: { 'user-agent': 'peptidescostarica-rebuild-harvest' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return cheerio.load(await res.text());
  } catch (err) {
    if (attempt >= 4) throw new Error(`${path} -> ${err.message}`);
    await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
    return load(path, attempt + 1);
  }
}

const describe = ($) => ({
  title: clean($('title').first().text()),
  description: clean($('meta[name="description"]').attr('content')),
  heading: clean($('#content h1').first().text()) || clean($('h1').first().text()),
});

async function main() {
  const routeData = JSON.parse(await readFile(resolve(ROOT, 'data/routes.json'), 'utf8'));
  const routes = new Map(routeData.routes.map((r) => [r.en, r]));

  const pages = [];
  const failed = [];

  for (const { path, source } of INDEXES) {
    const route = routes.get(path);
    if (!route) {
      failed.push(`${path} — not in the route map`);
      continue;
    }
    try {
      const [$en, $es] = await Promise.all([load(route.en), load(route.es)]);
      const en = describe($en);
      const es = describe($es);

      const sections = [];
      if (en.heading || es.heading) {
        sections.push({
          type: 'heading',
          content: { level: 1, text_en: en.heading, text_es: es.heading || en.heading },
        });
      }
      sections.push({ type: 'link_list', content: { source } });

      pages.push({
        slug: path.replace(/^\/|\/$/g, ''),
        en: route.en,
        es: route.es,
        head: {
          title_en: en.title,
          title_es: es.title,
          description_en: en.description,
          description_es: es.description,
        },
        sections,
      });
    } catch (err) {
      failed.push(`${path} — ${err.message}`);
    }
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      { harvestedAt: new Date().toISOString(), group: 'index', count: pages.length, pages, failed },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Wrote ${pages.length}/${INDEXES.length} index pages → data/pages/index.json`);
  for (const p of pages) console.log(`  ${p.en} → lists ${p.sections.at(-1).content.source}`);
  if (failed.length) {
    console.log(`\n${failed.length} failed:`);
    for (const f of failed) console.log(`  ${f}`);
  }
}

main().catch((err) => {
  console.error(`\nharvest-indexes failed: ${err.message}`);
  process.exit(1);
});
