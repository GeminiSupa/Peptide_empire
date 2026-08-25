import Link from 'next/link';
import { Check, CircleCheck, ExternalLink, FileText } from 'lucide-react';
import Container from '@/components/ui/container';
import CategoryTabs from '@/components/category-tabs';
import FaqAccordion from '@/components/faq-accordion';
import ProductCard from '@/components/product-card';
import ReviewWall from '@/components/review-wall';
import { ui } from '@/content/global';
import { t } from '@/lib/i18n';
import ProductList from '@/components/product-list';
import { productsFor } from '@/content/pages/categories';
import { imageSource, imageUrl, SIZES } from '@/lib/images';
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

/**
 * Presentation harvested from the widget's own Elementor rule.
 *
 * `align` and `color` are declared per widget on the live site — a centred
 * section heading and a white heading inside a navy band are both widget-level
 * rules, not container ones. See the decorate() step in scripts/lib/elementor-tree.
 *
 * `inGroup` says the block sits inside a harvested container, which supplies
 * its own spacing through the flex gap. The stacking margins below are for the
 * flat block lists that the guide harvester still produces; keeping them inside
 * a group would double every gap on the page.
 */
const align = (content) =>
  content.align === 'center' ? 'text-center' : content.align === 'right' ? 'text-right' : '';
const tint = (content) => (content.color ? { color: content.color } : undefined);

/**
 * The widget's own type scale, straight from the live stylesheet.
 *
 * Elementor sizes each heading individually and this site depends on it: an
 * <h2> is 44.2px as a section title, 24.88px as a card title and 22px in a
 * small card. Rendering all three from one Tailwind size made the clone read as
 * a different design even where the layout already matched.
 *
 * Only what the page actually declares is applied; anything absent falls
 * through to the Tailwind classes, which stay as the responsive default.
 */
const font = (content) => {
  const f = content.font;
  if (!f) return undefined;
  // Only what the page DECLARES. Returning `{ lineHeight: undefined }` for a
  // widget that sets no line-height is not the same as omitting it: spreading
  // that object erases whatever default it is merged over, which is how every
  // paragraph kept Tailwind's ratio instead of the site's 24px.
  const out = {};
  if (f.size) out.fontSize = f.size;
  if (f.weight) out.fontWeight = f.weight;
  if (f.height) out.lineHeight = f.height;
  if (f.spacing) out.letterSpacing = f.spacing;
  if (f.family) out.fontFamily = `${f.family}, var(--font-open-sans), sans-serif`;
  return out;
};

/** Harvested colour and type together, for a text block. */
const textStyle = (content) => ({ ...tint(content), ...font(content) });
const gap = (inGroup, cls) => (inGroup ? '' : cls);

/**
 * Put a run of prose back together with its links.
 *
 * The harvest reduces a paragraph to plain text so it can be paired with its
 * Spanish twin, and keeps the `<a>`s beside it as anchor text plus href. This
 * finds each anchor in the string being displayed and wraps it.
 *
 * An anchor that is not found is skipped rather than forced: on a Spanish page
 * whose anchor text the dictionary could not translate, the sentence still
 * reads correctly, it just carries no link. Scanning forward from the previous
 * match means the same word linked twice resolves to the first, then the second.
 */
function linkify(text, links, lang) {
  if (!links?.length || !text) return text;

  const out = [];
  let rest = text;
  let key = 0;

  for (const link of links) {
    const anchor = t(link, 'text', lang);
    if (!anchor) continue;
    const at = rest.indexOf(anchor);
    if (at === -1) continue;

    if (at > 0) out.push(rest.slice(0, at));
    out.push(
      <Link
        className="text-accent underline underline-offset-2 hover:no-underline"
        href={localePath(link.href, lang)}
        key={`lnk-${key}`}
      >
        {anchor}
      </Link>,
    );
    key += 1;
    rest = rest.slice(at + anchor.length);
  }

  if (!key) return text;
  if (rest) out.push(rest);
  return out;
}

