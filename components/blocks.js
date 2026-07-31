import Link from 'next/link';
import { Check, ExternalLink, FileText } from 'lucide-react';
import Container from '@/components/ui/container';
import FaqAccordion from '@/components/faq-accordion';
import { catalogUrl } from '@/content/global';
import { t } from '@/lib/i18n';
import { imageUrl } from '@/lib/images';
import { localePath } from '@/lib/routes';

/**
 * Renderer for the generic block vocabulary produced by the page harvesters:
 * heading · paragraph · list · button · image · card · faq.
 *
 * Deliberately generic. The 93 city pages come in three structural variants and
 * the guides and product landers are built from the same Elementor widgets, so
 * one block list renders all of them — rather than a component per template.
 *
 * As in components/sections, an unknown block type renders nothing instead of
 * crashing, so harvested data can lead the code.
 */

const listItems = (block, key, lang) => block[`${key}_${lang}`] || block[`${key}_en`] || [];

function Heading({ block, lang, demote }) {
  const text = t(block, 'text', lang);
  if (!text) return null;

  // On product pages the <h1> is already emitted by ProductSummary, so a level-1
  // heading in the harvested blocks would be a second one on the same page.
  if (demote && block.level === 1) {
    return <h2 className="mt-12 text-2xl font-bold text-primary sm:text-[1.75rem]">{text}</h2>;
  }

  // h1 opens the page; the rest are section headings within it.
  if (block.level === 1) {
    return (
      <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.75rem]">
        {text}
      </h1>
    );
  }
  const Tag = `h${Math.min(Math.max(block.level || 2, 2), 6)}`;
  const size =
    block.level === 2
      ? 'mt-12 text-2xl font-bold sm:text-[1.75rem]'
      : 'mt-8 text-lg font-semibold sm:text-xl';
  return <Tag className={`${size} text-primary`}>{text}</Tag>;
}

function Paragraph({ block, lang }) {
  const text = t(block, 'text', lang);
  if (!text) return null;
  return <p className="mt-4 text-base leading-relaxed text-text-main">{text}</p>;
}

