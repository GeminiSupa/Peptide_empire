import Link from 'next/link';
import { Check, CircleCheck, ExternalLink, FileText } from 'lucide-react';
import Container from '@/components/ui/container';
import FaqAccordion from '@/components/faq-accordion';
import { catalogUrl, ui } from '@/content/global';
import { t } from '@/lib/i18n';
import ProductList from '@/components/product-list';
import { productsFor } from '@/content/pages/categories';
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

const listItems = (content, key, lang) => content[`${key}_${lang}`] || content[`${key}_en`] || [];

function Heading({ content, lang, demote }) {
  const text = t(content, 'text', lang);
  if (!text) return null;

  // On product pages the <h1> is already emitted by ProductSummary, so a level-1
  // heading in the harvested blocks would be a second one on the same page.
  if (demote && content.level === 1) {
    return <h2 className="mt-12 text-2xl font-bold text-primary sm:text-[1.75rem]">{text}</h2>;
  }

  // level 0 — styled as a heading on the live site but emitted as <p>. Kept
  // non-semantic here too, so the heading outline matches the original.
  if (content.level === 0) {
    return <p className="mt-8 text-lg font-semibold text-primary sm:text-xl">{text}</p>;
  }

  // h1 opens the page; the rest are section headings within it.
  if (content.level === 1) {
    return (
      <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl lg:text-[2.75rem]">
        {text}
      </h1>
    );
  }
  const Tag = `h${Math.min(Math.max(content.level || 2, 2), 6)}`;
  const size =
    content.level === 2
      ? 'mt-12 text-2xl font-bold sm:text-[1.75rem]'
      : 'mt-8 text-lg font-semibold sm:text-xl';
  return <Tag className={`${size} text-primary`}>{text}</Tag>;
}

function Paragraph({ content, lang }) {
  const text = t(content, 'text', lang);
  if (!text) return null;
  return <p className="mt-4 text-base leading-relaxed text-text-main">{text}</p>;
}

