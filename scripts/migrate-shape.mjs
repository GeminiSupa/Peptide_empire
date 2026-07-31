/**
 * Converge every page data file onto ONE shape:
 *
 *     sections: [ { type, content: { …fields, …_en/_es } } ]
 *
 * WHY
 *
 * The home page already used `{ type, content }` while the harvested pages used
 * a flatter `blocks: [{ type, …fields }]`. Two shapes means two section
 * builders in the CMS admin later, and two renderers now. One vocabulary of
 * named types, one renderer, one future admin screen.
 *
 * Each entry maps 1:1 onto a `site_cms_page_sections` row: `type` is the
 * section type, the array index is `sort_order`, and `content` is the JSON
 * payload. Nothing here needs redesigning to become database rows.
 *
 * IDEMPOTENT. Running twice is a no-op — a file already carrying `sections`
 * with nested `content` is skipped rather than double-nested. The harvest
 * scripts emit this shape directly, so this exists to convert data already on
 * disk without re-fetching 300 pages.
 *
 * Usage: node scripts/migrate-shape.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Block-shaped groups: `blocks: [{type, ...}]` → `sections: [{type, content}]`. */
const BLOCK_GROUPS = ['city', 'productLander', 'category', 'core', 'legal', 'wooProduct'];

const read = async (p) => JSON.parse(await readFile(resolve(ROOT, p), 'utf8'));
const write = async (p, data) =>
  writeFile(resolve(ROOT, p), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

/** `{type, a, b}` → `{type, content:{a, b}}`. */
function toSection(block) {
  const { type, ...rest } = block;
  return { type, content: rest };
}

async function migrateBlocks(group) {
  const file = `data/pages/${group}.json`;
  const data = await read(file);
  let converted = 0;

  for (const page of data.pages) {
    if (page.sections && !page.blocks) continue; // already migrated
    if (!page.blocks) continue;
    page.sections = page.blocks.map(toSection);
    delete page.blocks;
    converted += 1;
  }
  if (!converted) return `${group}: already converged`;
  await write(file, data);
  return `${group}: ${converted} pages → sections`;
}

/**
 * Guides are one self-contained HTML article, not a widget list. They become a
 * single `article` section so they live in the same vocabulary as everything
 * else rather than being a special case the renderer has to know about.
 */
async function migrateGuides() {
  const file = 'data/pages/guide.json';
  const data = await read(file);
  let converted = 0;

  for (const page of data.pages) {
    if (page.sections) continue;
    page.sections = [
      { type: 'article', content: { html_en: page.html_en, html_es: page.html_es } },
    ];
    delete page.html_en;
    delete page.html_es;
    converted += 1;
  }
  if (!converted) return 'guide: already converged';
  await write(file, data);
  return `guide: ${converted} pages → sections`;
}

/**
 * Category archives carry a heading and intro, then a product list resolved at
 * render time from the store harvest. The list stays dynamic — the section
 * stores only which category to list, never a frozen copy of the products.
 */
async function migrateCategories() {
  const file = 'data/pages/wooCategory.json';
  const data = await read(file);
  let converted = 0;

  for (const page of data.pages) {
    if (page.sections) continue;
    page.sections = [
      {
        type: 'category_header',
        content: {
          heading_en: page.heading_en,
          heading_es: page.heading_es,
          intro_en: page.intro_en,
          intro_es: page.intro_es,
        },
      },
      { type: 'product_grid_dynamic', content: { categorySlug: page.slug } },
    ];
    for (const key of ['heading_en', 'heading_es', 'intro_en', 'intro_es']) delete page[key];
    converted += 1;
  }
  if (!converted) return 'wooCategory: already converged';
  await write(file, data);
  return `wooCategory: ${converted} pages → sections`;
}

async function main() {
  const results = [];
  for (const group of BLOCK_GROUPS) results.push(await migrateBlocks(group));
  results.push(await migrateGuides());
  results.push(await migrateCategories());

  for (const line of results) console.log(`  ${line}`);

  // Report the unified vocabulary, so a new type cannot appear unnoticed.
  const types = new Map();
  for (const group of [...BLOCK_GROUPS, 'guide', 'wooCategory', 'home']) {
    const file = group === 'home' ? 'data/pages/home.json' : `data/pages/${group}.json`;
    const data = await read(file);
    const pages = data.pages ?? [data];
    for (const page of pages) {
      for (const section of page.sections ?? []) {
        types.set(section.type, (types.get(section.type) ?? 0) + 1);
      }
    }
  }
  console.log(`\nUnified vocabulary — ${types.size} section types:`);
  for (const [type, n] of [...types.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${type}`);
  }
}

main().catch((err) => {
  console.error(`\nmigrate-shape failed: ${err.message}`);
  process.exit(1);
});