function BlockList({ block, lang }) {
  const items = listItems(block, 'items', lang);
  if (!items.length) return null;

  if (block.icon) {
    return (
      <ul className="mt-6 flex flex-wrap gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm"
          >
            <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    );
  }

  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={`mt-4 space-y-2 pl-5 text-base leading-relaxed text-text-main ${
        block.ordered ? 'list-decimal' : 'list-disc'
      }`}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

function BlockButton({ block, lang }) {
  const text = t(block, 'text', lang);
  if (!text || !block.href) return null;
  const external = /^https?:\/\//i.test(block.href);
  const href = external ? block.href : localePath(block.href, lang);
  const className =
    'mt-8 inline-flex items-center justify-center rounded-full bg-accent px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110';

  if (external) {
    return (
      <a className={className} href={href} rel="noopener noreferrer" target="_blank">
        {text}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {text}
    </Link>
  );
}

function BlockImage({ block, lang }) {
  const src = imageUrl(block.src);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- harvested content
    // images have no known intrinsic size; next/image would need one per file.
    <img
      alt={t(block, 'alt', lang)}
      className="mt-8 h-auto w-full max-w-2xl rounded-xl"
      loading="lazy"
      src={src}
    />
  );
}

/** Consecutive `card` blocks render as one grid rather than a stack. */
function CardGrid({ blocks, lang }) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {blocks.map((block, i) => {
        const title = t(block, 'title', lang);
        const body = (
          <>
            <h3 className="text-base font-bold text-primary">{title}</h3>
            {t(block, 'text', lang) && (
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{t(block, 'text', lang)}</p>
            )}
          </>
        );
        const shell =
          'flex h-full flex-col rounded-xl border border-primary/10 bg-white p-5 shadow-sm';
        return block.href ? (
          <Link
            className={`${shell} transition hover:border-primary/30 hover:shadow-md`}
            href={localePath(block.href, lang)}
            key={`${title}-${i}`}
          >
            {body}
          </Link>
        ) : (
          <div className={shell} key={`${title}-${i}`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function Table({ block, lang }) {
  const header = block[`header_${lang}`] || block.header_en;
  const rows = block[`rows_${lang}`] || block.rows_en || [];
  if (!rows.length) return null;
  return (
    // The wrapper scrolls so a wide table never widens the page.
    <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        {header && (
          <thead>
            <tr>
              {header.map((cell, i) => (
                <th
                  className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-primary"
                  key={`${cell}-${i}`}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={`row-${r}`}>
              {row.map((cell, c) => (
                <td className="border border-slate-200 px-3 py-2 text-text-main" key={`c-${c}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tabs({ block, lang }) {
  if (!block.items?.length) return null;
  // Rendered as stacked labelled sections rather than JS tabs: every pane is
  // real content and all of it should be readable and indexable at once.
  return (
    <div className="mt-8 space-y-6">
      {block.items.map((item, i) => (
        <section key={`tab-${i}`}>
          <h3 className="text-lg font-semibold text-primary">{t(item, 'label', lang)}</h3>
          <p className="mt-2 text-base leading-relaxed text-text-main">{t(item, 'body', lang)}</p>
        </section>
      ))}
    </div>
  );
}

function Cards({ block, lang }) {
  if (!block.items?.length) return null;
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {block.items.map((item, i) => (
        <div
          className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm"
          key={`slide-${i}`}
        >
          <h3 className="text-base font-bold text-primary">{t(item, 'title', lang)}</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{t(item, 'text', lang)}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * A WooCommerce product grid, display-only.
 *
 * This project has no cart: the catalog site owns checkout and orders, so every
 * buy action links there rather than adding to a basket here. Prices are a
 * harvest-time snapshot and are labelled as indicative for that reason — the
 * catalog site is the authority on what anything costs.
 */
function ProductGrid({ block, lang }) {
  if (!block.products?.length) return null;
  const buy = catalogUrl(lang);
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {block.products.map((product) => (
        <div
          className="flex h-full flex-col rounded-xl border border-primary/10 bg-white p-4 shadow-sm"
          key={product.name}
        >
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element -- harvested
            <img
              alt={product.name}
              className="mb-3 aspect-square w-full rounded-lg object-cover"
              loading="lazy"
              src={imageUrl(product.image)}
            />
          )}
          <h3 className="text-sm font-bold text-primary">{product.name}</h3>
          {product.price && (
            <p className="mt-1 text-sm font-semibold text-accent">{product.price}</p>
          )}
          <a
            className="mt-auto inline-flex items-center justify-center gap-1 rounded-full bg-accent px-4 py-2 pt-2 text-xs font-bold text-white transition hover:brightness-110"
            href={buy}
            rel="noopener noreferrer"
            target="_blank"
          >
            {lang === 'en' ? 'View in catalog' : 'Ver en el catálogo'}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      ))}
    </div>
  );
}

/**
 * The certificate-of-analysis list on the lab-tests page: one row per product,
 * linking to its COA PDF.
 *
 * The PDFs are NOT mirrored into public/ yet, so they still resolve against
 * NEXT_PUBLIC_IMAGE_BASE — the live WordPress origin during the rebuild. They
 * must be downloaded before launch or every link here breaks at cutover.
 */
function CoaList({ block, lang }) {
  if (!block.items?.length) return null;
  return (
    <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
      {block.items.map((item) => (
        <li
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          key={item.name}
        >
          <span className="text-sm font-semibold text-primary">{item.name}</span>
          {item.pdf && (
            <a
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/5"
              href={imageUrl(item.pdf)}
              rel="noopener noreferrer"
              target="_blank"
            >
              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              {lang === 'en' ? 'Download PDF' : 'Descargar PDF'}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Faq({ block, lang }) {
  if (!block.items?.length) return null;
  // FaqAccordion is a client component and takes resolved strings, so the
  // language is applied here rather than passed down.
  const items = block.items.map((item) => ({
    q: t(item, 'q', lang),
    a: t(item, 'a', lang),
  }));
  return <FaqAccordion items={items} />;
}

const RENDERERS = {
  heading: Heading,
  paragraph: Paragraph,
  list: BlockList,
  button: BlockButton,
  image: BlockImage,
  table: Table,
  tabs: Tabs,
  cards: Cards,
  product_grid: ProductGrid,
  coa_list: CoaList,
  faq: Faq,
};

/** Block types that need the full column width rather than the prose measure. */
const WIDE = new Set(['product_grid', 'cards', 'table', 'coa_list']);

/** Collapse runs of `card` blocks into a single grid entry. */
function group(blocks) {
  const out = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    if (block.type === 'card' && last?.kind === 'cards') {
      last.blocks.push(block);
      continue;
    }
    if (block.type === 'card') out.push({ kind: 'cards', blocks: [block] });
    else out.push({ kind: 'block', block });
  }
  return out;
}

export default function Blocks({ blocks = [], lang, demoteH1 = false }) {
  if (!blocks.length) return null;
  return (
    <Container className="py-12 sm:py-16">
      {group(blocks).map((entry, i) => {
        if (entry.kind === 'cards') {
          return (
            <div className="mx-auto max-w-5xl" key={`cards-${i}`}>
              <CardGrid blocks={entry.blocks} lang={lang} />
            </div>
          );
        }
        const Renderer = RENDERERS[entry.block.type];
        if (!Renderer) return null;
        // Prose stays at a readable measure; grids and tables get more room.
        const width = WIDE.has(entry.block.type) ? 'max-w-5xl' : 'max-w-3xl';
        return (
          <div className={`mx-auto ${width}`} key={`${entry.block.type}-${i}`}>
            <Renderer block={entry.block} demote={demoteH1} lang={lang} />
          </div>
        );
      })}
    </Container>
  );
}
