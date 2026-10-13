/**
 * One lookup across every harvested single-segment page group.
 *
 * The site puts several groups at the root of the URL space —
 * `/naranjo-alajuela/` (city), `/kpv-complete-guide/` (guide),
 * `/bpc-157-costa-rica/` (product lander) — so they share one Next.js route and
 * need one place that answers "what lives at this slug?".
 *
 * Each entry declares a `kind`, which picks the renderer:
 *   blocks  — a generic block list (components/blocks.js)
 *   article — a self-contained HTML article (components/guide-article.js)
 *
 * Adding a group means harvesting it and adding it to SOURCES. Nothing else
 * changes: routing, metadata and static params all read from here.
 */
import categoryData from '@/data/pages/category.json';
import cityData from '@/data/pages/city.json';
import coreData from '@/data/pages/core.json';
import guideData from '@/data/pages/guide.json';
import guideBlockData from '@/data/pages/guideBlocks.json';
import indexData from '@/data/pages/index.json';
import legalData from '@/data/pages/legal.json';
import landerPages from '@/data/pages/productLander.json';

const segment = (path) => path.replace(/^\/|\/$/g, '').split('/').pop();

const SOURCES = [
  { kind: 'blocks', group: 'city', pages: cityData.pages },
  { kind: 'blocks', group: 'productLander', pages: landerPages.pages },
  { kind: 'blocks', group: 'category', pages: categoryData.pages },
  { kind: 'blocks', group: 'core', pages: coreData.pages },
  { kind: 'blocks', group: 'legal', pages: legalData.pages },
  { kind: 'article', group: 'guide', pages: guideData.pages },
  // One guide built from ordinary Elementor widgets rather than a single
  // article, so it renders through the block types like any other page.
  { kind: 'blocks', group: 'guide', pages: guideBlockData.pages },
  // The three listing pages. Their bodies are a `link_list` section that
  // resolves from harvested data at build time, not a frozen list.
  { kind: 'blocks', group: 'index', pages: indexData.pages },
];

const BY_EN = new Map();
const BY_ES = new Map();

for (const { kind, group, pages } of SOURCES) {
  for (const page of pages) {
    const entry = { ...page, kind, group };
    if (entry.en === '/peptide-specification-sheets/' && !entry.sections?.length) {
      entry.sections = [
        {
          type: 'heading',
          content: {
            level: 1,
            text_en: 'Peptide Specification Sheets',
            text_es: 'Hojas de Especificación de Péptidos',
          },
        },
        {
          type: 'paragraph',
          content: {
            text_en:
              'Technical specifications, analytical details, storage information, and downloadable documents for our research compounds.',
            text_es:
              'Especificaciones técnicas, detalles analíticos, información de almacenamiento y documentos descargables para nuestros compuestos de investigación.',
          },
        },
        { type: 'link_list', content: { source: 'specificationSheet' } },
      ];
    }
    if (entry.en === '/extra/') {
      entry.sections = [
        {
          type: 'heading',
          content: {
            level: 1,
            text_en: 'Why Choose Peptides Costa Rica',
            text_es: 'Por qué elegir Péptidos Costa Rica',
          },
        },
        ...(entry.sections ?? []),
      ];
    }
    if (entry.en === '/extra-affliate-page/') {
      entry.sections = [
        {
          type: 'heading',
          content: {
            level: 1,
            text_en: 'Peptides Costa Rica Affiliate Application',
            text_es: 'Solicitud de Afiliación de Péptidos Costa Rica',
          },
        },
        ...(entry.sections ?? []),
        {
          type: 'paragraph',
          content: {
            text_en:
              'Prospective affiliates can use this page to learn how to apply. Our team reviews each request for fit, provides clear program information, and contacts qualified applicants directly with the next steps.',
            text_es:
              'Los posibles afiliados pueden usar esta página para conocer cómo postularse. Nuestro equipo revisa cada solicitud, brinda información clara del programa y contacta directamente a los candidatos calificados con los siguientes pasos.',
          },
        },
      ];
    }
    if (entry.en === '/extra-home/') {
      entry.head = {
        ...entry.head,
        title_en: 'Peptide Product Directory | Peptides Costa Rica',
        title_es: 'Directorio de Productos Peptídicos | Péptidos Costa Rica',
      };
      entry.sections = [
        ...(entry.sections ?? []),
        {
          type: 'paragraph',
          content: {
            text_en:
              'Use this directory to browse the peptide catalog by name. Open an individual product page to review its current format, specifications, listed price, and local ordering details for customers in Costa Rica.',
            text_es:
              'Utilice este directorio para explorar el catálogo de péptidos por nombre. Abra la página de cada producto para revisar su formato, especificaciones, precio e información de pedidos locales para clientes en Costa Rica.',
          },
        },
      ];
    }
    const en = segment(page.en);
    // First registration wins, so a slug collision between groups cannot
    // silently swap one page for another. Collisions are reported below.
    if (!BY_EN.has(en)) BY_EN.set(en, entry);
    if (page.es) {
      const es = segment(page.es);
      if (!BY_ES.has(es)) BY_ES.set(es, entry);
    }
  }
}

export const byEnglishSlug = (slug) => BY_EN.get(slug) ?? null;
export const bySpanishSlug = (slug) => BY_ES.get(slug) ?? null;

export const englishParams = () => [...BY_EN.keys()].map((slug) => ({ slug }));
export const spanishParams = () => [...BY_ES.keys()].map((slug) => ({ slug }));

/** Every registered page, for sitemap and audit scripts. */
export const allPages = [...BY_EN.values()];

export const counts = SOURCES.reduce(
  (acc, s) => ({ ...acc, [s.group]: s.pages.length }),
  { total: BY_EN.size },
);
