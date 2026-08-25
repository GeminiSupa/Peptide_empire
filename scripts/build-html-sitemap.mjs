/**
 * Build the /html-sitemap/ page body.
 *
 * WordPress generates that page from a plugin, so the REST API stores no
 * content for it and no harvest can produce one — it came out blank. We hold
 * the complete route inventory, so the index is built from our own data.
 *
 * Must run AFTER `node scripts/harvest-blocks.mjs legal`, because that rewrites
 * legal.json and would otherwise drop these sections. Idempotent: it replaces
 * the page body rather than appending to it.
 *
 * Usage: node scripts/build-html-sitemap.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'data/pages/legal.json');

/** Section order a visitor would expect, matching the live page's grouping. */
const GROUPS = [
  ['core', 'Main Pages', 'Páginas principales'],
  ['category', 'Shop By Category', 'Comprar por categoría'],
  ['productLander', 'Products', 'Productos'],
  ['wooCategory', 'Product Categories', 'Categorías de producto'],
  ['wooProduct', 'All Products', 'Todos los productos'],
  ['guide', 'Guides', 'Guías'],
  // The `guide` custom post type at /blog/guide/... — a different collection
  // from the long-form guides above, and the one /peptide-guides/ lists.
  ['mixingGuide', 'Mixing & Dosage Guides', 'Guías de mezcla y dosificación'],
  ['blogPost', 'Blog', 'Blog'],
  ['city', 'Service Locations', 'Zonas de servicio'],
  ['legal', 'Policies', 'Políticas'],
];

const data = JSON.parse(await readFile(FILE, 'utf8'));
const page = data.pages.find((p) => p.slug === 'html-sitemap');
if (!page) {
  console.error('html-sitemap page not found in legal.json');
  process.exit(1);
}

const sections = [
  { type: 'heading', content: { level: 1, text_en: 'HTML Sitemap', text_es: 'Mapa del sitio HTML' } },
];
for (const [source, en, es] of GROUPS) {
  sections.push({ type: 'heading', content: { level: 2, text_en: en, text_es: es } });
  // The list resolves from harvested data at render time — see
  // components/link-list.js — so publishing a page updates this index with no
  // edit here.
  sections.push({ type: 'link_list', content: { source } });
}

page.sections = sections;
await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`build-html-sitemap: ${sections.length} sections across ${GROUPS.length} groups`);