function BlockList({ content, lang }) {
  const items = listItems(content, 'items', lang);
  if (!items.length) return null;

  if (content.icon) {
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

  const Tag = content.ordered ? 'ol' : 'ul';
  return (
    <Tag
      className={`mt-4 space-y-2 pl-5 text-base leading-relaxed text-text-main ${
        content.ordered ? 'list-decimal' : 'list-disc'
      }`}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

function BlockButton({ content, lang }) {
  const text = t(content, 'text', lang);
  if (!text || !content.href) return null;
  const external = /^https?:\/\//i.test(content.href);
  const href = external ? content.href : localePath(content.href, lang);
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

function BlockImage({ content, lang }) {
  const src = imageUrl(content.src);
  if (!src) return null;

  // Never scale an image UP. A press logo is 300px wide natively; rendering it
  // at a blanket max-width blew it up to 672px and dominated the page.
  const natural = content.width || null;
  const cap = natural ? Math.min(natural, 672) : 672;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- harvested asset
    <img
      alt={t(content, 'alt', lang)}
      className="mx-auto h-auto w-full rounded"
      height={content.height || undefined}
      loading="lazy"
      src={src}
      style={{ maxWidth: `${cap}px` }}
      width={natural || undefined}
    />
  );
}

/** Consecutive `card` sections render as one grid rather than a stack. */
export function CardGrid({ items, lang }) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((content, i) => {
        const title = t(content, 'title', lang);
        const body = (
          <>
            <h3 className="text-base font-bold text-primary">{title}</h3>
            {t(content, 'text', lang) && (
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{t(content, 'text', lang)}</p>
            )}
          </>
        );
        const shell =
          'flex h-full flex-col rounded-xl border border-primary/10 bg-white p-5 shadow-sm';
        return content.href ? (
          <Link
            className={`${shell} transition hover:border-primary/30 hover:shadow-md`}
            href={localePath(content.href, lang)}
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

function Table({ content, lang }) {
  const header = content[`header_${lang}`] || content.header_en;
  const rows = content[`rows_${lang}`] || content.rows_en || [];
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

function Tabs({ content, lang }) {
  if (!content.items?.length) return null;
  // Rendered as stacked labelled sections rather than JS tabs: every pane is
  // real content and all of it should be readable and indexable at once.
  return (
    <div className="mt-8 space-y-6">
      {content.items.map((item, i) => (
        <section key={`tab-${i}`}>
          <h3 className="text-lg font-semibold text-primary">{t(item, 'label', lang)}</h3>
          <p className="mt-2 text-base leading-relaxed text-text-main">{t(item, 'body', lang)}</p>
        </section>
      ))}
    </div>
  );
}

function Cards({ content, lang }) {
  if (!content.items?.length) return null;
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {content.items.map((item, i) => (
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
function ProductGrid({ content, lang }) {
  if (!content.products?.length) return null;
  const buy = catalogUrl(lang);
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {content.products.map((product) => (
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
            {t(ui, 'viewInCatalog', lang)}
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
function CoaList({ content, lang }) {
  if (!content.items?.length) return null;
  return (
    <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
      {content.items.map((item) => (
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
              {t(ui, 'downloadPdf', lang)}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Faq({ content, lang }) {
  if (!content.items?.length) return null;
  // FaqAccordion is a client component and takes resolved strings, so the
  // language is applied here rather than passed down.
  const items = content.items.map((item) => ({
    q: t(item, 'q', lang),
    a: t(item, 'a', lang),
  }));
  return <FaqAccordion items={items} />;
}


/** The heading and intro of a WooCommerce category archive. */
function CategoryHeader({ content, lang }) {
  const heading = t(content, 'heading', lang);
  const intro = t(content, 'intro', lang);
  if (!heading && !intro) return null;
  return (
    <>
      {heading && (
        <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
          {heading}
        </h1>
      )}
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-text-main">{intro}</p>
      )}
    </>
  );
}

/**
 * A category's product list, resolved at RENDER time from the store harvest —
 * the section stores only which category to list, never a frozen copy of the
 * products. Moving a product between categories in WordPress and re-running
 * the store harvest updates every archive without touching page data.
 */
function ProductGridDynamic({ content, lang }) {
  const products = productsFor(content.categorySlug);
  return <ProductList emptyLabel={t(ui, 'noProducts', lang)} lang={lang} products={products} />;
}


/** Customer quotes from the product pages' slider, rendered as a static grid. */
function TestimonialsSlider({ content, lang }) {
  if (!content.items?.length) return null;
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      {content.items.map((item, i) => (
        <figure
          className="flex h-full flex-col rounded-xl border border-primary/10 bg-white p-5 shadow-sm"
          key={`quote-${i}`}
        >
          <blockquote className="text-sm leading-relaxed text-text-main">
            {t(item, 'quote', lang)}
          </blockquote>
          {(t(item, 'name', lang) || t(item, 'role', lang)) && (
            <figcaption className="mt-3 text-xs font-semibold text-text-muted">
              {t(item, 'name', lang)}
              {t(item, 'role', lang) && ` · ${t(item, 'role', lang)}`}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}


/**
 * The home hero: copy on the left, product photo on the right.
 *
 * Built to match the live page rather than harvested, because the arrangement
 * lives in Elementor's framework stylesheets — the page's own CSS carries no
 * flex-direction, grid-template-columns or container widths at all. See
 * foldHero() in scripts/harvest-blocks.mjs.
 *
 * Matched by eye against peptidescostarica.net: red badge for the eyebrow,
 * left-aligned navy h1, inline red check items with no pill borders, and a
 * solid navy rectangular call to action.
 *
 * NOT reproduced: the hexagon watermark behind the copy. Its source file
 * (Banner-Imagesz-1-e1774523007418.png) is one of the 12 images that 404 on the
 * live server, so there is nothing to serve.
 */
function HeroSplit({ content, lang }) {
  const body = content.body ?? [];
  const eyebrow = body.find((b) => b.type === 'heading' && b.content.level === 0);
  const title = body.find((b) => b.type === 'heading' && b.content.level === 1);
  const paras = body.filter((b) => b.type === 'paragraph');
  const chips = body.find((b) => b.type === 'list');
  const cta = body.find((b) => b.type === 'button');
  const items = chips ? listItems(chips.content, 'items', lang) : [];

  return (
    <div className="grid items-center gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div>
        {eyebrow && (
          <span className="inline-block rounded bg-brand-red px-3 py-1.5 text-[11px] font-bold tracking-[0.12em] text-white uppercase">
            {t(eyebrow.content, 'text', lang)}
          </span>
        )}
        {title && (
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight text-primary sm:text-5xl">
            {t(title.content, 'text', lang)}
          </h1>
        )}
        {paras[0] && (
          <p className="mt-5 text-lg leading-relaxed font-semibold text-text-main">
            {t(paras[0].content, 'text', lang)}
          </p>
        )}
        {paras[1] && (
          <p className="mt-4 text-base leading-relaxed text-text-main">
            {t(paras[1].content, 'text', lang)}
          </p>
        )}

        {items.length > 0 && (
          <ul className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
            {items.map((item) => (
              <li className="inline-flex items-center gap-2 text-base font-bold text-primary" key={item}>
                <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-red" />
                {item}
              </li>
            ))}
          </ul>
        )}

        {cta?.content.href && (
          <Link
            className="mt-8 inline-flex items-center justify-center rounded bg-primary px-7 py-4 text-sm font-bold text-white transition hover:brightness-110"
            href={localePath(cta.content.href, lang)}
          >
            {t(cta.content, 'text', lang)}
          </Link>
        )}
      </div>

      {content.image?.src && (
        // eslint-disable-next-line @next/next/no-img-element -- harvested asset
        <img
          alt={t(content.image, 'alt', lang)}
          className="h-auto w-full"
          src={imageUrl(content.image.src)}
        />
      )}
    </div>
  );
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
  category_header: CategoryHeader,
  hero_split: HeroSplit,
  testimonials_slider: TestimonialsSlider,
  product_grid_dynamic: ProductGridDynamic,
};

/**
 * Section types that need the full column width rather than the prose measure.
 * Read by components/sections, which owns layout for the whole vocabulary.
 */
export const WIDE_TYPES = [
  'product_grid',
  'cards',
  'table',
  'coa_list',
  'product_grid_dynamic',
  'testimonials_slider',
];

/**
 * The harvested half of the section vocabulary.
 *
 * Exported as a map rather than a renderer: components/sections merges it with
 * the hand-built home section types into ONE registry, so there is a single
 * renderer and a single type vocabulary for the future CMS admin to target.
 */
export const BLOCK_COMPONENTS = RENDERERS;
