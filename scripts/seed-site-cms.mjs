/** Import the harvested website into the catalog's dedicated CMS table.
 *
 * Dry run: node scripts/seed-site-cms.mjs
 * Write:   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-site-cms.mjs --write
 * Existing draft and published rows are never overwritten.
 */
import { readFile } from 'node:fs/promises';

const sources = [
  ['homeBlocks', 'blocks'], ['city', 'blocks'], ['productLander', 'blocks'],
  ['category', 'blocks'], ['core', 'blocks'], ['legal', 'blocks'],
  ['guide', 'article'], ['guideBlocks', 'blocks'], ['index', 'blocks'],
  ['blogPost', 'blocks'], ['mixingGuide', 'blocks'], ['wooProduct', 'blocks'],
  ['wooCategory', 'blocks'],
];

const pages = new Map();
function withoutHarvestedCommerce(node) {
  if (Array.isArray(node)) return node.map(withoutHarvestedCommerce).filter((item) => item !== null);
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'heading' && /^₡\s*[\d,.]+$/.test(node.content?.text_en || '')) return null;
  if (/^(?:FREE Shipping Over|Envío GRATIS a partir de)\s*₡/i.test(node.text_en || node.text_es || '')) return null;
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, withoutHarvestedCommerce(value)]));
}
function completeRegistryPage(entry) {
  if (entry.group === 'wooProduct') entry.sections = withoutHarvestedCommerce(entry.sections);
  if (entry.en === '/peptide-specification-sheets/' && !entry.sections?.length) {
    entry.sections = [
      { type: 'heading', content: { level: 1, text_en: 'Peptide Specification Sheets', text_es: 'Hojas de Especificación de Péptidos' } },
      { type: 'paragraph', content: { text_en: 'Technical specifications, analytical details, storage information, and downloadable documents for our research compounds.', text_es: 'Especificaciones técnicas, detalles analíticos, información de almacenamiento y documentos descargables para nuestros compuestos de investigación.' } },
      { type: 'link_list', content: { source: 'specificationSheet' } },
    ];
  }
  if (entry.en === '/extra/') {
    entry.sections = [{ type: 'heading', content: { level: 1, text_en: 'Why Choose Peptides Costa Rica', text_es: 'Por qué elegir Péptidos Costa Rica' } }, ...(entry.sections ?? [])];
  }
  if (entry.en === '/extra-affliate-page/') {
    entry.sections = [
      { type: 'heading', content: { level: 1, text_en: 'Peptides Costa Rica Affiliate Application', text_es: 'Solicitud de Afiliación de Péptidos Costa Rica' } },
      ...(entry.sections ?? []),
      { type: 'paragraph', content: { text_en: 'Prospective affiliates can use this page to learn how to apply. Our team reviews each request for fit, provides clear program information, and contacts qualified applicants directly with the next steps.', text_es: 'Los posibles afiliados pueden usar esta página para conocer cómo postularse. Nuestro equipo revisa cada solicitud, brinda información clara del programa y contacta directamente a los candidatos calificados con los siguientes pasos.' } },
    ];
  }
  if (entry.en === '/extra-home/') {
    entry.head = { ...entry.head, title_en: 'Peptide Product Directory | Peptides Costa Rica', title_es: 'Directorio de Productos Peptídicos | Péptidos Costa Rica' };
    entry.sections = [
      ...(entry.sections ?? []),
      { type: 'paragraph', content: { text_en: 'Use this directory to browse the peptide catalog by name. Open an individual product page to review its current format, specifications, listed price, and local ordering details for customers in Costa Rica.', text_es: 'Utilice este directorio para explorar el catálogo de péptidos por nombre. Abra la página de cada producto para revisar su formato, especificaciones, precio e información de pedidos locales para clientes en Costa Rica.' } },
    ];
  }
  return entry;
}
for (const [source, kind] of sources) {
  const data = JSON.parse(await readFile(new URL(`../data/pages/${source}.json`, import.meta.url), 'utf8'));
  for (const page of data.pages || []) {
    if (!page.en || pages.has(page.en) || page.slug === 'pt-141-10mgtest') continue;
    pages.set(page.en, completeRegistryPage({
      ...page,
      kind,
      group: source === 'guideBlocks' ? 'guide' : source,
    }));
  }
}

pages.set('/site-global/', JSON.parse(await readFile(new URL('../data/global.json', import.meta.url), 'utf8')));

console.log(`Prepared ${pages.size - 1} English pages and the global header/footer document.`);
if (!process.argv.includes('--write')) {
  console.log('Dry run only. Supply --write and Supabase service credentials to import.');
  process.exit(0);
}

const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const endpoint = `${base.replace(/\/$/, '')}/rest/v1/site_cms_documents?on_conflict=path,state`;
const entries = [...pages.entries()];
for (let index = 0; index < entries.length; index += 5) {
  const payload = entries.slice(index, index + 5).flatMap(([path, page]) => [
    { path, state: 'published', page },
    { path, state: 'draft', page },
  ]);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Import stopped at page ${index + 1}: ${response.status} ${await response.text()}`);
  if ((index + 5) % 50 === 0 || index + 5 >= entries.length) {
    console.log(`Imported ${Math.min(index + 5, entries.length)}/${entries.length} pages.`);
  }
}