function Heading({ content, lang, demote, inGroup }) {
  const text = t(content, 'text', lang);
  if (!text) return null;

  const common = `${align(content)} ${content.color ? '' : 'text-primary'}`;
  const style = textStyle(content);
  const body = linkify(text, content.links, lang);

  // A badge — the red "PEPTIDES COSTA RICA" pill over the hero headline, and
  // "BULK OFFER" on the navy panel. Both are white text, so without the fill
  // they were white on white and invisible.
  if (content.box) {
    return (
      <span
        className="inline-block w-fit self-start text-[13px] font-semibold"
        style={{
          backgroundColor: content.box.bg,
          borderRadius: content.box.radius != null ? `${content.box.radius}px` : undefined,
          padding: content.box.pad ?? '7px 21px',
          color: content.color ?? undefined,
        }}
      >
        {text}
      </span>
    );
  }

  // On product pages the <h1> is already emitted by ProductSummary, so a level-1
  // heading in the harvested blocks would be a second one on the same page.
  if (demote && content.level === 1) {
    return (
      <h2 className={`${gap(inGroup, 'mt-12')} text-2xl font-bold sm:text-[1.75rem] ${common}`} style={style}>
        {body}
      </h2>
    );
  }

  // level 0 — styled as a heading on the live site but emitted as <p>. Kept
  // non-semantic here too, so the heading outline matches the original.
  if (content.level === 0) {
    return (
      <p className={`${gap(inGroup, 'mt-8')} text-lg font-semibold sm:text-xl ${common}`} style={style}>
        {body}
      </p>
    );
  }

  // h1 opens the page; the rest are section headings within it.
  if (content.level === 1) {
    return (
      <h1
        className={`text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08] ${common}`}
        style={style}
      >
        {body}
      </h1>
    );
  }
  const Tag = `h${Math.min(Math.max(content.level || 2, 2), 6)}`;

  /**
   * The default type scale, used only when the widget declares none of its own.
   *
   * These are the live kit's values, measured: an <h2> that carries no rule of
   * its own renders at 44.2px / 700 / 1.3 / -2px on every page of the site.
   * A widget that DOES carry a rule gets it inline from `font()`, and the
   * tracking and leading here are withheld so they cannot leak onto a 24.88px
   * card title whose own rule sets neither.
   */
  const scaled = Boolean(content.font);
  const size =
    content.level === 2
      ? `${gap(inGroup, 'mt-12')} font-bold ${
          scaled ? 'text-[2rem]' : 'text-[2rem] sm:text-[44.2px] sm:tracking-[-2px]'
        }`
      : `${gap(inGroup, 'mt-8')} font-semibold ${scaled ? 'text-lg' : 'text-lg sm:text-xl'}`;

  // A section title drawn with Elementor's divider widget: the words, then a
  // rule running out to the edge of the column. "Popular Products" and "Latest
  // Product" are both this on the live site.
  if (content.rule) {
    return (
      <div className={`${gap(inGroup, 'mt-12')} flex items-center gap-4`}>
        <Tag className={`shrink-0 ${size.replace(/mt-\d+/, '')} ${common}`} style={style}>
          {body}
        </Tag>
        <span aria-hidden="true" className="h-px flex-1 bg-primary/25" />
      </div>
    );
  }

  return (
    <Tag className={`${size} ${common}`} style={style}>
      {body}
    </Tag>
  );
}

/**
 * One icon, in whichever of the two forms the live site uses.
 *
 * Font Awesome arrives as an inline `<svg>` — harvested markup from the page
 * being cloned, injected at build time, never user input. ElementsKit arrives
 * as a class naming a glyph in `elementskit.woff`, mirrored by
 * scripts/mirror-icon-font.mjs along with the `content:` rule that selects it.
 */
function Glyph({ html, name, color, className = 'mb-2 h-9 w-9' }) {
  if (html) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 [&>svg]:h-full [&>svg]:w-full ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ color: color ?? undefined, fill: color ?? undefined }}
      />
    );
  }
  if (name) {
    return (
      <i
        aria-hidden="true"
        className={`${name} inline-block shrink-0 text-[2rem] leading-none ${className}`}
        style={{ color: color ?? undefined }}
      />
    );
  }
  return null;
}

