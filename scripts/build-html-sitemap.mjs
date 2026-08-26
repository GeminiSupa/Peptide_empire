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
let page = data.pages.find((p) => p.slug === 'html-sitemap');

/**
 * Create the page when it is absent, rather than failing.
 *
 * harvest-blocks SKIPs /html-sitemap/ — WordPress renders it from a plugin and
 * stores no content, so harvesting it produced a blank page that overwrote this
 * generated one. But skipping it also means a re-harvest of `legal` writes the
 * group WITHOUT it, silently dropping the site's full index from 4 pages to 3.
 * This script owns the page outright, so it can rebuild the whole entry.
 */
if (!page) {
  const routeData = JSON.parse(await readFile(resolve(ROOT, 'data/routes.json'), 'utf8'));
  const route = routeData.routes.find((r) => r.en === '/html-sitemap/');
  if (!route) {
    console.error('/html-sitemap/ is not in data/routes.json');
    process.exit(1);
  }
  page = {
    slug: 'html-sitemap',
    en: route.en,
    es: route.es,
    head: {
      title_en: 'HTML Sitemap | Peptides Costa Rica',
      title_es: 'Mapa del sitio HTML | Peptides Costa Rica',
      description_en: 'Every page on Peptides Costa Rica, listed by section.',
      description_es: 'Todas las páginas de Peptides Costa Rica, por sección.',
    },
    sections: [],
  };
  data.pages.push(page);
  console.log('build-html-sitemap: html-sitemap page was missing — recreated');
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