/** A standalone icon widget — the glyph above each "What We Offer" card. */
function BlockIcon({ content }) {
  return (
    <Glyph
      className={`h-9 w-9 ${content.align === 'center' ? 'mx-auto' : ''}`}
      color={content.iconColor}
      html={content.icon}
      name={content.iconClass}
    />
  );
}

/**
 * A decorative rule. Two of these flank the "AS SEEN IN" label on the home
 * page; dropped, that label floated with nothing either side of it.
 */
function Divider({ inRow }) {
  return (
    <span
      aria-hidden="true"
      className={`h-px bg-primary/25 ${inRow ? 'w-full lg:flex-1 lg:basis-0' : 'w-full'}`}
    />
  );
}

function Paragraph({ content, lang, inGroup }) {
  const text = t(content, 'text', lang);
  if (!text) return null;
  return (
    <p
      className={`${gap(inGroup, 'mt-4')} text-base ${
        content.color ? '' : 'text-text-main'
      } ${align(content)}`}
      style={{
        // The live site's body line-height is an inherited LENGTH (24px), so it
        // does not scale with the paragraph's own size — an 18px and a 20px
        // paragraph both sit on a 24px line. Tailwind's `text-base` supplies a
        // RATIO instead, which re-scaled to 27px and 30px as soon as the
        // harvested font size was applied over it.
        lineHeight: '24px',
        ...textStyle(content),
      }}
    >
      {linkify(text, content.links, lang)}
    </p>
  );
}

function BlockList({ content, lang, inGroup }) {
  const items = listItems(content, 'items', lang);
  if (!items.length) return null;

  if (content.icon) {
    // Styled from the live widget's own rule: the hero's three assurances are
    // 20px bold navy with red check marks laid out in a row; the category
    // sidebar is the same widget stacked, with red arrows. Neither is a pill —
    // the bordered white chips this used to render appear nowhere on the site.
    const inline = content.inline;
    return (
      <ul
        className={`${gap(inGroup, 'mt-6')} flex ${
          inline ? 'flex-wrap items-center gap-x-6 gap-y-3' : 'flex-col gap-3'
        }`}
      >
        {items.map((item, i) => {
          const href = content.hrefs?.[i];
          const body = (
            <>
              <CircleCheck
                aria-hidden="true"
                className="mt-0.5 h-[18px] w-[18px] shrink-0"
                style={{ color: content.iconColor ?? undefined }}
              />
              <span>{item}</span>
            </>
          );
          return (
            <li
              className={`flex items-start gap-2 font-bold ${
                content.textColor ? '' : 'text-primary'
              } ${content.transform === 'capitalize' ? 'capitalize' : ''}`}
              key={item}
              style={{ color: content.textColor ?? undefined, fontSize: content.fontSize ?? undefined }}
            >
              {href ? (
                <Link className="flex items-start gap-2 hover:underline" href={localePath(href, lang)}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
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

function BlockButton({ content, lang, inGroup }) {
  const text = t(content, 'text', lang);
  if (!text || !content.href) return null;
  const external = /^https?:\/\//i.test(content.href);
  const href = external ? content.href : localePath(content.href, lang);

  // Paint from the harvested rule when there is one. `#BD0A0D00` — an 8-digit
  // hex whose alpha byte is 00 — is Elementor's way of writing an outline
  // button, so it becomes a border rather than an invisible fill.
  const ghost = /^#[0-9a-f]{6}00$/i.test(content.bg ?? '');
  const bg = !ghost && /^#[0-9a-f]{6}$/i.test(content.bg ?? '') ? content.bg : null;

  const style = {
    backgroundColor: ghost ? 'transparent' : (bg ?? undefined),
    color: content.color ?? undefined,
    borderRadius: content.radius != null ? `${content.radius}px` : undefined,
    borderColor: ghost ? (content.color ?? undefined) : undefined,
  };

  const className = `${gap(inGroup, 'mt-8')} inline-flex w-fit items-center justify-center px-7 py-3.5 text-sm font-bold transition hover:brightness-110 ${
    ghost ? 'border' : ''
  } ${bg || ghost ? '' : 'bg-accent text-white'} ${content.radius == null ? 'rounded' : ''}`;

  if (external) {
    return (
      <a className={className} href={href} rel="noopener noreferrer" style={style} target="_blank">
        {text}
      </a>
    );
  }
  return (
    <Link className={className} href={href} style={style}>
      {text}
    </Link>
  );
}

function BlockImage({ content, lang, inGroup, inRow }) {
  const source = imageSource(content.src);
  if (!source.src) return null;

  // Inside a harvested container the column already decides how wide the image
  // is, exactly as it does on the live site — where an image widget fills its
  // column, whether that column is the 553px hero panel or a 291px card.
  //
  // `w-full` rather than the intrinsic size: as a flex item with no width and
  // no `width` attribute (Elementor's thumbnails carry neither), the image
  // resolves to a basis of zero and disappears entirely. That is what collapsed
  // the before/after photos to 0px wide.
  //
  // An image sitting DIRECTLY in a row is a column of that row, so it takes an
  // equal share instead. Left at `w-full` it claimed the whole row as its flex
  // basis and starved the text beside it to zero width — which is what happened
  // to "Our Approach to Quality" on the about page.
  if (inGroup) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- harvested asset
      <img
        alt={t(content, 'alt', lang)}
        className={`h-auto w-full max-w-full ${inRow ? 'lg:min-w-0 lg:flex-1 lg:basis-0' : ''} ${
          content.align === 'center' ? 'mx-auto' : ''
        }`}
        height={source.height || content.height || undefined}
        loading="lazy"
        sizes={source.srcSet ? SIZES.prose : undefined}
        src={source.src}
        srcSet={source.srcSet}
        width={source.width || content.width || undefined}
      />
    );
  }

  // Never scale an image UP. A press logo is 300px wide natively; rendering it
  // at a blanket max-width blew it up to 672px and dominated the page.
  //
  // The cap is now the widest MIRRORED width rather than the referenced file's,
  // because a srcset can legitimately offer more resolution than the reference.
  const widest = source.srcSet ? source.width : content.width;
  const natural = widest || null;
  const cap = natural ? Math.min(natural, 672) : 672;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- harvested asset
    <img
      alt={t(content, 'alt', lang)}
      className="mx-auto h-auto w-full rounded"
      height={source.height || content.height || undefined}
      loading="lazy"
      sizes={source.srcSet ? SIZES.prose : undefined}
      src={source.src}
      srcSet={source.srcSet}
      style={{ maxWidth: `${cap}px` }}
      width={source.width || content.width || undefined}
    />
  );
}

/**
 * One Elementor icon-box, rendered where the harvested container puts it.
 *
 * NOT a card in a grid. On the live site these are stacked entries in a column
 * — the four audiences under "Who This Is For", the three assurances in the
 * white panel of the transformation band — and the parent container already
 * decides whether they stack or sit side by side. Boxing each one and forcing
 * them into a four-across grid, as the flat pipeline did, is what turned that
 * section into a row of cramped tiles.
 */
function Card({ content, lang }) {
  const title = t(content, 'title', lang);
  const text = t(content, 'text', lang);
  if (!title && !text) return null;

  const body = (
    <>
      <Glyph color={content.iconColor} html={content.icon} name={content.iconClass} />
      {title && (
        <h3 className={`text-lg font-bold ${content.color ? '' : 'text-primary'}`} style={tint(content)}>
          {title}
        </h3>
      )}
      {text && <p className="mt-1 text-base leading-relaxed text-text-main">{text}</p>}
    </>
  );

  // Some of these boxes ARE painted on the live site — the three white panels
  // in the "Why choose us" column. That fill is harvested from the widget's own
  // container rule, so a plain icon-box stays plain and a card looks like a card.
  const boxed = content.box
    ? {
        backgroundColor: content.box.bg,
        borderRadius: content.box.radius != null ? `${content.box.radius}px` : undefined,
        padding: content.box.pad ?? undefined,
      }
    : undefined;

  return content.href ? (
    <Link
      className="block transition hover:opacity-80"
      href={localePath(content.href, lang)}
      style={boxed}
    >
      {body}
    </Link>
  ) : (
    <div style={boxed}>{body}</div>
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
  // Per-cell hrefs, in the same shape as rows. Language-independent: the paths
  // are English and localePath resolves each to its Spanish twin.
  const links = content.links ?? [];
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
              {row.map((cell, c) => {
                const href = links[r]?.[c];
                return (
                  <td className="border border-slate-200 px-3 py-2 text-text-main" key={`c-${c}`}>
                    {href ? (
                      <Link className="text-primary underline-offset-2 hover:underline" href={localePath(href, lang)}>
                        {cell}
                      </Link>
                    ) : (
                      cell
                    )}
                  </td>
                );
              })}
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
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {content.products.map((product, i) => (
        <ProductCard key={`${product.name}-${i}`} lang={lang} product={product} />
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

      {imageSource(content.image?.src).src && (
        // eslint-disable-next-line @next/next/no-img-element -- harvested asset
        <img
          alt={t(content.image, 'alt', lang)}
          className="h-auto w-full"
          sizes={SIZES.prose}
          {...imageSource(content.image.src)}
        />
      )}
    </div>
  );
}


/**
 * The "AS SEEN IN" press band: a centred rule, then each outlet's logo with its
 * link, side by side. See foldPress() in scripts/harvest-blocks.mjs for why the
 * harvested widgets have to be paired rather than rendered in document order.
 */
function PressBandBlock({ content, lang }) {
  const items = content.items ?? [];
  if (!items.length) return null;

  return (
    <section className="border-y border-slate-200 py-10">
      <div className="flex items-center justify-center gap-4">
        <span className="h-px w-12 bg-slate-300" />
        <p className="text-xs font-bold tracking-[0.18em] text-text-muted uppercase">
          {t(content, 'title', lang)}
        </p>
        <span className="h-px w-12 bg-slate-300" />
      </div>

      <div className="mt-8 grid gap-10 sm:grid-cols-2">
        {items.map((item, i) => (
          <div className="flex flex-col items-center text-center" key={`press-${i}`}>
            {imageSource(item.logo?.src).src && (
              // eslint-disable-next-line @next/next/no-img-element -- harvested
              <img
                alt={t(item.logo, 'alt', lang)}
                className="h-16 w-auto object-contain"
                loading="lazy"
                sizes="16rem"
                {...imageSource(item.logo.src)}
              />
            )}
            <p className="mt-4 text-sm text-text-muted">{t(item, 'intro', lang)}</p>
            <p className="text-sm font-bold text-primary">{t(item, 'outlet', lang)}</p>
            {item.link?.href && (
              <a
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                href={item.link.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t(item.link, 'text', lang)}
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const RENDERERS = {
  heading: Heading,
  icon: BlockIcon,
  divider: Divider,
  card: Card,
  paragraph: Paragraph,
  list: BlockList,
  button: BlockButton,
  image: BlockImage,
  table: Table,
  tabs: Tabs,
  cards: Cards,
  product_grid: ProductGrid,
  category_tabs: CategoryTabs,
  reviews: ReviewWall,
  coa_list: CoaList,
  faq: Faq,
  category_header: CategoryHeader,
  hero_split: HeroSplit,
  press_band: PressBandBlock,
  testimonials_slider: TestimonialsSlider,
  product_grid_dynamic: ProductGridDynamic,
};

/**
 * Section types that need the full column width rather than the prose measure.
 * Read by components/sections, which owns layout for the whole vocabulary.
 */
export const WIDE_TYPES = [
  'product_grid',
  'category_tabs',
  'reviews',
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
